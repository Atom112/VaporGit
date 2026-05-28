import { createStore } from 'solid-js/store';

export interface TutorialState {
  active: boolean;
  currentStep: number;
  demoRepoPath: string | null;
  totalSteps: number;
}

const initialState: TutorialState = {
  active: false,
  currentStep: 0,
  demoRepoPath: null,
  totalSteps: 9, // steps 0-8, plus the "complete" state at the end
};

const [tutorialStore, setTutorialStore] = createStore<TutorialState>({ ...initialState });

export function startTutorial() {
  setTutorialStore({ active: true, currentStep: 0 });
}

export function stopTutorial() {
  setTutorialStore({ ...initialState });
}

export function nextStep() {
  setTutorialStore((s) => ({
    currentStep: Math.min(s.currentStep + 1, s.totalSteps),
  }));
}

export function prevStep() {
  setTutorialStore((s) => ({
    currentStep: Math.max(s.currentStep - 1, 0),
  }));
}

export function setDemoRepoPath(path: string) {
  setTutorialStore({ demoRepoPath: path });
}

export { tutorialStore };
