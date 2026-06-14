import { githubStore, setGithubStore, setAuthenticated, resetLogin } from '../../stores/githubStore';
import { clearGiteeAuth } from '../../stores/giteeStore';
import { githubLogin, giteeLogout } from '../../lib/tauriCommands';
import { describeError } from '../../lib/gitErrorDesc';
import PlatformLogin from '../platform/PlatformLogin';

const GitHubLogin = () => {
  const startLogin = async () => {
    setGithubStore({ loginPhase: 'authorizing', error: null, loading: true });
    // Logout Gitee first — platforms are mutually exclusive
    try { await giteeLogout(); } catch { /* ignore */ }
    clearGiteeAuth();
    try {
      const user = await githubLogin();
      setAuthenticated(user);
    } catch (err) {
      setGithubStore({
        loginPhase: 'error',
        error: describeError(err),
        loading: false,
      });
    }
  };

  return (
    <PlatformLogin
      kind="github"
      phase={githubStore.loginPhase}
      error={githubStore.error}
      onLogin={startLogin}
      onRetry={resetLogin}
    />
  );
};

export default GitHubLogin;
