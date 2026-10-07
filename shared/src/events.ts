import {
  Coordinates,
  Driver,
  DriverStatus,
  LocationPoint,
  Ride,
  Rider,
  RouteGeometry,
} from './types.js';

export const SOCKET_EVENTS = {
  // Conexión y Presencia Conductor
  DRIVER_REGISTER: 'driver:register',
  DRIVER_STATUS_UPDATE: 'driver:status_update',
  DRIVER_LOCATION_UPDATE: 'driver:location_update',

  // Flujo del Viaje
  RIDE_REQUEST: 'ride:request',
  RIDE_OFFER: 'ride:offer',                 // Servidor -> Drivers disponibles
  RIDE_ACCEPT: 'ride:accept',
  RIDE_ARRIVED_PICKUP: 'ride:arrived_pickup',
  RIDE_START_TRIP: 'ride:start_trip',
  RIDE_COMPLETE_TRIP: 'ride:complete_trip',
  RIDE_CANCEL: 'ride:cancel',

  // Notificaciones y Sincronización Global / Room
  RIDE_UPDATED: 'ride:updated',             // Servidor -> Clientes en la sala
  ACTIVE_DRIVERS_SYNC: 'drivers:sync',      // Servidor -> Rider (conductores cercanos en el mapa)

  // Errores / Avisos
  RIDE_ERROR: 'ride:error',
} as const;

export type SocketEventType = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

export interface DriverRegisterPayload {
  driver: Driver;
}

export interface DriverStatusUpdatePayload {
  driverId: string;
  status: DriverStatus;
}

export interface DriverLocationUpdatePayload {
  driverId: string;
  location: Coordinates;
  heading: number;
  rideId?: string;
}

export interface RideRequestPayload {
  rider: Rider;
  pickup: LocationPoint;
  dropoff: LocationPoint;
  fare: number;
  routeGeometry: RouteGeometry;
}

export interface RideOfferPayload {
  ride: Ride;
}

export interface RideAcceptPayload {
  rideId: string;
  driverId: string;
  routeToPickup: RouteGeometry;
}

export interface RideArrivedPickupPayload {
  rideId: string;
  driverId: string;
}

export interface RideStartTripPayload {
  rideId: string;
  driverId: string;
}

export interface RideCompleteTripPayload {
  rideId: string;
  driverId: string;
}

export interface RideCancelPayload {
  rideId: string;
  cancelledBy: 'rider' | 'driver';
  reason?: string;
}

export interface RideUpdatedPayload {
  ride: Ride;
}

export interface ActiveDriversSyncPayload {
  drivers: Driver[];
}

export interface RideErrorPayload {
  message: string;
  rideId?: string;
}
