import { describe, expect, it } from 'vitest';
import {
  repositoryStore,
  resetRepositoryViewState,
  setRepositoryLeftMode,
  setRepositoryLoading,
  setRepositoryModal,
  setRepositoryRightWidth,
} from '../repositoryStore';

describe('repositoryStore', () => {
  it('updates modal, loading, and panel state', () => {
    resetRepositoryViewState();

    setRepositoryLeftMode('diff');
    setRepositoryRightWidth(999);
    setRepositoryModal('push', true);
    setRepositoryLoading('graphMore', true);

    expect(repositoryStore.panels.leftMode).toBe('diff');
    expect(repositoryStore.panels.rightWidth).toBe(500);
    expect(repositoryStore.modals.push).toBe(true);
    expect(repositoryStore.loading.graphMore).toBe(true);
  });
});
