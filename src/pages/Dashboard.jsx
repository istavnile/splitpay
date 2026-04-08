import React, { useState, useEffect } from 'react';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Input } from '../components/UI';
import { Plus, Calendar, Share2, Trash2, ChevronRight, User, Wallet, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SummaryCard = ({ title, value, icon: Icon, color }) => (
  <Card className="flex flex-col gap-2 border-none bg-white/50 dark:bg-gray-900/50 backdrop-blur-md" hover={false}>
    <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white mb-2 shadow-lg shadow-emerald-500/10`}>
      <Icon size={20} />
    </div>
    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-gray-500">{title}</span>
    <span className="text-2xl font-black dark:text-white tracking-tight">{value}</span>
  </Card>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      // 1. Get owned events
      const ownedRecords = await pb.collection('events').getFullList({
        filter: `creado_por = "${user.id}"`,
        sort: '-created',
      });

      // 2. Get events where user is a member
      const memberships = await pb.collection('members').getFullList({
        filter: `id_usuario = "${user.id}"`,
        expand: 'id_evento',
      });
      const sharedRecords = memberships
        .filter(m => m.id_evento && m.expand?.id_evento && m.expand.id_evento.creado_por !== user.id)
        .map(m => m.expand.id_evento);

      // Merge and remove duplicates (though filter above handles mostly)
      const allEvents = [...ownedRecords, ...sharedRecords];
      setEvents(allEvents);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    setCreating(true);
    try {
      const data = {
        nombre_evento: newEventName.trim(),
        creado_por: user.id,
      };
      const record = await pb.collection('events').create(data);
      
      // Also add the creator as the first participant
      await pb.collection('participants').create({
        id_evento: record.id,
        nombre: user.name || user.email.split('@')[0],
        creado_por: user.id
      });

      setEvents([record, ...events]);
      setModalVisible(false);
      setNewEventName('');
      navigate(`/event/${record.id}`);
    } catch (err) {
      alert('Error al crear evento: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteEvent = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar este evento?')) return;
    try {
      await pb.collection('events').delete(id);
      setEvents(events.filter(e => e.id !== id));
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
           <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500 mb-2 block">Panel de Control</span>
           <h2 className="text-4xl font-black dark:text-white tracking-tight">Hola, {user.name || 'Usuario'}</h2>
           <p className="text-slate-500 dark:text-gray-400 mt-2">Tienes {events.length} eventos activos este mes.</p>
        </div>
        <Button onClick={() => setModalVisible(true)} className="px-6 py-6 rounded-2xl shadow-xl shadow-emerald-500/20 hover:scale-105 transition-transform">
          <Plus size={20} /> <span className="font-bold">Nuevo Evento</span>
        </Button>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
         <SummaryCard title="Gasto Total" value="$1,250.00" icon={Wallet} color="bg-emerald-500" />
         <SummaryCard title="Tu Balance" value="+$145.20" icon={TrendingUp} color="bg-blue-500" />
         <SummaryCard title="Miembros" value="12" icon={Users} color="bg-indigo-500" />
         <SummaryCard title="Ahorro" value="8%" icon={TrendingUp} color="bg-rose-500" />
      </div>

      <div className="flex items-center justify-between mb-8">
         <h3 className="text-xl font-black dark:text-white tracking-tight">Eventos Recientes</h3>
         <button onClick={fetchEvents} className="text-xs font-bold text-emerald-500 hover:underline uppercase tracking-widest">Sincronizar</button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
           <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
           <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Leyendo universos...</p>
        </div>
      ) : events.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center bg-white/20 dark:bg-gray-900/20 border-dashed border-2 border-slate-200 dark:border-gray-800" hover={false}>
          <div className="w-20 h-20 bg-slate-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-6 text-slate-300 dark:text-gray-700">
            <Calendar size={40} />
          </div>
          <h3 className="text-xl font-bold dark:text-white">Empieza tu primer viaje</h3>
          <p className="text-slate-500 dark:text-gray-400 mt-2 max-w-xs text-sm">Divide gastos con amigos, familia o compañeros de trabajo fácilmente.</p>
          <Button variant="secondary" className="mt-6 rounded-xl" onClick={() => setModalVisible(true)}>
             Crear primer evento
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {events.map((event, index) => (
            <Card key={event.id} className="group p-0 overflow-hidden flex flex-col h-full bg-white dark:bg-gray-900 border-none shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
              <div 
                className="h-24 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 relative"
                onClick={() => navigate(`/event/${event.id}`)}
              >
                 <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 bg-white/80 dark:bg-black/40 rounded-lg text-rose-500 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); deleteEvent(event.id); }}>
                       <Trash2 size={16} />
                    </button>
                 </div>
                 <div className="absolute -bottom-6 left-6 w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center text-emerald-500 border border-slate-50 dark:border-gray-700 font-bold text-xl">
                    {event.nombre_evento?.[0]?.toUpperCase()}
                 </div>
              </div>

              <div className="p-6 pt-10 flex-1 cursor-pointer" onClick={() => navigate(`/event/${event.id}`)}>
                 <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-black dark:text-white group-hover:text-emerald-500 transition-colors tracking-tight">{event.nombre_evento}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{new Date(event.created).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-black dark:text-white">$1,250.00</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Gasto Total</p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 w-[65%]" style={{ width: `${Math.floor(Math.random() * 80 + 20)}%` }}></div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                       <div className="flex -space-x-2">
                          {[1,2,3,4].map(i => (
                            <div key={i} className="w-7 h-7 rounded-full bg-slate-100 dark:bg-gray-800 border-2 border-white dark:border-gray-950 flex items-center justify-center overflow-hidden">
                               <img src={`https://i.pravatar.cc/100?u=${event.id}${i}`} alt="User" />
                            </div>
                          ))}
                          <div className="w-7 h-7 rounded-full bg-emerald-500 text-[10px] font-bold text-white border-2 border-white dark:border-gray-950 flex items-center justify-center">
                             +2
                          </div>
                       </div>
                       <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Split with 6</span>
                    </div>
                 </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New Event Modal */}
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="max-w-md w-full animate-in zoom-in-95 duration-300 shadow-2xl border-none p-8" hover={false}>
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black flex items-center gap-2 dark:text-white tracking-tight">
                    <Plus className="text-emerald-500" strokeWidth={3} /> Nuevo Evento
                </h2>
                <button onClick={() => setModalVisible(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                   <Plus size={24} className="rotate-45" />
                </button>
             </div>
             <form onSubmit={handleCreateEvent} className="flex flex-col gap-8">
                <Input 
                  label="Nombre del Proyecto" 
                  placeholder="Ej: Viaje a París, Cena Equipos..." 
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  autoFocus
                  className="bg-slate-50 dark:bg-gray-800/50 border-none px-6 py-4 rounded-2xl"
                />
                <div className="flex flex-col gap-3">
                   <Button className="py-4 h-auto rounded-2xl font-bold shadow-xl shadow-emerald-500/10" type="submit" disabled={creating}>
                     {creating ? 'Generando Universo...' : 'Crear Evento'}
                   </Button>
                   <Button variant="secondary" className="py-4 h-auto rounded-2xl border-none bg-slate-100 dark:bg-gray-800" onClick={() => setModalVisible(false)} type="button">
                      Cancelar
                   </Button>
                </div>
             </form>
          </Card>
        </div>
      )}
    </div>
  );
}
