import React, { useState, useEffect } from 'react';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/UI';
import { Calendar, ChevronRight, TrendingUp, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Events() {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user?.id) {
       fetchEvents();
    }
  }, [user?.id, authLoading]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const ownedRecords = await pb.collection('events').getFullList({
        filter: `creado_por = "${user.id}"`,
      });
      
      let sharedRecords = [];
      try {
        const memberships = await pb.collection('members').getFullList({
          filter: `id_usuario = "${user.id}"`,
          expand: 'id_evento',
        });
        sharedRecords = memberships
          .filter(m => m.id_evento && m.expand?.id_evento && m.expand.id_evento.creado_por !== user.id)
          .map(m => m.expand.id_evento);
      } catch (err) {}

      console.log(`Events page: ${ownedRecords.length} owned, ${sharedRecords.length} shared`);
      setEvents([...ownedRecords, ...sharedRecords]);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEventColor = (index) => {
    const colors = [
      'from-emerald-500 to-teal-500',
      'from-indigo-500 to-blue-600',
      'from-rose-500 to-pink-600',
      'from-amber-600 to-orange-600',
      'from-purple-500 to-violet-600',
      'from-cyan-500 to-blue-500'
    ];
    return colors[index % colors.length];
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center py-20 min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-10">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500 mb-2 block">Mis Proyectos</span>
        <h2 className="text-4xl font-black dark:text-white tracking-tight uppercase">Eventos</h2>
        <p className="text-slate-500 dark:text-gray-400 mt-2">Gestiona todos tus viajes y salidas compartidas.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
        </div>
      ) : events.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center bg-white/20 dark:bg-gray-900/20 border-dashed border-2 border-slate-200 dark:border-gray-800" hover={false}>
          <Calendar size={40} className="text-slate-300 mb-4" />
          <h3 className="text-xl font-bold dark:text-white uppercase tracking-tight">No hay eventos todavía</h3>
          <p className="text-slate-500 dark:text-gray-400 mt-2 text-sm max-w-xs">Crea tu primer evento desde el Dashboard para empezar a dividir gastos.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-white">
          {events.map((event, index) => (
            <Link 
              key={event.id} 
              to={`/event/${event.id}`}
              className={`group p-0 overflow-hidden flex flex-col h-full bg-white dark:bg-gray-900 border-none shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 cursor-pointer rounded-[2.5rem] ${event.archivado ? 'opacity-60 grayscale-[0.5]' : ''}`}
            >
              <div className={`h-28 bg-gradient-to-br ${getEventColor(index)} relative flex items-center justify-between px-8`}>
                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/10 font-black text-2xl shadow-lg">
                    {event.nombre_evento?.[0]?.toUpperCase()}
                  </div>
              </div>
              
              <div className="p-8 pt-6 flex-1 bg-white dark:bg-gray-900">
                 <div className="mb-4">
                    <h3 className="text-xl font-black dark:text-white group-hover:text-emerald-500 transition-colors tracking-tighter uppercase">{event.nombre_evento}</h3>
                    <div className="flex items-center gap-2 mt-2">
                       <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">
                          {event.created ? new Date(event.created).toLocaleDateString() : 'Sin fecha'}
                       </p>
                       {event.archivado && <span className="bg-slate-100 dark:bg-gray-800 text-slate-400 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Archivado</span>}
                    </div>
                 </div>

                 <div className="mt-auto pt-6 border-t border-slate-50 dark:border-gray-800 flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                       Ver detalle <ChevronRight size={12} />
                    </span>
                 </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
