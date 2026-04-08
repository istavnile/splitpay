import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Input } from '../components/UI';
import { calculateBalance } from '../utils/balanceEngine';
import { 
  ArrowLeft, Plus, UserPlus, Share2, Trash2, 
  Wallet, Receipt, ArrowRightLeft, CheckCircle2,
  Copy, Mail, ChevronRight, X, AlertCircle, Users, TrendingUp, Settings
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

  useEffect(() => {
    fetchData();
  }, [id]);

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
      setExpenses([record, ...expenses]);
      setDescription('');
      setAmount('');
    } catch (err) {
      alert('Error: ' + err.message);
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
        creado_por: user.id
      });

      alert(`Invitación enviada a ${inviteEmail}`);
      setInviteEmail('');
      setModals({ ...modals, invite: false });
      fetchData();
    } catch (err) {
      alert('Error al invitar: ' + err.message);
    } finally {
      setInviting(false);
    }
  };

  const deleteExpense = async (expId) => {
    if (!confirm('¿Borrar este gasto?')) return;
    try {
      await pb.collection('expenses').delete(expId);
      setExpenses(expenses.filter(e => e.id !== expId));
    } catch (err) {
      alert('Error al borrar: ' + err.message);
    }
  };

  const removeParticipant = async (pId) => {
    if (!confirm('¿Quitar a este participante? No se borrarán sus gastos pasados pero ya no aparecerá en el cálculo.')) return;
    try {
      await pb.collection('participants').delete(pId);
      setParticipants(participants.filter(p => p.id !== pId));
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const toggleCurrency = async (newMoneda) => {
    try {
      const updated = await pb.collection('events').update(id, { moneda: newMoneda });
      setEvent(updated);
    } catch (err) {
      alert('Error al cambiar moneda: ' + err.message);
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
      <Card className="mb-10 p-0 overflow-hidden border-none shadow-2xl shadow-emerald-500/10 rounded-[2.5rem]" hover={false}>
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 md:p-12 text-white relative group">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
             
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 w-full">
                <div className="flex items-center gap-6">
                    <button 
                       onClick={() => navigate('/')} 
                       className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 border border-white/10 shrink-0"
                    >
                       <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">{event?.nombre_evento || 'Cargando...'}</h1>
                        <p className="text-emerald-100/70 text-[10px] font-black uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
                           <Calendar size={12} /> {event?.created ? new Date(event.created.replace(' ','T')).toLocaleDateString() : 'Sincronizando...'}
                           <span className="mx-2 opacity-30">|</span>
                           <span className="text-emerald-300">Evento Activo ({moneda})</span>
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <Button 
                      variant="secondary" 
                      className="bg-white/10 hover:bg-white/20 border-none text-white backdrop-blur-sm px-6 py-3 h-auto rounded-2xl font-black text-xs uppercase tracking-widest shrink-0" 
                      onClick={() => setModals({...modals, invite: true})}
                    >
                        <UserPlus size={18} /> <span className="ml-2">Invitar</span>
                    </Button>
                    <div className="flex bg-white/10 backdrop-blur-md rounded-2xl p-1 border border-white/10 shrink-0">
                       <button 
                         onClick={() => toggleCurrency('$')}
                         className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${moneda === '$' ? 'bg-white text-emerald-600' : 'text-white hover:bg-white/10'}`}
                       >
                         $
                       </button>
                       <button 
                         onClick={() => toggleCurrency('S/.')}
                         className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${moneda === 'S/.' ? 'bg-white text-emerald-600' : 'text-white hover:bg-white/10'}`}
                       >
                         S/.
                       </button>
                    </div>
                </div>
             </div>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 bg-white dark:bg-gray-900">
             <div className="flex flex-col gap-1 border-r border-slate-100 dark:border-gray-800 pr-8">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">Gasto Total</span>
                <span className="text-3xl font-black dark:text-white tracking-tighter">{moneda} {balance.total?.toFixed(2)}</span>
             </div>
             <div className="flex flex-col gap-1 border-r border-slate-100 dark:border-gray-800 pr-8">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">Participantes</span>
                <div className="flex items-center gap-2 mt-1">
                   <div className="flex -space-x-2">
                      {participants.slice(0, 5).map(p => (
                         <div key={p.id} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-800 border-2 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-black text-slate-500">
                            {p.nombre[0].toUpperCase()}
                         </div>
                      ))}
                   </div>
                   <span className="text-sm font-black dark:text-white ml-2">{participants.length} personas</span>
                </div>
             </div>
             <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">Estado</span>
                <div className="flex items-center gap-2 mt-1">
                   <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                   <span className="text-sm font-black text-emerald-500 uppercase tracking-widest">Activo</span>
                </div>
             </div>
          </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Content: Expenses */}
        <div className="lg:col-span-8 space-y-8">
           <Card className="border-none shadow-sm dark:bg-gray-900/50 p-8" hover={false}>
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-lg font-black dark:text-white tracking-tight flex items-center gap-2 uppercase">
                    <Receipt className="text-emerald-500" /> Historial de Gastos
                 </h3>
                 <button className="text-xs font-black text-emerald-500 hover:scale-105 transition-transform uppercase tracking-widest">Filtrar</button>
              </div>

              {expenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 grayscale opacity-40">
                   <AlertCircle size={40} className="mb-4 text-slate-300" />
                   <p className="text-xs font-black uppercase tracking-widest">No hay gastos todavía</p>
                </div>
              ) : (
                <div className="space-y-4">
                   {expenses.map(exp => (
                     <div key={exp.id} className="group p-5 bg-slate-50 dark:bg-gray-800/20 rounded-3xl border border-slate-100 dark:border-gray-800 hover:border-emerald-500/30 transition-all flex items-center justify-between">
                        <div className="flex items-center gap-5">
                           <div className="w-14 h-14 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-emerald-500 shadow-sm transition-colors border border-slate-50 dark:border-gray-700">
                              <Wallet size={24} />
                           </div>
                           <div>
                              <h4 className="font-black dark:text-white text-lg tracking-tight leading-none">{exp.descripcion}</h4>
                              <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mt-2">
                                 Pagado por <span className="text-emerald-500">{exp.expand?.pagado_por?.nombre}</span>
                              </p>
                           </div>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                           <span className="text-2xl font-black dark:text-white tracking-tighter">{moneda}{exp.monto.toFixed(2)}</span>
                           <button onClick={() => deleteExpense(exp.id)} className="p-3 opacity-0 group-hover:opacity-100 bg-rose-500/10 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all">
                              <Trash2 size={18} />
                           </button>
                        </div>
                     </div>
                   ))}
                </div>
              )}
           </Card>

           <Card className="border-none shadow-sm dark:bg-gray-900/50 p-8" hover={false}>
              <h3 className="text-lg font-black dark:text-white mb-8 tracking-tight flex items-center gap-2 uppercase">
                 <Users className="text-indigo-500" /> Colaboradores
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {participants.map(p => (
                   <div key={p.id} className="p-4 bg-slate-50 dark:bg-gray-800/30 rounded-2xl border border-slate-100 dark:border-gray-800 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black">
                            {p.nombre[0].toUpperCase()}
                         </div>
                         <span className="font-black dark:text-white text-sm">{p.nombre}</span>
                      </div>
                      <button 
                        onClick={() => removeParticipant(p.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                         <Trash2 size={16} />
                      </button>
                   </div>
                 ))}
                 <button 
                   onClick={() => setModals({...modals, invite: true})}
                   className="p-4 border-2 border-dashed border-slate-200 dark:border-gray-800 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-all font-black uppercase text-[10px] tracking-widest"
                 >
                    <Plus size={16} /> Añadir Colaborador
                 </button>
              </div>
           </Card>
        </div>

        {/* Sidebar Actions: Add and Balance */}
        <div className="lg:col-span-4 flex flex-col gap-8">
           <Card className="border-none shadow-xl shadow-emerald-500/10 bg-emerald-500 text-white p-8 rounded-[2.5rem]" hover={false}>
              <h3 className="text-lg font-black uppercase tracking-[0.2em] mb-10 flex items-center gap-2">
                 <Plus className="text-emerald-200" /> Registrar Gasto
              </h3>
              <form onSubmit={handleAddExpense} className="space-y-8">
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100/70 mb-4 block">¿Quién pagó hoy?</label>
                    <div className="flex flex-wrap gap-2">
                       {participants.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPayerId(p.id)}
                            className={`px-4 py-2.5 rounded-xl text-[11px] font-black transition-all ${payerId === p.id ? 'bg-white text-emerald-600 shadow-xl scale-110' : 'bg-emerald-600/50 text-emerald-50 hover:bg-emerald-600'}`}
                          >
                             {p.nombre}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100/70 mb-2 block">¿En qué se gastó?</label>
                        <Input 
                          placeholder="Ej: Combustible, Drinks..." 
                          value={description} 
                          onChange={e => setDescription(e.target.value)} 
                          required 
                          className="bg-emerald-600/50 border-none text-white placeholder:text-emerald-300 h-14 rounded-2xl font-black"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100/70 mb-2 block">Monto Total</label>
                        <div className="relative">
                           <div className="absolute left-4 top-1/2 -translate-y-1/2 pr-4 border-r border-emerald-600/50 text-emerald-200 font-black">
                              {moneda}
                           </div>
                           <Input 
                             type="number" 
                             step="0.01" 
                             placeholder="0.00" 
                             value={amount} 
                             onChange={e => setAmount(e.target.value)} 
                             required 
                             className="bg-emerald-600/50 border-none text-white pl-16 h-14 rounded-2xl font-black text-xl"
                           />
                        </div>
                    </div>
                 </div>
                 
                 <Button type="submit" disabled={addingExpense} className="w-full py-5 h-auto rounded-2xl bg-white text-emerald-600 hover:bg-emerald-50 border-none font-black shadow-2xl shadow-emerald-900/40 uppercase tracking-widest text-[11px] transition-all active:scale-95">
                    {addingExpense ? 'Guardando...' : 'Confirmar Gasto'}
                 </Button>
              </form>
           </Card>

           <Card className="border-none shadow-sm dark:bg-gray-900/50 p-8 rounded-[2rem]" hover={false}>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-8 flex items-center gap-2">
                 <ArrowRightLeft size={16} /> Ajuste de Cuentas
              </h3>
              
              {balance.transferencias.length === 0 ? (
                <div className="py-10 text-center flex flex-col items-center">
                   <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-6 animate-bounce duration-[3000ms]">
                      <CheckCircle2 size={32} />
                   </div>
                   <p className="text-sm font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">Todo está al día</p>
                </div>
              ) : (
                <div className="space-y-4">
                   {balance.transferencias.map((t, i) => (
                     <div key={i} className="group p-5 bg-slate-50 dark:bg-gray-800/20 rounded-3xl border border-slate-50 dark:border-gray-800 hover:border-emerald-500/30 transition-all">
                        <div className="flex items-center justify-between mb-3 text-emerald-500">
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">{t.de}</span>
                           <ArrowLeft size={14} className="rotate-180" />
                           <span className="text-[10px] font-black uppercase tracking-widest">{t.para}</span>
                        </div>
                        <span className="text-3xl font-black dark:text-white tracking-tighter">{moneda}{t.monto.toFixed(2)}</span>
                     </div>
                   ))}
                   
                   <div className="pt-8 border-t border-slate-100 dark:border-gray-800 mt-6">
                      <Button variant="secondary" className="w-full py-5 h-auto rounded-2xl flex items-center justify-center gap-3 bg-slate-100 dark:bg-gray-800 border-none group" onClick={copyBalance}>
                         {copied ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Share2 size={20} className="group-hover:text-emerald-500 transition-colors" />}
                         <span className="font-black uppercase tracking-widest text-[11px]">{copied ? 'Enlace Copiado' : 'Compartir Balance'}</span>
                      </Button>
                   </div>
                </div>
              )}
           </Card>
        </div>
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
    </div>
  );
}
