export interface ControlCallbacks {
  onMasterVolume: (level: number) => void;
  onNoiseLevel: (level: number) => void;
  onHumLevel: (level: number) => void;
  onHumFrequency: (freq: 50 | 60) => void;
  onChirpLevel: (level: number) => void;
  onChirpRate: (rate: number) => void;
  onGlitchLevel: (level: number) => void;
  onGlitchRate: (rate: number) => void;
}

function bindRange(id: string, onChange: (value: number) => void): void {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) throw new Error(`Missing range input #${id}`);
  el.addEventListener('input', () => onChange(Number(el.value) / 100));
  onChange(Number(el.value) / 100);
}

export function bindControls(callbacks: ControlCallbacks): void {
  bindRange('masterVolume', callbacks.onMasterVolume);
  bindRange('noiseLevel', callbacks.onNoiseLevel);
  bindRange('humLevel', callbacks.onHumLevel);
  bindRange('chirpLevel', callbacks.onChirpLevel);
  bindRange('chirpRate', callbacks.onChirpRate);
  bindRange('glitchLevel', callbacks.onGlitchLevel);
  bindRange('glitchRate', callbacks.onGlitchRate);

  const humRadios = document.querySelectorAll<HTMLInputElement>('input[name="humFreq"]');
  humRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) callbacks.onHumFrequency(Number(radio.value) as 50 | 60);
    });
  });
}
