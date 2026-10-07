import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';

interface SimulationControlsProps {
  isPlaying: boolean;
  speed: number;
  progress: number;
  onTogglePlay: () => void;
  onChangeSpeed: (speed: number) => void;
  onSkipToEnd: () => void;
  onReset?: () => void;
  disabled?: boolean;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  isPlaying,
  speed,
  progress,
  onTogglePlay,
  onChangeSpeed,
  onSkipToEnd,
  onReset,
  disabled = false
}) => {
  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl flex flex-col gap-2">
      {/* Barra de progreso visual */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] font-semibold text-slate-400">Progreso:</span>
        <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-emerald-400 w-8 text-right">
          {Math.round(progress * 100)}%
        </span>
      </div>

      {/* Botones de acción */}
      <div className="flex items-center justify-between gap-1.5">
        {/* Play / Pause */}
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={disabled}
          title={isPlaying ? 'Pausar simulación' : 'Iniciar simulación'}
          className={`flex items-center justify-center w-8 h-8 rounded-lg font-medium text-xs transition-colors ${
            isPlaying
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
              : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20'
          } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>

        {/* Multiplicador de velocidad (1x, 2x, 5x) */}
        <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/50">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => onChangeSpeed(s)}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                speed === s
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Skip to end (Llegada rápida) */}
        <button
          type="button"
          onClick={onSkipToEnd}
          disabled={disabled || progress >= 0.98}
          title="Saltar directo al final (Llegar ya)"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 text-[11px] font-semibold transition-colors ${
            disabled || progress >= 0.98 ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          <SkipForward size={12} />
          <span>Llegar ya</span>
        </button>

        {/* Reset (opcional) */}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            title="Reiniciar ruta"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>
    </div>
  );
};
