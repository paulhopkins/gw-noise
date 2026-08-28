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
      { noiseGain, humGain, chirpBus, glitchBus, masterGain, analyser },
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
