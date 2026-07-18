import { giteeStore, setGiteeStore, setGiteeAuthenticated, resetGiteeLogin } from '../../stores/giteeStore';
import { clearAuth } from '../../stores/githubStore';
import { giteeLogin, githubLogout } from '../../lib/tauriCommands';
import { describeError } from '../../lib/gitErrorDesc';
import PlatformLogin from '../platform/PlatformLogin';

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
    <PlatformLogin
      kind="gitee"
      phase={giteeStore.loginPhase}
      error={giteeStore.error}
      onLogin={startLogin}
      onRetry={resetGiteeLogin}
    />
  );
};

export default GiteeLogin;
