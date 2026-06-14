import { Component, createSignal, onCleanup } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { getPlatformAdapter, PlatformKind, PlatformUser } from '../../lib/platformAdapter';
import { tt } from '../../i18n';

interface PlatformUserMenuProps {
  kind: PlatformKind;
  user: PlatformUser;
  onClearAuth: () => void;
}

const fallbackColor: Record<PlatformKind, string> = {
  github: 'bg-cyan-500/20 text-cyan-400',
  gitee: 'bg-red-500/20 text-red-400',
};

const PlatformUserMenu: Component<PlatformUserMenuProps> = (props) => {
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);
  const menuAttr = `data-${props.kind}-menu`;

  const logout = async () => {
    try {
      await getPlatformAdapter(props.kind).logout();
    } catch (e) {
      console.error(`${props.kind} logout failed`, e);
    }
    props.onClearAuth();
    setOpen(false);
  };

  const handleSwitch = async () => {
    await logout();
    navigate('/settings');
  };

  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(`[${menuAttr}]`)) {
      setOpen(false);
    }
  };

  if (typeof window !== 'undefined') {
    document.addEventListener('click', handleClickOutside);
    onCleanup(() => document.removeEventListener('click', handleClickOutside));
  }

  const displayName = () => props.user.name ?? props.user.login;

  return (
    <div class="relative" {...{ [menuAttr]: true }}>
      <button
        onClick={() => setOpen(!open())}
        class="flex items-center gap-2 p-1 rounded-lg hover:bg-white/10 transition-colors"
        title={props.user.login}
        aria-label={props.user.login}
      >
        {props.user.avatarUrl ? (
          <img
            src={props.user.avatarUrl}
            alt={props.user.login}
            class="w-7 h-7 rounded-full"
          />
        ) : (
          <div class={`w-7 h-7 rounded-full flex items-center justify-center ${fallbackColor[props.kind]}`}>
            <span class="text-xs font-medium">
              {props.user.login.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        )}
      </button>

      {open() && (
        <div class="absolute right-0 top-full mt-1 w-52 p-2 rounded-xl bg-[#505054]/95 backdrop-blur-xl border border-white/15 shadow-2xl z-50 animate-context-menu-enter">
          <div class="px-2 py-1.5 border-b border-white/10 mb-1">
            <p class="text-sm text-white font-medium truncate">{displayName()}</p>
            <p class="text-xs text-gray-400 truncate">{props.user.login}</p>
          </div>
          <button
            onClick={handleSwitch}
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            {tt('settings.switchAccount')}
          </button>
          <button
            onClick={logout}
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {tt(`${props.kind}.logout`)}
          </button>
        </div>
      )}
    </div>
  );
};

export default PlatformUserMenu;
