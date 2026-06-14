fn main() {
    #[cfg(target_os = "windows")]
    println!("cargo:rustc-link-lib=Advapi32");

    tauri_build::build()
}
