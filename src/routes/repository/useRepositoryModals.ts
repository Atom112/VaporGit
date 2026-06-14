import { repositoryStore, setRepositoryLoading, setRepositoryModal } from '../../stores/repositoryStore';

export function useRepositoryModals() {
  return {
    remoteActionLoading: () => repositoryStore.loading.remoteAction,
    setRemoteActionLoading: (loading: boolean) => setRepositoryLoading('remoteAction', loading),
    undoLoading: () => repositoryStore.loading.undo,
    setUndoLoading: (loading: boolean) => setRepositoryLoading('undo', loading),
    showStashPanel: () => repositoryStore.modals.stash,
    setShowStashPanel: (open: boolean) => setRepositoryModal('stash', open),
    showConflictResolver: () => repositoryStore.modals.conflictResolver,
    setShowConflictResolver: (open: boolean) => setRepositoryModal('conflictResolver', open),
    showRebaseDialog: () => repositoryStore.modals.rebase,
    setShowRebaseDialog: (open: boolean) => setRepositoryModal('rebase', open),
    showMergeDialog: () => repositoryStore.modals.merge,
    setShowMergeDialog: (open: boolean) => setRepositoryModal('merge', open),
    showRemoteManager: () => repositoryStore.modals.remoteManager,
    setShowRemoteManager: (open: boolean) => setRepositoryModal('remoteManager', open),
    showBranchCompare: () => repositoryStore.modals.branchCompare,
    setShowBranchCompare: (open: boolean) => setRepositoryModal('branchCompare', open),
    showPushDialog: () => repositoryStore.modals.push,
    setShowPushDialog: (open: boolean) => setRepositoryModal('push', open),
    showGitTools: () => repositoryStore.modals.gitTools,
    setShowGitTools: (open: boolean) => setRepositoryModal('gitTools', open),
  };
}
