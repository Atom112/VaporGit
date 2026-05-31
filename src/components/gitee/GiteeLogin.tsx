import { giteeStore, setGiteeStore, setGiteeAuthenticated, resetGiteeLogin } from '../../stores/giteeStore';
import { clearAuth } from '../../stores/githubStore';
import { giteeLogin, githubLogout } from '../../lib/tauriCommands';
import { describeError } from '../../lib/gitErrorDesc';

const GiteeLogin = () => {
  const startLogin = async () => {
    setGiteeStore({ loginPhase: 'authorizing', error: null, loading: true });
    // Logout GitHub first — platforms are mutually exclusive
    try { await githubLogout(); } catch { /* ignore */ }
    clearAuth();
    try {
      const user = await giteeLogin();
      setGiteeAuthenticated(user);
    } catch (err) {
      setGiteeStore({
        loginPhase: 'error',
        error: describeError(err),
        loading: false,
      });
    }
  };

  return (
    <div>
      {giteeStore.loginPhase === 'idle' && (
        <button
          onClick={startLogin}
          class="w-full flex items-center justify-center gap-3 p-3 rounded-xl bg-[#c71d23] hover:bg-[#a8171c] text-white text-sm font-medium transition-colors"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.593.593 0 0 0-.592-.593h-4.15a.592.592 0 0 1-.592-.592v-1.482a.593.593 0 0 1 .593-.592h6.815c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.445-4.444h8.296z" />
          </svg>
          使用 Gitee 登录
        </button>
      )}

      {(giteeStore.loginPhase === 'authorizing') && (
        <div class="flex items-center gap-2 text-sm text-gray-400">
          <div class="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          正在打开授权窗口...
        </div>
      )}

      {giteeStore.loginPhase === 'error' && (
        <div class="space-y-2">
          <p class="text-sm text-red-400 rounded-xl bg-red-500/10 border border-red-500/30 p-3">{giteeStore.error}</p>
          <button
            onClick={resetGiteeLogin}
            class="p-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
};

export default GiteeLogin;
