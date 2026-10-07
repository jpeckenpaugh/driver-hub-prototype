# Especificación Técnica de Producto, UX/UI y Contratos de Sistema
## Driver Hub Prototype 🚗💨

**Versión:** 1.0.0  
**Rol del Documento:** Lead Product Designer & System Architect  
**Audiencia:** Frontend Engineer, Backend Engineer, QA/Demo Presenters  

---

## 1. Visión General del Producto

Driver Hub Prototype es una plataforma web interactiva y en tiempo real que emula de extremo a extremo la experiencia de viaje compartido (tipo Uber, Lyft o Cabify) entre un **Pasajero (Rider)** y un **Conductor (Driver)**.

El objetivo principal es brindar una experiencia de demostración **inmediata, fluida y visualmente impactante**, con capacidad de ejecución tanto en dispositivos separados como en una vista de **pantalla dividida con mockups de smartphones duales** (`/?role=split`).

### Características Clave:
1. **Rutas reales por calles:** Integración con la API pública de **OSRM** (Open Source Routing Machine) para polilíneas y distancias reales sobre OpenStreetMap sin necesidad de API keys.
2. **Telemetría y simulación de alta fidelidad:** Movimiento suave del vehículo con interpolación, rotación del ícono según el rumbo (*bearing/heading*) y **barra de control de demo** (pausa, aceleración 1x / 2x / 5x, llegada inmediata).
3. **Flujo de estados realista:**  
   `idle` ➔ `requested` ➔ `accepted` (conductor va a pickup) ➔ `arrived_at_pickup` ➔ `in_progress` (viaje rumbo a dropoff) ➔ `completed` (resumen y calificación).
4. **Diseño Visual Moderno:** Estética inspirada en dark/modern mobility apps, microinteracciones, tarjetas flotantes con backdrop-blur y mapas responsivos con Leaflet.

---

## 2. Estructura del Monorepo

```
driver-hub-prototype/
├── package.json               # Configuración de workspaces (client, server, shared)
├── README.md
├── ARQUITECTURA.md
├── ESPECIFICACION_TECNICA.md  # Este documento
├── shared/                    # Tipos y constantes compartidas TypeScript
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types.ts           # Interfaces de datos y estados
│       ├── events.ts          # Contratos y payloads de Socket.io
│       └── presets.ts         # Puntos de interés y presets para la demo
├── server/                    # Backend Node.js + Express + Socket.io
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           # Servidor HTTP y Socket.io
│       ├── store.ts           # Estado en memoria (Drivers, Rides)
│       └── handlers/          # Manejadores de eventos de socket
│           ├── driverHandler.ts
│           └── rideHandler.ts
└── client/                    # Frontend React 19 + Vite + Tailwind CSS + Leaflet
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── App.tsx            # Enrutador por URL query (?role=rider|driver|split)
        ├── components/
        │   ├── common/        # Botones, Cards, Badges, Modals
        │   ├── map/           # MapContainer, CustomMarkers, PolylineRenderer
        │   ├── simulation/    # SimulationControls (Play/Pause, 1x/2x/5x, Skip)
        │   └── device/        # SmartphoneFrame (para el modo split)
        ├── views/
        │   ├── RiderView.tsx  # Vista completa de pasajero
        │   ├── DriverView.tsx # Vista completa de conductor
        │   └── SplitView.tsx  # Vista dual con 2 marcos móviles lado a lado
        ├── hooks/
        │   ├── useSocket.ts   # Conexión socket singleton / configurable
        │   ├── useRouting.ts  # Consulta a OSRM para obtener ruta y geometría
        │   └── useSimulator.ts# Lógica de interpolación y animación de coordenadas
        └── services/
            └── osrm.ts        # Cliente HTTP para router.project-osrm.org
```

---

## 3. Modelo de Datos y Máquina de Estados

### 3.1 Entidades de Dominio (`shared/src/types.ts`)

