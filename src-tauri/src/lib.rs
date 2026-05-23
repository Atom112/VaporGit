mod commands;
mod git;
mod github;
mod models;

use commands::branch::{checkout_branch, checkout_remote_branch, create_branch, delete_branch, get_branch_list};
use commands::commit::{cherry_pick, commit, get_commit_detail, get_commit_graph, get_commit_history, rebase, undo, redo};
use commands::diff::{check_lfs, get_file_base64, get_file_content, get_file_diff};
use commands::remote::{fetch, get_remotes, pull, push};
use commands::repo::{check_submodules, clone_repo, get_conflicts, get_recent_repos, get_status, init_repo, open_repo, remove_recent_repo, resolve_conflict, save_repo_path, stage_files, unstage_files};
use commands::stash::{stash_apply, stash_drop, stash_list, stash_pop, stash_save};
use commands::github::{
    check_update, github_check_auth, github_create_pull, github_create_pull_comment,
    github_create_repo, github_get_asset, github_get_pull, github_get_pull_diff,
    github_get_pull_files, github_get_repo, github_get_user, github_install_update,
    github_list_branches, github_list_pull_comments, github_list_pulls, github_list_repos,
    github_login, github_logout, github_merge_pull, github_start_download, push_to_github,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // repo
            open_repo,
            init_repo,
            clone_repo,
            check_submodules,
            get_recent_repos,
            remove_recent_repo,
            save_repo_path,
            get_status,
            stage_files,
            unstage_files,
            // commit
            commit,
            get_commit_history,
            get_commit_detail,
            get_commit_graph,
            rebase,
            cherry_pick,
            // undo/redo
            undo,
            redo,
            // diff
            get_file_diff,
            get_file_content,
            get_file_base64,
            check_lfs,
            // branch
            get_branch_list,
            create_branch,
            checkout_branch,
            checkout_remote_branch,
            delete_branch,
            // remote
            fetch,
            pull,
            push,
            get_remotes,
            // stash
            stash_save,
            stash_list,
            stash_pop,
            stash_apply,
            stash_drop,
            // conflict
            get_conflicts,
            resolve_conflict,
            // github
            check_update,
            github_get_asset,
            github_start_download,
            github_install_update,
            github_login,
            github_check_auth,
            github_logout,
            github_get_user,
            github_list_repos,
            github_get_repo,
            github_create_repo,
            github_list_branches,
            push_to_github,
            github_list_pulls,
            github_get_pull,
            github_create_pull,
            github_merge_pull,
            github_get_pull_files,
            github_get_pull_diff,
            github_list_pull_comments,
            github_create_pull_comment,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}