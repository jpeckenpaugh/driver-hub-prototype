# Driver Hub Prototype 🚗💨

Un prototipo funcional, ligero y moderno de una plataforma de viajes compartidos tipo Uber/Cabify que conecta **Conductores** y **Pasajeros** en tiempo real.

---

## 🎯 Objetivo del Proyecto

Demostrar de forma rápida y tangible la interacción esencial entre pasajero y conductor:
- Solicitud de viaje en mapa interactivo.
- Notificación y aceptación en tiempo real por parte del conductor.
- Seguimiento visual de la ruta y actualizaciones de estado del viaje.
- Interfaz reactiva adaptable para demostraciones lado a lado (pantalla dividida o dos dispositivos).

---

## 🛠️ Stack Tecnológico Seleccionado

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS.
- **Mapas:** Leaflet / React-Leaflet + OpenStreetMap (cero fricción de claves de API para prototipado rápido).
- **Comunicación en Tiempo Real:** Node.js + Express + Socket.io (permite conexión entre diferentes navegadores o dispositivos en la misma red local).

---

## 🚀 Flujo Principal (User Journey)

```
[ Pasajero ]                          [ Backend (Socket.io) ]                         [ Conductor ]
      |                                          |                                          |
      |--- 1. Solicita viaje (Origen/Destino) -->|                                          |
      |                                          |--- 2. Notifica solicitud entrante ------>|
      |                                          |                                          |
      |                                          |<-- 3. Acepta viaje ----------------------|
      |<-- 4. Asigna conductor y ruta -----------|                                          |
      |                                          |                                          |
      |<-- 5. Actualizaciones de ubicación <-----|--- 5. Emite ubicación (telemetría) ------|
      |                                          |                                          |
      |<-- 6. Notifica: En viaje / Llegada <-----|--- 6. Inicia / Completa viaje -----------|
```

---

## 📂 Estructura del Repositorio

Consulta [ARQUITECTURA.md](file:///Users/jarad/git/driver-hub-prototype/ARQUITECTURA.md) para un desglose detallado de la arquitectura de datos, eventos y componentes.

---

## 💻 Puesta en Marcha (Próximamente)

```bash
# Instalar dependencias
npm install

# Iniciar servidor y cliente en modo desarrollo
npm run dev
```
