import { Component, createSignal, onCleanup } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { githubStore, clearAuth } from '../../stores/githubStore';
import { githubLogout } from '../../lib/tauriCommands';
import { tt } from '../../i18n';

const GitHubUserMenu: Component = () => {
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);

  const handleLogout = async () => {
    try {
      await githubLogout();
    } catch {
      // ignore
    }
    clearAuth();
    setOpen(false);
  };

  const handleSwitch = async () => {
    try {
      await githubLogout();
    } catch {
      // ignore
    }
    clearAuth();
    setOpen(false);
    navigate('/settings');
  };

  // Close dropdown when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-github-menu]')) {
      setOpen(false);
    }
  };
  if (typeof window !== 'undefined') {
    document.addEventListener('click', handleClickOutside);
    onCleanup(() => document.removeEventListener('click', handleClickOutside));
  }

  const user = () => githubStore.user;

  return (
    <div class="relative" data-github-menu>
      <button
        onClick={() => setOpen(!open())}
        class="flex items-center gap-2 p-1 rounded-lg hover:bg-white/10 transition-colors"
        title={user()?.login ?? ''}
      >
        {user()?.avatarUrl ? (
          <img
            src={user()!.avatarUrl}
            alt={user()!.login}
            class="w-7 h-7 rounded-full"
          />
        ) : (
          <div class="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <span class="text-xs text-cyan-400 font-medium">
              {user()?.login?.charAt(0).toUpperCase() ?? '?'}
            </span>
          </div>
        )}
      </button>

      {open() && (
        <div class="absolute right-0 top-full mt-1 w-52 p-2 rounded-xl bg-[#505054]/95 backdrop-blur-xl border border-white/15 shadow-2xl z-50 animate-context-menu-enter">
          <div class="px-2 py-1.5 border-b border-white/10 mb-1">
            <p class="text-sm text-white font-medium truncate">{user()?.name ?? user()?.login}</p>
            <p class="text-xs text-gray-400 truncate">{user()?.login}</p>
          </div>
          <button
            onClick={handleSwitch}
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            {tt('settings.switchAccount')}
          </button>
          <button
            onClick={handleLogout}
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {tt('github.logout')}
          </button>
        </div>
      )}
    </div>
  );
};

export default GitHubUserMenu;
