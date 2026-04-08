import React, { useState, useEffect } from 'react';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Input } from '../components/UI';
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

        setStats({
            total: `$${myTotalPaid.toFixed(2)}`,
            balance: `${globalNet >= 0 ? '+' : ''}$${globalNet.toFixed(2)}`,
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
         <h3 className="text-xl font-black dark:text-white tracking-tight">Eventos Recientes</h3>
         <button onClick={fetchEvents} className="text-xs font-bold text-emerald-500 hover:underline uppercase tracking-widest disabled:opacity-50" disabled={loading}>
            {loading ? 'Sincronizando...' : 'Sincronizar'}
         </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
           <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
        </div>
      ) : events.length === 0 ? (
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {events.map((event) => (
            <Link 
              key={event.id} 
              to={`/event/${event.id}`}
              className="group p-0 overflow-hidden flex flex-col h-full bg-white dark:bg-gray-900 border-none shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 cursor-pointer rounded-[2rem]"
            >
              <div className="h-24 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 relative">
                 <div className="absolute -bottom-6 left-6 w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center text-emerald-500 border border-slate-50 dark:border-gray-700 font-bold text-xl">
                    {event.nombre_evento?.[0]?.toUpperCase()}
                 </div>
              </div>

              <div className="p-6 pt-10 flex-1">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-black dark:text-white group-hover:text-emerald-500 transition-colors tracking-tight">{event.nombre_evento}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">
                           {event.created ? new Date(event.created.replace(' ', 'T')).toLocaleDateString() : 'Sin fecha'}
                        </p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 w-[65%]" style={{ width: `${Math.floor(Math.random() * 60 + 20)}%` }}></div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                       <div className="flex -space-x-2">
                          {[1,2,3].map(i => (
                            <div key={i} className="w-7 h-7 rounded-full bg-slate-100 dark:bg-gray-800 border-2 border-white dark:border-gray-950 flex items-center justify-center overflow-hidden text-[8px] text-slate-400">
                               {i}
                            </div>
                          ))}
                       </div>
                       <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1">
                          Calculando deudas <ChevronRight size={12} />
                       </span>
                    </div>
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
    </div>
  );
}
