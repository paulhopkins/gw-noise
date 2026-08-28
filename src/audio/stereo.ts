// Stereo placement helpers. Not meant to be physically literal, but each
// technique is picked to match how the thing it's placing would actually
// behave across two separated detectors:
//
// - Continuous beds (noise, hum) are per-instrument and have no onset for a
//   delay to act on anyway, so they just get a fixed random pan.
// - A chirp is one real signal arriving at both detectors, just with a
//   light-travel-time offset between them (how real networks triangulate a
//   source's sky position) — see applyRandomStereoPlacement.
// - Glitches are per-instrument artifacts, genuinely uncorrelated between
//   sites — each side gets its own independent glitch stream, hard-committed
//   to that side — see createSidePanner, used by glitches.ts.

export function applyRandomPan(
  context: AudioContextLike,
  input: AudioNode,
  destination: AudioNode,
  maxPan: number,
): void {
  const panner = context.createStereoPanner();
  panner.pan.value = (Math.random() * 2 - 1) * maxPan;
  input.connect(panner).connect(destination);
}

// A panner committed to one side (with a little jitter so repeated calls
// don't all land on the exact same spot), for content that has no business
// appearing on the other channel at all.
export function createSidePanner(context: AudioContextLike, side: -1 | 1, spread = 0.35): StereoPannerNode {
  const panner = context.createStereoPanner();
  panner.pan.value = side * (1 - spread + Math.random() * spread);
  return panner;
}

// Nodes created by applyRandomStereoPlacement, so a caller that tears down
// its own voice on completion (chirps, glitches) can disconnect these too.
export interface StereoPlacementNodes {
  disconnect(): void;
}

export interface StereoPlacementOptions {
  maxDelaySeconds?: number;
  maxPan?: number;
}

// Splits a mono voice into a dry copy and a delayed copy (a few ms apart,
// LIGO/Virgo-baseline scale), panned toward roughly opposite sides. The
// short delay between the two channels' onset is what actually reads as
// "arriving from a direction" for a transient sound, on top of the level
// difference from panning alone.
export function applyRandomStereoPlacement(
  context: AudioContextLike,
  input: AudioNode,
  destination: AudioNode,
  options: StereoPlacementOptions = {},
): StereoPlacementNodes {
  const maxDelay = options.maxDelaySeconds ?? 0.008;
  const maxPan = options.maxPan ?? 0.85;

  const pan = (Math.random() * 2 - 1) * maxPan;
  const leadSide = Math.random() < 0.5 ? -1 : 1;
  const delayTime = Math.random() * maxDelay;

  const dryGain = context.createGain();
  dryGain.gain.value = 0.62;
  const dryPanner = context.createStereoPanner();
  dryPanner.pan.value = Math.max(-1, Math.min(1, pan + leadSide * 0.15));
  input.connect(dryGain).connect(dryPanner).connect(destination);

  const delay = context.createDelay(0.05);
  delay.delayTime.value = delayTime;
  const wetGain = context.createGain();
  wetGain.gain.value = 0.55;
  const wetPanner = context.createStereoPanner();
  wetPanner.pan.value = Math.max(-1, Math.min(1, pan - leadSide * 0.15));
  input.connect(delay).connect(wetGain).connect(wetPanner).connect(destination);

  return {
    disconnect() {
      dryGain.disconnect();
      dryPanner.disconnect();
      delay.disconnect();
      wetGain.disconnect();
      wetPanner.disconnect();
    },
  };
}

type AudioContextLike = AudioContext | OfflineAudioContext;
