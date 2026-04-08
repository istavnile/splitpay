import React, { useState, useEffect } from 'react';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Input, ConfirmDialog } from '../components/UI';
import { Plus, Calendar, Share2, Trash2, ChevronRight, User, Wallet, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const SummaryCard = ({ title, value, icon: Icon, color, onClick }) => (
  <Card 
    className={`flex flex-col gap-2 border-none bg-white/50 dark:bg-gray-900/50 backdrop-blur-md cursor-pointer group active:scale-95 transition-all`} 
    hover={true}
    onClick={onClick}
  >
    <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white mb-2 shadow-lg shadow-emerald-500/10 group-hover:scale-110 transition-transform`}>
      <Icon size={20} />
    </div>
    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-gray-500">{title}</span>
    <span className="text-2xl font-black dark:text-white tracking-tight">{value}</span>
  </Card>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ total: '$0.00', balance: '$0.00', members: '0', activity: '0' });
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });
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
        sort: '',
      });

      // 2. Get events where user is a member (Handle potential 404 if collection not created yet)
      let sharedRecords = [];
      try {
        const memberships = await pb.collection('members').getFullList({
          filter: `id_usuario = "${user.id}"`,
          expand: 'id_evento',
        });
        sharedRecords = memberships
          .filter(m => m.id_evento && m.expand?.id_evento && m.expand.id_evento.creado_por !== user.id)
          .map(m => m.expand.id_evento);
      } catch (err) {
        console.warn('Members collection might not exist yet:', err.message);
      }

      const allEvents = [...ownedRecords, ...sharedRecords];
      setEvents(allEvents);

      // 3. Simple Stats Calculation
      calculateGlobalStats(allEvents);

    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateGlobalStats = async (allEvents) => {
    try {
        const eventIds = allEvents.map(e => e.id);
        if (eventIds.length === 0) {
            setStats({ total: '$0.00', balance: '$0.00', members: '0', activity: '0' });
            return;
        }

        // 1. Fetch all expenses for all events I belong to
        const allExpenses = await pb.collection('expenses').getFullList({
            filter: eventIds.map(id => `id_evento = "${id}"`).join(' || '),
        });

        // 2. Fetch all participants for these events
        const allParticipants = await pb.collection('participants').getFullList({
            filter: eventIds.map(id => `id_evento = "${id}"`).join(' || '),
        });

        // 3. Calculate "Total Gasto" (What I have paid across all events)
        const myExpenses = allExpenses.filter(exp => exp.creado_por === user.id);
        const myTotalPaid = myExpenses.reduce((sum, exp) => sum + (exp.monto || 0), 0);

        // 4. Calculate "Tu Balance" (Global Net)
        let globalNet = 0;
        allEvents.forEach(evt => {
            const evtExpenses = allExpenses.filter(exp => exp.id_evento === evt.id);
            const evtParticipants = allParticipants.filter(p => p.id_evento === evt.id);
            if (evtParticipants.length > 0) {
                const totalEvent = evtExpenses.reduce((s, e) => s + (e.monto || 0), 0);
                const fairShare = totalEvent / evtParticipants.length;
                const iPaid = evtExpenses.filter(e => e.creado_por === user.id).reduce((s, e) => s + (e.monto || 0), 0);
                globalNet += (iPaid - fairShare);
            }
        });

        // 5. Count Unique Members
        const uniqueNames = new Set(allParticipants.map(p => p.nombre.toLowerCase().trim()));

        const globalMoneda = user.moneda_preferida || '$';
        setStats({
            total: `${globalMoneda}${myTotalPaid.toFixed(2)}`,
            balance: `${globalNet >= 0 ? '+' : ''}${globalMoneda}${globalNet.toFixed(2)}`,
            members: uniqueNames.size.toString(),
            activity: allEvents.length.toString()
        });
    } catch (err) {
        console.warn('Stats calculation error:', err.message);
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
        moneda: user.moneda_preferida || '$',
      };
      const record = await pb.collection('events').create(data);
      
      // Add creator as participant
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
      alert('Error al crear: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteEvent = async () => {
    try {
      await pb.collection('events').delete(confirmDelete.id);
      setEvents(events.filter(ev => ev.id !== confirmDelete.id));
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const archiveEvent = async (e, eventId, currentStatus) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await pb.collection('events').update(eventId, { archivado: !currentStatus });
      setEvents(events.map(ev => ev.id === eventId ? { ...ev, archivado: !currentStatus } : ev));
    } catch (err) {
      alert('Error: ' + err.message);
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

  const filteredEvents = showArchived ? events : events.filter(e => !e.archivado);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
           <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500 mb-2 block">Panel de Control</span>
           <h2 className="text-4xl font-black dark:text-white tracking-tight">Hola, {user.name || 'Usuario'}</h2>
           <p className="text-slate-500 dark:text-gray-400 mt-2">
             {loading ? 'Calculando universo...' : `Tienes ${events.length} eventos activos este mes.`}
           </p>
        </div>
        <Button onClick={() => setModalVisible(true)} className="px-6 py-6 rounded-2xl shadow-xl shadow-emerald-500/20 hover:scale-105 transition-transform">
          <Plus size={20} /> <span className="font-bold">Nuevo Evento</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
         <SummaryCard title="Gasto Total" value={stats.total} icon={Wallet} color="bg-emerald-500" onClick={() => navigate('/activity')} />
         <SummaryCard title="Tu Balance" value={stats.balance} icon={TrendingUp} color="bg-blue-500" onClick={() => navigate('/')} />
         <SummaryCard title="Miembros" value={stats.members} icon={Users} color="bg-indigo-500" onClick={() => navigate('/members')} />
         <SummaryCard title="Proyectos" value={stats.activity} icon={Calendar} color="bg-rose-500" onClick={() => navigate('/')} />
      </div>

      <div className="flex items-center justify-between mb-8">
         <h3 className="text-xl font-black dark:text-white tracking-tight uppercase">Eventos Recientes</h3>
         <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowArchived(!showArchived)}
              className={`text-[10px] font-black uppercase tracking-widest transition-colors ${showArchived ? 'text-emerald-500' : 'text-slate-400 hover:text-white'}`}
            >
               {showArchived ? 'Ocultar Archivados' : 'Mostrar Archivados'}
            </button>
            <button onClick={fetchEvents} className="text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:scale-105 transition-transform" disabled={loading}>
               {loading ? 'Sincronizando...' : 'Sincronizar'}
            </button>
         </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
           <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center bg-white/20 dark:bg-gray-900/20 border-dashed border-2 border-slate-200 dark:border-gray-800" hover={false}>
          <div className="w-20 h-20 bg-slate-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-6 text-slate-300 dark:text-gray-700">
            <Calendar size={40} />
          </div>
          <h3 className="text-xl font-bold dark:text-white">Empieza tu primer viaje</h3>
          <p className="text-slate-500 dark:text-gray-400 mt-2 max-w-xs text-sm text-center">Divide gastos con amigos, familia o compañeros de trabajo fácilmente.</p>
          <Button variant="secondary" className="mt-6 rounded-xl" onClick={() => setModalVisible(true)}>
             Crear primer evento
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredEvents.map((event, index) => (
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
                  <div className="flex gap-2 relative z-10 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                     <button 
                       onClick={(e) => archiveEvent(e, event.id, event.archivado)}
                       className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-xl text-white backdrop-blur-md flex items-center justify-center transition-colors"
                       title={event.archivado ? 'Desarchivar' : 'Archivar'}
                     >
                        <AlertCircle size={18} />
                     </button>
                     <button 
                       onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete({ open: true, id: event.id }); }}
                       className="w-10 h-10 bg-rose-500/20 hover:bg-rose-500/40 rounded-xl text-white backdrop-blur-md flex items-center justify-center transition-colors"
                       title="Eliminar"
                     >
                        <Trash2 size={18} />
                     </button>
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
                    <div className="flex -space-x-2">
                       {[1,2,3].map(i => (
                         <div key={i} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-800 border-2 border-white dark:border-gray-950 flex items-center justify-center text-[10px] font-black text-slate-400">
                            {i}
                         </div>
                       ))}
                    </div>
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                       Ver detalle <ChevronRight size={12} />
                    </span>
                 </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New Event Modal */}
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="max-w-md w-full animate-in zoom-in-95 duration-300 shadow-2xl border-none p-8" hover={false}>
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black flex items-center gap-2 dark:text-white tracking-tight uppercase">
                    <Plus className="text-emerald-500" strokeWidth={3} /> Nuevo Evento
                </h2>
                <button onClick={() => setModalVisible(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                   <Plus size={24} className="rotate-45" />
                </button>
             </div>
             <form onSubmit={handleCreateEvent} className="space-y-8">
                <Input 
                  label="Nombre del Proyecto" 
                  placeholder="Ej: Viaje a París, Cena Equipos..." 
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  autoFocus
                  required
                />
                <div className="flex flex-col gap-3">
                   <Button className="py-4 h-auto rounded-2xl font-bold shadow-xl shadow-emerald-500/20" type="submit" disabled={creating}>
                     {creating ? 'Generando Universo...' : 'Crear Evento'}
                   </Button>
                   <Button variant="secondary" className="py-4 h-auto rounded-2xl border-none" onClick={() => setModalVisible(false)} type="button">
                      Cancelar
                   </Button>
                </div>
             </form>
          </Card>
        </div>
      )}
      {/* Delete Confirmation */}
      <ConfirmDialog 
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null })}
        onConfirm={deleteEvent}
        title="¿Eliminar Evento?"
        message="¿Estás seguro de que deseas borrar este evento y todos sus gastos asociados? Esta acción no se puede deshacer."
      />
    </div>
  );
}
