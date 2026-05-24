use std::io::{Read, Write};
use std::sync::Mutex;
use portable_pty::{CommandBuilder, MasterPty, PtySize, native_pty_system};
use tauri::Emitter;

pub struct TerminalProcess {
    inner: Mutex<Option<TerminalSession>>,
}

impl TerminalProcess {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    pub fn spawn(&self, path: &str, app: tauri::AppHandle) -> Result<(), String> {
        // Kill old session without holding the lock during blocking join
        let old_session = self.inner.lock().unwrap().take();
        // Lock is released — safe to do blocking cleanup now
        drop(old_session);

        let session = create_session(path, app)?;
        *self.inner.lock().unwrap() = Some(session);
        Ok(())
    }

    pub fn write(&self, data: &str) -> Result<(), String> {
        let mut guard = self.inner.lock().unwrap();
        if let Some(ref mut session) = *guard {
            session
                .writer
                .write_all(data.as_bytes())
                .map_err(|e| format!("写入终端失败: {}", e))?;
        }
        Ok(())
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        let guard = self.inner.lock().unwrap();
        if let Some(ref session) = *guard {
            session
                .master
                .as_ref()
                .ok_or("终端未初始化")?
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("调整终端大小失败: {}", e))?;
        }
        Ok(())
    }

    pub fn kill(&self) {
        let old_session = self.inner.lock().unwrap().take();
        // Lock released — blocking cleanup below won't affect other commands
        drop(old_session);
    }
}

impl Drop for TerminalProcess {
    fn drop(&mut self) {
        // Don't call kill() — it would try to lock the already-poisoned mutex
        // during Drop. Instead, take directly.
        if let Ok(mut guard) = self.inner.lock() {
            let old_session = guard.take();
            drop(guard);
            drop(old_session);
        }
    }
}

struct TerminalSession {
    /// Option so we can drop the master PTY handle *before* joining the reader
    /// thread. On Windows (ConPTY), the reader may block indefinitely if the
    /// master handle isn't closed first.
    master: Option<Box<dyn MasterPty>>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn portable_pty::ChildKiller + Send + Sync>,
    reader_thread: Option<std::thread::JoinHandle<()>>,
}

impl Drop for TerminalSession {
    fn drop(&mut self) {
        let _ = self.killer.kill();
        // Drop the master PTY *before* joining the reader thread.
        // This closes the PTY (especially important for Windows ConPTY)
        // so the reader gets EOF/error and can exit.
        drop(self.master.take());
        if let Some(thread) = self.reader_thread.take() {
            // CRITICAL: Do NOT block the current thread joining the reader!
            // Tauri commands run on the tokio async runtime. Blocking with
            // thread.join() in Drop (called from close_terminal via state.kill())
            // hangs the async runtime, causing ALL subsequent Tauri commands
            // (get_commit_history, get_recent_repos, etc.) to silently fail.
            // The app appears frozen and can't even close properly.
            // Instead, delegate the join to a detached OS thread.
            std::thread::spawn(move || {
                let _ = thread.join();
            });
        }
    }
}

fn create_session(path: &str, app: tauri::AppHandle) -> Result<TerminalSession, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 30,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("创建伪终端失败: {}", e))?;

    #[cfg(windows)]
    let child = {
        let shells = [
            ("powershell.exe", &["-NoLogo", "-NoExit"] as &[&str]),
            ("pwsh.exe", &["-NoLogo", "-NoExit"] as &[&str]),
            ("cmd.exe", &[] as &[&str]),
        ];
        let mut last_err = "没有可用的命令行终端".to_string();
        let mut result = None;
        for &(prog, args) in &shells {
            let mut cmd = CommandBuilder::new(prog);
            for &arg in args {
                cmd.arg(arg);
            }
            cmd.cwd(path);
            match pair.slave.spawn_command(cmd) {
                Ok(c) => {
                    result = Some(c);
                    break;
                }
                Err(e) => last_err = format!("启动 {} 失败: {}", prog, e),
            }
        }
        result.ok_or(last_err)?
    };

    #[cfg(not(windows))]
    let child = {
        let shell =
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        let mut cmd = CommandBuilder::new(&shell);
        cmd.arg("-l");
        cmd.arg("-i");
        cmd.cwd(path);
        pair.slave
            .spawn_command(cmd)
            .map_err(|e| format!("启动终端失败: {}", e))?
    };

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("获取终端读取器失败: {}", e))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("获取终端写入器失败: {}", e))?;
    let killer = child.clone_killer();

    let app_clone = app.clone();
    let reader_thread = std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut reader = reader;
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = buf[..n].to_vec();
                    let _ = app_clone.emit("terminal-output", chunk);
                }
                Err(_) => break,
            }
        }
        let _ = app_clone.emit("terminal-exited", ());
    });

    // Keep the child alive so the process doesn't get killed
    // when child goes out of scope
    let _child = child;

    let mut session = TerminalSession {
        master: Some(pair.master),
        writer,
        killer,
        reader_thread: Some(reader_thread),
    };

    // Send initial newline to trigger the shell prompt
    let _ = session.writer.write_all(b"\r\n");

    Ok(session)
}
