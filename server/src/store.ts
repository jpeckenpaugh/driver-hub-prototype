import {
  Coordinates,
  Driver,
  DriverStatus,
  INITIAL_MOCK_DRIVERS,
  Ride,
  RideStatus,
} from '@driver-hub/shared';

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

    // Precargar conductores mock de fondo en Madrid
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

  public removeDriver(id: string): void {
    this.drivers.delete(id);
  }

  // --- Rides ---
  public getRide(id: string): Ride | undefined {
    return this.rides.get(id);
  }

  public getAllRides(): Ride[] {
    return Array.from(this.rides.values());
  }

  public getActiveRideByDriverId(driverId: string): Ride | undefined {
    return Array.from(this.rides.values()).find(
      (r) =>
        r.driverId === driverId &&
        r.status !== 'completed' &&
        r.status !== 'cancelled'
    );
  }

  public getActiveRideByRiderId(riderId: string): Ride | undefined {
    return Array.from(this.rides.values()).find(
      (r) =>
        r.riderId === riderId &&
        r.status !== 'completed' &&
        r.status !== 'cancelled'
    );
  }

  public createRide(ride: Ride): Ride {
    this.rides.set(ride.id, ride);
    return ride;
  }

  public updateRide(id: string, updates: Partial<Ride>): Ride | undefined {
    const ride = this.rides.get(id);
    if (!ride) return undefined;

    const updatedRide: Ride = { ...ride, ...updates };
    this.rides.set(id, updatedRide);
    return updatedRide;
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
      if (this.driverToSocket.get(driverId) === socketId) {
        this.driverToSocket.delete(driverId);
      }
      return { role: 'driver', entityId: driverId };
    }

    if (this.socketToRider.has(socketId)) {
      const riderId = this.socketToRider.get(socketId)!;
      this.socketToRider.delete(socketId);
      if (this.riderToSocket.get(riderId) === socketId) {
        this.riderToSocket.delete(riderId);
      }
      return { role: 'rider', entityId: riderId };
    }

    return {};
  }

  public getSocketIdForDriver(driverId: string): string | undefined {
    return this.driverToSocket.get(driverId);
  }

  public getSocketIdForRider(riderId: string): string | undefined {
    return this.riderToSocket.get(riderId);
  }

  public getDriverIdForSocket(socketId: string): string | undefined {
    return this.socketToDriver.get(socketId);
  }

  public getRiderIdForSocket(socketId: string): string | undefined {
    return this.socketToRider.get(socketId);
  }
}

export const store = new AppStore();
