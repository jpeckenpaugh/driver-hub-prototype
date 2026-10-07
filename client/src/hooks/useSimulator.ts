import { useState, useRef, useEffect, useCallback } from 'react';
import { Coordinates, RouteGeometry } from '@driver-hub/shared';
import { calculateBearing, interpolateCoords } from '../utils/geo';

interface SimulatorOptions {
  route: RouteGeometry | null;
  onLocationUpdate?: (location: Coordinates, heading: number) => void;
  onRouteCompleted?: () => void;
  initialSpeed?: number; // 1, 2, 5
}

export function useSimulator({
  route,
  onLocationUpdate,
  onRouteCompleted,
  initialSpeed = 1
}: SimulatorOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(initialSpeed);
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(
    route && route.coordinates.length > 0 ? route.coordinates[0] : null
  );
  const [heading, setHeading] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0); // 0 a 1

  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const progressRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const speedRef = useRef<number>(speed);
  const routeRef = useRef<RouteGeometry | null>(route);

  // Mantener refs actualizados para el loop de animación
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    routeRef.current = route;
    if (route && route.coordinates.length > 0) {
      // Si la ruta cambió, inicializar posición
      progressRef.current = 0;
      setProgress(0);
      setCurrentLocation(route.coordinates[0]);
      if (route.coordinates.length > 1) {
        const initialHeading = calculateBearing(route.coordinates[0], route.coordinates[1]);
        setHeading(initialHeading);
        onLocationUpdate?.(route.coordinates[0], initialHeading);
      }
    }
  }, [route]);

  const updatePositionForProgress = useCallback((p: number) => {
    const activeRoute = routeRef.current;
    if (!activeRoute || activeRoute.coordinates.length === 0) return;

    const coords = activeRoute.coordinates;
    const totalSegments = coords.length - 1;

    if (totalSegments <= 0) {
      setCurrentLocation(coords[0]);
      return;
    }

    // Calcular en qué segmento de la polilínea estamos
    const exactIndex = p * totalSegments;
    const segmentIndex = Math.min(Math.floor(exactIndex), totalSegments - 1);
    const segmentFraction = exactIndex - segmentIndex;

    const p1 = coords[segmentIndex];
    const p2 = coords[Math.min(segmentIndex + 1, totalSegments)];

    const currentPos = interpolateCoords(p1, p2, segmentFraction);
    const currentBearing = calculateBearing(p1, p2);

    setCurrentLocation(currentPos);
    setHeading(currentBearing);
    setProgress(p);

    onLocationUpdate?.(currentPos, currentBearing);
  }, [onLocationUpdate]);

  // Loop de animación
  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!lastTimestampRef.current) {
        lastTimestampRef.current = timestamp;
      }

      const deltaMs = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;

      if (isPlayingRef.current && routeRef.current && routeRef.current.coordinates.length > 1) {
        // Duración base ajustada para que una simulación típica sea ágil en demo (~15s a 1x)
        const baseDurationMs = 18000;
        const progressIncrement = (deltaMs / baseDurationMs) * speedRef.current;

        const newProgress = Math.min(1, progressRef.current + progressIncrement);
        progressRef.current = newProgress;

        updatePositionForProgress(newProgress);

        if (newProgress >= 1) {
          setIsPlaying(false);
          isPlayingRef.current = false;
          onRouteCompleted?.();
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updatePositionForProgress, onRouteCompleted]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(() => setIsPlaying(prev => !prev), []);

  const changeSpeed = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
  }, []);

  // Salto rápido al 98% (llegada casi inmediata)
  const skipToEnd = useCallback(() => {
    progressRef.current = 0.98;
    updatePositionForProgress(0.98);
    setIsPlaying(true);
  }, [updatePositionForProgress]);

  const reset = useCallback(() => {
    progressRef.current = 0;
    setProgress(0);
    setIsPlaying(false);
    if (routeRef.current && routeRef.current.coordinates.length > 0) {
      updatePositionForProgress(0);
    }
  }, [updatePositionForProgress]);

  return {
    isPlaying,
    speed,
    currentLocation,
    heading,
    progress,
    play,
    pause,
    togglePlay,
    changeSpeed,
    skipToEnd,
    reset,
    setCurrentLocation
  };
}
