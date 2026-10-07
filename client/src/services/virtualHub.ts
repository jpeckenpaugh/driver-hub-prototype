import {
  SOCKET_EVENTS,
  sharedStore,
  Ride,
  DriverRegisterPayload,
  DriverLocationUpdatePayload,
  DriverStatusUpdatePayload,
  RideRequestPayload,
  RideAcceptPayload,
  RideArrivedPickupPayload,
  RideStartTripPayload,
  RideCompleteTripPayload,
  RideCancelPayload,
} from '@driver-hub/shared';

type EventListener = (...args: any[]) => void;

/**
 * Hub virtual de eventos que emula el servidor Socket.io en el navegador.
 * Comparte exactamente la misma instancia de AppStore y ejecuta los mismos contratos de negocio.
 */
class InBrowserVirtualHub {
  private channels: Map<string, Set<VirtualSocket>> = new Map();
  private store = sharedStore;

  constructor() {
    this.store.seedInitialData();
  }

  public registerSocket(socket: VirtualSocket): void {
    // Sala global
    this.joinRoom('global', socket);
  }

  public unregisterSocket(socket: VirtualSocket): void {
    this.leaveAllRooms(socket);
    const unbindResult = this.store.unbindSocket(socket.id);
    if (unbindResult.role === 'driver') {
      this.store.updateDriverStatus(unbindResult.entityId!, 'offline');
      this.broadcast(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: this.store.getAllDrivers() });
    }
  }

  public joinRoom(room: string, socket: VirtualSocket): void {
    if (!this.channels.has(room)) {
      this.channels.set(room, new Set());
    }
    this.channels.get(room)!.add(socket);
  }

  public leaveAllRooms(socket: VirtualSocket): void {
    for (const sockets of this.channels.values()) {
      sockets.delete(socket);
    }
  }

  public broadcast(event: string, payload: any): void {
    for (const socket of this.channels.get('global') || []) {
      socket._receiveEvent(event, payload);
    }
  }

  public emitToRoom(room: string, event: string, payload: any): void {
    const sockets = this.channels.get(room);
    if (sockets) {
      for (const socket of sockets) {
        socket._receiveEvent(event, payload);
      }
    }
  }

  /**
   * Procesa los eventos emitidos por los clientes usando la misma lógica que los handlers de Node.js
   */
  public handleClientEvent(socket: VirtualSocket, event: string, payload: any): void {
    switch (event) {
      case SOCKET_EVENTS.DRIVER_REGISTER: {
        const data = payload as DriverRegisterPayload;
        if (!data?.driver?.id) return;
        this.store.setDriver(data.driver);
        this.store.bindSocket(socket.id, 'driver', data.driver.id);
        this.broadcast(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: this.store.getAllDrivers() });
        break;
      }

      case SOCKET_EVENTS.DRIVER_LOCATION_UPDATE: {
        const data = payload as DriverLocationUpdatePayload;
        if (!data?.driverId || !data?.location) return;
        this.store.updateDriverLocation(data.driverId, data.location, data.heading || 0);

        if (data.rideId) {
          this.emitToRoom(`ride_${data.rideId}`, SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, data);
        } else {
          this.broadcast(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: this.store.getAllDrivers() });
        }
        break;
      }

      case SOCKET_EVENTS.DRIVER_STATUS_UPDATE: {
        const data = payload as DriverStatusUpdatePayload;
        if (!data?.driverId || !data?.status) return;
        this.store.updateDriverStatus(data.driverId, data.status);
        this.broadcast(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: this.store.getAllDrivers() });
        break;
      }

      case SOCKET_EVENTS.RIDE_REQUEST: {
        const data = payload as RideRequestPayload;
        if (!data?.rider?.id || !data?.pickup || !data?.dropoff) return;

        const rideId = `ride-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;
        const newRide: Ride = {
          id: rideId,
          riderId: data.rider.id,
          rider: data.rider,
          pickup: data.pickup,
          dropoff: data.dropoff,
          fare: data.fare || 12.5,
          status: 'requested',
          routeToDropoff: data.routeGeometry,
          createdAt: Date.now(),
        };

        this.store.createRide(newRide);
        this.store.bindSocket(socket.id, 'rider', data.rider.id);
        this.joinRoom(`ride_${rideId}`, socket);

        // Notificar al pasajero
        socket._receiveEvent(SOCKET_EVENTS.RIDE_UPDATED, { ride: newRide });

        // Difundir oferta a todos los conductores disponibles
        this.broadcast(SOCKET_EVENTS.RIDE_OFFER, { ride: newRide });
        break;
      }

      case SOCKET_EVENTS.RIDE_ACCEPT: {
        const data = payload as RideAcceptPayload;
        if (!data?.rideId || !data?.driverId) return;

        const ride = this.store.getRide(data.rideId);
        if (!ride || ride.status !== 'requested') return;

        this.store.updateDriverStatus(data.driverId, 'busy');
        const updatedDriver = this.store.getDriver(data.driverId);

        const updatedRide = this.store.updateRide(data.rideId, {
          driverId: data.driverId,
          driver: updatedDriver,
          routeToPickup: data.routeToPickup,
          status: 'accepted',
          acceptedAt: Date.now(),
        });

        if (!updatedRide) return;

        this.joinRoom(`ride_${data.rideId}`, socket);
        this.store.bindSocket(socket.id, 'driver', data.driverId);

        // Notificar a la sala del viaje (rider y driver)
        this.emitToRoom(`ride_${data.rideId}`, SOCKET_EVENTS.RIDE_UPDATED, { ride: updatedRide });
        this.broadcast(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: this.store.getAllDrivers() });
        break;
      }

      case SOCKET_EVENTS.RIDE_ARRIVED_PICKUP: {
        const data = payload as RideArrivedPickupPayload;
        if (!data?.rideId) return;

        const updatedRide = this.store.updateRide(data.rideId, { status: 'arrived_at_pickup' });
        if (updatedRide) {
          this.emitToRoom(`ride_${data.rideId}`, SOCKET_EVENTS.RIDE_UPDATED, { ride: updatedRide });
        }
        break;
      }

      case SOCKET_EVENTS.RIDE_START_TRIP: {
        const data = payload as RideStartTripPayload;
        if (!data?.rideId) return;

        const updatedRide = this.store.updateRide(data.rideId, {
          status: 'in_progress',
        });
        if (updatedRide) {
          this.emitToRoom(`ride_${data.rideId}`, SOCKET_EVENTS.RIDE_UPDATED, { ride: updatedRide });
        }
        break;
      }


      case SOCKET_EVENTS.RIDE_COMPLETE_TRIP: {
        const data = payload as RideCompleteTripPayload;
        if (!data?.rideId) return;

        const updatedRide = this.store.updateRide(data.rideId, {
          status: 'completed',
          completedAt: Date.now(),
        });

        if (updatedRide && updatedRide.driverId) {
          this.store.updateDriverStatus(updatedRide.driverId, 'available');
          this.emitToRoom(`ride_${data.rideId}`, SOCKET_EVENTS.RIDE_UPDATED, { ride: updatedRide });
          this.broadcast(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: this.store.getAllDrivers() });
        }
        break;
      }

      case SOCKET_EVENTS.RIDE_CANCEL: {
        const data = payload as RideCancelPayload;
        if (!data?.rideId) return;

        const updatedRide = this.store.updateRide(data.rideId, { status: 'cancelled' });
        if (updatedRide) {
          if (updatedRide.driverId) {
            this.store.updateDriverStatus(updatedRide.driverId, 'available');
          }
          this.emitToRoom(`ride_${data.rideId}`, SOCKET_EVENTS.RIDE_UPDATED, { ride: updatedRide });
          this.broadcast(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: this.store.getAllDrivers() });
        }
        break;
      }

      case 'demo:reset': {
        this.store.seedInitialData();
        this.broadcast(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: this.store.getAllDrivers() });
        break;
      }
    }
  }
}

export const virtualHub = new InBrowserVirtualHub();

/**
 * Emula la API de Socket.io (socket.on, socket.emit, socket.off) conectado al hub en memoria.
 */
export class VirtualSocket {
  public id: string;
  private listeners: Map<string, Set<EventListener>> = new Map();
  public role: string;

  constructor(role: string) {
    this.id = `virtual-${role}-${Math.random().toString(36).slice(2, 9)}`;
    this.role = role;
    virtualHub.registerSocket(this);

    // Notificar connect en el siguiente microtask para simular handshake
    setTimeout(() => {
      this._receiveEvent('connect');
      this._receiveEvent(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, {
        drivers: sharedStore.getAllDrivers(),
      });
    }, 50);
  }

  public emit(event: string, payload?: any): this {
    setTimeout(() => {
      virtualHub.handleClientEvent(this, event, payload);
    }, 10);
    return this;
  }

  public on(event: string, callback: EventListener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return this;
  }

  public off(event: string, callback?: EventListener): this {
    if (!callback) {
      this.listeners.delete(event);
    } else {
      const set = this.listeners.get(event);
      if (set) {
        set.delete(callback);
      }
    }
    return this;
  }

  public disconnect(): this {
    virtualHub.unregisterSocket(this);
    this._receiveEvent('disconnect', 'io client disconnect');
    return this;
  }

  public _receiveEvent(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(...args);
        } catch (err) {
          console.error(`[VirtualSocket ${this.role}] Error in listener for ${event}:`, err);
        }
      }
    }
  }
}
