import { Component, createSignal } from 'solid-js';
import { tt } from '../../i18n';
import { startTutorial } from '../../stores/tutorialStore';
import { dismissTutorial, completeTutorial } from '../../stores/settingsStore';

interface Props {
  onClose: () => void;
}

const WelcomeDialog: Component<Props> = (props) => {
  const [dontShow, setDontShow] = createSignal(false);

  const handleStart = () => {
    if (dontShow()) completeTutorial();
    startTutorial();
    props.onClose();
  };

  const handleSkip = () => {
    if (dontShow()) completeTutorial();
    else dismissTutorial();
    props.onClose();
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div class="w-96 rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl animate-modal-enter">
        <div class="p-6 space-y-4">
          <div class="text-center">
            <h2 class="text-lg font-bold text-white">{tt('tutorial.welcome')}</h2>
            <p class="text-sm text-gray-300 mt-2 leading-relaxed">{tt('tutorial.welcomeDesc')}</p>
          </div>

          <div class="space-y-2">
            <button
              class="w-full py-2.5 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 text-sm font-medium transition-colors"
              onClick={handleStart}
            >
              {tt('tutorial.start')}
            </button>
            <button
              class="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
              onClick={handleSkip}
            >
              {tt('tutorial.skip')}
            </button>
          </div>

          <label class="flex items-center justify-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShow()}
              onChange={(e) => setDontShow(e.currentTarget.checked)}
              class="rounded bg-white/10 border-white/20"
            />
            {tt('tutorial.dontShowAgain')}
          </label>
        </div>
      </div>
    </div>
  );
};

export default WelcomeDialog;
