import { Coordinates } from '@driver-hub/shared';

/**
 * Calcula el rumbo (bearing) en grados (0° a 360°) entre dos coordenadas geográficas.
 */
export function calculateBearing(from: Coordinates, to: Coordinates): number {
  const fromLat = (from.lat * Math.PI) / 180;
  const fromLng = (from.lng * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const toLng = (to.lng * Math.PI) / 180;

  const dLng = toLng - fromLng;

  const y = Math.sin(dLng) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLng);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Interpola linealmente entre dos puntos dados una fracción t en [0, 1].
 */
export function interpolateCoords(
  p1: Coordinates,
  p2: Coordinates,
  t: number
): Coordinates {
  return {
    lat: p1.lat + (p2.lat - p1.lat) * t,
    lng: p1.lng + (p2.lng - p1.lng) * t
  };
}

/**
 * Formatea metros a distancia legible (km o m).
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Formatea segundos a minutos estimados.
 */
export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} min`;
}

/**
 * Reproduce un chime suave usando Web Audio API (cero dependencias externas).
 */
export function playNotificationChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.debug('Audio not enabled or blocked by autoplay policy:', e);
  }
}
