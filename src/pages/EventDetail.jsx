import React, { useState, useEffect, useRef } from 'react';
import { getEventColorCss } from '../utils/eventColor';
import { useParams, useNavigate } from 'react-router-dom';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { Card, Button, Input, ConfirmDialog, StatusModal, Toast } from '../components/UI';
import { calculateBalance } from '../utils/balanceEngine';
import { generateReceipt } from '../utils/generateReceipt';
import EventChat from '../components/EventChat';
import PaymentInfoPopup from '../components/PaymentInfoPopup';
import {
  ArrowLeft, Plus, UserPlus, Share2, Trash2,
  Wallet, Receipt, ArrowRightLeft, CheckCircle2,
  X, AlertCircle, Calendar,
  Check, CreditCard, Undo2, Upload, RefreshCw, Megaphone, FileDown,
  Eye, Copy, Link2, Download, ChevronDown,
  Utensils, Car, BedDouble, Music2, ShoppingBag, HeartPulse, Package
} from 'lucide-react';

const CATEGORIES = [
  { value: '',               label: 'Sin categoría',   icon: null },
  { value: 'Comida',         label: 'Comida',           icon: Utensils },
  { value: 'Transporte',     label: 'Transporte',       icon: Car },
  { value: 'Alojamiento',    label: 'Alojamiento',      icon: BedDouble },
  { value: 'Entretenimiento',label: 'Entretenimiento',  icon: Music2 },
  { value: 'Compras',        label: 'Compras',          icon: ShoppingBag },
  { value: 'Salud',          label: 'Salud',            icon: HeartPulse },
  { value: 'Otro',           label: 'Otro',             icon: Package },
];

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { sendMessage } = useNotifications();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingExpense, setAddingExpense] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Payment status
  const [paymentStatuses, setPaymentStatuses] = useState([]);
  // Contacts agenda
  const [contacts, setContacts] = useState([]);       // [{ email, nombre }]
  const [selectedContacts, setSelectedContacts] = useState([]); // emails picked from agenda
  // Users to message (all members except current user)
  const [messageTargets, setMessageTargets] = useState([]); // [{id, nombre}]
  const [sendingQuickMsg, setSendingQuickMsg] = useState(false);

  // Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [categoria, setCategoria] = useState('');
  const [payerOpen, setPayerOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Members data (with rol) for observer cross-reference
  const [membersData, setMembersData] = useState([]);

  const [modals, setModals] = useState({ invite: false, settings: false });

  // Load past contacts whenever invite modal opens
  useEffect(() => {
    if (!modals.invite || !user) return;
    setSelectedContacts([]);
    (async () => {
      try {
        // All members the current user has ever created across all their events
        const rows = await pb.collection('members').getFullList({
          filter: `id_evento.creado_por = "${user.id}"`,
          fields: 'email,expand',
          expand: 'id_usuario',
        });
        // Also members of events they participate in (shared events)
        const sharedRows = await pb.collection('members').getFullList({
          filter: `id_evento.members.id_usuario ?= "${user.id}"`,
          fields: 'email,expand',
          expand: 'id_usuario',
        }).catch(() => []);

        const allRows = [...rows, ...sharedRows];
        const currentEmails = new Set(participants.map(p => p.email).filter(Boolean));
        currentEmails.add(user.email); // exclude self

        const seen = new Set();
        const list = [];
        allRows.forEach(r => {
          const email = r.email?.toLowerCase();
          if (!email || seen.has(email) || currentEmails.has(email)) return;
          seen.add(email);
          const nombre = r.expand?.id_usuario?.name
            || r.expand?.id_usuario?.email?.split('@')[0]
            || email.split('@')[0];
          list.push({ email, nombre });
        });
        list.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setContacts(list);
      } catch (_) {}
    })();
  }, [modals.invite]);
  const [balance, setBalance] = useState({ transferencias: [], summary: [], text: '', total: 0 });
  const [copied, setCopied] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: () => {} });
  const [status, setStatus] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' });
  const [onlineUsers, setOnlineUsers] = useState({});
  const [paymentPopup, setPaymentPopup] = useState(null); // { userId, name }
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

    pb.collection('presence').subscribe('*', (e) => {
      if (e.record.id_evento !== id) return;
      setOnlineUsers(prev => ({ ...prev, [e.record.id_usuario]: e.record.last_seen }));
    }).catch(() => {});

    return () => {
      clearInterval(heartbeatRef.current);
      pb.collection('presence').unsubscribe('*');
      if (presenceRecordId.current) {
        pb.collection('presence').delete(presenceRecordId.current).catch(() => {});
        presenceRecordId.current = null;
      }
    };
  }, [id, user]);

  useEffect(() => {
    if (participants.length > 0) {
      const active = participants.filter(p => !p.isObserver);
      const perfiles = {};
      active.forEach(p => perfiles[p.id] = p.nombre);
      const result = calculateBalance(expenses, active.map(p => p.id), perfiles);
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
      const eventData = await pb.collection('events').getOne(id, { expand: 'creado_por' });
      if (!eventData.moneda) {
        eventData.moneda = localStorage.getItem(`event_moneda_${id}`) || '$';
      }
      setEvent(eventData);

      const [participantsData, membersForRole] = await Promise.all([
        pb.collection('participants').getFullList({ filter: `id_evento = "${id}"` }),
        pb.collection('members').getFullList({ filter: `id_evento = "${id}"` }).catch(() => []),
      ]);

      // Attach isObserver flag based on members.rol
      const participantsWithRole = participantsData.map(p => ({
        ...p,
        isObserver: membersForRole.some(m =>
          m.rol === 'observador' && (
            (m.id_usuario && m.id_usuario === p.id_usuario) ||
            (m.email && p.email && m.email.toLowerCase() === p.email.toLowerCase())
          )
        ),
      }));

      setParticipants(participantsWithRole);
      setMembersData(membersForRole);
      if (participantsWithRole.length > 0 && !payerId) setPayerId(participantsWithRole[0].id);

      const expensesData = await pb.collection('expenses').getFullList({
        filter: `id_evento = "${id}"`,
        expand: 'pagado_por',
      });
      setExpenses(expensesData);

      // Load payment statuses
      const psData = await pb.collection('payment_status').getFullList({
        filter: `id_evento = "${id}"`,
      }).catch(() => []);
      setPaymentStatuses(psData);

      // Build message targets: all members of this event except current user
      const membersData = await pb.collection('members').getFullList({
        filter: `id_evento = "${id}"`,
        expand: 'id_usuario',
      }).catch(() => []);

      const targets = [];
      const seen = new Set([user.id]);

      // Event creator (if not current user)
      if (eventData.creado_por && eventData.creado_por !== user.id) {
        const creatorName = eventData.expand?.creado_por?.name
          || eventData.expand?.creado_por?.email?.split('@')[0]
          || 'Organizador';
        targets.push({ id: eventData.creado_por, nombre: creatorName });
        seen.add(eventData.creado_por);
      }

      // Members with linked accounts
      membersData.forEach(m => {
        const uid = m.id_usuario;
        if (uid && !seen.has(uid)) {
          const memberName = m.expand?.id_usuario?.name
            || m.expand?.id_usuario?.email?.split('@')[0]
            || m.email?.split('@')[0]
            || 'Colaborador';
          targets.push({ id: uid, nombre: memberName });
          seen.add(uid);
        }
      });

      setMessageTargets(targets);
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
        ...(categoria ? { categoria } : {}),
      };
      await pb.collection('expenses').create(data, { expand: 'pagado_por' });
      setToast({ isOpen: true, message: `"${description}" — ${moneda}${parseFloat(amount).toFixed(2)}`, type: 'success' });
      setAmount('');
      setDescription('');
      setCategoria('');
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

  // Invite a single email (from form input or contact chip)
  const inviteOneEmail = async (email) => {
    const existing = await pb.collection('members').getFirstListItem(
      `id_evento = "${id}" && email = "${email}"`
    ).catch(() => null);
    if (existing) return; // already a member — skip silently in bulk mode

    await pb.collection('members').create({ id_evento: id, email, rol: 'editor' });

    const alreadyParticipant = await pb.collection('participants').getFirstListItem(
      `id_evento = "${id}" && email = "${email}"`
    ).catch(() => null);

    if (!alreadyParticipant) {
      await pb.collection('participants').create({
        id_evento: id,
        nombre: email.split('@')[0],
        email,
        creado_por: user.id,
      });
    }
  };

  const handleInviteByEmail = async (e) => {
    e.preventDefault();
    setInviting(true);

    // Collect: typed email + any selected contacts
    const emails = new Set();
    if (inviteEmail.trim()) emails.add(inviteEmail.toLowerCase().trim());
    selectedContacts.forEach(em => emails.add(em));

    if (emails.size === 0) { setInviting(false); return; }

    try {
      await Promise.all([...emails].map(inviteOneEmail));
      const names = [...emails].map(em => {
        const c = contacts.find(c => c.email === em);
        return c?.nombre || em;
      }).join(', ');
      setStatus({
        isOpen: true,
        type: 'success',
        title: emails.size === 1 ? 'Invitación Enviada' : `${emails.size} invitaciones enviadas`,
        message: `${names} ${emails.size === 1 ? 'ha sido invitado' : 'han sido invitados'} al evento.`
      });
      setInviteEmail('');
      setSelectedContacts([]);
      setModals({ ...modals, invite: false });
      fetchData();
    } catch (err) {
      setStatus({ isOpen: true, type: 'error', title: 'Error al Invitar', message: err.message });
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

  // ── Payment Status ──────────────────────────────────────────────────────────
  const myParticipant = participants.find(p => p.id_usuario === user?.id);

  const getPaymentStatus = (deId, paraId) =>
    paymentStatuses.find(ps => ps.id_pagador === deId && ps.id_receptor === paraId);

  const confirmPayment = async (transfer) => {
    const existing = getPaymentStatus(transfer.deId, transfer.paraId);
    if (existing) return;
    try {
      const ps = await pb.collection('payment_status').create({
        id_evento: id,
        id_pagador: transfer.deId,
        id_receptor: transfer.paraId,
        monto: transfer.monto,
        creado_por: user.id,
      });
      setPaymentStatuses(prev => [...prev, ps]);

      // Notify the receptor (if they have a user account)
      const receptorParticipant = participants.find(p => p.id === transfer.paraId);
      if (receptorParticipant?.id_usuario) {
        const moneda = event?.moneda || '$';
        await sendMessage(
          receptorParticipant.id_usuario,
          'pago_confirmado',
          `confirmó que te transfirió ${moneda}${transfer.monto.toFixed(2)}`,
          id
        );
      }

      setToast({ isOpen: true, message: `Pago confirmado — ${moneda}${transfer.monto.toFixed(2)}`, type: 'success' });
    } catch (err) {
      setStatus({ isOpen: true, type: 'error', title: 'Error', message: err.message });
    }
  };

  const cancelPayment = async (transfer) => {
    const existing = getPaymentStatus(transfer.deId, transfer.paraId);
    if (!existing) return;
    try {
      await pb.collection('payment_status').delete(existing.id);
      setPaymentStatuses(prev => prev.filter(ps => ps.id !== existing.id));
      setToast({ isOpen: true, message: 'Confirmación cancelada', type: 'info' });
    } catch (err) {
      setStatus({ isOpen: true, type: 'error', title: 'Error', message: err.message });
    }
  };

  // ── Quick Messages ──────────────────────────────────────────────────────────
  const sendQuickMessage = async (tipo, contenido) => {
    if (messageTargets.length === 0) {
      setToast({ isOpen: true, message: 'No hay colaboradores para notificar', type: 'info' });
      return;
    }
    setSendingQuickMsg(true);
    try {
      await Promise.all(messageTargets.map(t => sendMessage(t.id, tipo, contenido, id)));
      setToast({ isOpen: true, message: `Notificación enviada a ${messageTargets.length} colaborador${messageTargets.length > 1 ? 'es' : ''}`, type: 'success' });
    } catch (_) {
      setToast({ isOpen: true, message: 'Error al enviar notificación', type: 'error' });
    } finally {
      setSendingQuickMsg(false);
    }
  };

  // ── Observer toggle ────────────────────────────────────────────────────────
  const toggleObserver = async (participant) => {
    const newRol = participant.isObserver ? 'editor' : 'observador';
    // Find existing members record
    const existing = membersData.find(m =>
      (m.id_usuario && m.id_usuario === participant.id_usuario) ||
      (m.email && participant.email && m.email.toLowerCase() === participant.email.toLowerCase())
    );
    try {
      if (existing) {
        await pb.collection('members').update(existing.id, { rol: newRol });
        setMembersData(prev => prev.map(m => m.id === existing.id ? { ...m, rol: newRol } : m));
      } else {
        const created = await pb.collection('members').create({
          id_evento: id,
          email: participant.email || '',
          id_usuario: participant.id_usuario || '',
          rol: newRol,
        });
        setMembersData(prev => [...prev, created]);
      }
      setParticipants(prev => prev.map(p =>
        p.id === participant.id ? { ...p, isObserver: newRol === 'observador' } : p
      ));
    } catch (err) {
      setToast({ isOpen: true, message: 'Error al cambiar rol: ' + err.message, type: 'error' });
    }
  };

  // ── CSV Export ──────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const cur = event?.moneda || '$';
    const rows = [];

    rows.push(['EVENTO', event?.nombre_evento || '']);
    rows.push(['MONEDA', cur]);
    rows.push(['TOTAL', balance.total?.toFixed(2) || '0.00']);
    rows.push([]);
    rows.push(['GASTOS']);
    rows.push(['Descripción', 'Categoría', 'Pagado por', 'Monto']);
    expenses.forEach(exp => {
      const payerName = exp.expand?.pagado_por?.nombre
        || participants.find(p => p.id === exp.pagado_por)?.nombre
        || exp.pagado_por;
      rows.push([
        exp.descripcion,
        exp.categoria || '',
        payerName,
        exp.monto.toFixed(2),
      ]);
    });

    rows.push([]);
    rows.push(['BALANCE']);
    rows.push(['Participante', 'Rol', 'Pagado', 'Balance']);
    balance.summary.forEach(s => {
      const p = participants.find(pp => pp.nombre === s.nombre);
      rows.push([s.nombre, p?.isObserver ? 'Observador' : 'Participante', s.pagado.toFixed(2), s.balance.toFixed(2)]);
    });

    rows.push([]);
    rows.push(['TRANSFERENCIAS']);
    rows.push(['De', 'Para', 'Monto']);
    balance.transferencias.forEach(t => {
      rows.push([t.de, t.para, t.monto.toFixed(2)]);
    });

    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event?.nombre_evento || 'evento'}_splitpay.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Copy join link ──────────────────────────────────────────────────────────
  const copyJoinLink = () => {
    const url = `${window.location.origin}/join/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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

      {/* Event Header Card — sticky */}
      <Card className="mb-6 p-0 overflow-hidden border-none shadow-2xl shadow-emerald-500/10 rounded-[2rem] md:rounded-[2.5rem] lg:sticky lg:top-0 lg:z-30" hover={false}>
          <div style={{ background: getEventColorCss(id) }} className="p-5 md:p-12 text-white relative group rounded-b-[1.5rem] md:rounded-b-[2rem]">
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
                           <Calendar size={10} />
                           {event?.creado_por === user.id ? (
                             <input
                               type="date"
                               value={event?.fecha_evento ? event.fecha_evento.split(' ')[0] : event?.fecha_creacion ? event.fecha_creacion.split(' ')[0] : ''}
                               onChange={async (e) => {
                                 const val = e.target.value;
                                 const iso = val ? val + ' 12:00:00.000Z' : '';
                                 setEvent(prev => ({ ...prev, fecha_evento: iso }));
                                 try { await pb.collection('events').update(id, { fecha_evento: iso }); } catch (_) {}
                               }}
                               className="bg-transparent border-b border-emerald-300/40 text-emerald-100/70 text-[9px] font-black uppercase tracking-[0.25em] focus:outline-none focus:border-emerald-300 cursor-pointer"
                             />
                           ) : (
                             event?.fecha_evento
                               ? new Date(event.fecha_evento.slice(0,10) + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
                               : event?.fecha_creacion
                               ? new Date(event.fecha_creacion.slice(0,10) + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
                               : 'Sin fecha'
                           )}
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

          {/* Stats row */}
          <div className="px-5 py-3 md:px-8 md:py-4 grid grid-cols-3 gap-3 md:gap-8 bg-white dark:bg-gray-900 border-b border-slate-50 dark:border-gray-800">
             <div className="flex flex-col gap-0.5 md:gap-1">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-gray-500">Gasto Total</span>
                <span className="text-xl md:text-2xl font-black dark:text-white tracking-tighter">{moneda}{balance.total?.toFixed(2)}</span>
             </div>
             <div className="flex flex-col gap-0.5 md:gap-1">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-gray-500">Equipo</span>
                <span className="text-xl md:text-2xl font-black dark:text-white tracking-tighter">{participants.length} <span className="text-sm font-bold text-slate-400 dark:text-gray-600">{participants.length === 1 ? 'persona' : 'personas'}</span></span>
             </div>
             <div className="flex flex-col gap-0.5 md:gap-1">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-gray-500">Estado</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                   <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">Activo</span>
                </div>
             </div>
          </div>

          {/* Team chips row */}
          <div className="px-5 py-3 md:px-8 md:py-3 flex items-center gap-1.5 bg-white dark:bg-gray-900 overflow-x-auto scrollbar-none">
            {participants.map(p => {
              const lastSeen = p.id_usuario ? onlineUsers[p.id_usuario] : null;
              const online = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 60000;
              const isOwner = event?.creado_por === user.id;
              return (
                <div key={p.id} className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all ${p.isObserver ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30' : 'bg-slate-50 dark:bg-gray-800/50 border-slate-100 dark:border-gray-700'}`}>
                  <button className="relative shrink-0" title={p.id_usuario ? 'Ver datos de pago' : undefined}
                    onClick={() => p.id_usuario && setPaymentPopup({ userId: p.id_usuario, name: p.nombre })}>
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center font-black text-[9px] transition-colors ${p.isObserver ? 'bg-amber-500/10 text-amber-600' : `bg-indigo-500/10 text-indigo-500 ${p.id_usuario ? 'hover:bg-indigo-500 hover:text-white' : ''}`}`}>
                      {p.nombre[0].toUpperCase()}
                    </div>
                    {online && <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white dark:border-gray-800 animate-pulse" />}
                  </button>
                  <span className="text-xs font-black dark:text-white">{p.nombre}</span>
                  {p.isObserver && <span className="text-[8px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-400 flex items-center gap-0.5"><Eye size={8} /> obs</span>}
                  {isOwner && (
                    <button onClick={() => toggleObserver(p)}
                      className={`p-0.5 opacity-0 group-hover:opacity-100 transition-all rounded ${p.isObserver ? 'text-amber-500 hover:text-indigo-500' : 'text-slate-300 hover:text-amber-500'}`}
                      title={p.isObserver ? 'Convertir a participante' : 'Marcar como observador'}>
                      <Eye size={10} />
                    </button>
                  )}
                  <button onClick={() => setConfirmState({ open: true, title: '¿Quitar Participante?', message: 'No se borrarán sus gastos pasados pero ya no aparecerá en el cálculo actual.', onConfirm: () => removeParticipant(p.id) })}
                    className="p-0.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                    <X size={10} />
                  </button>
                </div>
              );
            })}
            <button onClick={() => setModals({...modals, invite: true})}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-dashed border-slate-300 dark:border-gray-700 rounded-xl text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-all font-black text-[10px] tracking-widest">
              <Plus size={11} /> Añadir
            </button>
          </div>
      </Card>

      {/* Flat grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 lg:items-start">

        {/* 2. Registrar Gasto */}
        <div className="order-2 lg:col-start-9 lg:col-span-4 lg:row-start-1 bg-slate-900 dark:bg-gray-900 text-white p-5 rounded-[2rem] shadow-xl shadow-black/20 relative">
           <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 text-white">
              <Plus className="text-emerald-400" /> Registrar Gasto
           </h3>
           <form onSubmit={handleAddExpense} className="space-y-3">

              {/* ── Payer dropdown ── */}
              <div>
                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">¿Quién pagó?</label>
                 <div className="relative">
                    {payerOpen && <div className="fixed inset-0 z-10" onClick={() => setPayerOpen(false)} />}
                    <button
                      type="button"
                      onClick={() => setPayerOpen(o => !o)}
                      className="relative z-20 w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-4 h-11 text-sm font-black text-white transition-all"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-black shrink-0">
                          {participants.find(p => p.id === payerId)?.nombre?.[0]?.toUpperCase() || '?'}
                        </span>
                        {participants.find(p => p.id === payerId)?.nombre || 'Seleccionar'}
                      </span>
                      <ChevronDown size={14} className={`transition-transform duration-200 shrink-0 text-slate-400 ${payerOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {payerOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-800/70 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-20">
                        {participants.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setPayerId(p.id); setPayerOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-black transition-all text-left ${payerId === p.id ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-200 hover:bg-white/10'}`}
                          >
                            <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-black shrink-0">
                              {p.nombre[0].toUpperCase()}
                            </span>
                            {p.nombre}
                            {payerId === p.id && <Check size={12} className="ml-auto text-emerald-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                 </div>
              </div>

              {/* ── Description ── */}
              <div>
                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">¿En qué se gastó?</label>
                 <Input
                   placeholder="Ej: Combustible, Drinks..."
                   value={description}
                   onChange={e => setDescription(e.target.value)}
                   required
                   className="bg-white/5 border border-white/10 text-white placeholder:text-slate-600 h-11 rounded-2xl font-bold text-sm focus:border-emerald-500/50"
                 />
              </div>

              {/* ── Category + Amount side by side ── */}
              <div className="grid grid-cols-2 gap-2.5">
                 {/* Category dropdown */}
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Categoría</label>
                    <div className="relative">
                       {catOpen && <div className="fixed inset-0 z-10" onClick={() => setCatOpen(false)} />}
                       <button
                         type="button"
                         onClick={() => setCatOpen(o => !o)}
                         className="relative z-20 w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-3 h-11 text-[11px] font-black text-white transition-all"
                       >
                         <span className="flex items-center gap-1.5 truncate">
                           {(() => { const c = CATEGORIES.find(c => c.value === categoria); const Icon = c?.icon; return Icon ? <Icon size={12} className="shrink-0 text-emerald-400" /> : null; })()}
                           {categoria || <span className="text-slate-500 font-bold">Opcional</span>}
                         </span>
                         <ChevronDown size={12} className={`ml-1 shrink-0 text-slate-400 transition-transform duration-200 ${catOpen ? 'rotate-180' : ''}`} />
                       </button>
                       {catOpen && (
                         <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-800/70 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-20">
                           {CATEGORIES.map(({ value, label, icon: Icon }) => (
                             <button
                               key={value || '__none__'}
                               type="button"
                               onClick={() => { setCategoria(value); setCatOpen(false); }}
                               className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[11px] font-black transition-all ${categoria === value ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-200 hover:bg-white/10'}`}
                             >
                               {Icon ? <Icon size={13} className="shrink-0 opacity-60" /> : <span className="w-[13px]" />}
                               {label}
                               {categoria === value && <Check size={11} className="ml-auto text-emerald-400" />}
                             </button>
                           ))}
                         </div>
                       )}
                    </div>
                 </div>
                 {/* Amount */}
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5 block">Monto</label>
                    <div className="relative">
                       <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pr-3 border-r border-white/10 text-slate-400 font-black z-10 text-sm leading-none">
                          {moneda}
                       </div>
                       <Input
                         type="number"
                         step="0.01"
                         placeholder="0.00"
                         value={amount}
                         onChange={e => setAmount(e.target.value)}
                         required
                         className="bg-white/5 border border-white/10 text-white pl-12 h-11 rounded-2xl font-black text-base"
                       />
                    </div>
                 </div>
              </div>

              <Button
                type="submit"
                disabled={addingExpense}
                className="w-full py-3.5 h-auto rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white border-none font-black shadow-lg shadow-emerald-500/20 uppercase tracking-[0.2em] text-[11px] transition-all active:scale-95"
              >
                 {addingExpense ? 'Guardando...' : 'Confirmar Gasto'}
              </Button>
           </form>
        </div>

        {/* 3. Historial de Gastos */}
        <Card className="order-3 lg:col-start-1 lg:col-span-8 lg:row-start-1 lg:row-span-3 border-none shadow-sm dark:bg-gray-900/50 p-5 md:p-8" hover={false}>
           <div className="flex items-center justify-between mb-5 md:mb-8">
              <h3 className="text-base font-black dark:text-white tracking-tight flex items-center gap-2 uppercase">
                 <Receipt className="text-emerald-500" /> Historial de Gastos
              </h3>
              {expenses.length > 0 && (
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-emerald-500 uppercase tracking-widest transition-colors"
                  title="Exportar CSV"
                >
                  <Download size={13} /> CSV
                </button>
              )}
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
                           <div className="flex items-center gap-2 mt-1 flex-wrap">
                             <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{exp.expand?.pagado_por?.nombre}</span>
                             {exp.categoria && (
                               <span className="text-[9px] font-black px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-500">
                                 {exp.categoria}
                               </span>
                             )}
                           </div>
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

        {/* 4. Ajuste de Cuentas */}
        <Card className="order-4 lg:col-start-9 lg:col-span-4 lg:row-start-2 border-none shadow-sm dark:bg-gray-900/50 p-5 md:p-8 rounded-[2rem]" hover={false}>
           <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-600 dark:text-gray-500 mb-5 md:mb-8 flex items-center gap-2">
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
                {balance.transferencias.map((t, i) => {
                  const ps = getPaymentStatus(t.deId, t.paraId);
                  const isPaid = !!ps;
                  const isMyTransfer = myParticipant && t.deId === myParticipant.id;
                  const isMyReceivable = myParticipant && t.paraId === myParticipant.id;

                  return (
                  <div
                    key={i}
                    className={`p-4 rounded-2xl border transition-all ${
                      isPaid
                        ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-slate-50 dark:bg-gray-800/20 border-slate-50 dark:border-gray-800 hover:border-emerald-500/30'
                    }`}
                  >
                    {/* Transfer header */}
                    <div className="flex items-center justify-between mb-2">
                       <span className={`text-[10px] font-black uppercase tracking-widest ${isMyTransfer ? 'text-rose-500' : 'text-slate-600 dark:text-gray-500'}`}>
                         {t.de}
                       </span>
                       <ArrowLeft size={14} className="rotate-180 text-emerald-500" />
                       <span className={`text-[10px] font-black uppercase tracking-widest ${isMyReceivable ? 'text-emerald-600 dark:text-emerald-400' : 'text-emerald-500'}`}>
                         {t.para}
                       </span>
                    </div>

                    {/* Amount */}
                    <div className="flex items-end justify-between gap-3">
                      <span className={`text-2xl font-black tracking-tighter ${isPaid ? 'text-emerald-500' : 'dark:text-white'}`}>
                        {moneda}{t.monto.toFixed(2)}
                        {isPaid && <span className="text-sm ml-2">✓</span>}
                      </span>

                      {/* Action button */}
                      {isMyTransfer && (
                        isPaid ? (
                          <button
                            onClick={() => cancelPayment(t)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-rose-500/10 hover:text-rose-500 transition-all text-[10px] font-black uppercase tracking-widest group shrink-0"
                            title="Cancelar confirmación"
                          >
                            <CheckCircle2 size={14} className="group-hover:hidden" />
                            <Undo2 size={14} className="hidden group-hover:block" />
                            <span className="group-hover:hidden">Pagado</span>
                            <span className="hidden group-hover:inline">Deshacer</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => confirmPayment(t)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-emerald-600 hover:dark:bg-emerald-500 transition-all text-[10px] font-black uppercase tracking-widest active:scale-95 shrink-0"
                          >
                            <CreditCard size={14} />
                            Ya pagué
                          </button>
                        )
                      )}

                      {isMyReceivable && !isMyTransfer && (
                        <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0 ${
                          isPaid
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}>
                          {isPaid ? 'Recibido ✓' : 'Pendiente'}
                        </span>
                      )}
                    </div>
                  </div>
                  );
                })}

                {/* Share + PDF buttons */}
                <div className="pt-4 border-t border-slate-100 dark:border-gray-800 mt-4 flex flex-col gap-2">
                   <Button variant="secondary" className="w-full py-4 h-auto rounded-2xl flex items-center justify-center gap-3 bg-slate-100 dark:bg-gray-800 border-none group" onClick={copyBalance}>
                      {copied ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Share2 size={18} className="group-hover:text-emerald-500 transition-colors" />}
                      <span className="font-black uppercase tracking-widest text-[11px]">{copied ? 'Copiado' : 'Compartir Balance'}</span>
                   </Button>
                   <Button
                     variant="secondary"
                     className="w-full py-4 h-auto rounded-2xl flex items-center justify-center gap-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-emerald-700 dark:hover:bg-slate-100 border-none group"
                     onClick={() => generateReceipt({  // async — fire-and-forget
                       event,
                       expenses,
                       participants,
                       balance,
                       moneda,
                       userName: user?.name || user?.email?.split('@')[0] || 'Usuario',
                     })}
                   >
                      <FileDown size={18} className="group-hover:scale-110 transition-transform" />
                      <span className="font-black uppercase tracking-widest text-[11px]">Descargar Recibo PDF</span>
                   </Button>
                </div>
             </div>
           )}
        </Card>

        {/* 5. Notificar al Equipo */}
        {messageTargets.length > 0 && (
          <Card className="order-6 lg:col-start-9 lg:col-span-4 lg:row-start-4 border-none shadow-sm dark:bg-gray-900/50 p-5 md:p-6 rounded-[2rem]" hover={false}>
            <h3 className="text-xs font-black dark:text-white mb-4 tracking-tight flex items-center gap-2 uppercase">
              <Megaphone className="text-amber-500" size={14} /> Notificar al Equipo
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-gray-500 font-bold mb-4 uppercase tracking-widest">
              {messageTargets.map(t => t.nombre).join(', ')}
            </p>
            <div className="flex flex-col gap-2">
              <button
                disabled={sendingQuickMsg}
                onClick={() => sendQuickMessage('gastos_subidos', 'subió sus gastos al evento')}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all text-xs font-black uppercase tracking-widest active:scale-95 disabled:opacity-50 text-left"
              >
                <Upload size={15} className="shrink-0" />
                Ya subí mis gastos
              </button>
              <button
                disabled={sendingQuickMsg}
                onClick={() => sendQuickMessage('gastos_actualizados', 'actualizó los gastos del evento')}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all text-xs font-black uppercase tracking-widest active:scale-95 disabled:opacity-50 text-left"
              >
                <RefreshCw size={15} className="shrink-0" />
                Actualicé los gastos
              </button>
              <button
                disabled={sendingQuickMsg}
                onClick={() => sendQuickMessage('listo', 'dice que todo está listo')}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-black uppercase tracking-widest active:scale-95 disabled:opacity-50 text-left"
              >
                <Check size={15} className="shrink-0" />
                ¡Todo listo!
              </button>
            </div>
            {sendingQuickMsg && (
              <p className="text-[10px] text-slate-400 dark:text-gray-500 font-bold mt-3 text-center uppercase tracking-widest animate-pulse">
                Enviando...
              </p>
            )}
          </Card>
        )}

      </div>

      {/* Floating Chat */}
      <EventChat eventId={id} />

      {/* Invite Modal */}
      {modals.invite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="max-w-md w-full animate-in zoom-in-95 duration-200 p-8 border-none shadow-2xl rounded-[3rem] max-h-[90vh] overflow-y-auto" hover={false}>
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black flex items-center gap-2 dark:text-white tracking-tight leading-none">
                  <UserPlus className="text-emerald-500" size={28} /> <span className="uppercase">Invitar</span>
                </h2>
                <button onClick={() => { setModals({ ...modals, invite: false }); setSelectedContacts([]); }} className="text-slate-400 hover:text-white transition-colors">
                   <X size={24} />
                </button>
             </div>

             {/* Join link */}
             <div className="mb-6 p-4 bg-slate-50 dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700">
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-2 flex items-center gap-1">
                 <Link2 size={10} /> Link de invitación
               </p>
               <div className="flex items-center gap-2">
                 <code className="flex-1 text-[11px] font-mono text-slate-500 dark:text-gray-400 truncate">
                   {`${window.location.origin}/join/${id}`}
                 </code>
                 <button
                   type="button"
                   onClick={copyJoinLink}
                   className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${copiedLink ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-emerald-500 hover:text-white'}`}
                 >
                   {copiedLink ? <Check size={11} /> : <Copy size={11} />}
                   {copiedLink ? 'Copiado' : 'Copiar'}
                 </button>
               </div>
             </div>

             {/* Contacts agenda */}
             {contacts.length > 0 && (
               <div className="mb-6">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-3">
                   Contactos frecuentes
                 </p>
                 <div className="flex flex-wrap gap-2">
                   {contacts.map(c => {
                     const selected = selectedContacts.includes(c.email);
                     return (
                       <button
                         key={c.email}
                         type="button"
                         onClick={() => setSelectedContacts(prev =>
                           selected ? prev.filter(e => e !== c.email) : [...prev, c.email]
                         )}
                         className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black transition-all active:scale-95 border ${
                           selected
                             ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                             : 'bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-300 border-slate-100 dark:border-gray-700 hover:border-emerald-500/50'
                         }`}
                       >
                         <div className={`w-5 h-5 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${selected ? 'bg-white/20' : 'bg-emerald-500/10 text-emerald-500'}`}>
                           {c.nombre[0].toUpperCase()}
                         </div>
                         {c.nombre}
                         {selected && <Check size={11} className="shrink-0" />}
                       </button>
                     );
                   })}
                 </div>
                 {selectedContacts.length > 0 && (
                   <p className="text-[10px] text-emerald-500 font-black mt-2 uppercase tracking-widest">
                     {selectedContacts.length} seleccionado{selectedContacts.length > 1 ? 's' : ''}
                   </p>
                 )}
               </div>
             )}

             {/* Manual email input */}
             <form onSubmit={handleInviteByEmail} className="space-y-5">
                <Input
                  label="O añade un email nuevo"
                  type="email"
                  placeholder="ejemplo@email.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required={selectedContacts.length === 0}
                  className="bg-slate-50 dark:bg-gray-800 border-slate-100 dark:border-gray-700 h-12 px-5 rounded-2xl font-bold"
                />
                <div className="flex flex-col gap-3 pt-2">
                   <Button
                     className="py-4 h-auto rounded-2xl font-black shadow-xl shadow-emerald-500/20 uppercase tracking-widest text-xs"
                     type="submit"
                     disabled={inviting || (selectedContacts.length === 0 && !inviteEmail.trim())}
                   >
                      {inviting ? 'Enviando...' : selectedContacts.length > 0
                        ? `Invitar ${selectedContacts.length + (inviteEmail.trim() ? 1 : 0)} persona${selectedContacts.length + (inviteEmail.trim() ? 1 : 0) > 1 ? 's' : ''}`
                        : 'Enviar Invitación'}
                   </Button>
                   <Button variant="ghost" className="py-4 h-auto rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400" onClick={() => { setModals({ ...modals, invite: false }); setSelectedContacts([]); }} type="button">
                      Cerrar
                   </Button>
                </div>
             </form>
          </Card>
        </div>
      )}

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
      {paymentPopup && (
        <PaymentInfoPopup
          userId={paymentPopup.userId}
          name={paymentPopup.name}
          onClose={() => setPaymentPopup(null)}
        />
      )}
    </div>
  );
}
