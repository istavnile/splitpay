import React from 'react';
import { Activity as ActivityIcon, Construction } from 'lucide-react';
import { Card } from '../components/UI';

export default function Activity() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700">
      <Card className="max-w-md p-12 border-none shadow-xl shadow-rose-500/5 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md" hover={false}>
          <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center text-rose-500 mx-auto mb-8">
            <ActivityIcon size={40} />
          </div>
          <h2 className="text-3xl font-black dark:text-white tracking-tight uppercase mb-4">Feed de Actividad</h2>
          <p className="text-slate-500 dark:text-gray-400 mb-8 leading-relaxed">
            Aquí verás quién ha añadido gastos, quién ha editado eventos y notificaciones importantes de tus deudas en tiempo real.
          </p>
          <div className="flex items-center justify-center gap-2 text-rose-500 font-bold uppercase tracking-widest text-[10px]">
             <Construction size={14} /> Próximamente
          </div>
      </Card>
    </div>
  );
}
