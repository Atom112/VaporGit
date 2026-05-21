mod commands;
mod git;
mod models;

use commands::branch::{create_branch, checkout_branch, delete_branch, get_branch_list};
use commands::commit::{commit, get_commit_detail, get_commit_graph, get_commit_history};
use commands::diff::{get_file_content, get_file_diff};
use commands::remote::{fetch, pull, push};
use commands::repo::{get_recent_repos, get_status, open_repo, save_repo_path, stage_files, unstage_files};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // repo
            open_repo,
            get_recent_repos,
            save_repo_path,
            get_status,
            stage_files,
            unstage_files,
            // commit
            commit,
            get_commit_history,
            get_commit_detail,
            get_commit_graph,
            // diff
            get_file_diff,
            get_file_content,
            // branch
            get_branch_list,
            create_branch,
            checkout_branch,
            delete_branch,
            // remote
            fetch,
            pull,
            push,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}