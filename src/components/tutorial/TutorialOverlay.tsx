import { Component, createEffect, createSignal, Show, onCleanup } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { tutorialStore, nextStep, prevStep, stopTutorial, setDemoRepoPath } from '../../stores/tutorialStore';
import { completeTutorial } from '../../stores/settingsStore';
import { openRepo as openRepoCommand, deleteDir, removeRecentRepo } from '../../lib/tauriCommands';
import { createDemoRepo } from '../../lib/tauriCommands';
import { setRepoStore } from '../../stores/repoStore';
import { tt, ttf } from '../../i18n';

interface StepDef {
  selector?: string;
  position?: 'bottom' | 'top' | 'center' | 'right';
  titleKey: string;
  descKey: string;
  needsRepo?: boolean;
  custom?: boolean;
}

const STEPS: StepDef[] = [
  { position: 'center', titleKey: 'tutorial.stepWelcomeTitle', descKey: 'tutorial.stepWelcomeDesc' },
  { selector: 'nav a[href="/"]', position: 'bottom', titleKey: 'tutorial.stepHomeTitle', descKey: 'tutorial.stepHomeDesc' },
  { selector: 'nav a[href="/repository"]', position: 'bottom', titleKey: 'tutorial.stepRepoTabTitle', descKey: 'tutorial.stepRepoTabDesc' },
  { selector: 'nav a[href="/settings"]', position: 'bottom', titleKey: 'tutorial.stepSettingsTitle', descKey: 'tutorial.stepSettingsDesc' },
  { position: 'center', titleKey: 'tutorial.stepDemoTitle', descKey: 'tutorial.stepDemoDesc', custom: true },
  { selector: '#remote-actions', position: 'top', titleKey: 'tutorial.stepRemoteTitle', descKey: 'tutorial.stepRemoteDesc', needsRepo: true },
  { selector: '#commit-area', position: 'top', titleKey: 'tutorial.stepCommitTitle', descKey: 'tutorial.stepCommitDesc', needsRepo: true },
  { selector: '#file-list-area', position: 'top', titleKey: 'tutorial.stepFilesTitle', descKey: 'tutorial.stepFilesDesc', needsRepo: true },
  { selector: '#commit-graph-area', position: 'top', titleKey: 'tutorial.stepGraphTitle', descKey: 'tutorial.stepGraphDesc', needsRepo: true },
  { position: 'center', titleKey: 'tutorial.stepCompleteTitle', descKey: 'tutorial.stepCompleteDesc' },
];

async function cleanupDemoRepo() {
  const path = tutorialStore.demoRepoPath;
  if (path) {
    try { await deleteDir(path); } catch { /* ignore */ }
    try { await removeRecentRepo(path); } catch { /* ignore */ }
    setDemoRepoPath('');
  }
}

function exitTutorial() {
  cleanupDemoRepo();
  stopTutorial();
  completeTutorial();
}

