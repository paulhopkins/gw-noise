// A small stack of fading toasts naming each simulated chirp/glitch as it
// fires, so "something just happened in the mix" turns into "that was a
// short, fast merger" / "that was a Koi Fish glitch on the left detector."
export type EventKind = 'chirp' | 'glitch';

export interface EventLogEntry {
  kind: EventKind;
  label: string;
  detail?: string;
}

const LIFETIME_MS = 4200;
const MAX_VISIBLE = 4;

export class EventLog {
  constructor(private readonly container: HTMLElement) {}

  push(entry: EventLogEntry): void {
    const toast = document.createElement('div');
    toast.className = `event-toast event-toast--${entry.kind}`;

    const label = document.createElement('span');
    label.className = 'event-toast__label';
    label.textContent = entry.label;
    toast.appendChild(label);

    if (entry.detail) {
      const detail = document.createElement('span');
      detail.className = 'event-toast__detail';
      detail.textContent = entry.detail;
      toast.appendChild(detail);
    }

    this.container.appendChild(toast);
    while (this.container.childElementCount > MAX_VISIBLE) {
      this.container.firstElementChild?.remove();
    }

    // Add the visible class on the next frame so the CSS transition (from
    // the base, off-screen/transparent state) actually plays.
    requestAnimationFrame(() => toast.classList.add('event-toast--visible'));

    window.setTimeout(() => {
      toast.classList.remove('event-toast--visible');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, LIFETIME_MS);
  }

  clear(): void {
    this.container.replaceChildren();
  }
}
