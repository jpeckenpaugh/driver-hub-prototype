import React, { useState, useEffect, useCallback } from 'react';
import {
  Navigation,
  Power,
  DollarSign,
  TrendingUp,
  MapPin,
  CheckCircle2,
  UserCheck
} from 'lucide-react';
import {
  Ride,
  Driver,
  Coordinates,
  RouteGeometry,
  SOCKET_EVENTS,
  DEFAULT_DRIVER,
  DriverRegisterPayload,
  DriverLocationUpdatePayload,
  RideOfferPayload,
  RideAcceptPayload,
  RideUpdatedPayload
} from '@driver-hub/shared';
import { LeafletMapView } from '../components/map/LeafletMapView';
import { SimulationControls } from '../components/simulation/SimulationControls';
import { useSimulator } from '../hooks/useSimulator';
import { useRouting } from '../hooks/useRouting';
import { playNotificationChime } from '../utils/geo';
import { Socket } from 'socket.io-client';

interface DriverViewProps {
  socket: Socket | null;
  isConnected: boolean;
  onResetDemo?: () => void;
}

export const DriverView: React.FC<DriverViewProps> = ({
  socket,
  isConnected,
  onResetDemo
}) => {
  // Datos del Conductor
  const [driver, setDriver] = useState<Driver>(DEFAULT_DRIVER);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [earnings, setEarnings] = useState<number>(48.5);
  const [completedTrips, setCompletedTrips] = useState<number>(3);

  // Oferta entrante de viaje
  const [incomingOffer, setIncomingOffer] = useState<Ride | null>(null);
  const [offerTimer, setOfferTimer] = useState<number>(15);

  // Viaje activo asignado
  const [activeRide, setActiveRide] = useState<Ride | null>(null);

  // Ruta activa de simulación actual
  const [currentRoute, setCurrentRoute] = useState<RouteGeometry | null>(null);

  // Servicio OSRM para calcular ruta conductor -> pickup
  const { calculateRoute: calculateDriverRoute } = useRouting();

  // Emisión periódica de telemetría a través del socket
  const handleLocationUpdate = useCallback(
    (location: Coordinates, heading: number) => {
      setDriver(prev => ({
        ...prev,
        currentLocation: location,
        heading
      }));

      if (socket && isConnected) {
        const payload: DriverLocationUpdatePayload = {
          driverId: driver.id,
          location,
          heading,
          rideId: activeRide?.id
        };
        socket.emit(SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, payload);
      }
    },
    [socket, isConnected, driver.id, activeRide?.id]
  );

  // Callback cuando la simulación termina una ruta
  const handleRouteCompleted = useCallback(() => {
    if (!activeRide) return;

    if (activeRide.status === 'accepted') {
      // Llegó al pickup
      playNotificationChime();
    } else if (activeRide.status === 'in_progress') {
      // Llegó al destino final
      playNotificationChime();
    }
  }, [activeRide]);

  // Hook del Simulador maestro
  const {
    isPlaying,
    speed,
    progress,
    togglePlay,
    changeSpeed,
    skipToEnd,
    reset: resetSimulator,
    play: playSimulator
  } = useSimulator({
    route: currentRoute,
    onLocationUpdate: handleLocationUpdate,
    onRouteCompleted: handleRouteCompleted,
    initialSpeed: 1
  });

  // Registrar conductor en el servidor al conectar o cambiar estado online
  useEffect(() => {
    if (!socket || !isConnected) return;

    const payload: DriverRegisterPayload = {
      driver: {
        ...driver,
        status: isOnline ? (activeRide ? 'busy' : 'available') : 'offline'
      }
    };
    socket.emit(SOCKET_EVENTS.DRIVER_REGISTER, payload);
  }, [socket, isConnected, isOnline, driver.id, activeRide]);

  // Manejo de eventos socket
  useEffect(() => {
    if (!socket) return;

    // Recibir oferta de viaje
    const handleRideOffer = (payload: RideOfferPayload) => {
      if (!isOnline || activeRide) return; // Si está offline u ocupado, ignorar
      console.log('[DriverView] Oferta de viaje recibida:', payload.ride.id);
      playNotificationChime();
      setIncomingOffer(payload.ride);
      setOfferTimer(15);
    };

    // Actualizaciones de viaje
    const handleRideUpdated = (payload: RideUpdatedPayload) => {
      console.log('[DriverView] ride:updated:', payload.ride.status);
      setActiveRide(payload.ride);

      // Si fue cancelado, limpiar
      if (payload.ride.status === 'cancelled') {
        setActiveRide(null);
        setCurrentRoute(null);
      }
    };

    socket.on(SOCKET_EVENTS.RIDE_OFFER, handleRideOffer);
    socket.on(SOCKET_EVENTS.RIDE_UPDATED, handleRideUpdated);

    return () => {
      socket.off(SOCKET_EVENTS.RIDE_OFFER, handleRideOffer);
      socket.off(SOCKET_EVENTS.RIDE_UPDATED, handleRideUpdated);
    };
  }, [socket, isOnline, activeRide]);

  // Cuenta atrás de la oferta entrante (15s)
  useEffect(() => {
    if (!incomingOffer) return;
    const interval = setInterval(() => {
      setOfferTimer(prev => {
        if (prev <= 1) {
          setIncomingOffer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingOffer]);

  // Acción: Aceptar viaje entrante
  const handleAcceptRide = async () => {
    if (!incomingOffer || !socket) return;

    const rideToAccept = incomingOffer;
    setIncomingOffer(null);

    // Calcular ruta desde la posición actual del conductor hasta el punto de recogida (pickup)
    const routeToPickup = await calculateDriverRoute(
      driver.currentLocation,
      rideToAccept.pickup
    );

    const fullRouteToPickup: RouteGeometry = routeToPickup || {
      coordinates: [driver.currentLocation, rideToAccept.pickup],
      distanceMeters: 1200,
      durationSeconds: 180
    };

    const payload: RideAcceptPayload = {
      rideId: rideToAccept.id,
      driverId: driver.id,
      routeToPickup: fullRouteToPickup
    };

    socket.emit(SOCKET_EVENTS.RIDE_ACCEPT, payload);

    // Configurar ruta en el simulador pero NO auto-iniciar para permitir demo pausada/staged
    setCurrentRoute(fullRouteToPickup);
    setActiveRide({
      ...rideToAccept,
      driverId: driver.id,
      driver,
      routeToPickup: fullRouteToPickup,
      status: 'accepted'
    });
  };


  // Acción: Rechazar oferta
  const handleDeclineRide = () => {
    setIncomingOffer(null);
  };

  // Acción: Marcar llegada a pickup
  const handleArriveAtPickup = () => {
    if (!socket || !activeRide) return;
    socket.emit(SOCKET_EVENTS.RIDE_ARRIVED_PICKUP, {
      rideId: activeRide.id,
      driverId: driver.id
    });
    setActiveRide(prev => prev ? { ...prev, status: 'arrived_at_pickup' } : null);
    playNotificationChime();
  };

  // Acción: Iniciar viaje hacia destino (dropoff)
  const handleStartTrip = () => {
    if (!socket || !activeRide || !activeRide.routeToDropoff) return;

    socket.emit(SOCKET_EVENTS.RIDE_START_TRIP, {
      rideId: activeRide.id,
      driverId: driver.id
    });

    setActiveRide(prev => prev ? { ...prev, status: 'in_progress' } : null);

    // Cargar la ruta al dropoff en el simulador y arrancar
    setCurrentRoute(activeRide.routeToDropoff);
    resetSimulator();
    setTimeout(() => {
      playSimulator();
    }, 300);
  };

  // Acción: Finalizar viaje
  const handleCompleteTrip = () => {
    if (!socket || !activeRide) return;

    socket.emit(SOCKET_EVENTS.RIDE_COMPLETE_TRIP, {
      rideId: activeRide.id,
      driverId: driver.id
    });

    setEarnings(prev => Number((prev + activeRide.fare).toFixed(2)));
    setCompletedTrips(prev => prev + 1);

    setActiveRide(prev => prev ? { ...prev, status: 'completed' } : null);
    setCurrentRoute(null);
  };

  // Acción: Volver al estado disponible tras completar
  const handleFinishCompleted = () => {
    setActiveRide(null);
    setCurrentRoute(null);
    onResetDemo?.();
  };

  const rideStatus = activeRide?.status || 'idle';

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-900 text-slate-100 select-none overflow-hidden">
      {/* MAPA PRINCIPAL */}
      <div className="relative flex-1 w-full min-h-0">
        <LeafletMapView
          center={driver.currentLocation}
          zoom={14}
          pickup={activeRide?.pickup || null}
          dropoff={activeRide?.dropoff || null}
          activeVehicle={{
            location: driver.currentLocation,
            heading: driver.heading,
            isBusy: rideStatus !== 'idle'
          }}
          routeToPickup={
            rideStatus === 'accepted' ? currentRoute : null
          }
          routeToDropoff={
            rideStatus === 'in_progress' ? currentRoute : null
          }
        />

        {/* Barra superior de estado conductor */}
        <div className="absolute top-2 left-3 right-3 z-[1000] flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/70 shadow-lg">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span className="text-xs font-bold text-slate-200">
              {isOnline ? 'En Línea' : 'Desconectado'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsOnline(prev => !prev)}
            disabled={rideStatus !== 'idle'}
            className={`p-2 rounded-full border shadow-lg transition-all ${
              isOnline
                ? 'bg-rose-600/20 text-rose-400 border-rose-500/40 hover:bg-rose-600/30'
                : 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30'
            } ${rideStatus !== 'idle' ? 'opacity-30 cursor-not-allowed' : ''}`}
            title="Alternar estado online"
          >
            <Power size={14} />
          </button>
        </div>

        {/* Panel flotante de controles de simulación (cuando hay una ruta activa) */}
        {currentRoute && (
          <div className="absolute top-12 left-3 right-3 z-[1000]">
            <SimulationControls
              isPlaying={isPlaying}
              speed={speed}
              progress={progress}
              onTogglePlay={togglePlay}
              onChangeSpeed={changeSpeed}
              onSkipToEnd={skipToEnd}
            />
          </div>
        )}
      </div>

      {/* PANELES FLOTANTES UX SEGÚN ESTADO */}

      {/* 1. ESTADO: IDLE (Esperando viaje / Métricas del día) */}
      {rideStatus === 'idle' && !incomingOffer && (
        <div className="relative z-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-4 flex flex-col gap-3 shadow-2xl">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3 flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <DollarSign size={12} className="text-emerald-400" />
                Ganancias hoy
              </span>
              <span className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                ${earnings}
              </span>
            </div>

            <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3 flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <TrendingUp size={12} className="text-blue-400" />
                Viajes hechos
              </span>
              <span className="text-xl font-black text-slate-100 font-mono mt-0.5">
                {completedTrips}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2 bg-slate-800/40 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <span className="text-slate-300 font-medium">Esperando solicitudes...</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Orlando I-Drive Corridor</span>
          </div>
        </div>
      )}

      {/* 2. ESTADO: OFERTA ENTRANTE (ride:offer) */}
      {incomingOffer && !activeRide && (
        <div className="absolute inset-x-0 bottom-0 z-50 bg-slate-950/95 backdrop-blur-md border-t-2 border-emerald-500 p-4 flex flex-col gap-3 shadow-2xl animate-bounce-subtle">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/40">
              ¡NUEVA SOLICITUD! ({offerTimer}s)
            </span>
            <span className="text-xl font-black text-emerald-400 font-mono">
              +${incomingOffer.fare}
            </span>
          </div>

          {/* Rutas de la oferta */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-200 truncate">
                Recogida: <strong>{incomingOffer.pickup.name || incomingOffer.pickup.address}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-slate-200 truncate">
                Destino: <strong>{incomingOffer.dropoff.name || incomingOffer.dropoff.address}</strong>
              </span>
            </div>
          </div>

          {/* Pasajero info */}
          <div className="flex items-center gap-2 text-xs text-slate-300 px-1">
            <img
              src={incomingOffer.rider.avatar}
              alt={incomingOffer.rider.name}
              className="w-6 h-6 rounded-full object-cover"
            />
            <span>{incomingOffer.rider.name}</span>
            <span className="text-amber-400 font-bold ml-auto">⭐ {incomingOffer.rider.rating}</span>
          </div>

          {/* Botones de acción Aceptar / Rechazar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeclineRide}
              className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={handleAcceptRide}
              className="flex-[2] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5"
            >
              <span>Aceptar Viaje</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. ESTADO: ACCEPTED (En camino al pickup) */}
      {rideStatus === 'accepted' && activeRide && (
        <div className="relative z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3.5 flex flex-col gap-2.5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-200">Paso 1: En camino al Pasajero</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              ${activeRide.fare}
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 flex items-center gap-2.5">
            <MapPin size={18} className="text-blue-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-slate-400">Punto de recogida</p>
              <p className="text-xs font-semibold text-slate-100 truncate">
                {activeRide.pickup.name || activeRide.pickup.address}
              </p>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 italic">
            El viaje ha sido aceptado. Conduce o simula la ruta, y pulsa el botón para confirmar tu llegada:
          </div>

          {/* Botón de Llegada explícito */}
          <button
            type="button"
            onClick={handleArriveAtPickup}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <UserCheck size={16} />
            <span>Confirmar: Notificar que he llegado</span>
          </button>
        </div>
      )}

      {/* 4. ESTADO: ARRIVED_AT_PICKUP (Esperando que el pasajero suba) */}
      {rideStatus === 'arrived_at_pickup' && activeRide && (
        <div className="relative z-30 bg-slate-900/95 backdrop-blur-md border-t-2 border-amber-500 p-3.5 flex flex-col gap-2.5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs font-bold text-amber-300">Paso 2: Pasajero Notificado</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              ${activeRide.fare}
            </span>
          </div>

          <p className="text-xs text-slate-300">
            <strong>{activeRide.rider.name}</strong> sabe que estás afuera. Cuando suba al vehículo, presiona confirmar:
          </p>

          <button
            type="button"
            onClick={handleStartTrip}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/40 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Navigation size={18} />
            <span>Confirmar: Iniciar Viaje al Destino</span>
          </button>
        </div>
      )}

      {/* 5. ESTADO: IN_PROGRESS (En viaje a dropoff) */}
      {rideStatus === 'in_progress' && activeRide && (
        <div className="relative z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3.5 flex flex-col gap-2.5 shadow-2xl">

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-slate-200">Viaje en Curso</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              ${activeRide.fare}
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 flex items-center gap-2.5">
            <Navigation size={18} className="text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-slate-400">Destino</p>
              <p className="text-xs font-semibold text-slate-100 truncate">
                {activeRide.dropoff.name || activeRide.dropoff.address}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCompleteTrip}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all"
          >
            <CheckCircle2 size={15} />
            <span>Finalizar y Cobrar Viaje</span>
          </button>
        </div>
      )}

      {/* 6. ESTADO: COMPLETED (Resumen conductor) */}
      {rideStatus === 'completed' && activeRide && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mb-3">
            <CheckCircle2 size={36} className="text-emerald-400" />
          </div>

          <h2 className="text-lg font-bold text-white">¡Viaje Finalizado con Éxito!</h2>
          <p className="text-xs text-slate-400 mt-1">Ganancia agregada a tu balance</p>

          <div className="my-5 w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <p className="text-xs uppercase font-bold text-slate-400">Ganancia Neta</p>
            <p className="text-3xl font-black text-emerald-400 font-mono my-1">
              +${activeRide.fare}
            </p>
            <p className="text-[11px] text-slate-400">Balance acumulado hoy: ${earnings}</p>
          </div>

          <button
            type="button"
            onClick={handleFinishCompleted}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all"
          >
            Volver a Estado Disponible
          </button>
        </div>
      )}
    </div>
  );
};
