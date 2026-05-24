use crate::terminal::TerminalProcess;
use tauri::AppHandle;
use tauri::State;

#[tauri::command]
pub async fn open_terminal(
    state: State<'_, TerminalProcess>,
    app: AppHandle,
    path: String,
) -> Result<(), String> {
    state.spawn(&path, app)
}

#[tauri::command]
pub async fn write_terminal(
    state: State<'_, TerminalProcess>,
    data: String,
) -> Result<(), String> {
    state.write(&data)
}

#[tauri::command]
pub async fn resize_terminal(
    state: State<'_, TerminalProcess>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.resize(cols, rows)
}

#[tauri::command]
pub async fn close_terminal(state: State<'_, TerminalProcess>) -> Result<(), String> {
    state.kill();
    Ok(())
}
