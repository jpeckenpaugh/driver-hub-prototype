import React, { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import { Coordinates, RouteGeometry, Driver } from '@driver-hub/shared';
import {
  createVehicleIcon,
  createPickupIcon,
  createDropoffIcon,
  createAvailableDriverIcon
} from './CustomMarkers';

interface LeafletMapViewProps {
  center?: Coordinates;
  zoom?: number;
  pickup?: Coordinates | null;
  dropoff?: Coordinates | null;
  activeVehicle?: {
    location: Coordinates;
    heading: number;
    isBusy?: boolean;
  } | null;
  routeToPickup?: RouteGeometry | null;
  routeToDropoff?: RouteGeometry | null;
  availableDrivers?: Driver[];
  onMapClick?: (coords: Coordinates) => void;
  className?: string;
  autoFitBounds?: boolean;
}

// Subcomponente para sincronizar vista y redimensionar mapa al montarse
function MapUpdater({
  center,
  zoom,
  bounds
}: {
  center?: Coordinates;
  zoom?: number;
  bounds?: L.LatLngBoundsExpression | null;
}) {
  const map = useMap();

  useEffect(() => {
    // Invalidate size para evitar bugs de tiles no cargadas en contenedores dinámicos
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (center) {
      map.panTo([center.lat, center.lng], { animate: true });
      if (zoom) map.setZoom(zoom);
    }
  }, [map, center, zoom, bounds]);

  return null;
}

// Subcomponente para capturar clics en el mapa
function MapClickHandler({ onClick }: { onClick?: (coords: Coordinates) => void }) {
  useMapEvents({
    click(e) {
      if (onClick) {
        onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    }
  });
  return null;
}

export const LeafletMapView: React.FC<LeafletMapViewProps> = ({
  center = { lat: 40.4168, lng: -3.7038 }, // Madrid Puerta del Sol
  zoom = 13,
  pickup,
  dropoff,
  activeVehicle,
  routeToPickup,
  routeToDropoff,
  availableDrivers = [],
  onMapClick,
  className = 'w-full h-full',
  autoFitBounds = true
}) => {
  // Calcular bounds si hay pickup y dropoff o ruta
  const bounds = React.useMemo(() => {
    if (!autoFitBounds) return null;
    const points: L.LatLngExpression[] = [];

    if (pickup) points.push([pickup.lat, pickup.lng]);
    if (dropoff) points.push([dropoff.lat, dropoff.lng]);
    if (activeVehicle) points.push([activeVehicle.location.lat, activeVehicle.location.lng]);

    if (routeToPickup && routeToPickup.coordinates.length > 0) {
      routeToPickup.coordinates.forEach(c => points.push([c.lat, c.lng]));
    }
    if (routeToDropoff && routeToDropoff.coordinates.length > 0) {
      routeToDropoff.coordinates.forEach(c => points.push([c.lat, c.lng]));
    }

    if (points.length >= 2) {
      return L.latLngBounds(points);
    }
    return null;
  }, [pickup, dropoff, activeVehicle, routeToPickup, routeToDropoff, autoFitBounds]);

  // Transformar rutas a formato [lat, lng] para React-Leaflet
  const polylineRouteToPickup = React.useMemo(() => {
    if (!routeToPickup) return [];
    return routeToPickup.coordinates.map(c => [c.lat, c.lng] as [number, number]);
  }, [routeToPickup]);

  const polylineRouteToDropoff = React.useMemo(() => {
    if (!routeToDropoff) return [];
    return routeToDropoff.coordinates.map(c => [c.lat, c.lng] as [number, number]);
  }, [routeToDropoff]);

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full"
      >
        {/* CartoDB Dark Matter / Positron tiles para estética moderna */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        <MapUpdater center={center} zoom={zoom} bounds={bounds} />
        <MapClickHandler onClick={onMapClick} />

        {/* Polilínea de ruta hacia el pasajero (Ruta de recogida: Azul punteada o delgada) */}
        {polylineRouteToPickup.length > 0 && (
          <Polyline
            positions={polylineRouteToPickup}
            pathOptions={{
              color: '#3b82f6',
              weight: 5,
              opacity: 0.85,
              dashArray: '8, 8'
            }}
          />
        )}

        {/* Polilínea de viaje principal (Ruta a destino: Verde esmeralda sólido vibrante) */}
        {polylineRouteToDropoff.length > 0 && (
          <Polyline
            positions={polylineRouteToDropoff}
            pathOptions={{
              color: '#10b981',
              weight: 6,
              opacity: 0.9
            }}
          />
        )}

        {/* Marcador Pickup */}
        {pickup && (
          <Marker
            position={[pickup.lat, pickup.lng]}
            icon={createPickupIcon()}
            interactive={false}
          />
        )}

        {/* Marcador Dropoff */}
        {dropoff && (
          <Marker
            position={[dropoff.lat, dropoff.lng]}
            icon={createDropoffIcon()}
            interactive={false}
          />
        )}

        {/* Otros conductores disponibles en la zona */}
        {availableDrivers.map((driver) => (
          <Marker
            key={driver.id}
            position={[driver.currentLocation.lat, driver.currentLocation.lng]}
            icon={createAvailableDriverIcon(driver.heading)}
            interactive={false}
          />
        ))}

        {/* Coche activo del viaje (telemetría rotatoria) */}
        {activeVehicle && (
          <Marker
            position={[activeVehicle.location.lat, activeVehicle.location.lng]}
            icon={createVehicleIcon(activeVehicle.heading, activeVehicle.isBusy)}
            zIndexOffset={1000}
            interactive={false}
          />
        )}
      </MapContainer>
    </div>
  );
};
