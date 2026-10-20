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

## 💻 Puesta en Marcha

```bash
# Instalar dependencias
npm ci

# Iniciar servidor y cliente en modo desarrollo
npm run dev
```

- Cliente: http://localhost:5173
- Servidor / API: http://localhost:3001
- Demo dual: http://localhost:5173/?role=split

### Variables de entorno

Copia `.env.example` a `.env` y completa `OPENCODE_API_KEY` para habilitar el agente de
soporte con IA. El servidor carga automáticamente el `.env` de la raíz y el de `server/`.

```bash
cp .env.example .env
# edita .env y define OPENCODE_API_KEY=...
npm run dev
```

---

## 🤖 Customer Support AI Agent

La vista de pasajero y la de conductor incluyen un botón **Soporte** que abre a **Nova**, un
agente de ayuda con IA. El agente responde preguntas básicas sobre viajes, cancelaciones,
tarifas, cuenta y seguridad, y ofrece un formulario de escalamiento a un representante
humano con nombre, correo, tema y mensaje.

### Integración con OpenCode

- El backend usa la **API HTTP de OpenCode** (`opencode serve`) con un modelo gratuito:
  `deepseek-v4.1-flash-free`.
- El servidor arranca OpenCode de forma perezosa en el primer mensaje, con un agente
  `support` aislado (solo puede leer archivos de su sandbox) y lo reutiliza para las
  siguientes conversaciones. No se expone la API key al navegador.
- Variables: `OPENCODE_API_KEY`, `OPENCODE_SUPPORT_MODEL`, `OPENCODE_AUTOSTART` y
  `OPENCODE_SERVER_URL` (para conectar a un `opencode serve` existente).
- Si OpenCode o la API no están disponibles, la interfaz cambia a **Modo demo local** con
  respuestas FAQ deterministas y tickets guardados en `localStorage`. Esto mantiene
  funcionando la demo estática de GitHub Pages, donde no hay backend Node.

### Endpoints

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/support/chat` | `{ messages, audience }` → respuesta del agente |
| `POST` | `/api/support/escalate` | Crea un ticket placeholder en memoria |
| `GET` | `/api/support/status` | Modo de integración y modelo configurado |

Los tickets de escalamiento son un placeholder de demostración: se guardan en memoria del
servidor y desaparecen al reiniciarlo.
