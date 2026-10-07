export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationPoint extends Coordinates {
  address: string;
  name?: string;
}

export type DriverStatus = 'offline' | 'available' | 'busy';

export interface DriverVehicle {
  model: string;
  plate: string;
  color: string;
}

export interface Driver {
  id: string;
  name: string;
  avatar: string;
  vehicle: DriverVehicle;
  rating: number;
  status: DriverStatus;
  currentLocation: Coordinates;
  heading: number; // Orientación en grados (0-360)
}

export interface Rider {
  id: string;
  name: string;
  avatar: string;
  rating: number;
}

export type RideStatus =
  | 'idle'
  | 'requested'          // Pasajero solicitó viaje; buscando conductor
  | 'accepted'           // Conductor aceptó y va camino al pickup
  | 'arrived_at_pickup'  // Conductor llegó al punto de recogida
  | 'in_progress'        // Pasajero subió; en trayecto a dropoff
  | 'completed'          // Llegada al destino final
  | 'cancelled';         // Cancelado por rider o driver

export interface RouteGeometry {
  coordinates: Coordinates[]; // Array ordenado de puntos de la calle
  distanceMeters: number;
  durationSeconds: number;
}

export type VehicleTier = 'standard' | 'comfort' | 'black';

export interface Ride {
  id: string;
  riderId: string;
  rider: Rider;
  driverId?: string;
  driver?: Driver;
  pickup: LocationPoint;
  dropoff: LocationPoint;
  fare: number;               // Precio estimado en USD / Moneda local
  tier?: VehicleTier;
  status: RideStatus;
  routeToPickup?: RouteGeometry; // Ruta del conductor al pasajero
  routeToDropoff?: RouteGeometry;// Ruta del viaje principal
  createdAt: number;
  acceptedAt?: number;
  completedAt?: number;
  cancelledAt?: number;
  cancelledBy?: 'rider' | 'driver';
  cancelReason?: string;
}
