import { useMemo } from 'react';
import { RiderView } from './views/RiderView';
import { DriverView } from './views/DriverView';
import { SplitView } from './views/SplitView';
import { useSocket } from './hooks/useSocket';

export default function App() {
  // Enrutamiento simple por query param: ?role=rider | driver | split
  const role = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('role');
    if (r === 'rider' || r === 'driver') return r;
    return 'split'; // Por defecto vista dividida dual
  }, []);

  // Hook socket para vista única (si no es split)
  const singleSocketHook = useSocket({
    role: role === 'driver' ? 'driver' : 'rider',
    autoConnect: role !== 'split'
  });

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 font-['Plus_Jakarta_Sans',sans-serif]">
      {role === 'split' && <SplitView />}

      {role === 'rider' && (
        <div className="w-full h-full">
          <RiderView
            socket={singleSocketHook.socket}
            isConnected={singleSocketHook.isConnected}
          />
        </div>
      )}

      {role === 'driver' && (
        <div className="w-full h-full">
          <DriverView
            socket={singleSocketHook.socket}
            isConnected={singleSocketHook.isConnected}
          />
        </div>
      )}
    </div>
  );
}
