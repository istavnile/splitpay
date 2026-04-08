import React, { useState, useEffect } from 'react';
import { Activity as ActivityIcon, Receipt, TrendingUp, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import { Card } from '../components/UI';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Activity() {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchActivity();
  }, []);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      // Get all events I'm in
      const owned = await pb.collection('events').getFullList({ filter: `creado_por = "${user.id}"` });
      let shared = [];
      try {
        const membs = await pb.collection('members').getFullList({ filter: `id_usuario = "${user.id}"`, expand: 'id_evento' });
        shared = membs.filter(m => m.id_evento).map(m => m.expand.id_evento);
      } catch (e) {}

      const allEventIds = [...new Set([...owned, ...shared].map(e => e.id))];

      if (allEventIds.length === 0) {
        setActivities([]);
        return;
      }

      // Get all expenses for these events
      const expenses = await pb.collection('expenses').getFullList({
        filter: allEventIds.map(id => `id_evento = "${id}"`).join(' || '),
        expand: 'id_evento,pagado_por',
      });

      setActivities(expenses.slice(0, 20)); // Last 20 actions
    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto pb-20">
      <div className="mb-10">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-500 mb-2 block">Historial</span>
        <h2 className="text-4xl font-black dark:text-white tracking-tight uppercase">Actividad Reciente</h2>
        <p className="text-slate-500 dark:text-gray-400 mt-2">Sigue el rastro de todos los gastos y cambios en tus eventos.</p>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
           <div className="w-10 h-10 border-4 border-rose-500/30 border-t-rose-500 rounded-full animate-spin"></div>
        </div>
      ) : activities.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center bg-white/20 dark:bg-gray-900/20 border-dashed border-2 border-slate-200 dark:border-gray-800" hover={false}>
          <div className="w-20 h-20 bg-slate-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-6 text-slate-300 dark:text-gray-700">
            <ActivityIcon size={40} />
          </div>
          <h3 className="text-xl font-bold dark:text-white uppercase tracking-tight">No hay actividad aún</h3>
          <p className="text-slate-500 dark:text-gray-400 mt-2 max-w-xs text-sm">Los movimientos aparecerán aquí en cuanto registres el primer gasto.</p>
        </Card>
      ) : (
        <div className="space-y-4">
           {activities.map((act, i) => (
              <Card 
                key={act.id} 
                className="group border-none shadow-sm dark:bg-gray-900/50 p-6 flex items-center justify-between cursor-pointer" 
                hover={true}
                onClick={() => navigate(`/event/${act.id_evento}`)}
              >
                 <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform shadow-sm">
                       <Receipt size={22} />
                    </div>
                    <div>
                       <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold dark:text-white uppercase tracking-tight">{act.descripcion}</h4>
                          <span className="text-[10px] bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded-full text-slate-500 font-bold uppercase tracking-tighter">
                             {act.expand?.id_evento?.nombre_evento || 'Proyecto'}
                          </span>
                       </div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Clock size={10} /> {new Date(act.created).toLocaleString()} • Por <span className="text-rose-500">{act.expand?.pagado_por?.nombre || 'Alguien'}</span>
                       </p>
                    </div>
                 </div>
                 <div className="flex items-center gap-6">
                    <span className="text-2xl font-black dark:text-white tracking-tighter text-right">
                       ${act.monto?.toFixed(2)}
                    </span>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-rose-500 group-hover:translate-x-1 transition-all" />
                 </div>
              </Card>
           ))}
        </div>
      )}
    </div>
  );
}
