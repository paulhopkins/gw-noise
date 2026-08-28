// Mains electrical hum: a fundamental sine plus a couple of quieter
// harmonics, with a slow amplitude wobble so it doesn't sound like a dead
// flat tone. Runs continuously; base frequency is switchable between 50 Hz
// and 60 Hz mains conventions.
interface Harmonic {
  multiple: number;
  gain: number;
}

// A pure 60Hz fundamental sits at or below what a lot of small speakers can
// reproduce, so the audible character of "mains hum" has to come mostly from
// its upper harmonics (which real transformer/rectifier hum has plenty of
// anyway) rather than relying on bass response.
const HARMONICS: Harmonic[] = [
  { multiple: 1, gain: 0.7 },
  { multiple: 2, gain: 0.5 },
  { multiple: 3, gain: 0.4 },
  { multiple: 4, gain: 0.22 },
  { multiple: 5, gain: 0.16 },
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