```typescript
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationPoint extends Coordinates {
  address: string;
  name?: string;
}

export type DriverStatus = 'offline' | 'available' | 'busy';

export interface Driver {
  id: string;
  name: string;
  avatar: string;
  vehicle: {
    model: string;
    plate: string;
    color: string;
  };
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

export interface Ride {
  id: string;
  riderId: string;
  rider: Rider;
  driverId?: string;
  driver?: Driver;
  pickup: LocationPoint;
  dropoff: LocationPoint;
  fare: number;               // Precio estimado en USD / Moneda local
  status: RideStatus;
  routeToPickup?: RouteGeometry; // Ruta del conductor al pasajero
  routeToDropoff?: RouteGeometry;// Ruta del viaje principal
  createdAt: number;
  acceptedAt?: number;
  completedAt?: number;
}
```

### 3.2 Diagrama de Máquina de Estados del Viaje

```
       [IDLE / Sin Viaje]
               |
        (ride:request)
               v
         [REQUESTED] ---------------------------(ride:cancel)-----> [CANCELLED]
               |                                                       ^
        (ride:accept)                                                  |
               v                                                       |
          [ACCEPTED] (Driver en camino a pickup) --(ride:cancel)-------+
               |
      (ride:arrived_pickup)
               v
     [ARRIVED_AT_PICKUP] (Esperando a abordar) ---(ride:cancel)--------+
               |
        (ride:start_trip)
               v
        [IN_PROGRESS] (En ruta al destino final)
               |
       (ride:complete_trip)
               v
          [COMPLETED] (Resumen & Calificación)
```

---

## 4. Contratos de Comunicación (Socket.io)

### 4.1 Definición de Eventos (`shared/src/events.ts`)

```typescript
// Nombre de los eventos tipados
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
} as const;
```

### 4.2 Payloads y Semántica de Mensajes

#### 1. `driver:register`
- **Emisor:** Conductor
- **Destinatario:** Servidor
- **Payload:**
```typescript
interface DriverRegisterPayload {
  driver: Driver;
}
```
- **Efecto:** El servidor registra el driver en el store en memoria. Si el estado es `'available'`, lo incluye en el broadcast de conductores activos.

#### 2. `driver:location_update`
- **Emisor:** Conductor
- **Destinatario:** Servidor
- **Payload:**
```typescript
interface DriverLocationUpdatePayload {
  driverId: string;
  location: Coordinates;
  heading: number;
  rideId?: string;
}
```
- **Efecto:** El servidor actualiza la posición del conductor en memoria. Si tiene un `rideId`, retransmite a la room `ride_${rideId}` para que el pasajero vea el coche moverse en tiempo real sin latencia de polling.

#### 3. `ride:request`
- **Emisor:** Pasajero
- **Destinatario:** Servidor
- **Payload:**
```typescript
interface RideRequestPayload {
  rider: Rider;
  pickup: LocationPoint;
  dropoff: LocationPoint;
  fare: number;
  routeGeometry: RouteGeometry;
}
```
- **Efecto:** El backend genera un nuevo `rideId`, guarda el estado como `'requested'`, une el socket del pasajero a la room `ride_${rideId}`, y emite `ride:offer` a los conductores con estado `'available'`.

#### 4. `ride:offer`
- **Emisor:** Servidor
- **Destinatario:** Conductores disponibles (o broadcast a todos los conductores activos en la demo)
- **Payload:**
```typescript
interface RideOfferPayload {
  ride: Ride;
}
```

#### 5. `ride:accept`
- **Emisor:** Conductor
- **Destinatario:** Servidor
- **Payload:**
```typescript
interface RideAcceptPayload {
  rideId: string;
  driverId: string;
  routeToPickup: RouteGeometry; // Calculada por el driver desde su ubicación actual hasta el pickup
}
```
- **Efecto:** El viaje cambia a `'accepted'`. El conductor pasa a `'busy'`. Se une el socket del conductor a la room `ride_${rideId}`. Se emite `ride:updated` a la room con los datos del viaje y del conductor.

