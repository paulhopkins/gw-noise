// Simulated detector "glitches": short transient artifacts loosely inspired
// by real Gravity Spy glitch class names (Blip, Koi Fish, Whistle, Scratchy,
// Helix, Extremely Loud). These are invented/stylized sounds, not
// reconstructions of real detector data — just capturing the flavor of
// "something briefly odd happened in the instrument."
//
// Unlike a chirp (one real signal arriving at both detectors, just delayed),
// glitches are per-instrument artifacts — cable issues, scattered light,
// local environmental noise — genuinely uncorrelated between sites. So each
// side gets its own independent glitch stream (see the two schedulers in
// main.ts) rather than one glitch split across channels; playRandomGlitch
// just commits its output to whichever side it was asked for.
import { createSidePanner } from './stereo';

type GlitchPlayer = (context: AudioContext, destination: AudioNode) => void;

interface GlitchClass {
  name: string;
  play: GlitchPlayer;
}

function noiseBufferSource(context: AudioContext, duration: number): AudioBufferSourceNode {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  return source;
}

// Blip: a very short broadband click with a sharp decay.
function playBlip(context: AudioContext, destination: AudioNode): void {
  const now = context.currentTime;
  const duration = 0.15;

  const source = noiseBufferSource(context, duration);
  const bandpass = context.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 700 + Math.random() * 1500;
  bandpass.Q.value = 1.1;

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.9, now);
  envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  source.connect(bandpass).connect(envelope).connect(destination);
  source.start(now);
  source.stop(now + duration);
  source.onended = () => {
    source.disconnect();
    bandpass.disconnect();
    envelope.disconnect();
  };
}

// Koi Fish: a smooth arched pitch sweep up then down, like a fish leaping.
function playKoiFish(context: AudioContext, destination: AudioNode): void {
  const now = context.currentTime;
  const duration = 0.5;
  const baseFreq = 280 + Math.random() * 160;

  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.linearRampToValueAtTime(baseFreq * 2.2, now + duration * 0.5);
  osc.frequency.linearRampToValueAtTime(baseFreq * 0.85, now + duration);

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(0.5, now + duration * 0.4);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(envelope).connect(destination);
  osc.start(now);
  osc.stop(now + duration + 0.05);
  osc.onended = () => {
    osc.disconnect();
    envelope.disconnect();
  };
}

// Whistle: a narrowband tone sweep with vibrato and a longer decay.
function playWhistle(context: AudioContext, destination: AudioNode): void {
  const now = context.currentTime;
  const duration = 1.0 + Math.random() * 0.4;
  const startFreq = 900 + Math.random() * 500;

  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(startFreq * 1.6, now + duration);

  const vibrato = context.createOscillator();
  vibrato.frequency.value = 6;
  const vibratoGain = context.createGain();
  vibratoGain.gain.value = 12;
  vibrato.connect(vibratoGain).connect(osc.frequency);

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(0.32, now + 0.1);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(envelope).connect(destination);
  osc.start(now);
  vibrato.start(now);
  const stopAt = now + duration + 0.1;
  osc.stop(stopAt);
  vibrato.stop(stopAt);
  osc.onended = () => {
    osc.disconnect();
    vibrato.disconnect();
    vibratoGain.disconnect();
    envelope.disconnect();
  };
}

// Scratchy: a short burst of filtered noise with a crackly, fast-modulated envelope.
function playScratchy(context: AudioContext, destination: AudioNode): void {
  const now = context.currentTime;
  const duration = 0.3;

  const source = noiseBufferSource(context, duration);
  const highpass = context.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 1500;

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, now);
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    envelope.gain.linearRampToValueAtTime(Math.random() * 0.55, now + (i / steps) * duration);
  }
  envelope.gain.linearRampToValueAtTime(0, now + duration);

  source.connect(highpass).connect(envelope).connect(destination);
  source.start(now);
  source.stop(now + duration);
  source.onended = () => {
    source.disconnect();
    highpass.disconnect();
    envelope.disconnect();
  };
}

// Helix: two sines drifting apart in frequency, giving a slow spiral/beating effect.
function playHelix(context: AudioContext, destination: AudioNode): void {
  const now = context.currentTime;
  const duration = 0.8;
  const base = 220 + Math.random() * 120;

  const oscA = context.createOscillator();
  const oscB = context.createOscillator();
  oscA.type = 'sine';
  oscB.type = 'sine';
  oscA.frequency.setValueAtTime(base, now);
  oscB.frequency.setValueAtTime(base, now);
  oscA.frequency.exponentialRampToValueAtTime(base * 1.5, now + duration);
  oscB.frequency.exponentialRampToValueAtTime(base * 0.7, now + duration);

  const gainA = context.createGain();
  const gainB = context.createGain();
  gainA.gain.value = 0.5;
  gainB.gain.value = 0.5;

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(0.4, now + 0.15);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscA.connect(gainA).connect(envelope);
  oscB.connect(gainB).connect(envelope);
  envelope.connect(destination);

  const stopAt = now + duration + 0.1;
  oscA.start(now);
  oscB.start(now);
  oscA.stop(stopAt);
  oscB.stop(stopAt);
  oscA.onended = () => {
    oscA.disconnect();
    oscB.disconnect();
    gainA.disconnect();
    gainB.disconnect();
    envelope.disconnect();
  };
}

// Extremely Loud: a brief broadband burst with a hard attack and sudden cutoff.
// Gain-capped so it stays safe for a relaxation app rather than actually startling.
function playExtremelyLoud(context: AudioContext, destination: AudioNode): void {
  const now = context.currentTime;
  const duration = 0.25;

  const source = noiseBufferSource(context, duration);
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 4000;

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.7, now);
  envelope.gain.setTargetAtTime(0.0001, now + 0.02, 0.03);

  source.connect(lowpass).connect(envelope).connect(destination);
  source.start(now);
  source.stop(now + duration);
  source.onended = () => {
    source.disconnect();
    lowpass.disconnect();
    envelope.disconnect();
  };
}

export const GLITCH_CLASSES: GlitchClass[] = [
  { name: 'Blip', play: playBlip },
  { name: 'Koi Fish', play: playKoiFish },
  { name: 'Whistle', play: playWhistle },
  { name: 'Scratchy', play: playScratchy },
  { name: 'Helix', play: playHelix },
  { name: 'Extremely Loud', play: playExtremelyLoud },
];

export function playRandomGlitch(context: AudioContext, destination: AudioNode, side: -1 | 1): void {
  const glitchClass = GLITCH_CLASSES[Math.floor(Math.random() * GLITCH_CLASSES.length)];
  const panner = createSidePanner(context, side);
  panner.connect(destination);
  glitchClass.play(context, panner);
}
