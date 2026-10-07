import React from 'react';
import { SmartphoneFrame } from '../components/device/SmartphoneFrame';
import { RiderView } from './RiderView';
import { DriverView } from './DriverView';
import { useSocket } from '../hooks/useSocket';
import { RotateCcw } from 'lucide-react';

interface SplitViewProps {
  onResetDemo?: () => void;
}

export const SplitView: React.FC<SplitViewProps> = ({ onResetDemo }) => {
  // Dos sockets completamente aislados e independientes
  const riderSocketHook = useSocket({ role: 'rider' });
  const driverSocketHook = useSocket({ role: 'driver' });

  const [demoKey, setDemoKey] = React.useState<number>(0);

  const handleResetBoth = () => {
    // Forzar re-render de ambos teléfonos limpiando estados locales
    setDemoKey(prev => prev + 1);
    if (riderSocketHook.socket) {
      riderSocketHook.socket.emit('demo:reset');
    }
    if (driverSocketHook.socket) {
      driverSocketHook.socket.emit('demo:reset');
    }
    onResetDemo?.();
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 overflow-y-auto">
      {/* Barra de control superior para la demo */}
      <header className="sticky top-0 z-50 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <span className="text-xl">🚗</span>
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center gap-2">
              Driver Hub Prototype
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-semibold border border-blue-500/30">
                Split Demo Mode
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Simulación de 2 dispositivos móviles conectados en tiempo real por WebSockets
            </p>
          </div>
        </div>

        {/* Acciones de la barra */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetBoth}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-bold transition-all shadow-sm active:scale-95"
            title="Reiniciar estados de ambos teléfonos"
          >
            <RotateCcw size={14} className="text-blue-400" />
            <span>Reiniciar Demo</span>
          </button>
        </div>
      </header>

      {/* Contenedor central con los dos mockups de smartphone */}
      <main className="flex-1 flex flex-wrap items-center justify-center gap-8 md:gap-14 p-6 sm:p-10 min-h-0">
        {/* Smartphone 1: Rider */}
        <SmartphoneFrame
          key={`rider-${demoKey}`}
          title="Pasajero"
          subtitle="Elena Ramos"
          roleBadge={{
            label: 'Rider App',
            color: 'bg-blue-400'
          }}
          time="12:30"
        >
          <RiderView
            socket={riderSocketHook.socket}
            isConnected={riderSocketHook.isConnected}
            onResetDemo={handleResetBoth}
          />
        </SmartphoneFrame>

        {/* Smartphone 2: Driver */}
        <SmartphoneFrame
          key={`driver-${demoKey}`}
          title="Conductor"
          subtitle="Carlos Gómez"
          roleBadge={{
            label: 'Driver App',
            color: 'bg-emerald-400'
          }}
          time="12:30"
        >
          <DriverView
            socket={driverSocketHook.socket}
            isConnected={driverSocketHook.isConnected}
            onResetDemo={handleResetBoth}
          />
        </SmartphoneFrame>
      </main>

      {/* Footer informativo */}
      <footer className="w-full py-2.5 text-center text-[11px] text-slate-500 border-t border-slate-900 bg-slate-950/60 select-none">
        OpenStreetMap & OSRM Routing · Socket.io Real-Time Orchestration · React 18 + Leaflet
      </footer>
    </div>
  );
};
