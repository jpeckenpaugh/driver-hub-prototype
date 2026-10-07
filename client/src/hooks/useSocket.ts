import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  role: 'rider' | 'driver' | 'admin';
  serverUrl?: string;
  autoConnect?: boolean;
}

const DEFAULT_SERVER_URL = 'http://localhost:3000';

export function useSocket({
  role,
  serverUrl = DEFAULT_SERVER_URL,
  autoConnect = true
}: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    // Conexión independiente forzada con multiplex: false
    const socket = io(serverUrl, {
      multiplex: false,
      transports: ['websocket', 'polling'],
      query: { role }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[Socket ${role}] Conectado id=${socket.id}`);
      setIsConnected(true);
      setLastError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket ${role}] Desconectado:`, reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn(`[Socket ${role}] Error de conexión:`, err.message);
      setLastError(err.message);
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [role, serverUrl, autoConnect]);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    lastError,
    emit,
    on
  };
}
