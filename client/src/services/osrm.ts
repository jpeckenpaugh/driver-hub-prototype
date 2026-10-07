import { Coordinates, RouteGeometry } from '@driver-hub/shared';

/**
 * Genera una ruta alternativa interpolada linealmente con N puntos.
 * Usada como fallback automático en caso de timeout, error de red o rate limit de OSRM.
 */
export function generateLinearFallbackRoute(
  start: Coordinates,
  end: Coordinates,
  numPoints = 25
): RouteGeometry {
  const coordinates: Coordinates[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints;
    coordinates.push({
      lat: start.lat + (end.lat - start.lat) * fraction,
      lng: start.lng + (end.lng - start.lng) * fraction
    });
  }

  // Estimación simple de distancia aproximada en metros (Haversine simple)
  const dLat = (end.lat - start.lat) * 111000;
  const dLng = (end.lng - start.lng) * 111000 * Math.cos((start.lat * Math.PI) / 180);
  const distanceMeters = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
  // Velocidad media urbana ~30 km/h = ~8.3 m/s
  const durationSeconds = Math.max(30, Math.round(distanceMeters / 8.3));

  return {
    coordinates,
    distanceMeters,
    durationSeconds
  };
}

/**
 * Consulta la API pública de OSRM para obtener la polilínea y distancias en calles reales.
 * Si falla, retorna automáticamente un fallback lineal para que la demo continúe sin interrupciones.
 */
export async function getRouteOSRM(
  start: Coordinates,
  end: Coordinates
): Promise<RouteGeometry> {
  // OSRM espera {lng},{lat};{lng},{lat}
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 segundos timeout

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route returned by OSRM');
    }

    const route = data.routes[0];
    // GeoJSON coordinates son [lng, lat]
    const coordinates: Coordinates[] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ lat, lng })
    );

    return {
      coordinates,
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration)
    };
  } catch (err) {
    console.warn('[OSRM Service] Fallback a interpolación lineal por error o timeout:', err);
    return generateLinearFallbackRoute(start, end);
  }
}