#### 6. `ride:arrived_pickup`
- **Emisor:** Conductor
- **Destinatario:** Servidor
- **Payload:** `{ rideId: string; driverId: string }`
- **Efecto:** El viaje cambia a `'arrived_at_pickup'`. Notifica al pasajero con alerta sonora/visual: *"¡Tu conductor ha llegado!"*.

#### 7. `ride:start_trip`
- **Emisor:** Conductor
- **Destinatario:** Servidor
- **Payload:** `{ rideId: string; driverId: string }`
- **Efecto:** El viaje cambia a `'in_progress'`. Ambos clientes actualizan su vista a la etapa de viaje en curso hacia el dropoff.

#### 8. `ride:complete_trip`
- **Emisor:** Conductor
- **Destinatario:** Servidor
- **Payload:** `{ rideId: string; driverId: string }`
- **Efecto:** El viaje cambia a `'completed'`. El conductor vuelve a quedar en estado `'available'`. El pasajero ve la pantalla de cobro y calificación de 5 estrellas.

#### 9. `ride:cancel`
- **Emisor:** Pasajero o Conductor
- **Destinatario:** Servidor
- **Payload:** `{ rideId: string; cancelledBy: 'rider' | 'driver'; reason?: string }`
- **Efecto:** El viaje cambia a `'cancelled'`. Se libera al conductor si ya estaba asignado.

---

## 5. Servicio de Enrutamiento (OSRM) y Simulación

### 5.1 Integración OSRM Client-Side
Se utilizará la API pública de demostración de OSRM:
`https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson`

- **Entrada:** `(start: Coordinates, end: Coordinates)`
- **Salida:**
  - `coordinates`: Lista de pares `[lat, lng]` (transformados del GeoJSON `[lng, lat]`).
  - `distanceMeters`: Distancia total en metros.
  - `durationSeconds`: Duración estimada en segundos.
  - `fallback`: En caso de fallo de red o timeout de la API pública de OSRM, el servicio implementa una interpolación lineal de 20 puntos como fallback automático para garantizar que la demo nunca se bloquee.

### 5.2 Motor de Simulación (`useSimulator`)
El cliente del **Conductor** es el maestro de la simulación:
1. Al entrar en estado `accepted`, simula el trayecto desde su ubicación actual hasta `pickup`.
2. Al pulsar "Iniciar Viaje" (`in_progress`), simula el trayecto desde `pickup` hasta `dropoff`.
3. **Cálculo de Rumbo (Heading):**
   ```typescript
   export function calculateHeading(from: Coordinates, to: Coordinates): number {
     const y = Math.sin(to.lng - from.lng) * Math.cos(to.lat);
     const x = Math.cos(from.lat) * Math.sin(to.lat) -
               Math.sin(from.lat) * Math.cos(to.lat) * Math.cos(to.lng - from.lng);
     return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
   }
   ```
4. **Controles de Demo (SimulationControls Component):**
   - **Play / Pause:** Detiene o reanuda el avance de la interpolación.
   - **Speed Multiplier:** Botones `1x`, `2x`, `5x` para ajustar el tiempo de paso.
   - **Llegada Rápida (Skip to End):** Salta inmediatamente al 98% de la ruta actual para disparar el evento de llegada en 1 segundo.

---

## 6. Especificación de UX / UI y Wireframes

### 6.1 Presets Geográficos Predeterminados (Madrid Centro por Defecto)
Para una demo sin fricción, se configuran accesos directos con coordenadas preestablecidas:
1. **Sol / Gran Vía:** `{ lat: 40.4168, lng: -3.7038, name: "Puerta del Sol" }`
2. **Aeropuerto Madrid-Barajas:** `{ lat: 40.4983, lng: -3.5676, name: "Aeropuerto T4" }`
3. **Estación de Atocha:** `{ lat: 40.4065, lng: -3.6907, name: "Estación de Atocha" }`
4. **Estadio Santiago Bernabéu:** `{ lat: 40.4530, lng: -3.6883, name: "Estadio Bernabéu" }`
5. **Parque del Retiro:** `{ lat: 40.4153, lng: -3.6844, name: "Parque del Retiro" }`

