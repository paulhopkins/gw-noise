# gw-noise

An ambient "relaxation noise" generator themed around gravitational-wave
detectors — like a white-noise/rain/cafe sound generator, but the bed is
synthesized detector "hiss" shaped after the bucket-shaped noise curve of an
interferometer like LIGO (seismic wall at low frequency, shot-noise rise at
high frequency), plus:

- 50 Hz / 60 Hz mains electrical hum with harmonics
- occasional simulated gravitational-wave chirps (long & slow, short & fast,
  and variants in between)
- occasional simulated detector "glitches" loosely inspired by
  [Gravity Spy](https://www.zooniverse.org/projects/zooniverse/gravity-spy)
  glitch classes — Blip, Koi Fish, Whistle, Scratchy, Helix, Extremely Loud

Everything is synthesized live in the browser with the Web Audio API — no
audio files, no backend. This is an artistic soundscape, not real detector
strain data.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the site
and publishes it to GitHub Pages. The first time, enable Pages once in repo
Settings → Pages → Source: GitHub Actions.
