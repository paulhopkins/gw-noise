import './style.css';
import { AudioEngine } from './audio/engine';
import { Visualizer, VisualizerMode } from './audio/visualizer';
import { RandomScheduler } from './audio/scheduler';
import { playRandomChirp } from './audio/chirps';
import { playRandomGlitch } from './audio/glitches';
import { bindControls } from './ui/controls';

const playButtonEl = document.getElementById('playButton');
const canvasEl = document.getElementById('visualizer');
const playLabelEl = playButtonEl?.querySelector('.play-label');
const visualizerModeButtonEl = document.getElementById('visualizerModeButton');

if (
  !(playButtonEl instanceof HTMLButtonElement) ||
  !(canvasEl instanceof HTMLCanvasElement) ||
  !playLabelEl ||
  !(visualizerModeButtonEl instanceof HTMLButtonElement)
) {
  throw new Error('Expected page elements are missing');
}

const playButton: HTMLButtonElement = playButtonEl;
const canvas: HTMLCanvasElement = canvasEl;
const playLabel: Element = playLabelEl;
const visualizerModeButton: HTMLButtonElement = visualizerModeButtonEl;

let engine: AudioEngine | null = null;
let visualizer: Visualizer | null = null;
let visualizerMode: VisualizerMode = 'waveform';
let chirpScheduler: RandomScheduler | null = null;
let glitchSchedulerLeft: RandomScheduler | null = null;
let glitchSchedulerRight: RandomScheduler | null = null;
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
  visualizer.setMode(visualizerMode);

  // Floors are pushed low on purpose: cranking a rate slider all the way up
  // should tip over from "occasional" into "clearly too much" so the extremes
  // of the control are obvious.
  chirpScheduler = new RandomScheduler(
    () => meanIntervalSeconds(chirpRate, 1.5, 90),
    () => playRandomChirp(created.context, created.layers.chirpBus),
  );

  // Real detector glitches are per-instrument artifacts, uncorrelated
  // between sites, so each side runs its own independent random stream
  // rather than one glitch mirrored across channels.
  glitchSchedulerLeft = new RandomScheduler(
    () => meanIntervalSeconds(glitchRate, 1, 120),
    () => playRandomGlitch(created.context, created.layers.glitchBus, -1),
  );
  glitchSchedulerRight = new RandomScheduler(
    () => meanIntervalSeconds(glitchRate, 1, 120),
    () => playRandomGlitch(created.context, created.layers.glitchBus, 1),
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
    glitchSchedulerLeft?.start();
    glitchSchedulerRight?.start();
    playing = true;
  } else {
    await active.suspend();
    visualizer?.stop();
    chirpScheduler?.stop();
    glitchSchedulerLeft?.stop();
    glitchSchedulerRight?.stop();
    playing = false;
  }

  playButton.setAttribute('aria-pressed', String(playing));
  playLabel.textContent = playing ? 'Pause' : 'Listen';
});

visualizerModeButton.addEventListener('click', () => {
  visualizerMode = visualizerMode === 'waveform' ? 'spectrogram' : 'waveform';
  visualizerModeButton.textContent = visualizerMode === 'waveform' ? 'Spectrogram view' : 'Waveform view';
  visualizer?.setMode(visualizerMode);
});
