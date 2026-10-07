import {
  Coordinates,
  Driver,
  DriverStatus,
  Ride,
  RideStatus,
} from './types.js';
import { INITIAL_MOCK_DRIVERS } from './presets.js';


export class AppStore {
  private drivers: Map<string, Driver> = new Map();
  private rides: Map<string, Ride> = new Map();
  private socketToDriver: Map<string, string> = new Map();
  private socketToRider: Map<string, string> = new Map();
  private driverToSocket: Map<string, string> = new Map();
  private riderToSocket: Map<string, string> = new Map();

  constructor() {
    this.seedInitialData();
  }

  public seedInitialData(): void {
    this.drivers.clear();
    this.rides.clear();
    this.socketToDriver.clear();
    this.socketToRider.clear();
    this.driverToSocket.clear();
    this.riderToSocket.clear();

    // Precargar conductores mock de fondo en Orlando
    for (const mockDriver of INITIAL_MOCK_DRIVERS) {
      this.drivers.set(mockDriver.id, JSON.parse(JSON.stringify(mockDriver)));
    }
  }

  // --- Drivers ---
  public getDriver(id: string): Driver | undefined {
    return this.drivers.get(id);
  }

  public getAllDrivers(): Driver[] {
    return Array.from(this.drivers.values());
  }

  public getAvailableDrivers(): Driver[] {
    return Array.from(this.drivers.values()).filter((d) => d.status === 'available');
  }

  public setDriver(driver: Driver): void {
    this.drivers.set(driver.id, driver);
  }

  public updateDriverLocation(id: string, location: Coordinates, heading: number): Driver | undefined {
    const driver = this.drivers.get(id);
    if (!driver) return undefined;

    driver.currentLocation = location;
    driver.heading = heading;
    return driver;
  }

  public updateDriverStatus(id: string, status: DriverStatus): Driver | undefined {
    const driver = this.drivers.get(id);
    if (!driver) return undefined;

    driver.status = status;
    return driver;
  }

  // --- Rides ---
  public createRide(ride: Ride): void {
    this.rides.set(ride.id, ride);
  }

  public getRide(id: string): Ride | undefined {
    return this.rides.get(id);
  }

  public getAllRides(): Ride[] {
    return Array.from(this.rides.values());
  }

  public updateRide(id: string, updates: Partial<Ride>): Ride | undefined {
    const ride = this.rides.get(id);
    if (!ride) return undefined;

    const updated = { ...ride, ...updates };
    this.rides.set(id, updated);
    return updated;
  }

  public updateRideStatus(id: string, status: RideStatus): Ride | undefined {
    const ride = this.rides.get(id);
    if (!ride) return undefined;

    ride.status = status;
    return ride;
  }

  // --- Socket Bindings ---
  public bindSocket(socketId: string, role: 'driver' | 'rider', entityId: string): void {
    if (role === 'driver') {
      this.socketToDriver.set(socketId, entityId);
      this.driverToSocket.set(entityId, socketId);
    } else {
      this.socketToRider.set(socketId, entityId);
      this.riderToSocket.set(entityId, socketId);
    }
  }

  public unbindSocket(socketId: string): { role?: 'driver' | 'rider'; entityId?: string } {
    if (this.socketToDriver.has(socketId)) {
      const driverId = this.socketToDriver.get(socketId)!;
      this.socketToDriver.delete(socketId);
      this.driverToSocket.delete(driverId);
      return { role: 'driver', entityId: driverId };
    }

    if (this.socketToRider.has(socketId)) {
      const riderId = this.socketToRider.get(socketId)!;
      this.socketToRider.delete(socketId);
      this.riderToSocket.delete(riderId);
      return { role: 'rider', entityId: riderId };
    }

    return {};
  }

  public getSocketForDriver(driverId: string): string | undefined {
    return this.driverToSocket.get(driverId);
  }

  public getSocketForRider(riderId: string): string | undefined {
    return this.riderToSocket.get(riderId);
  }

  public getDriverBySocket(socketId: string): Driver | undefined {
    const driverId = this.socketToDriver.get(socketId);
    return driverId ? this.drivers.get(driverId) : undefined;
  }

  public getRiderIdBySocket(socketId: string): string | undefined {
    return this.socketToRider.get(socketId);
  }
}

export const sharedStore = new AppStore();
