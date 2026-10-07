import { Coordinates, RouteGeometry } from '@driver-hub/shared';

// Matriz de puntos de interconexión para la red de Orlando (I-Drive, Universal, I-4, Beachline, Convention, etc.)
interface WaypointNode {
  id: string;
  coords: Coordinates;
  neighbors: string[];
}

const ORLANDO_GRAPH: WaypointNode[] = [
  { id: 'universal', coords: { lat: 28.4744, lng: -81.4678 }, neighbors: ['universal_blvd_1', 'i4_north'] },
  { id: 'universal_blvd_1', coords: { lat: 28.4580, lng: -81.4520 }, neighbors: ['universal', 'sand_lake_east', 'universal_blvd_2'] },
  { id: 'universal_blvd_2', coords: { lat: 28.4380, lng: -81.4480 }, neighbors: ['universal_blvd_1', 'convention_ctr', 'beachline_west'] },
  
  { id: 'i4_north', coords: { lat: 28.4800, lng: -81.4600 }, neighbors: ['universal', 'i4_sand_lake'] },
  { id: 'i4_sand_lake', coords: { lat: 28.4500, lng: -81.4720 }, neighbors: ['i4_north', 'sand_lake_idrive', 'i4_south'] },
  { id: 'i4_south', coords: { lat: 28.4050, lng: -81.5100 }, neighbors: ['i4_sand_lake', 'i4_disney'] },
  { id: 'i4_disney', coords: { lat: 28.3750, lng: -81.5250 }, neighbors: ['i4_south', 'disney_springs'] },
  
  { id: 'sand_lake_west', coords: { lat: 28.4500, lng: -81.4950 }, neighbors: ['i4_sand_lake'] },
  { id: 'sand_lake_idrive', coords: { lat: 28.4500, lng: -81.4660 }, neighbors: ['i4_sand_lake', 'idrive_north', 'capital_grille', 'sand_lake_east'] },
  { id: 'sand_lake_east', coords: { lat: 28.4500, lng: -81.4520 }, neighbors: ['sand_lake_idrive', 'universal_blvd_1'] },
  
  { id: 'idrive_north', coords: { lat: 28.4650, lng: -81.4600 }, neighbors: ['sand_lake_idrive'] },
  { id: 'capital_grille', coords: { lat: 28.4382, lng: -81.4695 }, neighbors: ['sand_lake_idrive', 'convention_ctr'] },
  { id: 'convention_ctr', coords: { lat: 28.4285, lng: -81.4647 }, neighbors: ['capital_grille', 'universal_blvd_2', 'beachline_west', 'idrive_south'] },
  { id: 'idrive_south', coords: { lat: 28.4150, lng: -81.4600 }, neighbors: ['convention_ctr', 'cf_pkwy'] },
  
  { id: 'cf_pkwy', coords: { lat: 28.4100, lng: -81.4450 }, neighbors: ['idrive_south', 'ritz_carlton'] },
  { id: 'ritz_carlton', coords: { lat: 28.4067, lng: -81.4332 }, neighbors: ['cf_pkwy'] },
  
  { id: 'beachline_west', coords: { lat: 28.4280, lng: -81.4640 }, neighbors: ['convention_ctr', 'universal_blvd_2', 'beachline_mid'] },
  { id: 'beachline_mid', coords: { lat: 28.4280, lng: -81.4000 }, neighbors: ['beachline_west', 'mco_airport'] },
  { id: 'mco_airport', coords: { lat: 28.4312, lng: -81.3081 }, neighbors: ['beachline_mid'] },
  
  { id: 'disney_springs', coords: { lat: 28.3712, lng: -81.5175 }, neighbors: ['i4_disney'] },
];

function distanceSquared(c1: Coordinates, c2: Coordinates): number {
  const dLat = c1.lat - c2.lat;
  const dLng = c1.lng - c2.lng;
  return dLat * dLat + dLng * dLng;
}

function findClosestNodeId(target: Coordinates): string {
  let closestId = ORLANDO_GRAPH[0].id;
  let minDist = Infinity;
  for (const node of ORLANDO_GRAPH) {
    const dist = distanceSquared(target, node.coords);
    if (dist < minDist) {
      minDist = dist;
      closestId = node.id;
    }
  }
  return closestId;
}

/**
 * Algoritmo BFS para encontrar la ruta más corta sobre el grafo vial de Orlando
 */
function findPathOnGraph(startNodeId: string, endNodeId: string): Coordinates[] {
  if (startNodeId === endNodeId) {
    const node = ORLANDO_GRAPH.find(n => n.id === startNodeId);
    return node ? [node.coords] : [];
  }

  const queue: string[][] = [[startNodeId]];
  const visited = new Set<string>([startNodeId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const currentId = path[path.length - 1];

    if (currentId === endNodeId) {
      return path.map(id => ORLANDO_GRAPH.find(n => n.id === id)!.coords);
    }

    const node = ORLANDO_GRAPH.find(n => n.id === currentId);
    if (node) {
      for (const neighborId of node.neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push([...path, neighborId]);
        }
      }
    }
  }

  return [];
}

/**
 * Genera una polilínea densa y suave interpolando los puntos de la ruta offline de Orlando
 */
export function generateOrlandoOfflineRoute(
  start: Coordinates,
  end: Coordinates,
  pointsPerSegment = 8
): RouteGeometry {
  const startNodeId = findClosestNodeId(start);
  const endNodeId = findClosestNodeId(end);
  const graphCoords = findPathOnGraph(startNodeId, endNodeId);

  const rawWaypoints: Coordinates[] = [start, ...graphCoords, end];
  const denseCoordinates: Coordinates[] = [];

  for (let i = 0; i < rawWaypoints.length - 1; i++) {
    const segStart = rawWaypoints[i];
    const segEnd = rawWaypoints[i + 1];

    for (let j = 0; j < pointsPerSegment; j++) {
      const frac = j / pointsPerSegment;
      denseCoordinates.push({
        lat: segStart.lat + (segEnd.lat - segStart.lat) * frac,
        lng: segStart.lng + (segEnd.lng - segStart.lng) * frac,
      });
    }
  }
  denseCoordinates.push(end);

  // Estimación de distancia en metros y duración
  const dLat = (end.lat - start.lat) * 111000;
  const dLng = (end.lng - start.lng) * 111000 * Math.cos((start.lat * Math.PI) / 180);
  const straightDistance = Math.sqrt(dLat * dLat + dLng * dLng);
  const distanceMeters = Math.max(1200, Math.round(straightDistance * 1.35));
  // ~45 km/h promedio en Orlando = 12.5 m/s
  const durationSeconds = Math.max(90, Math.round(distanceMeters / 12.5));

  return {
    coordinates: denseCoordinates,
    distanceMeters,
    durationSeconds,
  };
}

/**
 * Obtiene la ruta: primero intenta OSRM online; si falla o no hay conexión, usa el ruteo offline de Orlando
 */
export async function getRouteOSRM(
  start: Coordinates,
  end: Coordinates
): Promise<RouteGeometry> {
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout rápido

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM HTTP status ${response.status}`);
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route from OSRM');
    }

    const route = data.routes[0];
    const coordinates: Coordinates[] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ lat, lng })
    );

    return {
      coordinates,
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration)
    };
  } catch (err) {
    // Modo 100% Offline garantizado para la demo de Orlando
    return generateOrlandoOfflineRoute(start, end);
  }
}
