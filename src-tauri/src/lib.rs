mod commands;
mod git;
mod github;
mod gitee;
mod models;
mod oauth;
mod remote_url;
mod terminal;

use commands::branch::{checkout_branch, checkout_remote_branch, compare_branches, create_branch, delete_branch, delete_remote_branch, get_branch_list};
use commands::commit::{amend_commit, cherry_pick, commit, get_commit_detail, get_commit_graph, get_commit_history, list_rebase_commits, perform_interactive_rebase, rebase, revert_commit, search_commit_history, undo, redo};
use commands::tag::{create_tag, delete_tag, list_tags};
use commands::terminal::{close_terminal, open_terminal, resize_terminal, write_terminal};
use commands::diff::{check_lfs, get_file_base64, get_file_content, get_file_diff};
use commands::remote::{add_remote, delete_remote, fetch, get_remotes, pull, push, push_with_auto_create, set_remote_url};
use commands::repo::{check_submodules, clone_repo, discard_files, get_conflict_blocks, get_conflict_content, get_conflicts, get_recent_repos, get_status, init_repo, open_repo, remove_recent_repo, resolve_conflict, resolve_conflict_blocks, save_repo_path, stage_files, unstage_files};
use commands::splashscreen::close_splashscreen;
use commands::stash::{stash_apply, stash_drop, stash_list, stash_pop, stash_save};
use commands::tutorial::{create_demo_repo, delete_dir};
use commands::merge::merge_branch;
use commands::stage::{stage_hunk, stage_line};
use commands::git_ext::{
    get_reflog, git_blame, lfs_pull, lfs_track, lfs_untrack, submodule_add, submodule_init,
    submodule_update, test_ssh_connection,
};
use commands::github::{
    check_update, github_check_auth, github_create_pull, github_create_pull_comment,
    github_create_repo, github_get_asset, github_get_pull, github_get_pull_diff,
    github_get_pull_files, github_get_repo, github_get_user, github_install_update,
    github_list_branches, github_list_pull_comments, github_list_pulls, github_list_repos,
    github_login, github_logout, github_merge_pull, github_start_download, push_to_github,
};
use commands::gitee::{
    gitee_check_auth, gitee_create_pull, gitee_create_repo, gitee_get_pull, gitee_get_pull_diff,
    gitee_get_pull_files, gitee_get_repo, gitee_get_user, gitee_list_branches,
    gitee_list_pull_comments, gitee_list_pulls, gitee_list_repos, gitee_login, gitee_logout,
    gitee_merge_pull,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(terminal::TerminalProcess::new())
        .invoke_handler(tauri::generate_handler![
            // splashscreen
            close_splashscreen,
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
            amend_commit,
            get_commit_history,
            search_commit_history,
            get_commit_detail,
            get_commit_graph,
            rebase,
            list_rebase_commits,
            perform_interactive_rebase,
            cherry_pick,
            // undo/redo
            undo,
            redo,
            // revert
            revert_commit,
            // tag
            create_tag,
            list_tags,
            delete_tag,
            // terminal
            open_terminal,
            write_terminal,
            resize_terminal,
            close_terminal,
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
            delete_remote_branch,
            compare_branches,
            // remote
            fetch,
            pull,
            push,
            push_with_auto_create,
            get_remotes,
            add_remote,
            set_remote_url,
            delete_remote,
            // merge
            merge_branch,
            // stage hunk/line
            stage_hunk,
            stage_line,
            // extended git operations
            submodule_add,
            submodule_init,
            submodule_update,
            git_blame,
            get_reflog,
            lfs_pull,
            lfs_track,
            lfs_untrack,
            test_ssh_connection,
            // stash
            stash_save,
            stash_list,
            stash_pop,
            stash_apply,
            stash_drop,
            // conflict
            get_conflicts,
            get_conflict_content,
            resolve_conflict,
            get_conflict_blocks,
            resolve_conflict_blocks,
            // discard
            discard_files,
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
            // gitee
            gitee_login,
            gitee_check_auth,
            gitee_logout,
            gitee_get_user,
            gitee_list_repos,
            gitee_get_repo,
            gitee_create_repo,
            gitee_list_branches,
            gitee_list_pulls,
            gitee_get_pull,
            gitee_create_pull,
            gitee_merge_pull,
            gitee_get_pull_files,
            gitee_get_pull_diff,
            gitee_list_pull_comments,
            // tutorial
            create_demo_repo,
            delete_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
