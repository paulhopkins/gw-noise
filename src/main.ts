import './style.css';
import { AudioEngine } from './audio/engine';
import { Visualizer } from './audio/visualizer';
import { RandomScheduler } from './audio/scheduler';
import { playRandomChirp } from './audio/chirps';
import { playRandomGlitch } from './audio/glitches';
import { bindControls } from './ui/controls';

const playButtonEl = document.getElementById('playButton');
const canvasEl = document.getElementById('visualizer');
const playLabelEl = playButtonEl?.querySelector('.play-label');

if (!(playButtonEl instanceof HTMLButtonElement) || !(canvasEl instanceof HTMLCanvasElement) || !playLabelEl) {
  throw new Error('Expected page elements are missing');
}

const playButton: HTMLButtonElement = playButtonEl;
const canvas: HTMLCanvasElement = canvasEl;
const playLabel: Element = playLabelEl;

let engine: AudioEngine | null = null;
let visualizer: Visualizer | null = null;
let chirpScheduler: RandomScheduler | null = null;
let glitchScheduler: RandomScheduler | null = null;
let playing = false;

// Rate sliders are 0..1; map to a mean gap in seconds for the Poisson-like
// scheduler (higher rate -> shorter average gap between events).
let chirpRate = 0.35;
let glitchRate = 0.2;

function meanIntervalSeconds(rate: number, minSeconds: number, maxSeconds: number): number {
  return maxSeconds - rate * (maxSeconds - minSeconds);
}

async function ensureEngine(): Promise<AudioEngine> {
  if (engine) return engine;

  const created = await AudioEngine.create();
  engine = created;
  visualizer = new Visualizer(canvas, created.layers.analyser);

  chirpScheduler = new RandomScheduler(
    () => meanIntervalSeconds(chirpRate, 5, 90),
    () => playRandomChirp(created.context, created.layers.chirpBus),
  );

  glitchScheduler = new RandomScheduler(
    () => meanIntervalSeconds(glitchRate, 5, 120),
    () => playRandomGlitch(created.context, created.layers.glitchBus),
  );

  bindControls({
    onMasterVolume: (v) => created.layers.masterGain.gain.setTargetAtTime(v, created.context.currentTime, 0.05),
    onNoiseLevel: (v) => created.layers.noiseGain.gain.setTargetAtTime(v, created.context.currentTime, 0.05),
    onHumLevel: (v) => created.layers.humGain.gain.setTargetAtTime(v, created.context.currentTime, 0.05),
    onHumFrequency: (freq) => created.setHumFrequency(freq),
    onChirpLevel: (v) => created.layers.chirpBus.gain.setTargetAtTime(v, created.context.currentTime, 0.05),
    onChirpRate: (v) => {
      chirpRate = v;
    },
    onGlitchLevel: (v) => created.layers.glitchBus.gain.setTargetAtTime(v, created.context.currentTime, 0.05),
    onGlitchRate: (v) => {
      glitchRate = v;
    },
  });

  return created;
}

playButton.addEventListener('click', async () => {
  const active = await ensureEngine();

  if (!playing) {
    await active.resume();
    visualizer?.start();
    chirpScheduler?.start();
    glitchScheduler?.start();
    playing = true;
  } else {
    await active.suspend();
    visualizer?.stop();
    chirpScheduler?.stop();
    glitchScheduler?.stop();
    playing = false;
  }

  playButton.setAttribute('aria-pressed', String(playing));
  playLabel.textContent = playing ? 'Pause' : 'Listen';
});
