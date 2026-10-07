import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { VirtualSocket } from '../services/virtualHub';

interface UseSocketOptions {
  role: 'rider' | 'driver' | 'admin';
  serverUrl?: string;
  autoConnect?: boolean;
}

const DEFAULT_SERVER_URL = 'http://localhost:3001';

export function useSocket({
  role,
  serverUrl = DEFAULT_SERVER_URL,
  autoConnect = true
}: UseSocketOptions) {
  const socketRef = useRef<Socket | VirtualSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    // Detectar si estamos en GitHub Pages o producción estática sin servidor de Node
    const isGitHubPages =
      typeof window !== 'undefined' &&
      (window.location.hostname.includes('github.io') || window.location.search.includes('standalone=true'));

    if (isGitHubPages) {
      console.log(`[Socket ${role}] Modo GitHub Pages / In-Browser Server activado`);
      const vSocket = new VirtualSocket(role);
      socketRef.current = vSocket;

      vSocket.on('connect', () => {
        setIsConnected(true);
        setLastError(null);
      });

      return () => {
        vSocket.disconnect();
        socketRef.current = null;
      };
    }

    // Modo Socket.io real (desarrollo local con servidor Node.js)
    const socket = io(serverUrl, {
      multiplex: false,
      transports: ['websocket', 'polling'],
      query: { role },
      timeout: 3000
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
      console.warn(`[Socket ${role}] Error de conexión TCP (${err.message}), conmutando a In-Browser Server...`);
      // Fallback transparente al virtual hub para que la demo nunca quede rota
      socket.disconnect();
      const vSocket = new VirtualSocket(role);
      socketRef.current = vSocket;
      setIsConnected(true);
      setLastError(null);
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
