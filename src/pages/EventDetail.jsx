import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, ConfirmDialog, StatusModal, Toast } from '../components/UI';
import { calculateBalance } from '../utils/balanceEngine';
import { 
  ArrowLeft, Plus, UserPlus, Share2, Trash2, 
  Wallet, Receipt, ArrowRightLeft, CheckCircle2,
  Copy, Mail, ChevronRight, X, AlertCircle, Users, TrendingUp, Settings, Calendar,
  Check
} from 'lucide-react';

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingExpense, setAddingExpense] = useState(false);
  const [inviting, setInviting] = useState(false);
  
  // Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  
  const [modals, setModals] = useState({ invite: false, settings: false });
  const [balance, setBalance] = useState({ transferencias: [], summary: [], text: '', total: 0 });
  const [copied, setCopied] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: () => {} });
  const [status, setStatus] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' });
  const [onlineUsers, setOnlineUsers] = useState({}); // { id_usuario: last_seen ISO string }
  const presenceRecordId = useRef(null);
  const heartbeatRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  // Presence system
  useEffect(() => {
    if (!user || !id) return;

    const pingPresence = async () => {
      const now = new Date().toISOString().replace('T', ' ');
      try {
        if (presenceRecordId.current) {
          await pb.collection('presence').update(presenceRecordId.current, { last_seen: now });
        } else {
          // Check if record already exists for this user+event
          const existing = await pb.collection('presence').getFirstListItem(
            `id_evento = "${id}" && id_usuario = "${user.id}"`
          ).catch(() => null);

          if (existing) {
            presenceRecordId.current = existing.id;
            await pb.collection('presence').update(existing.id, { last_seen: now });
          } else {
            const rec = await pb.collection('presence').create({
              id_evento: id,
              id_usuario: user.id,
              nombre: user.name || user.email.split('@')[0],
              last_seen: now,
            });
            presenceRecordId.current = rec.id;
          }
        }
      } catch (_) {}
    };

    // Load initial presence for this event
    const loadPresence = async () => {
      try {
        const records = await pb.collection('presence').getFullList({
          filter: `id_evento = "${id}"`,
        });
        const map = {};
        records.forEach(r => { map[r.id_usuario] = r.last_seen; });
        setOnlineUsers(map);
      } catch (_) {}
    };

    pingPresence();
    loadPresence();
    heartbeatRef.current = setInterval(pingPresence, 30000);

    // Realtime subscription
    pb.collection('presence').subscribe('*', (e) => {
      if (e.record.id_evento !== id) return;
      setOnlineUsers(prev => ({ ...prev, [e.record.id_usuario]: e.record.last_seen }));
    }).catch(() => {});

    return () => {
      clearInterval(heartbeatRef.current);
      pb.collection('presence').unsubscribe('*');
      // Mark offline by deleting presence record
      if (presenceRecordId.current) {
        pb.collection('presence').delete(presenceRecordId.current).catch(() => {});
        presenceRecordId.current = null;
      }
    };
  }, [id, user]);

  useEffect(() => {
    if (participants.length > 0) {
      const perfiles = {};
      participants.forEach(p => perfiles[p.id] = p.nombre);
      const result = calculateBalance(expenses, participants.map(p => p.id), perfiles);
      setBalance({
        transferencias: result.transferencias,
        summary: result.resumen,
        text: result.textoExportar,
        total: result.totalEvento
      });
    }
  }, [expenses, participants]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const eventData = await pb.collection('events').getOne(id);
      // Prefer PocketBase moneda, fall back to localStorage, then '$'
      if (!eventData.moneda) {
        eventData.moneda = localStorage.getItem(`event_moneda_${id}`) || '$';
      }
      setEvent(eventData);

      const participantsData = await pb.collection('participants').getFullList({
        filter: `id_evento = "${id}"`,
      });
      setParticipants(participantsData);
      if (participantsData.length > 0 && !payerId) setPayerId(participantsData[0].id);

      const expensesData = await pb.collection('expenses').getFullList({
        filter: `id_evento = "${id}"`,
        expand: 'pagado_por',
      });
      setExpenses(expensesData);
    } catch (err) {
      console.error(err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!description || !amount || !payerId) return;
    setAddingExpense(true);
    try {
      const data = {
        id_evento: id,
        descripcion: description,
        monto: parseFloat(amount),
        pagado_por: payerId,
        creado_por: user.id,
        estado: 'activo',
      };
      const record = await pb.collection('expenses').create(data, { expand: 'pagado_por' });
      setToast({ isOpen: true, message: `"${description}" — ${moneda}${parseFloat(amount).toFixed(2)}`, type: 'success' });
      setAmount('');
      setDescription('');
      fetchData();
    } catch (err) {
      setStatus({
        isOpen: true,
        type: 'error',
        title: 'Error de Guardado',
        message: 'No pudimos registrar el gasto: ' + err.message
      });
    } finally {
      setAddingExpense(false);
    }
  };

  const handleInviteByEmail = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    try {
      await pb.collection('members').create({
        id_evento: id,
        email: inviteEmail.toLowerCase().trim(),
        rol: 'editor'
      });

      const nameFromEmail = inviteEmail.split('@')[0];
      await pb.collection('participants').create({
        id_evento: id,
        nombre: nameFromEmail,
        email: inviteEmail.toLowerCase().trim(),
        creado_por: user.id
      });

      setStatus({
        isOpen: true,
        type: 'success',
        title: 'Invitación Enviada',
        message: `Se ha invitado a ${inviteEmail} a colaborar en este evento.`
      });
      setInviteEmail('');
      setModals({ ...modals, invite: false });
      fetchData();
    } catch (err) {
      setStatus({
        isOpen: true,
        type: 'error',
        title: 'Error al Invitar',
        message: err.message
      });
    } finally {
      setInviting(false);
    }
  };

  const deleteExpense = async (expId) => {
    try {
      await pb.collection('expenses').delete(expId);
      setExpenses(expenses.filter(e => e.id !== expId));
    } catch (err) {
      setStatus({
        isOpen: true,
        type: 'error',
        title: 'Error al Borrar',
        message: err.message
      });
    }
  };

  const removeParticipant = async (pId) => {
    try {
      await pb.collection('participants').delete(pId);
      setParticipants(participants.filter(p => p.id !== pId));
    } catch (err) {
      setStatus({
        isOpen: true,
        type: 'error',
        title: 'Error de Gestión',
        message: 'No se pudo eliminar al participante: ' + err.message
      });
    }
  };

  const toggleCurrency = async (newMoneda) => {
    localStorage.setItem(`event_moneda_${id}`, newMoneda);
    setEvent(prev => ({ ...prev, moneda: newMoneda }));
    // Solo el creador puede persistir la moneda en el servidor
    if (event?.creado_por === user.id) {
      try {
        await pb.collection('events').update(id, { moneda: newMoneda });
      } catch (_) {}
    }
  };

  const copyBalance = () => {
    navigator.clipboard.writeText(balance.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
       <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
       <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Escaneando transacciones...</p>
    </div>
  );

  const moneda = event?.moneda || '$';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* Event Header Card */}
      <Card className="mb-6 p-0 overflow-hidden border-none shadow-2xl shadow-emerald-500/10 rounded-[2rem] md:rounded-[2.5rem]" hover={false}>
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-5 md:p-12 text-white relative group rounded-b-[1.5rem] md:rounded-b-[2rem]">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>

             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 w-full">
                <div className="flex items-center gap-4">
                    <button
                       onClick={() => navigate('/')}
                       className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 border border-white/10 shrink-0"
                    >
                       <ArrowLeft size={18} />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-2xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none truncate">{event?.nombre_evento || 'Cargando...'}</h1>
                        <p className="text-emerald-100/70 text-[9px] font-black uppercase tracking-[0.25em] mt-1.5 flex items-center gap-2 flex-wrap">
                           <Calendar size={10} /> {event?.created ? new Date(event.created).toLocaleDateString() : 'Sincronizando...'}
                           <span className="opacity-30">|</span>
                           <span className="text-emerald-300">Evento Activo ({moneda})</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    <Button
                      variant="secondary"
                      className="bg-white/10 hover:bg-white/20 border-none text-white backdrop-blur-sm px-4 md:px-6 py-2.5 md:py-3 h-auto rounded-2xl font-black text-xs uppercase tracking-widest shrink-0"
                      onClick={() => setModals({...modals, invite: true})}
                    >
                        <UserPlus size={16} /> <span className="ml-1.5">Invitar</span>
                    </Button>
                    <div className="flex bg-white/10 backdrop-blur-md rounded-2xl p-1 border border-white/10 shrink-0 h-10 self-center">
                       <button
                         onClick={() => toggleCurrency('$')}
                         className={`px-3 rounded-xl text-xs font-black transition-all ${moneda === '$' ? 'bg-white text-emerald-900 shadow-lg' : 'text-white hover:bg-white/10'}`}
                       >
                         $
                       </button>
                       <button
                         onClick={() => toggleCurrency('S/.')}
                         className={`px-3 rounded-xl text-xs font-black transition-all ${moneda === 'S/.' ? 'bg-white text-emerald-900 shadow-lg' : 'text-white hover:bg-white/10'}`}
                       >
                         S/.
                       </button>
                    </div>
                </div>
             </div>
          </div>

          <div className="px-5 py-4 md:p-8 grid grid-cols-3 gap-3 md:gap-8 bg-white dark:bg-gray-900">
             <div className="flex flex-col gap-0.5 md:gap-1 md:border-r border-slate-100 dark:border-gray-800 md:pr-8">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">Gasto Total</span>
                <span className="text-xl md:text-3xl font-black dark:text-white tracking-tighter">{moneda}{balance.total?.toFixed(2)}</span>
             </div>
             <div className="flex flex-col gap-0.5 md:gap-1 md:border-r border-slate-100 dark:border-gray-800 md:pr-8">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">Participantes</span>
                <div className="flex items-center gap-1 mt-0.5">
                   <div className="flex -space-x-1.5">
                      {participants.slice(0, 3).map(p => {
                        const lastSeen = p.id_usuario ? onlineUsers[p.id_usuario] : null;
                        const online = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 60000;
                        return (
                          <div key={p.id} className="relative">
                            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-slate-100 dark:bg-gray-800 border-2 border-white dark:border-gray-900 flex items-center justify-center text-[9px] font-black text-slate-500">
                               {p.nombre[0].toUpperCase()}
                            </div>
                            {online && <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-white dark:border-gray-900" />}
                          </div>
                        );
                      })}
                   </div>
                   <span className="text-xs font-black dark:text-white ml-1">{participants.length}</span>
                </div>
             </div>
             <div className="flex flex-col gap-0.5 md:gap-1">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">Estado</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                   <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">Activo</span>
                </div>
             </div>
          </div>
      </Card>

      {/* Flat grid — each card has its own order for mobile and lg:col-start for desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 lg:items-start">

        {/* 1. Colaboradores — mobile 1st, desktop right col 3rd */}
        <Card className="order-1 lg:col-start-9 lg:col-span-4 lg:row-start-3 border-none shadow-sm dark:bg-gray-900/50 p-4 md:p-6 rounded-[2rem]" hover={false}>
           <h3 className="text-xs font-black dark:text-white mb-3 tracking-tight flex items-center gap-2 uppercase">
              <Users className="text-indigo-500" size={14} /> Colaboradores
           </h3>
           <div className="flex flex-wrap gap-2">
              {participants.map(p => {
                const lastSeen = p.id_usuario ? onlineUsers[p.id_usuario] : null;
                const online = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 60000;
                return (
                <div key={p.id} className="group flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-gray-800/50 rounded-xl border border-slate-100 dark:border-gray-700">
                   <div className="relative shrink-0">
                      <div className="w-5 h-5 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-[9px]">
                         {p.nombre[0].toUpperCase()}
                      </div>
                      {online && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white dark:border-gray-800 animate-pulse" title="Online" />
                      )}
                   </div>
                   <span className="text-xs font-black dark:text-white">{p.nombre}</span>
                   <button
                     onClick={() => setConfirmState({
                       open: true,
                       title: '¿Quitar Participante?',
                       message: '¿Estás seguro de que deseas quitar a este colaborador? No se borrarán sus gastos pasados pero ya no aparecerá en el cálculo actual.',
                       onConfirm: () => removeParticipant(p.id)
                     })}
                     className="p-0.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                   >
                      <X size={10} />
                   </button>
                </div>
                );
              })}
              <button
                onClick={() => setModals({...modals, invite: true})}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-dashed border-slate-300 dark:border-gray-700 rounded-xl text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-all font-black text-[10px] tracking-widest"
              >
                 <Plus size={11} /> Añadir
              </button>
           </div>
        </Card>

        {/* 2. Registrar Gasto — mobile 2nd, desktop right col 1st */}
        <Card className="order-2 lg:col-start-9 lg:col-span-4 lg:row-start-1 border-none shadow-xl shadow-emerald-500/10 bg-emerald-500 text-white p-5 md:p-8 rounded-[2rem]" hover={false}>
           <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-5 md:mb-8 flex items-center gap-2">
              <Plus className="text-emerald-200" /> Registrar Gasto
           </h3>
           <form onSubmit={handleAddExpense} className="space-y-4 md:space-y-6">
              <div>
                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100/70 mb-3 block">¿Quién pagó hoy?</label>
                 <div className="flex flex-wrap gap-2">
                    {participants.map(p => (
                       <button
                         key={p.id}
                         type="button"
                         onClick={() => setPayerId(p.id)}
                         className={`px-3 py-2 rounded-xl text-[11px] font-black transition-all ${payerId === p.id ? 'bg-white text-emerald-600 shadow-xl scale-105' : 'bg-emerald-600/50 text-emerald-50 hover:bg-emerald-600'}`}
                       >
                          {p.nombre}
                       </button>
                    ))}
                 </div>
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100/70 mb-2 block">¿En qué se gastó?</label>
                 <Input
                   placeholder="Ej: Combustible, Drinks..."
                   value={description}
                   onChange={e => setDescription(e.target.value)}
                   required
                   className="bg-emerald-600/20 border-none text-white placeholder:text-emerald-300/60 h-12 rounded-2xl font-bold text-sm shadow-inner"
                 />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100/70 mb-2 block">Monto Total</label>
                 <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pr-4 border-r border-emerald-600/30 text-emerald-100 font-black z-10">
                       {moneda}
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      required
                      className="bg-emerald-600/20 border-none text-white pl-14 h-12 rounded-2xl font-black text-xl shadow-inner"
                    />
                 </div>
              </div>
              <Button
                type="submit"
                disabled={addingExpense}
                className="w-full py-4 h-auto rounded-2xl bg-slate-900 text-white hover:bg-black border-none font-black shadow-2xl shadow-emerald-950/40 uppercase tracking-[0.2em] text-[11px] transition-all active:scale-95"
              >
                 {addingExpense ? 'Guardando...' : 'Confirmar Gasto'}
              </Button>
           </form>
        </Card>

        {/* 3. Historial de Gastos — mobile 3rd, desktop left col */}
        <Card className="order-3 lg:col-start-1 lg:col-span-8 lg:row-start-1 lg:row-span-3 border-none shadow-sm dark:bg-gray-900/50 p-5 md:p-8" hover={false}>
           <div className="flex items-center justify-between mb-5 md:mb-8">
              <h3 className="text-base font-black dark:text-white tracking-tight flex items-center gap-2 uppercase">
                 <Receipt className="text-emerald-500" /> Historial de Gastos
              </h3>
              <button className="text-xs font-black text-emerald-500 hover:scale-105 transition-transform uppercase tracking-widest">Filtrar</button>
           </div>
           {expenses.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-12 grayscale opacity-40">
                <AlertCircle size={36} className="mb-4 text-slate-300" />
                <p className="text-xs font-black uppercase tracking-widest">No hay gastos todavía</p>
             </div>
           ) : (
             <div className="space-y-3">
                {expenses.map(exp => (
                  <div key={exp.id} className="group p-4 bg-slate-50 dark:bg-gray-800/20 rounded-2xl border border-slate-100 dark:border-gray-800 hover:border-emerald-500/30 transition-all flex items-center justify-between">
                     <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 shrink-0 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-500 shadow-sm transition-colors border border-slate-50 dark:border-gray-700">
                           <Wallet size={20} />
                        </div>
                        <div className="min-w-0">
                           <h4 className="font-black dark:text-white text-sm tracking-tight leading-none truncate">{exp.descripcion}</h4>
                           <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mt-1">
                              <span className="text-emerald-500">{exp.expand?.pagado_por?.nombre}</span>
                           </p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 text-right shrink-0">
                        <span className="text-lg font-black dark:text-white tracking-tighter">{moneda}{exp.monto.toFixed(2)}</span>
                        <button
                          onClick={() => setConfirmState({
                            open: true,
                            title: '¿Borrar Gasto?',
                            message: '¿Estás seguro de que deseas eliminar este gasto de la lista?',
                            onConfirm: () => deleteExpense(exp.id)
                          })}
                          className="p-2.5 opacity-0 group-hover:opacity-100 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                        >
                           <Trash2 size={16} />
                        </button>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </Card>

        {/* 4. Ajuste de Cuentas — mobile 4th, desktop right col 2nd */}
        <Card className="order-4 lg:col-start-9 lg:col-span-4 lg:row-start-2 border-none shadow-sm dark:bg-gray-900/50 p-5 md:p-8 rounded-[2rem]" hover={false}>
           <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-5 md:mb-8 flex items-center gap-2">
              <ArrowRightLeft size={16} /> Ajuste de Cuentas
           </h3>
           {balance.transferencias.length === 0 ? (
             <div className="py-8 text-center flex flex-col items-center">
                <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-4 animate-bounce duration-[3000ms]">
                   <CheckCircle2 size={28} />
                </div>
                <p className="text-xs font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">Todo está al día</p>
             </div>
           ) : (
             <div className="space-y-4">
                {balance.transferencias.map((t, i) => (
                  <div key={i} className="group p-4 bg-slate-50 dark:bg-gray-800/20 rounded-2xl border border-slate-50 dark:border-gray-800 hover:border-emerald-500/30 transition-all">
                     <div className="flex items-center justify-between mb-2 text-emerald-500">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">{t.de}</span>
                        <ArrowLeft size={14} className="rotate-180" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{t.para}</span>
                     </div>
                     <span className="text-2xl font-black dark:text-white tracking-tighter">{moneda}{t.monto.toFixed(2)}</span>
                  </div>
                ))}
                <div className="pt-4 border-t border-slate-100 dark:border-gray-800 mt-4">
                   <Button variant="secondary" className="w-full py-4 h-auto rounded-2xl flex items-center justify-center gap-3 bg-slate-100 dark:bg-gray-800 border-none group" onClick={copyBalance}>
                      {copied ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Share2 size={18} className="group-hover:text-emerald-500 transition-colors" />}
                      <span className="font-black uppercase tracking-widest text-[11px]">{copied ? 'Enlace Copiado' : 'Compartir Balance'}</span>
                   </Button>
                </div>
             </div>
           )}
        </Card>

      </div>

      {/* Invite Modal */}
      {modals.invite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="max-w-md w-full animate-in zoom-in-95 duration-200 p-10 border-none shadow-2xl rounded-[3rem]" hover={false}>
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black flex items-center gap-2 dark:text-white tracking-tight leading-none">
                  <UserPlus className="text-emerald-500" size={32} /> <span className="uppercase">Invitar</span>
                </h2>
                <button onClick={() => setModals({ ...modals, invite: false })} className="text-slate-400 hover:text-white transition-colors">
                   <X size={28} />
                </button>
             </div>
             <p className="text-sm text-slate-500 dark:text-gray-400 mb-10 leading-relaxed font-bold">
                Añade el correo de tu colaborador. Si no tiene cuenta, se le invitará a crear una para unirse al viaje.
             </p>
             <form onSubmit={handleInviteByEmail} className="space-y-8">
                <Input 
                  label="Email del Invitado" 
                  type="email"
                  placeholder="ejemplo@email.com" 
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  autoFocus
                  required
                  className="bg-slate-50 dark:bg-gray-800 border-slate-100 dark:border-gray-700 h-14 px-6 rounded-2xl font-bold"
                />
                <div className="flex flex-col gap-3 pt-4">
                   <Button className="py-5 h-auto rounded-2xl font-black shadow-xl shadow-emerald-500/20 uppercase tracking-widest text-xs" type="submit" disabled={inviting}>
                      {inviting ? 'Enviando...' : 'Enviar Invitación'}
                   </Button>
                   <Button variant="ghost" className="py-5 h-auto rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400" onClick={() => setModals({ ...modals, invite: false })} type="button">
                      Cerrar
                   </Button>
                </div>
             </form>
          </Card>
        </div>
      )}
      {/* Confirmation Dialog */}
      <ConfirmDialog 
        isOpen={confirmState.open}
        onClose={() => setConfirmState({ ...confirmState, open: false })}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
      />
      <StatusModal
        isOpen={status.isOpen}
        onClose={() => setStatus({...status, isOpen: false})}
        type={status.type}
        title={status.title}
        message={status.message}
      />
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />
    </div>
  );
}
