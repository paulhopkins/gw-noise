// Mains electrical hum: a fundamental sine plus a couple of quieter
// harmonics, with a slow amplitude wobble so it doesn't sound like a dead
// flat tone. Runs continuously; base frequency is switchable between 50 Hz
// and 60 Hz mains conventions.
interface Harmonic {
  multiple: number;
  gain: number;
}

const HARMONICS: Harmonic[] = [
  { multiple: 1, gain: 1.0 },
  { multiple: 2, gain: 0.35 },
  { multiple: 3, gain: 0.15 },
];

export class HumLayer {
  private readonly context: AudioContext;
  private readonly oscillators: OscillatorNode[] = [];
  private baseFrequency = 60;

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;

    const wobble = context.createGain();
    wobble.gain.value = 1;
    wobble.connect(destination);

    for (const harmonic of HARMONICS) {
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = this.baseFrequency * harmonic.multiple;

      const gain = context.createGain();
      gain.gain.value = harmonic.gain;

      osc.connect(gain).connect(wobble);
      osc.start();
      this.oscillators.push(osc);
    }

    const lfo = context.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain).connect(wobble.gain);
    lfo.start();
  }

  setBaseFrequency(freq: 50 | 60) {
    this.baseFrequency = freq;
    const now = this.context.currentTime;
    this.oscillators.forEach((osc, index) => {
      const multiple = HARMONICS[index].multiple;
      osc.frequency.setTargetAtTime(freq * multiple, now, 0.05);
    });
  }
}
