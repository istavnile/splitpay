import React from 'react';
import { Users, Construction } from 'lucide-react';
import { Card } from '../components/UI';

export default function Members() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-700">
      <Card className="max-w-md p-12 border-none shadow-xl shadow-indigo-500/5 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md" hover={false}>
          <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-indigo-500 mx-auto mb-8">
            <Users size={40} />
          </div>
          <h2 className="text-3xl font-black dark:text-white tracking-tight uppercase mb-4">Gestión de Amigos</h2>
          <p className="text-slate-500 dark:text-gray-400 mb-8 leading-relaxed">
            Muy pronto podrás gestionar tu lista de contactos frecuentes, crear grupos y ver quién te debe más dinero de forma global.
          </p>
          <div className="flex items-center justify-center gap-2 text-indigo-500 font-bold uppercase tracking-widest text-[10px]">
             <Construction size={14} /> En Construcción
          </div>
      </Card>
    </div>
  );
}
