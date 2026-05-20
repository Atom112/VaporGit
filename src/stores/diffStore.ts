import { createStore } from 'solid-js/store';
import type { DiffResult, FileStatus } from '../lib/types';

export interface DiffState {
  fileStatuses: FileStatus[];
  selectedFile: string | null;
  diffResult: DiffResult | null;
  diffLoading: boolean;
  viewMode: 'unified' | 'fullFile';
}

const [diffStore, setDiffStore] = createStore<DiffState>({
  fileStatuses: [],
  selectedFile: null,
  diffResult: null,
  diffLoading: false,
  viewMode: 'unified',
});

export function useDiffStore() {
  return { diffStore, setDiffStore };
}

export { diffStore, setDiffStore };