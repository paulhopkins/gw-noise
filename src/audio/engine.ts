import { createDetectorNoiseNode } from './detectorNoise';
import { HumLayer } from './hum';
import { applyRandomPan } from './stereo';

export interface AudioLayers {
  noiseGain: GainNode;
  humGain: GainNode;
  chirpBus: GainNode;
  glitchBus: GainNode;
  masterGain: GainNode;
  analyser: AnalyserNode;
  spectrogramAnalyser: AnalyserNode;
}

export class AudioEngine {
  private constructor(
    readonly context: AudioContext,
    readonly layers: AudioLayers,
    private readonly hum: HumLayer,
  ) {}

  static async create(): Promise<AudioEngine> {
    const context = new AudioContext();
    await context.audioWorklet.addModule(`${import.meta.env.BASE_URL}worklets/detector-noise-processor.js`);

    const masterGain = context.createGain();
    masterGain.gain.value = 0.7;

    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;

    masterGain.connect(analyser);
    analyser.connect(context.destination);

    // A second, higher-resolution tap used only for the spectrogram's
    // frequency data. Mains hum's harmonics sit only 50/60 Hz apart, and an
    // AnalyserNode's window smears each tone's energy across several bins on
    // either side of it (its mainlobe is roughly 6 bins wide) -- at the
    // primary analyser's 2048-point FFT, that smear is wider than the gap
    // between harmonics, so they visually merge into one thick blob no
    // matter how the frequency-to-pixel mapping is done. A big enough FFT
    // narrows that smear back below the harmonic spacing, but the resulting
    // ~170ms analysis window is too sluggish for the default oscilloscope
    // trace (each animation frame would mostly repeat the last one's audio),
    // so it's kept on its own analyser rather than raising the primary one.
    // Muted out of the actual output -- it exists purely to be read from.
    const spectrogramAnalyser = context.createAnalyser();
    spectrogramAnalyser.fftSize = 8192;
    spectrogramAnalyser.smoothingTimeConstant = 0.5;
    const spectrogramTapMute = context.createGain();
    spectrogramTapMute.gain.value = 0;
    masterGain.connect(spectrogramAnalyser).connect(spectrogramTapMute).connect(context.destination);

    const noiseGain = context.createGain();
    noiseGain.gain.value = 0.7;
    const humGain = context.createGain();
    humGain.gain.value = 0.25;
    const chirpBus = context.createGain();
    chirpBus.gain.value = 0.6;
    const glitchBus = context.createGain();
    glitchBus.gain.value = 0.55;

    noiseGain.connect(masterGain);
    humGain.connect(masterGain);
    chirpBus.connect(masterGain);
    glitchBus.connect(masterGain);

    // Fixed random pan per layer, chosen once, so the noise bed and hum feel
    // like they're each coming from their own place rather than dead-center
    // (a delay would do nothing audible for a signal that never starts or
    // stops, so continuous layers just get a pan — see stereo.ts).
    const noiseNode = createDetectorNoiseNode(context);
    applyRandomPan(context, noiseNode, noiseGain, 0.4);

    const humRaw = context.createGain();
    const hum = new HumLayer(context, humRaw);
    applyRandomPan(context, humRaw, humGain, 0.35);

    return new AudioEngine(
      context,
      { noiseGain, humGain, chirpBus, glitchBus, masterGain, analyser, spectrogramAnalyser },
      hum,
    );
  }

  setHumFrequency(freq: 50 | 60): void {
    this.hum.setBaseFrequency(freq);
  }

  async resume(): Promise<void> {
    await this.context.resume();
  }

  async suspend(): Promise<void> {
    await this.context.suspend();
  }
}
