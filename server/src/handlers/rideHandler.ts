import { Server, Socket } from 'socket.io';
import { randomUUID } from 'node:crypto';
import {
  Ride,
  RideAcceptPayload,
  RideArrivedPickupPayload,
  RideCancelPayload,
  RideCompleteTripPayload,
  RideRequestPayload,
  RideStartTripPayload,
  SOCKET_EVENTS,
} from '@driver-hub/shared';
import { store } from '../store.js';

export function registerRideHandlers(io: Server, socket: Socket): void {
  // 1. Solicitud de Viaje (Pasajero)
  socket.on(SOCKET_EVENTS.RIDE_REQUEST, (payload: RideRequestPayload) => {
    if (!payload?.rider?.id || !payload?.pickup || !payload?.dropoff) {
      socket.emit(SOCKET_EVENTS.RIDE_ERROR, { message: 'Datos incompletos para solicitar viaje' });
      return;
    }

    const rideId = `ride-${Date.now().toString().slice(-6)}-${randomUUID().slice(0, 4)}`;
    const newRide: Ride = {
      id: rideId,
      riderId: payload.rider.id,
      rider: payload.rider,
      pickup: payload.pickup,
      dropoff: payload.dropoff,
      fare: payload.fare || 12.5,
      status: 'requested',
      routeToDropoff: payload.routeGeometry,
      createdAt: Date.now(),
    };

    store.createRide(newRide);
    store.bindSocket(socket.id, 'rider', payload.rider.id);

    // Unir al pasajero a la sala del viaje
    socket.join(`ride_${rideId}`);

    // Confirmar creación al pasajero
    socket.emit(SOCKET_EVENTS.RIDE_UPDATED, { ride: newRide });

    // Difundir oferta a todos los conductores disponibles (matchmaking broadcast)
    io.emit(SOCKET_EVENTS.RIDE_OFFER, { ride: newRide });
  });

  // 2. Conductor Acepta Viaje
  socket.on(SOCKET_EVENTS.RIDE_ACCEPT, (payload: RideAcceptPayload) => {
    if (!payload?.rideId || !payload?.driverId) return;

    const ride = store.getRide(payload.rideId);

    // Verificación atómica: el viaje debe existir y estar en estado 'requested'
    if (!ride || ride.status !== 'requested') {
      socket.emit(SOCKET_EVENTS.RIDE_ERROR, {
        rideId: payload.rideId,
        message: 'El viaje ya no está disponible o ha sido aceptado por otro conductor',
      });
      return;
    }

    const driver = store.getDriver(payload.driverId);
    if (!driver) {
      socket.emit(SOCKET_EVENTS.RIDE_ERROR, {
        rideId: payload.rideId,
        message: 'Conductor no registrado',
      });
      return;
    }

    // Actualizar estado del viaje y del conductor
    store.updateDriverStatus(payload.driverId, 'busy');
    const updatedDriver = store.getDriver(payload.driverId);

    const updatedRide = store.updateRide(payload.rideId, {
      driverId: payload.driverId,
      driver: updatedDriver,
      routeToPickup: payload.routeToPickup,
      status: 'accepted',
      acceptedAt: Date.now(),
    });

    if (!updatedRide) return;

    // Unir socket del conductor a la sala del viaje
    socket.join(`ride_${payload.rideId}`);
    store.bindSocket(socket.id, 'driver', payload.driverId);

    // Notificar a ambos (pasajero y conductor) en la sala
    io.to(`ride_${payload.rideId}`).emit(SOCKET_EVENTS.RIDE_UPDATED, { ride: updatedRide });

    // Sincronizar estado global de conductores
    io.emit(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: store.getAllDrivers() });
  });

  // 3. Conductor Llega al Punto de Recogida (Pickup)
  socket.on(SOCKET_EVENTS.RIDE_ARRIVED_PICKUP, (payload: RideArrivedPickupPayload) => {
    if (!payload?.rideId) return;

    const ride = store.getRide(payload.rideId);
    if (!ride || ride.status !== 'accepted') return;

    const updatedRide = store.updateRide(payload.rideId, {
      status: 'arrived_at_pickup',
    });

    if (updatedRide) {
      io.to(`ride_${payload.rideId}`).emit(SOCKET_EVENTS.RIDE_UPDATED, { ride: updatedRide });
    }
  });

  // 4. Iniciar Trayecto hacia Dropoff
  socket.on(SOCKET_EVENTS.RIDE_START_TRIP, (payload: RideStartTripPayload) => {
    if (!payload?.rideId) return;

    const ride = store.getRide(payload.rideId);
    if (!ride || (ride.status !== 'arrived_at_pickup' && ride.status !== 'accepted')) return;

    const updatedRide = store.updateRide(payload.rideId, {
      status: 'in_progress',
    });

    if (updatedRide) {
      io.to(`ride_${payload.rideId}`).emit(SOCKET_EVENTS.RIDE_UPDATED, { ride: updatedRide });
    }
  });

  // 5. Finalizar Viaje
  socket.on(SOCKET_EVENTS.RIDE_COMPLETE_TRIP, (payload: RideCompleteTripPayload) => {
    if (!payload?.rideId) return;

    const ride = store.getRide(payload.rideId);
    if (!ride || ride.status !== 'in_progress') return;

    const updatedRide = store.updateRide(payload.rideId, {
      status: 'completed',
      completedAt: Date.now(),
    });

    if (ride.driverId) {
      store.updateDriverStatus(ride.driverId, 'available');
    }

    if (updatedRide) {
      io.to(`ride_${payload.rideId}`).emit(SOCKET_EVENTS.RIDE_UPDATED, { ride: updatedRide });
    }

    // Sincronizar lista de conductores disponibles
    io.emit(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: store.getAllDrivers() });
  });

  // 6. Cancelar Viaje
  socket.on(SOCKET_EVENTS.RIDE_CANCEL, (payload: RideCancelPayload) => {
    if (!payload?.rideId) return;

    const ride = store.getRide(payload.rideId);
    if (!ride || ride.status === 'completed' || ride.status === 'cancelled') return;

    const updatedRide = store.updateRide(payload.rideId, {
      status: 'cancelled',
      cancelledAt: Date.now(),
      cancelledBy: payload.cancelledBy,
      cancelReason: payload.reason,
    });

    if (ride.driverId) {
      store.updateDriverStatus(ride.driverId, 'available');
    }

    if (updatedRide) {
      io.to(`ride_${payload.rideId}`).emit(SOCKET_EVENTS.RIDE_UPDATED, { ride: updatedRide });
    }

    io.emit(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: store.getAllDrivers() });
  });
}
