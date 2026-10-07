# Arquitectura del Sistema - Driver Hub Prototype

Este documento detalla las decisiones técnicas, modelos de datos, protocolos de eventos en tiempo real y la estructura de componentes para el prototipo.

---

## 1. Visión General de la Arquitectura

Para asegurar un desarrollo ágil y bajo acoplamiento, el proyecto utiliza una arquitectura de **Monorepo ligero** que combina un cliente web React y un servicio de orquestación en tiempo real con Node.js y Socket.io.

```
+-----------------------------------------------------------+
|                   Navegador / Cliente                     |
|                                                           |
|  +-----------------------+     +-----------------------+  |
|  |     Vista Pasajero    |     |    Vista Conductor    |  |
|  | (Selección, Solicitud)|     | (Online, Aceptar ruta)|  |
|  +-----------+-----------+     +-----------+-----------+  |
|              \                             /              |
|               \                           /               |
|            +---v-------------------------v---+            |
|            |      Socket.io Client Hook      |            |
+------------+---------------------------------+------------+
                              |
                     WebSockets (Eventos)
                              |
+-----------------------------v-----------------------------+
|                 Backend Node.js + Socket.io               |
|                                                           |
|  - Gestión de Estado en Memoria (Viajes activos, drivers) |
|  - Matchmaking y Despacho de Eventos                      |
+-----------------------------------------------------------+
```

---

## 2. Decisiones de Diseño

1. **Mapas sin fricción (OpenStreetMap + Leaflet):**
   - No requiere configuración de tarjetas ni API Keys (Google Maps/Mapbox).
   - Compatible con simuladores de coordenadas y rutas interpoladas.

2. **Sockets Bidireccionales (Socket.io):**
   - Permite pruebas multi-dispositivo inmediatas (ej. Móvil en modo conductor y Laptop en modo pasajero en la misma red Wi-Fi o mediante ngrok/túnel).
   - Reconexión automática y soporte de rooms por viaje (`ride_room_${rideId}`).

3. **Estado en Memoria para Prototipado Rápido:**
   - Para el prototipo, no se añade persistencia pesada (PostgreSQL/Redis) de entrada, manteniendo el código ligero y fácil de reiniciar.

4. **Modo Dual en Frontend:**
   - La aplicación incluye un selector de rol rápido:
     - `/?role=rider` (Vista Pasajero)
     - `/?role=driver` (Vista Conductor)
     - `/?role=split` (Vista Dual lado a lado para presentaciones de pantalla única).

---

## 3. Modelo de Datos Mínimo

### Entidad: Conductor (`Driver`)
```typescript
interface Driver {
  id: string;
  name: string;
  vehicle: string;
  plate: string;
  status: 'offline' | 'available' | 'busy';
  currentLocation: {
    lat: number;
    lng: number;
  };
}
```

### Entidad: Pasajero (`Rider`)
```typescript
interface Rider {
  id: string;
  name: string;
}
```

### Entidad: Viaje (`Ride`)
```typescript
interface Ride {
  id: string;
  riderId: string;
  driverId?: string;
  pickup: {
    lat: number;
    lng: number;
    address: string;
  };
  dropoff: {
    lat: number;
    lng: number;
    address: string;
  };
  fare: number;
  status: 
    | 'requested'    // Pasajero buscó viaje
    | 'accepted'     // Conductor asignado y en camino al punto de recogida
    | 'in_progress'  // Pasajero a bordo, rumbo al destino
    | 'completed'    // Viaje finalizado
    | 'cancelled';   // Cancelado por alguna de las partes
  createdAt: number;
}
```

---

## 4. Contrato de Eventos Socket.io

| Evento | Origen | Destino | Payload | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `driver:register` | Conductor | Servidor | `{ driverId, location }` | Conductor se pone en línea |
| `driver:location_update` | Conductor | Servidor / Room | `{ driverId, location, rideId? }` | Emisión periódica de coordenadas |
| `ride:request` | Pasajero | Servidor | `{ riderId, pickup, dropoff, fare }` | Solicitud de nuevo viaje |
| `ride:offer` | Servidor | Conductores disponibles | `Ride` | Emite oferta a conductores cercanos |
| `ride:accept` | Conductor | Servidor | `{ rideId, driverId }` | Conductor acepta la solicitud |
| `ride:status_change` | Servidor / Conductor | Pasajero / Conductor | `{ rideId, status, driverLocation? }` | Cambio de fase del viaje |

---

## 5. Fases de Implementación Sugeridas

1. **Fase 1 (Base):** Configuración de proyecto (Vite + Tailwind + Socket.io Server) y tipos comunes.
2. **Fase 2 (Mapa e Interfaz):** Renderizado de mapa con marcadores de inicio/fin y posición de conductor.
3. **Fase 3 (Conectividad en Tiempo Real):** Conexión de eventos entre pasajero y conductor.
4. **Fase 4 (Simulación de Movimiento):** Animación e interpolación del vehículo a lo largo del trayecto.
