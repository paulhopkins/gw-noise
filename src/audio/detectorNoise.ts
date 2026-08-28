// Thin wrapper around the AudioWorkletNode that runs
// public/worklets/detector-noise-processor.js. The worklet module must be
// registered on the context (via engine.ts) before this is called.
export function createDetectorNoiseNode(context: AudioContext): AudioWorkletNode {
  return new AudioWorkletNode(context, 'detector-noise-processor');
}
