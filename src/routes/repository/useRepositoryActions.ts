import type { Accessor } from 'solid-js';
import { diffStore } from '../../stores/diffStore';
import { settingsStore } from '../../stores/settingsStore';
import { addToast } from '../../stores/toastStore';
import { fetch as fetchRemote, pull as pullRemote, redo as redoLast, undo as undoLast } from '../../lib/tauriCommands';
import { describeError } from '../../lib/gitErrorDesc';
import { tt, ttf } from '../../i18n';
import { useRepositoryModals } from './useRepositoryModals';

interface RepositoryActionsParams {
  repoPath: Accessor<string | null>;
  refreshAll: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshGraph: (silent?: boolean) => Promise<void>;
  openConflictResolver: () => void;
}

export function useRepositoryActions(params: RepositoryActionsParams) {
  const {
    remoteActionLoading,
    setRemoteActionLoading,
    undoLoading,
    setUndoLoading,
  } = useRepositoryModals();

  const handleFetch = async () => {
    const path = params.repoPath();
    if (!path || remoteActionLoading()) return;
    setRemoteActionLoading(true);
    try {
      await fetchRemote(path, settingsStore.defaultRemoteName);
      addToast(tt('repo.fetchSuccess'), 'success');
      await params.refreshGraph(true);
    } catch (e) {
      addToast(ttf('repo.fetchFailed', describeError(e)), 'error');
    } finally {
      setRemoteActionLoading(false);
    }
  };

  const handlePull = async () => {
    const path = params.repoPath();
    if (!path || remoteActionLoading()) return;
    setRemoteActionLoading(true);
    try {
      const result = await pullRemote(path, settingsStore.defaultRemoteName);
      await params.refreshAll();
      const hasConflicts = diffStore.fileStatuses.some((file) => file.status === 'CONFLICTED');
      if (hasConflicts) {
        addToast(tt('repo.conflictPullDetected'), 'info');
        params.openConflictResolver();
      } else {
        addToast(result, 'success');
      }
    } catch (e) {
      addToast(ttf('repo.pullFailed', describeError(e)), 'error');
      await params.refreshStatus();
      if (diffStore.fileStatuses.some((file) => file.status === 'CONFLICTED')) {
        params.openConflictResolver();
      }
    } finally {
      setRemoteActionLoading(false);
    }
  };

  const handleUndo = async () => {
    const path = params.repoPath();
    if (!path || undoLoading()) return;
    setUndoLoading(true);
    try {
      const msg = await undoLast(path);
      addToast(ttf('repo.undoCommitSuccess', msg.slice(0, 50)), 'success');
      await params.refreshAll();
    } catch (e) {
      addToast(ttf('repo.undoFailed', describeError(e)), 'error');
    } finally {
      setUndoLoading(false);
    }
  };

  const handleRedo = async () => {
    const path = params.repoPath();
    if (!path || undoLoading()) return;
    setUndoLoading(true);
    try {
      const msg = await redoLast(path);
      addToast(ttf('repo.redoCommitSuccess', msg.slice(0, 50)), 'success');
      await params.refreshAll();
    } catch (e) {
      addToast(ttf('repo.redoFailed', describeError(e)), 'error');
    } finally {
      setUndoLoading(false);
    }
  };

  return {
    handleFetch,
    handlePull,
    handleUndo,
    handleRedo,
  };
}
