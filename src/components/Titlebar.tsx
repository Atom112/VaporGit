import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import { getCurrentWindow } from '@tauri-apps/api/window';

const Titlebar: Component = () => {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = createSignal(false);
  const windowControlClass = 'h-full px-4 bg-transparent text-gray-100 transition-colors flex items-center justify-center cursor-default border-0 rounded-lg shadow-none';

  onMount(() => {
    appWindow.isMaximized().then(setIsMaximized);

    const unlistenPromise = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });

    onCleanup(() => {
      unlistenPromise.then((unlisten) => unlisten());
    });
  });

  const handleMinimize = async () => await appWindow.minimize(); // 最小化窗口
  
  const handleToggleMaximize = async () => { // 切换最大化/还原窗口
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };
  
  const handleClose = async () => await appWindow.close(); // 关闭窗口

  return (
    <div 
      class="h-9 flex select-none items-center justify-between bg-white/5 border-b border-white/10 shrink-0"
    >
      <div data-tauri-drag-region class="px-2 text-xs tracking-wider text-gray-300 font-semibold flex-1 flex items-center gap-2 h-full">
        <img src="/logo/VaporGit.svg" alt="VaporGit Logo" class="w-5 h-5 pointer-events-none" />
        VaporGit
      </div>
      <div class="flex h-full" data-tauri-no-drag>
        <button
          class={`${windowControlClass} hover:bg-white/10`}
          onClick={handleMinimize}
          title="最小化"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
        </button>
        <button
          class={`${windowControlClass} hover:bg-white/10`}
          onClick={handleToggleMaximize}
          title={isMaximized() ? "向下还原" : "最大化"}
        >
          {isMaximized()
            ? <svg class="w-3 h-3" viewBox="0 0 1024 1024" fill="currentColor">
                <path d="M917.3 41.9H302.2c-34.8-0.1-63.2 28-63.3 62.8v131.1H106.6c-34.8-0.1-63.2 28-63.3 62.8v617.6c0.2 34.8 28.5 63 63.3 62.8h615.1c34.8 0.1 63.1-28 63.3-62.8v-131h132.2c34.8 0.1 63.2-28 63.3-62.8V104.7c0-34.8-28.4-62.9-63.2-62.8zM714.8 909.4H113.6V305.7h601l0.2 603.7z m195.5-194.1H785.1V298.4c-0.2-34.8-28.5-62.9-63.3-62.8H309.2V111.3h601l0.1 604z"></path>
              </svg>
            : <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h16v16H4z"></path>
              </svg>}

        </button>
        <button
          class={`${windowControlClass} hover:bg-red-600 hover:text-white`}
          onClick={handleClose}
          title="关闭"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
    </div>
  );
};

export default Titlebar;