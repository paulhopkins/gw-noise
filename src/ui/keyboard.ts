export interface KeyboardCallbacks {
  onTogglePlay: () => void;
  onToggleVisualizer: () => void;
  onVolumeStep: (deltaPercent: number) => void;
}

// Sliders and other form controls have their own arrow-key/space behavior --
// don't hijack it while one of them is focused.
function isFormControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function bindKeyboardShortcuts(callbacks: KeyboardCallbacks): void {
  document.addEventListener('keydown', (event) => {
    if (isFormControl(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

    switch (event.code) {
      case 'Space':
        // Also stops the default page-scroll-on-space and, when a button
        // happens to be focused, its own click-on-space (which would
        // otherwise fire alongside this and toggle twice).
        event.preventDefault();
        callbacks.onTogglePlay();
        break;
      case 'KeyV':
        callbacks.onToggleVisualizer();
        break;
      case 'ArrowUp':
        event.preventDefault();
        callbacks.onVolumeStep(5);
        break;
      case 'ArrowDown':
        event.preventDefault();
        callbacks.onVolumeStep(-5);
        break;
      default:
        break;
    }
  });
}
