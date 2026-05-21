import { createStore } from 'solid-js/store';
import type { CommitGraphData, GraphNode, BranchInfo } from '../lib/types';

export interface CommitState {
  graphData: CommitGraphData | null;
  branches: BranchInfo[];
  selectedNode: GraphNode | null;
  graphLoading: boolean;
  branchesLoading: boolean;
}

const [commitStore, setCommitStore] = createStore<CommitState>({
  graphData: null,
  branches: [],
  selectedNode: null,
  graphLoading: false,
  branchesLoading: false,
});

export function useCommitStore() {
  return { commitStore, setCommitStore };
}

export { commitStore, setCommitStore };