*(El usuario también puede hacer clic libremente en cualquier punto del mapa para fijar Origen o Destino).*

---

### 6.2 Wireframes y Layouts

#### A. Vista Dividida Dual (`SplitView.tsx` - `/?role=split`)
```
+-----------------------------------------------------------------------------------------+
|  DRIVER HUB PROTOTYPE  [🔴 Desconectar / Reiniciar Demo]  [⚙️ Configuración Madrid]      |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|       +-----------------------------+             +-----------------------------+       |
|       |       📱 RIDER PHONE        |             |       📱 DRIVER PHONE       |       |
|       | +-------------------------+ |             | +-------------------------+ |       |
|       | | 🟢 En Línea   12:30 PM  | |             | | 🚗 Conductor   12:30 PM | |       |
|       | |-------------------------| |             | |-------------------------| |       |
|       | |                         | |             | |                         | |       |
|       | |      [ MAPA LEAFLET ]   | |             | |      [ MAPA LEAFLET ]   | |       |
|       | |   - Marcador Origen     | |             | |   - Coche en vivo       | |       |
|       | |   - Marcador Destino    | |             | |   - Ruta resaltada      | |       |
|       | |   - Polyline de ruta    | |             | |   - Marcador Destino    | |       |
|       | |                         | |             | |                         | |       |
|       | |-------------------------| |             | |-------------------------| |       |
|       | | [ PANEL FLOTANTE UX ]   | |             | | [ PANEL FLOTANTE UX ]   | |       |
|       | | - Selección de destinos | |             | | - Botón "Aceptar Viaje" | |       |
|       | | - Tarifa estimada       | |             | | - Control de Simulación | |       |
|       | | - Botón "Pedir Ride"    | |             | |   [ ▶️ 1x 2x 5x ⏭️ Salto] | |       |
|       | | - Info del Conductor    | |             | | - Botón "Iniciar/Fin"   | |       |
|       | +-------------------------+ |             | +-------------------------+ |       |
|       +-----------------------------+             +-----------------------------+       |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
```

#### B. Componentes del Pasajero (`RiderView`)
1. **Fase 1: Configuración de Viaje (`idle`)**
   - Inputs con autocompletado rápido ("Desde: Mi Ubicación", "Hasta: ¿A dónde vas?").
   - Chips rápidos con los presets (Aeropuerto, Bernabéu, Atocha).
   - Selector de tipo de vehículo: **Standard** ($12.50) | **Comfort** ($18.00) | **Black** ($25.00).
   - Botón CTA destacado: `Solicitar Conductor`.

2. **Fase 2: Búsqueda (`requested`)**
   - Tarjeta con radar/pulso animado: *"Buscando conductores cercanos..."*.
   - Botón secundario: `Cancelar Solicitud`.

3. **Fase 3: Conductor Asignado (`accepted` & `arrived_at_pickup`)**
   - Tarjeta de información del conductor: Foto/Avatar, Nombre ("Carlos Gómez"), Calificación (⭐ 4.9), Vehículo ("Toyota Corolla Blanco - 4829-KLM").
   - Indicador dinámico de ETA: *"Llegando en 3 min"*.
   - Badge especial al llegar: *"¡Tu conductor está afuera esperando!"*.

4. **Fase 4: Viaje en Curso (`in_progress`)**
   - Visualización de la ruta en verde con progreso del coche.
   - ETA al destino final.

5. **Fase 5: Fin del Viaje (`completed`)**
   - Modal de recibo: Resumen de distancia, tiempo y total pagado.
   - Selector de calificación de 5 estrellas con botón `Completar y Volver al Inicio`.

