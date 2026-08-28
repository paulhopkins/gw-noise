// Simulated gravitational-wave "chirps", shaped after the leading-order
// (Newtonian quadrupole) inspiral formula rather than a generic sweep:
//
//   f(t)   ∝ (t_c - t)^(-3/8)   — frequency stays nearly flat, then
//                                  accelerates sharply as the merger time
//                                  t_c is approached
//   h(t)   ∝ f(t)^(2/3)         — amplitude rises together with frequency,
//                                  so the loudest, highest part of the sweep
//                                  arrives right at the end
//
// followed by a short ringdown: a fast-decaying tone a bit above the final
// inspiral frequency, standing in for the merged black hole's quasi-normal
// mode. That combination — slow build, sharp accelerating finish, abrupt
// ringing cutoff — is what makes a real chirp sound distinct rather than a
// smooth up-and-down sweep.
//
// Physically, longer chirps come from lower-mass (lower chirp-mass) systems,
// which spend longer sweeping through the audible band; short/fast ones
// come from higher-mass black hole mergers. Presets below follow that
// scaling.
export interface ChirpPreset {
  name: string;
  duration: number;
  freqStart: number;
  freqEnd: number;
}

export const CHIRP_PRESETS: ChirpPreset[] = [
  { name: 'long-slow', duration: 12, freqStart: 25, freqEnd: 260 },
  { name: 'medium-slow', duration: 6, freqStart: 32, freqEnd: 320 },
  { name: 'medium-fast', duration: 2.5, freqStart: 45, freqEnd: 420 },
  { name: 'short-fast', duration: 1.4, freqStart: 60, freqEnd: 520 },
];

interface InspiralCurves {
  freq: Float32Array;
  amp: Float32Array;
}

// Scheduling a curve at `context.currentTime` with zero lookahead is
// fragile: if enough other audio nodes are being created at once (many
// overlapping chirps/glitches at high rate settings), the JS thread can lag
// long enough between reading currentTime and the call actually reaching
// the audio thread that the browser silently clamps the curve's real start
// forward — desyncing it from time offsets computed against the stale
// value. A small forward lookahead keeps "now" safely in the future.
const SCHEDULE_LOOKAHEAD = 0.03;
const RING_MARGIN = 0.02;

function buildInspiralCurves(freqStart: number, freqEnd: number, duration: number): InspiralCurves {
  const ratio = freqEnd / freqStart;
  // Merger time t_c such that f(0) = freqStart and f(duration) = freqEnd
  // under f(t) = freqStart * (1 - t/t_c)^(-3/8).
  const mergerTime = duration / (1 - Math.pow(ratio, -8 / 3));

  const sampleCount = Math.min(600, Math.max(64, Math.round(duration * 50)));
  const freq = new Float32Array(sampleCount);
  const amp = new Float32Array(sampleCount);
  const fadeInFraction = 0.05;

  for (let i = 0; i < sampleCount; i++) {
    const t = (i / (sampleCount - 1)) * duration;
    const f = freqStart * Math.pow(1 - t / mergerTime, -3 / 8);
    freq[i] = f;

    // Smooth 0->1 fade over the first slice of the sweep so the oscillator
    // doesn't start with an audible click, then let amplitude track f^(2/3).
    const fadeIn = Math.min(1, t / (duration * fadeInFraction));
    const raisedCosine = 0.5 - 0.5 * Math.cos(Math.PI * fadeIn);
    amp[i] = raisedCosine * Math.pow(f / freqEnd, 2 / 3);
  }

  return { freq, amp };
}

function sweepOscillator(
  context: AudioContext,
  now: number,
  curves: InspiralCurves,
  duration: number,
  ringFreq: number,
  freqMultiplier: number,
): OscillatorNode {
  const osc = context.createOscillator();
  osc.type = 'sine';

  const scaledFreq =
    freqMultiplier === 1 ? curves.freq : curves.freq.map((f) => f * freqMultiplier);
  osc.frequency.setValueCurveAtTime(scaledFreq, now, duration);

  const ringStart = now + duration + RING_MARGIN;
  osc.frequency.setValueAtTime(scaledFreq[scaledFreq.length - 1], ringStart);
  osc.frequency.exponentialRampToValueAtTime(ringFreq * freqMultiplier, ringStart + 0.025);

  return osc;
}

export function playChirp(context: AudioContext, destination: AudioNode, preset: ChirpPreset): void {
  const now = context.currentTime + SCHEDULE_LOOKAHEAD;
  const curves = buildInspiralCurves(preset.freqStart, preset.freqEnd, preset.duration);
  const ringFreq = preset.freqEnd * 1.3;
  const ringDecay = 0.05 + preset.duration * 0.01;
  const mergerTime = now + preset.duration;

  const osc = sweepOscillator(context, now, curves, preset.duration, ringFreq, 1);
  const harmonic = sweepOscillator(context, now, curves, preset.duration, ringFreq, 2);
  const harmonicGain = context.createGain();
  const harmonicLevel = 0.18;
  harmonicGain.gain.value = harmonicLevel;

  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = ringFreq * 1.8;
  lowpass.Q.value = 0.5;

  // The fundamental (peak 1) and harmonic (peak harmonicLevel) can add up to
  // (1 + harmonicLevel) at a given instant; keep the envelope's peak below
  // that combined headroom (with a bit of extra margin for the lowpass
  // filter's transient overshoot at the ringdown frequency jump) so this
  // voice never exceeds unity on its own.
  const peakEnvelope = 0.9 / (1 + harmonicLevel);

  const envelope = context.createGain();
  const scaledAmp = curves.amp.map((v) => v * peakEnvelope);
  envelope.gain.setValueCurveAtTime(scaledAmp, now, preset.duration);
  envelope.gain.setValueAtTime(peakEnvelope, mergerTime + RING_MARGIN);
  envelope.gain.setTargetAtTime(0.0001, mergerTime + RING_MARGIN, ringDecay);

  osc.connect(lowpass);
  harmonic.connect(harmonicGain).connect(lowpass);
  lowpass.connect(envelope).connect(destination);

  const stopAt = mergerTime + ringDecay * 6 + 0.1;
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
