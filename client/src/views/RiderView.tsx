import React, { useState, useEffect } from 'react';
import {
  Navigation,
  Star,
  Shield,
  Car,
  CheckCircle2,
  Phone,
  MessageSquare
} from 'lucide-react';
import {
  Ride,
  Coordinates,
  LocationPoint,
  Driver,
  SOCKET_EVENTS,
  MADRID_PRESETS,
  DEFAULT_RIDER,
  VEHICLE_TIERS,
  VehicleTierOption,
  RideRequestPayload,
  RideUpdatedPayload,
  ActiveDriversSyncPayload
} from '@driver-hub/shared';
import { LeafletMapView } from '../components/map/LeafletMapView';
import { useRouting } from '../hooks/useRouting';
import { formatDuration, playNotificationChime } from '../utils/geo';
import { Socket } from 'socket.io-client';

interface RiderViewProps {
  socket: Socket | null;
  isConnected: boolean;
  onResetDemo?: () => void;
}

export const RiderView: React.FC<RiderViewProps> = ({
  socket,
  isConnected,
  onResetDemo
}) => {
  // Estado del viaje
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);

  // Puntos seleccionados
  const [pickup] = useState<LocationPoint>(MADRID_PRESETS[0]); // Sol
  const [dropoff, setDropoff] = useState<LocationPoint>(MADRID_PRESETS[3]); // Bernabéu
  const [selectedTier, setSelectedTier] = useState<string>('standard');

  // Calificación al completar
  const [ratingGiven, setRatingGiven] = useState<number>(5);

  // Enrutamiento con OSRM
  const { route: previewRoute, calculateRoute } = useRouting();

  // Calcular ruta previa de pickup -> dropoff cuando cambian
  useEffect(() => {
    if (pickup && dropoff) {
      calculateRoute(pickup, dropoff);
    }
  }, [pickup, dropoff, calculateRoute]);

  // Escucha de eventos de Socket
  useEffect(() => {
    if (!socket) return;

    // Actualización de viaje
    const handleRideUpdated = (payload: RideUpdatedPayload) => {
      console.log('[RiderView] ride:updated recibido:', payload.ride.status);
      setActiveRide(prev => {
        // Notificación sonora si el conductor llega
        if (payload.ride.status === 'arrived_at_pickup' && prev?.status !== 'arrived_at_pickup') {
          playNotificationChime();
        }
        return payload.ride;
      });
    };

    // Sincronización de conductores cercanos
    const handleDriversSync = (payload: ActiveDriversSyncPayload) => {
      setAvailableDrivers(payload.drivers || []);
    };

    // Actualización de ubicación en vivo del conductor
    const handleLocationUpdate = (payload: {
      driverId: string;
      location: Coordinates;
      heading: number;
    }) => {
      setActiveRide(prev => {
        if (!prev || !prev.driver) return prev;
        return {
          ...prev,
          driver: {
            ...prev.driver,
            currentLocation: payload.location,
            heading: payload.heading
          }
        };
      });
    };

    socket.on(SOCKET_EVENTS.RIDE_UPDATED, handleRideUpdated);
    socket.on(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, handleDriversSync);
    socket.on(SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, handleLocationUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.RIDE_UPDATED, handleRideUpdated);
      socket.off(SOCKET_EVENTS.ACTIVE_DRIVERS_SYNC, handleDriversSync);
      socket.off(SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, handleLocationUpdate);
    };
  }, [socket]);

  // Solicitud de viaje
  const handleRequestRide = () => {
    if (!socket || !previewRoute) return;

    const baseFare = 8.5;
    const distanceKm = previewRoute.distanceMeters / 1000;
    const tierMultiplier = VEHICLE_TIERS.find((t: VehicleTierOption) => t.id === selectedTier)?.multiplier || 1.0;
    const calculatedFare = Number((baseFare + distanceKm * 1.65 * tierMultiplier).toFixed(2));

    const payload: RideRequestPayload = {
      rider: DEFAULT_RIDER,
      pickup,
      dropoff,
      fare: calculatedFare,
      routeGeometry: previewRoute
    };

    socket.emit(SOCKET_EVENTS.RIDE_REQUEST, payload);

    // Estado optimista
    setActiveRide({
      id: 'pending-' + Date.now(),
      riderId: DEFAULT_RIDER.id,
      rider: DEFAULT_RIDER,
      pickup,
      dropoff,
      fare: calculatedFare,
      status: 'requested',
      routeToDropoff: previewRoute,
      createdAt: Date.now()
    });
  };

  // Cancelar viaje
  const handleCancelRide = () => {
    if (!socket || !activeRide) return;
    socket.emit(SOCKET_EVENTS.RIDE_CANCEL, {
      rideId: activeRide.id,
      cancelledBy: 'rider',
      reason: 'Cancelado por el usuario'
    });
    setActiveRide(null);
  };

  // Reiniciar estado
  const handleResetToIdle = () => {
    setActiveRide(null);
    onResetDemo?.();
  };

  // Calcular precio del tier
  const getTierPrice = (multiplier: number) => {
    if (!previewRoute) return '--';
    const baseFare = 8.5;
    const distanceKm = previewRoute.distanceMeters / 1000;
    return (baseFare + distanceKm * 1.65 * multiplier).toFixed(2);
  };

  const rideStatus = activeRide?.status || 'idle';

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-900 text-slate-100 select-none overflow-hidden">
      {/* MAPA PRINCIPAL */}
      <div className="relative flex-1 w-full min-h-0">
        <LeafletMapView
          center={pickup}
          zoom={13}
          pickup={pickup}
          dropoff={dropoff}
          activeVehicle={
            activeRide?.driver
              ? {
                  location: activeRide.driver.currentLocation,
                  heading: activeRide.driver.heading || 0,
                  isBusy: true
                }
              : null
          }
          routeToPickup={activeRide?.routeToPickup || null}
          routeToDropoff={
            rideStatus === 'in_progress' || rideStatus === 'accepted' || rideStatus === 'arrived_at_pickup'
              ? activeRide?.routeToDropoff || null
              : previewRoute
          }
          availableDrivers={rideStatus === 'idle' ? availableDrivers : []}
          onMapClick={(coords) => {
            if (rideStatus === 'idle') {
              setDropoff({
                ...coords,
                name: 'Ubicación seleccionada',
                address: `Lat: ${coords.lat.toFixed(4)}, Lng: ${coords.lng.toFixed(4)}`
              });
            }
          }}
        />

        {/* Indicador de conexión Socket */}
        <div className="absolute top-2 left-3 z-[1000] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-[10px] font-semibold text-slate-300">
            {isConnected ? 'Pasajero Conectado' : 'Sin conexión'}
          </span>
        </div>
      </div>

      {/* PANELES FLOTANTES UX SEGÚN ESTADO */}

      {/* 1. ESTADO: IDLE (Selección de viaje) */}
      {rideStatus === 'idle' && (
        <div className="relative z-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3.5 flex flex-col gap-3 shadow-2xl max-h-[58%] overflow-y-auto">
          {/* Selectores de Origen y Destino */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-xl px-2.5 py-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
              <div className="flex-1 text-left min-w-0">
                <p className="text-[10px] uppercase font-bold text-slate-400 leading-tight">Origen</p>
                <p className="text-xs font-semibold text-slate-100 truncate">{pickup.name || pickup.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-xl px-2.5 py-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/20" />
              <div className="flex-1 text-left min-w-0">
                <p className="text-[10px] uppercase font-bold text-slate-400 leading-tight">Destino</p>
                <p className="text-xs font-semibold text-slate-100 truncate">{dropoff.name || dropoff.address}</p>
              </div>
            </div>
          </div>

          {/* Presets rápidos de Madrid */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {MADRID_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setDropoff(p)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap border transition-all ${
                  dropoff.name === p.name
                    ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Opciones de Vehículo */}
          <div className="grid grid-cols-3 gap-2">
            {VEHICLE_TIERS.map((tier: VehicleTierOption) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => setSelectedTier(tier.id)}
                className={`p-2 rounded-xl border flex flex-col items-center justify-between transition-all ${
                  selectedTier === tier.id
                    ? 'bg-blue-600/20 border-blue-500 shadow-md ring-1 ring-blue-500/40'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/80'
                }`}
              >
                <span className="text-[11px] font-bold text-slate-200">{tier.name}</span>
                <span className="text-xs font-extrabold text-emerald-400 mt-1">
                  ${getTierPrice(tier.multiplier)}
                </span>
                <span className="text-[9px] text-slate-400">{tier.etaMinutes} min</span>
              </button>
            ))}
          </div>

          {/* Botón CTA Solicitar */}
          <button
            type="button"
            onClick={handleRequestRide}
            disabled={!isConnected}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <Car size={16} />
            <span>Solicitar Conductor</span>
            {previewRoute && (
              <span className="text-xs font-normal opacity-90">
                · {formatDuration(previewRoute.durationSeconds)}
              </span>
            )}
          </button>
        </div>
      )}

      {/* 2. ESTADO: REQUESTED (Buscando conductor) */}
      {rideStatus === 'requested' && (
        <div className="relative z-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-4 flex flex-col items-center gap-3 shadow-2xl">
          <div className="relative flex items-center justify-center my-1">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center animate-pulse">
              <Car className="text-blue-400 animate-bounce" size={24} />
            </div>
            <div className="absolute w-16 h-16 rounded-full border border-blue-400/30 animate-ping" />
          </div>

          <div className="text-center">
            <h3 className="font-bold text-sm text-slate-100">Buscando conductores cercanos...</h3>
            <p className="text-xs text-slate-400 mt-0.5">Notificando a conductores en Orlando, FL</p>
          </div>

          <div className="w-full flex items-center justify-between text-xs px-3 py-2 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <span className="text-slate-400">Tarifa fija:</span>
            <span className="font-bold text-emerald-400 font-mono">${activeRide?.fare}</span>
          </div>

          <button
            type="button"
            onClick={handleCancelRide}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-semibold text-xs border border-rose-500/20 transition-colors"
          >
            Cancelar Solicitud
          </button>
        </div>
      )}

      {/* 3. ESTADO: ACCEPTED o ARRIVED_AT_PICKUP (Conductor en camino o esperando) */}
      {(rideStatus === 'accepted' || rideStatus === 'arrived_at_pickup') && activeRide?.driver && (
        <div className="relative z-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-4 flex flex-col gap-3 shadow-2xl">
          {/* Badge de estado */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  rideStatus === 'arrived_at_pickup' ? 'bg-amber-400 animate-ping' : 'bg-blue-500 animate-pulse'
                }`}
              />
              <span className="text-xs font-bold text-slate-200">
                {rideStatus === 'arrived_at_pickup'
                  ? '¡El conductor ha llegado afuera!'
                  : 'Conductor en camino a recogerte'}
              </span>
            </div>
            <span className="text-xs font-extrabold text-emerald-400 font-mono">
              ${activeRide.fare}
            </span>
          </div>

          {/* Tarjeta de Información del Conductor */}
          <div className="flex items-center gap-3 bg-slate-800/70 border border-slate-700/70 rounded-2xl p-3">
            <img
              src={activeRide.driver.avatar}
              alt={activeRide.driver.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 shadow"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-sm text-slate-100 truncate">{activeRide.driver.name}</p>
                <div className="flex items-center text-amber-400 text-xs font-semibold">
                  <Star size={12} fill="currentColor" />
                  <span className="ml-0.5">{activeRide.driver.rating}</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 font-medium truncate">
                {activeRide.driver.vehicle.model}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono font-bold text-blue-300">
                  {activeRide.driver.vehicle.plate}
                </span>
                <span className="text-[10px] text-slate-400">
                  {activeRide.driver.vehicle.color}
                </span>
              </div>
            </div>
          </div>

          {/* Botones de contacto ficticios */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5"
            >
              <Phone size={14} className="text-emerald-400" />
              <span>Llamar</span>
            </button>
            <button
              type="button"
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5"
            >
              <MessageSquare size={14} className="text-blue-400" />
              <span>Mensaje</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. ESTADO: IN_PROGRESS (En viaje a dropoff) */}
      {rideStatus === 'in_progress' && activeRide?.driver && (
        <div className="relative z-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-4 flex flex-col gap-2.5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-200">Viaje en curso al destino</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              ${activeRide.fare}
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation size={16} className="text-emerald-400" />
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Rumbo a</p>
                <p className="text-xs font-semibold text-slate-100 truncate max-w-[200px]">
                  {activeRide.dropoff.name || activeRide.dropoff.address}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-medium">Seguridad</p>
              <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                <Shield size={12} />
                <span>Monitoreado</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ESTADO: COMPLETED (Recibo y calificación) */}
      {rideStatus === 'completed' && activeRide && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mb-3">
            <CheckCircle2 size={36} className="text-emerald-400" />
          </div>

          <h2 className="text-lg font-bold text-white">¡Has llegado a tu destino!</h2>
          <p className="text-xs text-slate-400 mt-1">Gracias por viajar con Driver Hub</p>

          <div className="my-5 w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <p className="text-xs uppercase font-bold text-slate-400">Total Facturado</p>
            <p className="text-3xl font-black text-emerald-400 font-mono my-1">
              ${activeRide.fare}
            </p>
            <p className="text-[11px] text-slate-400">Cobrado automáticamente con tarjeta</p>

            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <p className="text-xs font-medium text-slate-300 mb-2">
                ¿Cómo estuvo tu viaje con {activeRide.driver?.name || 'el conductor'}?
              </p>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingGiven(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      size={24}
                      className={star <= ratingGiven ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetToIdle}
            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all"
          >
            Completar y Volver al Inicio
          </button>
        </div>
      )}
    </div>
  );
};
