import { useState, useEffect } from 'react';
import pb from '../lib/pocketbase';
import { getEventColorTw } from '../utils/eventColor';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/UI';
import { Calendar, ChevronRight, AlertCircle, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

function EventCard({ event, user, onArchive, onDelete, creatorName, participantCount }) {
  const isOwner = event.creado_por === user.id;
  const dateStr = event.fecha_evento
    ? new Date(event.fecha_evento.slice(0,10) + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
    : event.fecha_creacion
    ? new Date(event.fecha_creacion.slice(0,10) + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <Link
      to={`/event/${event.id}`}
      className={`group flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-800 hover:border-emerald-500/40 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden ${event.archivado ? 'opacity-50 grayscale-[0.4]' : ''}`}
    >
      {/* Thin color accent strip */}
      <div className={`h-1 w-full bg-gradient-to-r ${getEventColorTw(event.id)}`} />

      <div className="p-5 flex flex-col flex-1 gap-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-black dark:text-white group-hover:text-emerald-500 transition-colors tracking-tight uppercase leading-snug flex-1">{event.nombre_evento}</h3>
          {/* Owner actions */}
          {isOwner && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0 -mr-1">
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); onArchive(event.id, event.archivado); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition-all" title={event.archivado ? 'Desarchivar' : 'Archivar'}>
                <AlertCircle size={14} />
              </button>
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(event.id); }}
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all" title="Eliminar">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          {dateStr && (
            <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1">
              <Calendar size={10} /> {dateStr}
            </span>
          )}
          {!isOwner && creatorName && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 uppercase tracking-wide flex items-center gap-1">
              <Users size={9} /> {creatorName}
            </span>
          )}
          {event.archivado && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-gray-800 text-slate-400 uppercase">Archivado</span>}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-3 border-t border-slate-50 dark:border-gray-800 flex items-center justify-between">
          {participantCount != null ? (
            <span className="text-[10px] font-bold text-slate-400 dark:text-gray-600 flex items-center gap-1">
              <Users size={10} /> {participantCount} {participantCount === 1 ? 'persona' : 'personas'}
            </span>
          ) : <span />}
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
            Ver detalle <ChevronRight size={12} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptySection({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-slate-100 dark:border-gray-800 rounded-3xl">
      <Calendar size={28} className="text-slate-300 dark:text-gray-700 mb-3" />
      <p className="text-slate-400 dark:text-gray-600 text-sm font-bold">{message}</p>
    </div>
  );
}

export default function Events() {
  const { user, loading: authLoading } = useAuth();
  const [ownedEvents, setOwnedEvents] = useState([]);
  const [sharedEvents, setSharedEvents] = useState([]);
  const [creatorNames, setCreatorNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });

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
          filter: `id_usuario = "${user.id}" || email = "${user.email}"`,
          expand: 'id_evento',
        });
        memberships.filter(m => !m.id_usuario && m.email === user.email)
          .forEach(m => pb.collection('members').update(m.id, { id_usuario: user.id }).catch(() => {}));
        sharedRecords = memberships
          .filter(m => m.id_evento && m.expand?.id_evento && m.expand.id_evento.creado_por !== user.id)
          .map(m => m.expand.id_evento);

        // Deduplicate shared
        const seen = new Set();
        sharedRecords = sharedRecords.filter(e => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });

        // Fetch creator names for shared events
        if (sharedRecords.length > 0) {
          try {
            const creatorFilter = sharedRecords
              .map(e => `(id_evento = "${e.id}" && id_usuario = "${e.creado_por}")`)
              .join(' || ');
            const creatorParticipants = await pb.collection('participants').getFullList({ filter: creatorFilter });
            const nameMap = {};
            creatorParticipants.forEach(p => { nameMap[p.id_evento] = p.nombre; });
            setCreatorNames(nameMap);
          } catch {}
        }
      } catch {}

      setOwnedEvents(ownedRecords);
      setSharedEvents(sharedRecords);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (eventId, currentStatus) => {
    try {
      await pb.collection('events').update(eventId, { archivado: !currentStatus });
      setOwnedEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, archivado: !currentStatus } : ev));
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDelete = async () => {
    const eventId = confirmDelete.id;
    try {
      const [participants, expenses, members, presence] = await Promise.all([
        pb.collection('participants').getFullList({ filter: `id_evento = "${eventId}"` }),
        pb.collection('expenses').getFullList({ filter: `id_evento = "${eventId}"` }),
        pb.collection('members').getFullList({ filter: `id_evento = "${eventId}"` }),
        pb.collection('presence').getFullList({ filter: `id_evento = "${eventId}"` }).catch(() => []),
      ]);
      await Promise.all([
        ...participants.map(r => pb.collection('participants').delete(r.id)),
        ...expenses.map(r => pb.collection('expenses').delete(r.id)),
        ...members.map(r => pb.collection('members').delete(r.id)),
        ...presence.map(r => pb.collection('presence').delete(r.id)),
      ]);
      await pb.collection('events').delete(eventId);
      setOwnedEvents(prev => prev.filter(ev => ev.id !== eventId));
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center py-20 min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const visibleOwned = showArchived ? ownedEvents : ownedEvents.filter(e => !e.archivado);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-14">
      <div>
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500 mb-2 block">Mis Proyectos</span>
        <h2 className="text-4xl font-black dark:text-white tracking-tight uppercase">Eventos</h2>
        <p className="text-slate-500 dark:text-gray-400 mt-2">Gestiona todos tus viajes y salidas compartidas.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* --- MIS EVENTOS --- */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500">Creados por ti</span>
                <h3 className="text-xl font-black dark:text-white tracking-tight uppercase">Mis Eventos</h3>
              </div>
              {ownedEvents.some(e => e.archivado) && (
                <button
                  onClick={() => setShowArchived(s => !s)}
                  className={`text-[10px] font-black uppercase tracking-widest transition-colors ${showArchived ? 'text-emerald-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-gray-300'}`}
                >
                  {showArchived ? 'Ocultar archivados' : 'Mostrar archivados'}
                </button>
              )}
            </div>

            {visibleOwned.length === 0 ? (
              <EmptySection message="No tienes eventos propios todavía." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {visibleOwned.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    user={user}
                    onArchive={handleArchive}
                    onDelete={(id) => setConfirmDelete({ open: true, id })}
                  />
                ))}
              </div>
            )}
          </section>

          {/* --- COMPARTIDOS CONMIGO --- */}
          <section>
            <div className="mb-6">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500">Invitado por otros</span>
              <h3 className="text-xl font-black dark:text-white tracking-tight uppercase">Compartidos Conmigo</h3>
            </div>

            {sharedEvents.length === 0 ? (
              <EmptySection message="Aún no te han compartido ningún evento." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {sharedEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    user={user}
                    creatorName={creatorNames[event.id] || 'Organizador'}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null })}
        onConfirm={handleDelete}
        title="¿Eliminar Evento?"
        message="¿Estás seguro de que deseas borrar este evento y todos sus gastos asociados? Esta acción no se puede deshacer."
      />
    </div>
  );
}