const TutorialOverlay: Component = () => {
  const navigate = useNavigate();
  const [tooltipStyle, setTooltipStyle] = createSignal<{ left: number; top: number; transform: string }>({ left: 0, top: 0, transform: '' });
  const [highlightBox, setHighlightBox] = createSignal<{ left: number; top: number; width: number; height: number } | null>(null);
  const [opening, setOpening] = createSignal(false);

  const step = () => STEPS[tutorialStore.currentStep] ?? STEPS[0];
  const isLast = () => tutorialStore.currentStep >= tutorialStore.totalSteps - 1;
  const isFirst = () => tutorialStore.currentStep <= 0;

  // --- Highlight overlay ---
  createEffect(() => {
    const s = STEPS[tutorialStore.currentStep];
    if (!s?.selector || s.position === 'center' || !tutorialStore.active) {
      setHighlightBox(null);
      return;
    }

    const updateHighlight = () => {
      const el = document.querySelector(s.selector!);
      if (!el) { setHighlightBox(null); return; }
      const r = el.getBoundingClientRect();
      setHighlightBox({ left: r.left, top: r.top, width: r.width, height: r.height });
    };

    updateHighlight();
    window.addEventListener('resize', updateHighlight);
    onCleanup(() => window.removeEventListener('resize', updateHighlight));
  });

  // --- Tooltip positioning with viewport clamping ---
  createEffect(() => {
    const s = STEPS[tutorialStore.currentStep];
    if (!s?.selector || !tutorialStore.active) return;

    const updatePosition = () => {
      const el = document.querySelector(s.selector!);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pos = s.position || 'bottom';
      const gap = 12;

      let left = 0, top = 0;
      let transform = '';

      if (pos === 'bottom') {
        left = rect.left + rect.width / 2;
        top = rect.bottom + gap;
        transform = 'translateX(-50%)';
      } else if (pos === 'top') {
        left = rect.left + rect.width / 2;
        top = rect.top - gap;
        transform = 'translateX(-50%) translateY(-100%)';
      } else if (pos === 'right') {
        left = rect.right + gap;
        top = rect.top + rect.height / 2;
        transform = 'translateY(-50%)';
      }

      // Initial placement
      setTooltipStyle({ left, top, transform });

      // Correct position after render using actual tooltip dimensions
      requestAnimationFrame(() => {
        const tooltipEl = document.getElementById('tutorial-tip');
        if (!tooltipEl) return;
        const t = tooltipEl.getBoundingClientRect();
        const m = 12;

        let cl = left, ct = top;

        if (transform === 'translateX(-50%)' || transform === 'translateX(-50%) translateY(-100%)') {
          // left is the horizontal center of the tooltip
          const halfW = t.width / 2;
          cl = Math.max(halfW + m, Math.min(cl, window.innerWidth - halfW - m));

          // Vertical clamping: try original side, flip if needed
          const isTop = transform.includes('translateY(-100%)');
          if (isTop) {
            // tooltip goes upward from top
            if (ct < m) {
              // Flip to bottom
              ct = rect.bottom + gap;
            }
          } else {
            // tooltip goes downward from top
            if (ct + t.height > window.innerHeight - m) {
              // Flip to top
              ct = rect.top - gap - t.height;
            }
          }
          // Final vertical clamp
          if (isTop && ct < m) ct = m;
          if (!isTop && ct + t.height > window.innerHeight - m) {
            ct = window.innerHeight - t.height - m;
          }
          // Keep translateY(-100%) if we're still above, else just translateX
          const isNowTop = ct + t.height <= rect.top;
          transform = isNowTop ? 'translateX(-50%) translateY(-100%)' : 'translateX(-50%)';
        } else if (transform === 'translateY(-50%)') {
          // right-positioned: left is left edge, top is vertical center
          const halfH = t.height / 2;
          ct = Math.max(halfH + m, Math.min(ct, window.innerHeight - halfH - m));

          if (cl + t.width > window.innerWidth - m) {
            // Flip to left side
            cl = rect.left - m - t.width;
          }
          if (cl < m) cl = m;
        }

        setTooltipStyle({ left: cl, top: ct, transform });
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    onCleanup(() => window.removeEventListener('resize', updatePosition));
  });

  // Keyboard handling
  createEffect(() => {
    if (!tutorialStore.active) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitTutorial();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (isLast()) { exitTutorial(); }
        else nextStep();
      } else if (e.key === 'ArrowLeft') {
        prevStep();
      }
    };
    window.addEventListener('keydown', handleKey);
    onCleanup(() => window.removeEventListener('keydown', handleKey));
  });

  const handleOpenDemo = async () => {
    setOpening(true);
    try {
      const demoPath = await createDemoRepo();
      setDemoRepoPath(demoPath);
      const info = await openRepoCommand(demoPath);
      setRepoStore({ repoPath: demoPath, repoInfo: info, loading: false, error: null });
      navigate('/repository');
      setTimeout(() => nextStep(), 500);
    } catch (e) {
      console.error('Failed to create demo repo:', e);
    } finally {
      setOpening(false);
    }
  };

  const handleNext = () => {
    if (isLast()) exitTutorial();
    else nextStep();
  };

  return (
    <Show when={tutorialStore.active}>
      {/* Backdrop */}
      <div class="fixed inset-0 z-[200] bg-black/30 backdrop-blur-[1px]" />

      {/* Highlight overlay (immune to parent overflow:hidden) */}
      <Show when={highlightBox()}>
        <div
          class="fixed z-[199] pointer-events-none rounded-lg border-2 border-cyan-400/60"
          style={{
            left: `${highlightBox()!.left - 2}px`,
            top: `${highlightBox()!.top - 2}px`,
            width: `${highlightBox()!.width + 4}px`,
            height: `${highlightBox()!.height + 4}px`,
          }}
        />
      </Show>

      {step().custom && step().position === 'center' ? (
        /* Centered card for demo repo step */
        <div class="fixed inset-0 z-[201] flex items-center justify-center pointer-events-none">
          <div class="w-80 rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl animate-modal-enter pointer-events-auto">
            <div class="p-5 space-y-3">
              <h3 class="text-sm font-bold text-white">{tt(step().titleKey)}</h3>
              <p class="text-xs text-gray-300 leading-relaxed">{tt(step().descKey)}</p>
              <button
                class="w-full py-2 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 text-sm font-medium transition-colors disabled:opacity-50"
                onClick={handleOpenDemo}
                disabled={opening()}
              >
                {opening() ? (
                  <span class="flex items-center justify-center gap-2">
                    <div class="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    {tt('pr.loading')}
                  </span>
                ) : tt('tutorial.stepOpenDemo')}
              </button>
              <div class="flex items-center justify-between pt-1">
                <button class="text-xs text-gray-400 hover:text-white transition-colors" onClick={exitTutorial}>
                  {tt('tutorial.close')}
                </button>
                <span class="text-xs text-gray-500">
                  {ttf('tutorial.step', tutorialStore.currentStep + 1, tutorialStore.totalSteps)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : step().position === 'center' ? (
        /* Centered card for welcome / complete */
        <div class="fixed inset-0 z-[201] flex items-center justify-center pointer-events-none">
          <div class="w-80 rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl animate-modal-enter pointer-events-auto">
            <div class="p-5 space-y-3">
              <h3 class="text-sm font-bold text-white">{tt(step().titleKey)}</h3>
              <p class="text-xs text-gray-300 leading-relaxed">{tt(step().descKey)}</p>
              <button
                class="w-full py-2 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 text-sm font-medium transition-colors"
                onClick={handleNext}
              >
                {isLast() ? tt('tutorial.finish') : tt('tutorial.start')}
              </button>
              <Show when={isLast()}>
                <div class="flex items-center justify-between pt-1">
                  <button class="text-xs text-gray-400 hover:text-white transition-colors" onClick={exitTutorial}>
                    {tt('tutorial.close')}
                  </button>
                  <span class="text-xs text-gray-500">
                    {ttf('tutorial.step', tutorialStore.currentStep + 1, tutorialStore.totalSteps)}
                  </span>
                </div>
              </Show>
            </div>
          </div>
        </div>
      ) : (
        /* Tooltip near target element */
        <div
          id="tutorial-tip"
          class="fixed z-[201] pointer-events-none"
          style={{
            left: `${tooltipStyle().left}px`,
            top: `${tooltipStyle().top}px`,
            transform: tooltipStyle().transform,
          }}
        >
          <div class="w-80 rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl animate-modal-enter pointer-events-auto">
            <div class="p-4 space-y-2">
              <div class="flex items-start justify-between gap-2">
                <h3 class="text-sm font-bold text-white">{tt(step().titleKey)}</h3>
                <button
                  class="text-xs text-gray-400 hover:text-white shrink-0 transition-colors"
                  onClick={exitTutorial}
                  title={tt('tutorial.close')}
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p class="text-xs text-gray-300 leading-relaxed">{tt(step().descKey)}</p>
              <div class="flex items-center justify-between pt-1">
                <div class="flex gap-2">
                  <Show when={!isFirst()}>
                    <button
                      class="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      onClick={prevStep}
                    >
                      {tt('tutorial.back')}
                    </button>
                  </Show>
                  <button
                    class="px-3 py-1 text-xs rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 transition-colors"
                    onClick={handleNext}
                  >
                    {isLast() ? tt('tutorial.finish') : tt('tutorial.next')}
                  </button>
                </div>
                <span class="text-xs text-gray-500">
                  {ttf('tutorial.step', tutorialStore.currentStep + 1, tutorialStore.totalSteps)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};

export default TutorialOverlay;
