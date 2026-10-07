import { Server, Socket } from 'socket.io';
import {
  DriverLocationUpdatePayload,
  DriverRegisterPayload,
  DriverStatusUpdatePayload,
  SOCKET_EVENTS,
} from '@driver-hub/shared';
import { store } from '../store.js';

export function registerDriverHandlers(io: Server, socket: Socket): void {
  // 1. Registro de Conductor
  socket.on(SOCKET_EVENTS.DRIVER_REGISTER, (payload: DriverRegisterPayload) => {
    if (!payload?.driver?.id) return;

    store.setDriver(payload.driver);
    store.bindSocket(socket.id, 'driver', payload.driver.id);

    // Si tiene un viaje activo asignado, volver a unirse a la sala
    const activeRide = store.getActiveRideByDriverId(payload.driver.id);
    if (activeRide) {
      socket.join(`ride_${activeRide.id}`);
      socket.emit(SOCKET_EVENTS.RIDE_UPDATED, { ride: activeRide });
    }

    // Sincronizar todos los conductores activos con los clientes
    io.emit(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: store.getAllDrivers() });
  });

  // 2. Cambio de Estado del Conductor (offline | available | busy)
  socket.on(SOCKET_EVENTS.DRIVER_STATUS_UPDATE, (payload: DriverStatusUpdatePayload) => {
    if (!payload?.driverId || !payload?.status) return;

    store.updateDriverStatus(payload.driverId, payload.status);
    io.emit(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: store.getAllDrivers() });
  });

  // 3. Telemetría de Ubicación
  socket.on(SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, (payload: DriverLocationUpdatePayload) => {
    if (!payload?.driverId || !payload?.location) return;

    store.updateDriverLocation(payload.driverId, payload.location, payload.heading || 0);

    // Determinar la sala del viaje: payload.rideId o buscar en store
    let targetRideId = payload.rideId;
    if (!targetRideId) {
      const activeRide = store.getActiveRideByDriverId(payload.driverId);
      if (activeRide) {
        targetRideId = activeRide.id;
      }
    }

    if (targetRideId) {
      // Retransmitir a la sala del viaje para el pasajero
      io.to(`ride_${targetRideId}`).emit(SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, payload);
    } else {
      // Si no está en viaje, sincronizar con el mapa general
      io.emit(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: store.getAllDrivers() });
    }
  });
}