#### C. Componentes del Conductor (`DriverView`)
1. **Fase 1: Espera (`available`)**
   - Toggle switch superior: `En Línea / Desconectado`.
   - Tarjeta de métricas rápidas del día: Ganancias acumuladas ($48.50), Viajes realizados (3).

2. **Fase 2: Solicitud Entrante (`ride:offer`)**
   - Alerta visual con temporizador de 15 segundos.
   - Datos del viaje: Distancia al pickup, destino, ganancia estimada ($12.50).
   - Botón grande verde: `Aceptar Viaje` y botón de rechazo.

3. **Fase 3: En Camino a Pickup (`accepted`)**
   - Botones de navegación.
   - Barra de control de simulación (`Play`, `1x / 2x / 5x`, `Simular Llegada`).
   - Botón al llegar a destino: `Marcar Llegada a Pickup` (o auto-disparado al completar la ruta).

4. **Fase 4: En Trayecto al Destino (`in_progress`)**
   - Botón `Iniciar Viaje` (una vez el pasajero sube).
   - La simulación avanza por la ruta al dropoff.
   - Al llegar: Botón `Finalizar Viaje`.

---

## 7. Plan de Tareas para Ingeniería

### Para el Ingeniero de Backend:
1. **Inicialización de Workspaces:**
   - Crear estructura `shared/` y `server/`.
   - Exportar tipos de eventos y payloads desde `shared/src/events.ts` y `types.ts`.
2. **Servidor Socket.io (`server/src/index.ts`):**
   - Configurar servidor Express + Socket.io con CORS permisivo para desarrollo (`*`).
   - Implementar el almacén en memoria `store.ts` (`driversMap`, `ridesMap`).
3. **Manejadores de Eventos:**
   - `driverHandler.ts`: Registro, cambio de estado de conductor, broadcast de conductores activos.
   - `rideHandler.ts`: Creación de viaje, broadcast de oferta a conductores disponibles, lógica de rooms por `rideId`, retransmisión de estados y telemetría.

### Para el Ingeniero de Frontend:
1. **Inicialización del Cliente (`client/`):**
   - Configurar Vite + React 19 + Tailwind CSS + Leaflet.
   - Instalar `@types/leaflet`, `leaflet`, `socket.io-client`, `lucide-react`.
2. **Servicio OSRM & Mapa:**
   - Crear `services/osrm.ts` para consultar rutas y generar GeoJSON.
   - Crear componentes de mapa con iconos personalizados de coche (rotables según heading), pines de origen y destino.
3. **Hook de Simulación:**
   - Implementar `useSimulator.ts` con interpolación de puntos, manejo de velocidades y emisión de `driver:location_update`.
4. **Vistas y Modo Split:**
   - Crear `SmartphoneFrame` con notch, bordes redondeados y aspecto nativo móvil.
   - Desarrollar `RiderView.tsx`, `DriverView.tsx` y ensamblar `SplitView.tsx` responsivo con la barra de herramientas de demo.

---

## 8. Criterios de Aceptación (Definición de Terminado - DoD)
- [ ] Iniciar el proyecto con un único comando (`npm run dev`) levanta backend y frontend concurrentemente.
- [ ] En `http://localhost:5173/?role=split`, se visualizan ambos teléfonos funcionando al unísono.
- [ ] Al seleccionar un origen/destino en el teléfono del Pasajero y pulsar "Solicitar", el teléfono del Conductor recibe la oferta al instante.
- [ ] Al aceptar, el coche del Conductor se desplaza sobre las calles de Madrid siguiendo la ruta OSRM y el Pasajero ve el movimiento reflejado en su pantalla.
- [ ] Los botones de demo (1x, 2x, 5x, llegada rápida) alteran la velocidad de movimiento de forma visible y sin saltos bruscos.
- [ ] El ciclo completo de estados termina con la pantalla de calificación y permite reiniciar un nuevo viaje inmediatamente.
