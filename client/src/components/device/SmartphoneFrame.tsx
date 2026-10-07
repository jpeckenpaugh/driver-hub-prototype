import React from 'react';
import { Wifi, Battery, Signal } from 'lucide-react';

interface SmartphoneFrameProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  roleBadge: {
    label: string;
    color: string;
  };
  time?: string;
}

export const SmartphoneFrame: React.FC<SmartphoneFrameProps> = ({
  children,
  subtitle,
  roleBadge,
  time = '12:30'
}) => {
  return (
    <div className="flex flex-col items-center">
      {/* Etiqueta superior del marco exterior */}
      <div className="flex items-center gap-2 mb-2 px-3 py-1 bg-slate-800/80 rounded-full border border-slate-700 shadow-sm">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${roleBadge.color} animate-pulse`}
        />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
          {roleBadge.label}
        </span>
        {subtitle && (
          <span className="text-[11px] text-slate-400">· {subtitle}</span>
        )}
      </div>

      {/* Dispositivo Físico */}
      <div className="relative w-[375px] h-[740px] bg-slate-950 rounded-[48px] p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_10px_#1e293b,0_0_0_12px_#334155] border-4 border-slate-800 flex flex-col overflow-hidden">
        {/* Notch / Dynamic Island */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-50 flex items-center justify-end px-3">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800 mr-2" />
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
        </div>

        {/* Status Bar */}
        <div className="w-full h-8 px-5 pt-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-400 select-none z-40 bg-slate-900/40 backdrop-blur-sm">
          <span>{time}</span>
          <div className="flex items-center gap-1.5">
            <Signal size={12} />
            <Wifi size={12} />
            <Battery size={13} className="text-emerald-400" />
          </div>
        </div>

        {/* Pantalla Interna */}
        <div className="relative flex-1 w-full h-full bg-slate-900 rounded-[36px] overflow-hidden flex flex-col">
          {children}
        </div>

        {/* Home Indicator bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-600/70 rounded-full z-50 pointer-events-none" />
      </div>
    </div>
  );
};
