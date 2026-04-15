import React, { useState, useEffect } from 'react';
import { Activity as ActivityIcon, Receipt, ChevronRight } from 'lucide-react';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str.replace(' ', 'T'));
  if (isNaN(d)) return '';
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

export default function Activity() {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { fetchActivity(); }, []);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const owned = await pb.collection('events').getFullList({ filter: `creado_por = "${user.id}"` });
      let shared = [];
      try {
        const membs = await pb.collection('members').getFullList({ filter: `id_usuario = "${user.id}"`, expand: 'id_evento' });
        shared = membs.filter(m => m.id_evento).map(m => m.expand.id_evento);
      } catch (_) {}

      const allEventIds = [...new Set([...owned, ...shared].map(e => e.id))];
      if (allEventIds.length === 0) { setActivities([]); return; }

      const expenses = await pb.collection('expenses').getFullList({
        filter: allEventIds.map(id => `id_evento = "${id}"`).join(' || '),
        expand: 'id_evento,pagado_por',
        sort: '-created',
      });
      setActivities(expenses.slice(0, 30));
    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6 md:mb-10">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-500 mb-1 block">Historial</span>
        <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Actividad Reciente</h2>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-10 h-10 border-4 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
          <ActivityIcon size={40} className="mb-4 text-slate-400" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-500">Sin actividad aún</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map(act => (
            <button
              key={act.id}
              onClick={() => navigate(`/event/${act.id_evento}`)}
              className="w-full flex items-center gap-3 p-3 md:p-4 bg-white dark:bg-gray-900/60 rounded-2xl border border-slate-100 dark:border-gray-800 hover:border-rose-500/30 hover:shadow-md transition-all text-left group"
            >
              {/* Icon */}
              <div className="w-9 h-9 shrink-0 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
                <Receipt size={16} />
              </div>

              {/* Main text */}
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-900 dark:text-white text-sm truncate leading-tight">
                  {act.descripcion}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5 truncate">
                  <span className="text-rose-400 font-bold">{act.expand?.pagado_por?.nombre || '—'}</span>
                  {act.expand?.id_evento?.nombre_evento && (
                    <> · {act.expand.id_evento.nombre_evento}</>
                  )}
                </p>
              </div>

              {/* Amount + date + arrow */}
              <div className="shrink-0 flex flex-col items-end gap-0.5">
                <span className="font-black text-slate-900 dark:text-white text-sm tracking-tight">
                  {act.expand?.id_evento?.moneda || '$'}{act.monto?.toFixed(2)}
                </span>
                <span className="text-[9px] text-slate-400 dark:text-gray-600 font-bold uppercase tracking-wide">
                  {fmtDate(act.created)}
                </span>
              </div>

              <ChevronRight size={14} className="shrink-0 text-slate-300 dark:text-gray-700 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
