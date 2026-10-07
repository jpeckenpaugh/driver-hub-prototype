import express from 'express';
import http from 'node:http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { SOCKET_EVENTS } from '@driver-hub/shared';
import { store } from './store.js';
import { registerDriverHandlers } from './handlers/driverHandler.js';
import { registerRideHandlers } from './handlers/rideHandler.js';

const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// --- HTTP Endpoints ---
app.get('/health', (_req, res) => {
  const allRides = store.getAllRides();
  const activeRides = allRides.filter((r) => r.status !== 'completed' && r.status !== 'cancelled');

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    driversCount: store.getAllDrivers().length,
    availableDriversCount: store.getAvailableDrivers().length,
    activeRidesCount: activeRides.length,
    totalRidesCount: allRides.length,
  });
});

app.get('/api/drivers', (_req, res) => {
  res.json({ drivers: store.getAllDrivers() });
});

app.get('/api/rides', (_req, res) => {
  res.json({ rides: store.getAllRides() });
});

app.post('/api/reset', (_req, res) => {
  store.seedInitialData();
  io.emit(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: store.getAllDrivers() });
  res.json({ success: true, message: 'Store reset to initial state with mock drivers' });
});

// --- Socket.io Lifecycle ---
io.on('connection', (socket: Socket) => {
  const query = socket.handshake.query;
  const role = typeof query.role === 'string' ? query.role : undefined;
  const driverId = typeof query.driverId === 'string' ? query.driverId : undefined;
  const riderId = typeof query.riderId === 'string' ? query.riderId : undefined;

  // Soporte directo para aislamiento de sockets en modo Split (?role=driver&driverId=... / ?role=rider&riderId=...)
  if (role === 'driver' && driverId) {
    store.bindSocket(socket.id, 'driver', driverId);
    const activeRide = store.getActiveRideByDriverId(driverId);
    if (activeRide) {
      socket.join(`ride_${activeRide.id}`);
      socket.emit(SOCKET_EVENTS.RIDE_UPDATED, { ride: activeRide });
    }
  } else if (role === 'rider' && riderId) {
    store.bindSocket(socket.id, 'rider', riderId);
    const activeRide = store.getActiveRideByRiderId(riderId);
    if (activeRide) {
      socket.join(`ride_${activeRide.id}`);
      socket.emit(SOCKET_EVENTS.RIDE_UPDATED, { ride: activeRide });
    }
  }

  // Enviar inmediatamente la lista de conductores activos al nuevo socket conectado
  socket.emit(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, { drivers: store.getAllDrivers() });

  // Registrar manejadores modulares
  registerDriverHandlers(io, socket);
  registerRideHandlers(io, socket);

  // Manejo de desconexión
  socket.on('disconnect', () => {
    store.unbindSocket(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚗 Driver Hub Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io ready for connections`);
});

export { app, server, io };
