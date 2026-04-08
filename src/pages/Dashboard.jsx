import React, { useState, useEffect } from 'react';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button, Card, Input } from '../components/UI';
import { Plus, Calendar, Share2, Trash2, LogOut, Sun, Moon, ChevronRight, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
      const records = await pb.collection('events').getFullList();
      setEvents(records);
    } catch (err) {
      console.error(err);
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
    if (!confirm('¿Seguro que quieres eliminar este evento y todo su historial?')) return;
    try {
      await pb.collection('events').delete(id);
      setEvents(events.filter(e => e.id !== id));
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 transition-colors duration-500 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b-0 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <h1 className="text-xl font-bold dark:text-white hidden sm:block">SplitPay</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={toggleTheme} className="rounded-full w-10 h-10 p-0 text-slate-500 dark:text-gray-400">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
          
          <div className="h-8 w-[1px] bg-slate-200 dark:bg-gray-800 mx-2"></div>
          
          <div className="flex items-center gap-3">
             <div className="text-right hidden xs:block">
                <p className="text-xs font-bold dark:text-white leading-tight">{user.name || 'Usuario'}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-tight">Conectado</p>
             </div>
             <Button variant="ghost" onClick={logout} className="rounded-full w-10 h-10 p-0 text-rose-500">
               <LogOut size={18} />
             </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl font-bold dark:text-white">Mis Eventos</h2>
            <p className="text-slate-500 dark:text-gray-400 mt-1">Gestiona tus gastos compartidos</p>
          </div>
          <Button onClick={() => setModalVisible(true)} className="sm:w-auto">
            <Plus size={20} /> Nuevo Evento
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
             <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
             <p className="mt-4 text-sm font-bold uppercase tracking-widest text-slate-400">Cargando Universos...</p>
          </div>
        ) : events.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 text-slate-300 dark:text-gray-700">
              <Calendar size={40} />
            </div>
            <h3 className="text-xl font-bold dark:text-white">No hay eventos aún</h3>
            <p className="text-slate-500 dark:text-gray-400 mt-2 max-w-xs">Comienza creando un evento para compartir gastos con tus amigos.</p>
            <Button variant="secondary" className="mt-6" onClick={() => setModalVisible(true)}>
               Crear mi primer evento
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map(event => (
              <Card key={event.id} className="group relative overflow-hidden flex flex-col justify-between h-48 border-emerald-500/0 hover:border-emerald-500/30">
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Button variant="ghost" className="p-2 text-rose-500 hover:bg-rose-500/10" onClick={(e) => { e.stopPropagation(); deleteEvent(event.id); }}>
                      <Trash2 size={18} />
                   </Button>
                </div>
                
                <div className="cursor-pointer flex-1" onClick={() => navigate(`/event/${event.id}`)}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                       <Calendar size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       {/* Fecha oculta por error de sistema */}
                       Evento Activo
                    </span>
                  </div>
                  <h3 className="text-xl font-bold dark:text-white group-hover:text-emerald-500 transition-colors uppercase tracking-tight">{event.nombre_evento}</h3>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-gray-800">
                   <div className="flex -space-x-2">
                      {[1,2,3].map(i => (
                        <div key={i} className="w-7 h-7 rounded-full bg-slate-200 dark:bg-gray-800 border-2 border-white dark:border-gray-900 flex items-center justify-center">
                           <User size={12} className="text-slate-400" />
                        </div>
                      ))}
                   </div>
                   <div className="flex items-center gap-1 text-emerald-500 font-bold text-xs uppercase tracking-widest cursor-pointer" onClick={() => navigate(`/event/${event.id}`)}>
                      Detalles <ChevronRight size={14} />
                   </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* New Event Modal */}
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="max-w-md w-full animate-in zoom-in-95 duration-200" hover={false}>
             <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 dark:text-white">
                <Plus className="text-emerald-500" /> Nuevo Evento
             </h2>
             <form onSubmit={handleCreateEvent} className="flex flex-col gap-6">
                <Input 
                  label="Nombre del Evento" 
                  placeholder="Ej: Viaje a la playa, Cena amigos..." 
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-3 mt-2">
                   <Button variant="secondary" className="flex-1" onClick={() => setModalVisible(false)} type="button">Cancelar</Button>
                   <Button className="flex-1" type="submit" disabled={creating}>
                     {creating ? 'Creando...' : 'Crear Evento'}
                   </Button>
                </div>
             </form>
          </Card>
        </div>
      )}
    </div>
  );
}
