import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Input } from '../components/UI';
import { calculateBalance } from '../utils/balanceEngine';
import { 
  ArrowLeft, Plus, UserPlus, Share2, Trash2, 
  Wallet, Receipt, ArrowRightLeft, CheckCircle2,
  Copy, Mail, ChevronRight, X, AlertCircle, Users, TrendingUp
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
  
  const [modals, setModals] = useState({ participant: false, invite: false, share: false });
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
        sort: '',
      });
      setParticipants(participantsData);
      if (participantsData.length > 0) setPayerId(participantsData[0].id);

      const expensesData = await pb.collection('expenses').getFullList({
        filter: `id_evento = "${id}"`,
        expand: 'pagado_por',
        sort: '',
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
      // 1. Create membership record
      await pb.collection('members').create({
        id_evento: id,
        email: inviteEmail.toLowerCase().trim(),
        rol: 'editor'
      });

      // 2. Add as participant for calculations
      const nameFromEmail = inviteEmail.split('@')[0];
      await pb.collection('participants').create({
        id_evento: id,
        nombre: nameFromEmail,
        creado_por: user.id
      });

      alert(`Invitación enviada a ${inviteEmail}`);
      setInviteEmail('');
      setModals({ ...modals, invite: false });
      fetchData(); // Refresh to show new participant
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

  const copyBalance = () => {
    navigator.clipboard.writeText(balance.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
       <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
       <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Escaneando transacciones...</p>
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Event Header Card */}
      <Card className="mb-10 bg-white dark:bg-gray-900 border-none shadow-xl shadow-emerald-500/5 overflow-hidden p-0" hover={false}>
         <div className="h-32 bg-gradient-to-r from-emerald-500 to-teal-600 p-8 flex items-end justify-between relative">
            <div className="absolute top-6 left-6">
               <button onClick={() => navigate('/')} className="p-2 bg-white/20 hover:bg-white/40 rounded-xl text-white backdrop-blur-md transition-colors">
                  <ArrowLeft size={20} />
               </button>
            </div>
            <div>
               <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-1 uppercase">{event.nombre_evento}</h1>
               <p className="text-emerald-100/70 text-[10px] font-bold uppercase tracking-[0.2em]">Creado el {new Date(event.created).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
               <Button variant="secondary" className="bg-white/10 hover:bg-white/20 border-none text-white backdrop-blur-sm px-4 py-2 h-auto" onClick={() => setModals({...modals, invite: true})}>
                  <UserPlus size={18} /> <span className="hidden sm:inline">Invitar</span>
               </Button>
               <Button variant="secondary" className="bg-white/10 hover:bg-white/20 border-none text-white backdrop-blur-sm px-4 py-2 h-auto" onClick={copyBalance}>
                  <Share2 size={18} />
               </Button>
            </div>
         </div>
         
         <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col gap-1 border-r border-slate-100 dark:border-gray-800 pr-8">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">Gasto Total</span>
               <span className="text-3xl font-black dark:text-white">${balance.total?.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-1 border-r border-slate-100 dark:border-gray-800 pr-8">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">Participantes</span>
               <div className="flex items-center gap-2 mt-1">
                  <div className="flex -space-x-2">
                     {participants.slice(0, 3).map(p => (
                        <div key={p.id} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-800 border-2 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-bold text-slate-500">
                           {p.nombre[0].toUpperCase()}
                        </div>
                     ))}
                  </div>
                  <span className="text-sm font-bold dark:text-white ml-1">{participants.length} personas</span>
               </div>
            </div>
            <div className="flex flex-col gap-1">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">Estado</span>
               <div className="flex items-center gap-2 mt-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-sm font-bold text-emerald-500">Evento Activo</span>
               </div>
            </div>
         </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Content: Expenses */}
        <div className="lg:col-span-8 flex flex-col gap-8">
           <Card className="border-none shadow-sm dark:bg-gray-900/50" hover={false}>
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-lg font-black dark:text-white tracking-tight flex items-center gap-2">
                    <Receipt className="text-emerald-500" /> Historial de Gastos
                 </h3>
                 <button onClick={() => setModals({...modals, invite: false})} className="text-xs font-bold text-emerald-500 hover:scale-105 transition-transform uppercase tracking-widest">Filtrar</button>
              </div>

              {expenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 grayscale opacity-40">
                   <AlertCircle size={40} className="mb-4 text-slate-300" />
                   <p className="text-xs font-bold uppercase tracking-widest">No hay gastos todavía</p>
                </div>
              ) : (
                <div className="space-y-4">
                   {expenses.map(exp => (
                     <div key={exp.id} className="group p-4 bg-slate-50 dark:bg-gray-900/50 rounded-2xl border border-slate-100 dark:border-gray-800 hover:border-emerald-500/50 transition-all flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-500 shadow-sm transition-colors">
                              <Wallet size={20} />
                           </div>
                           <div>
                              <h4 className="font-bold dark:text-white text-base tracking-tight">{exp.descripcion}</h4>
                              <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mt-1">
                                 Pagado por <span className="text-indigo-500">{exp.expand?.pagado_por?.nombre}</span>
                              </p>
                           </div>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                           <div className="flex flex-col">
                              <span className="text-xl font-black dark:text-white tracking-tighter">${exp.monto.toFixed(2)}</span>
                           </div>
                           <button onClick={() => deleteExpense(exp.id)} className="p-2.5 opacity-0 group-hover:opacity-100 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all">
                              <Trash2 size={16} />
                           </button>
                        </div>
                     </div>
                   ))}
                </div>
              )}
           </Card>
        </div>

        {/* Sidebar Actions: Add and Balance */}
        <div className="lg:col-span-4 flex flex-col gap-8">
           <Card className="border-none shadow-xl shadow-emerald-500/5 dark:shadow-none bg-emerald-500 text-white p-8" hover={false}>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                 <Plus size={18} /> Registrar Gasto
              </h3>
              <form onSubmit={handleAddExpense} className="space-y-8">
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100 mb-3 block">¿Quién pagó hoy?</label>
                    <div className="flex flex-wrap gap-2">
                       {participants.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPayerId(p.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${payerId === p.id ? 'bg-white text-emerald-600 shadow-lg scale-105' : 'bg-emerald-600/50 text-emerald-50 hover:bg-emerald-600 uppercase tracking-tight'}`}
                          >
                             {p.nombre}
                          </button>
                       ))}
                    </div>
                 </div>

                 <Input 
                   label="¿En qué se gastó?" 
                   placeholder="Ej: Combustible, Drinks..." 
                   value={description} 
                   onChange={e => setDescription(e.target.value)} 
                   required 
                   className="bg-emerald-600/50 border-none text-white placeholder:text-emerald-200"
                />
                 <Input 
                   label="Monto Total" 
                   type="number" 
                   step="0.01" 
                   placeholder="0.00" 
                   value={amount} 
                   onChange={e => setAmount(e.target.value)} 
                   required 
                   className="bg-emerald-600/50 border-none text-white"
                />
                 
                 <Button type="submit" disabled={addingExpense} className="w-full py-4 h-auto rounded-2xl bg-white text-emerald-600 hover:bg-emerald-50 border-none font-black shadow-xl shadow-emerald-900/20">
                    {addingExpense ? 'Guardando...' : 'Confirmar Gasto'}
                 </Button>
              </form>
           </Card>

           <Card className="border-none shadow-sm dark:bg-gray-900/50" hover={false}>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-6 flex items-center gap-2">
                 <ArrowRightLeft size={16} /> Ajuste de Cuentas
              </h3>
              
              {balance.transferencias.length === 0 ? (
                <div className="py-10 text-center flex flex-col items-center">
                   <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-4 animate-bounce duration-[2000ms]">
                      <CheckCircle2 size={32} />
                   </div>
                   <p className="text-sm font-bold text-slate-500 dark:text-gray-400 uppercase tracking-tight">Todo está al día</p>
                   <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Perfecto para una nueva aventura</p>
                </div>
              ) : (
                <div className="space-y-4">
                   {balance.transferencias.map((t, i) => (
                     <div key={i} className="group p-4 bg-slate-50 dark:bg-gray-800/20 rounded-2xl border border-slate-100 dark:border-gray-800 hover:border-emerald-500/30 transition-all">
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">{t.de}</span>
                           <ChevronRight size={14} className="text-slate-300" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{t.para}</span>
                        </div>
                        <span className="text-2xl font-black dark:text-white tracking-tighter">${t.monto.toFixed(2)}</span>
                     </div>
                   ))}
                   
                   <div className="pt-6 border-t border-slate-100 dark:border-gray-800 mt-4">
                      <Button variant="secondary" className="w-full py-4 h-auto rounded-xl flex items-center justify-center gap-3" onClick={copyBalance}>
                         {copied ? <CheckCircle2 size={20} /> : <Share2 size={20} />}
                         <span className="font-bold">{copied ? 'Enlace Copiado' : 'Compartir Balance'}</span>
                      </Button>
                   </div>
                </div>
              )}
           </Card>
        </div>
      </div>

      {/* Invite Modal */}
      {modals.invite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="max-w-md w-full animate-in zoom-in-95 duration-200 p-8 border-none shadow-2xl" hover={false}>
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black flex items-center gap-2 dark:text-white tracking-tight">
                  <UserPlus className="text-emerald-500" strokeWidth={3} /> Invitar Miembro
                </h2>
                <button onClick={() => setModals({ ...modals, invite: false })} className="text-slate-400 hover:text-white">
                   <X size={24} />
                </button>
             </div>
             <p className="text-sm text-slate-500 dark:text-gray-400 mb-8 leading-relaxed">
                Introduce el email de la persona que quieras añadir. Si ya está en SplitPay, verá el evento al instante. Si no, le esperará en cuanto se registre.
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
                  className="bg-slate-100 dark:bg-gray-800/50 border-none px-6 py-4 rounded-2xl"
                />
                <div className="flex flex-col gap-3">
                   <Button className="py-4 h-auto rounded-2xl font-black shadow-xl shadow-emerald-500/20" type="submit" disabled={inviting}>
                      {inviting ? 'Enviando Invitación...' : 'Enviar Invitación'}
                   </Button>
                   <Button variant="ghost" className="py-4 h-auto rounded-2xl" onClick={() => setModals({ ...modals, invite: false })} type="button">
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
