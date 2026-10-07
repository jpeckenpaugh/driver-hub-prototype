import { useState, useCallback } from 'react';
import { Coordinates, RouteGeometry } from '@driver-hub/shared';
import { getRouteOSRM } from '../services/osrm';

export function useRouting() {
  const [route, setRoute] = useState<RouteGeometry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateRoute = useCallback(async (
    start: Coordinates,
    end: Coordinates
  ): Promise<RouteGeometry | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getRouteOSRM(start, end);
      setRoute(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error calculando ruta';
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearRoute = useCallback(() => {
    setRoute(null);
    setError(null);
  }, []);

  return {
    route,
    isLoading,
    error,
    calculateRoute,
    clearRoute,
    setRoute
  };
}
