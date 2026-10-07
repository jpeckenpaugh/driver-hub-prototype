import L from 'leaflet';

/**
 * Crea un icono de vehículo rotatorio en SVG con sombra y heading.
 */
export function createVehicleIcon(heading: number = 0, isBusy: boolean = false) {
  const accentColor = isBusy ? '#2563eb' : '#059669'; // Azul si en viaje, Verde si disponible

  const html = `
    <div style="transform: rotate(${heading}deg); transition: transform 0.15s ease-out; width: 40px; height: 40px;" class="flex items-center justify-center">
      <div style="
        background: #0f172a;
        border: 2.5px solid ${accentColor};
        box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 10px ${accentColor}66;
        width: 32px;
        height: 32px;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <!-- Flecha de dirección hacia arriba (0 deg) -->
          <polygon points="12 2 19 21 12 17 5 21 12 2" fill="${accentColor}" stroke="white" />
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'vehicle-marker-div',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}

/**
 * Icono de punto de partida (Pickup)
 */
export function createPickupIcon() {
  const html = `
    <div class="flex items-center justify-center relative">
      <div class="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs ring-4 ring-emerald-500/20">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="6" fill="white" />
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'pickup-marker-div',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

/**
 * Icono de punto de destino (Dropoff)
 */
export function createDropoffIcon() {
  const html = `
    <div class="flex items-center justify-center relative">
      <div class="w-8 h-8 rounded-full bg-rose-600 border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs ring-4 ring-rose-500/20">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'dropoff-marker-div',
    iconSize: [32, 32],
    iconAnchor: [16, 28]
  });
}

/**
 * Icono para conductores disponibles en el mapa (Rider radar view)
 */
export function createAvailableDriverIcon(heading: number = 0) {
  const html = `
    <div style="transform: rotate(${heading}deg); width: 28px; height: 28px;" class="flex items-center justify-center">
      <div class="w-6 h-6 rounded-full bg-slate-900 border-2 border-emerald-400 shadow flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="text-emerald-400">
          <polygon points="12 2 19 21 12 17 5 21 12 2" />
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'avail-driver-div',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}
