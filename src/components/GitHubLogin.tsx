import { githubStore, setGithubStore, setAuthenticated, resetLogin } from '../stores/githubStore';
import { githubLogin } from '../lib/tauriCommands';

const GitHubLogin = () => {
  const startLogin = async () => {
    setGithubStore({ loginPhase: 'authorizing', error: null, loading: true });
    try {
      const user = await githubLogin();
      setAuthenticated(user);
    } catch (err) {
      setGithubStore({
        loginPhase: 'error',
        error: String(err),
        loading: false,
      });
    }
  };

  return (
    <div>
      {githubStore.loginPhase === 'idle' && (
        <button
          onClick={startLogin}
          class="w-full flex items-center justify-center gap-3 p-3 rounded-xl bg-[#24292f] hover:bg-[#2c3138] text-white text-sm font-medium transition-colors"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          使用 GitHub 登录
        </button>
      )}

      {(githubStore.loginPhase === 'authorizing') && (
        <div class="flex items-center gap-2 text-sm text-gray-400">
          <div class="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          正在打开授权窗口...
        </div>
      )}

      {githubStore.loginPhase === 'error' && (
        <div class="space-y-2">
          <p class="text-sm text-red-400">{githubStore.error}</p>
          <button
            onClick={resetLogin}
            class="p-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
};

export default GitHubLogin;
