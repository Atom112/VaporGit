import { Component, onMount } from 'solid-js';
import { A } from '@solidjs/router';
import { githubStore, setGithubStore, setAuthenticated } from '../stores/githubStore';
import { githubCheckAuth } from '../lib/tauriCommands';
import GitHubUserMenu from './GitHubUserMenu';
import { repoStore } from '../stores/repoStore';

const Navbar: Component = () => {
  onMount(async () => {
    if (!githubStore.authenticated && !githubStore.loading) {
      setGithubStore({ loading: true });
      try {
        const status = await githubCheckAuth();
        if (status.authenticated && status.user) {
          setAuthenticated(status.user);
        }
      } catch {
        // ignore
      } finally {
        setGithubStore({ loading: false });
      }
    }
  });

  return (
    <nav class="flex items-center justify-center pl-4 pr-4 pb-1 pt-1 bg-transparent">
      <ul class="flex items-center gap-1" data-tauri-no-drag>
        <li>
          <A
            class="flex items-center justify-center w-9 h-9 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            activeClass="!text-cyan-400 !bg-cyan-400/15"
            href="/"
            end
            title="主页"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </A>
        </li>
        <li>
          <A
            class="flex items-center justify-center w-9 h-9 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            activeClass="!text-cyan-400 !bg-cyan-400/15"
            href="/repository"
            title="仓库"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 22V12l3 2 3-2v10" />
            </svg>
          </A>
        </li>
        <li>
          <A
            class="flex items-center justify-center w-9 h-9 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            activeClass="!text-cyan-400 !bg-cyan-400/15"
            href="/settings"
            title="设置"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </A>
        </li>
        {githubStore.authenticated && repoStore.repoPath && (
          <li>
            <A
              class="flex items-center justify-center w-9 h-9 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              activeClass="!text-cyan-400 !bg-cyan-400/15"
              href="/pulls"
              title="Pull Requests"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </A>
          </li>
        )}
      </ul>

      {/* Right side: GitHub user menu */}
      <div class="flex items-center absolute right-4" data-tauri-no-drag>
        {githubStore.authenticated && githubStore.user && (
          <GitHubUserMenu />
        )}
      </div>
    </nav>
  );
};

export default Navbar;
