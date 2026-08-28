// Simulated gravitational-wave "chirps": a sine sweep from a low starting
// frequency up to a higher end frequency, with an amplitude envelope that
// rises through the sweep (mimicking the amplitude growth of a real
// compact-binary inspiral) and a lowpass to keep it soft rather than
// alarming. Different presets give long/slow (low-mass-like) vs
// short/fast (high-mass-merger-like) character.
export interface ChirpPreset {
  name: string;
  duration: number;
  freqStart: number;
  freqEnd: number;
}

export const CHIRP_PRESETS: ChirpPreset[] = [
  { name: 'long-slow', duration: 8, freqStart: 30, freqEnd: 220 },
  { name: 'medium', duration: 3, freqStart: 40, freqEnd: 300 },
  { name: 'short-fast', duration: 1, freqStart: 60, freqEnd: 400 },
  { name: 'very-short-fast', duration: 0.6, freqStart: 80, freqEnd: 500 },
];

export function playChirp(context: AudioContext, destination: AudioNode, preset: ChirpPreset): void {
  const now = context.currentTime;
  const releaseTail = 0.4;

  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(preset.freqStart, now);
  osc.frequency.exponentialRampToValueAtTime(preset.freqEnd, now + preset.duration);

  const harmonic = context.createOscillator();
  harmonic.type = 'sine';
  harmonic.frequency.setValueAtTime(preset.freqStart * 2, now);
  harmonic.frequency.exponentialRampToValueAtTime(preset.freqEnd * 2, now + preset.duration);
  const harmonicGain = context.createGain();
  harmonicGain.gain.value = 0.18;

  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = preset.freqEnd * 1.5;
  lowpass.Q.value = 0.5;

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(1, now + preset.duration * 0.85);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration + releaseTail);

  osc.connect(lowpass);
  harmonic.connect(harmonicGain).connect(lowpass);
  lowpass.connect(envelope).connect(destination);

  const stopAt = now + preset.duration + releaseTail + 0.1;
  osc.start(now);
  harmonic.start(now);
  osc.stop(stopAt);
  harmonic.stop(stopAt);

  osc.onended = () => {
    osc.disconnect();
    harmonic.disconnect();
    harmonicGain.disconnect();
    lowpass.disconnect();
    envelope.disconnect();
  };
}

export function playRandomChirp(context: AudioContext, destination: AudioNode): void {
  const preset = CHIRP_PRESETS[Math.floor(Math.random() * CHIRP_PRESETS.length)];
  playChirp(context, destination, preset);
}
