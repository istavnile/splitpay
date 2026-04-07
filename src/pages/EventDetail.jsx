import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button, Card, Input } from '../components/UI';
import { calculateBalance } from '../utils/balanceEngine';
import { 
  ArrowLeft, Plus, UserPlus, Share2, Trash2, 
  Wallet, Receipt, ArrowRightLeft, CheckCircle2,
  Copy, Mail, ChevronRight, X, AlertCircle
} from 'lucide-react';

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingExpense, setAddingExpense] = useState(false);
  const [addingParticipant, setAddingParticipant] = useState(false);
  
  // Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [modals, setModals] = useState({ participant: false, share: false });

  // Balance
  const [balance, setBalance] = useState({ transferencias: [], summary: [], text: '' });
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
      if (participantsData.length > 0) setPayerId(participantsData[0].id);

      const expensesData = await pb.collection('expenses').getFullList({
        filter: `id_evento = "${id}" && estado = "activo"`,
        expand: 'pagado_por',
        sort: '-fecha_creacion',
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
        fecha_creacion: new Date().toISOString()
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

  const handleAddParticipant = async (e) => {
    e.preventDefault();
    if (!participantName) return;
    setAddingParticipant(true);
    try {
      const data = {
        id_evento: id,
        nombre: participantName,
        creado_por: user.id
      };
      const record = await pb.collection('participants').create(data);
      setParticipants([...participants, record]);
      setParticipantName('');
      setModals({ ...modals, participant: false });
      setPayerId(record.id);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setAddingParticipant(false);
    }
  };

  const deleteExpense = async (expId) => {
    try {
      await pb.collection('expenses').update(expId, { estado: 'borrado' });
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
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center p-10">
       <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 transition-colors duration-500 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b-0 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/')} className="p-2 rounded-full h-10 w-10">
            <ArrowLeft size={18} />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold dark:text-white leading-tight">{event.nombre_evento}</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Detalle del Evento
            </span>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setModals({ ...modals, participant: true })}>
          <UserPlus size={16} /> <span className="hidden sm:inline">Invitar</span>
        </Button>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
        
        {/* Left Column: Form & Participants */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          <Card className="border-t-4 border-emerald-500" hover={false}>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-gray-400 mb-6 flex items-center gap-2">
               <Receipt size={16} /> Nuevo Gasto
            </h3>
            <form onSubmit={handleAddExpense} className="flex flex-col gap-4">
               <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500 ml-1 mb-2 block">¿Quién pagó?</label>
                  <div className="flex flex-wrap gap-2 mb-4 max-h-32 overflow-y-auto p-1 custom-scrollbar">
                    {participants.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPayerId(p.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${payerId === p.id ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20' : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:border-emerald-500'}`}
                      >
                        {p.nombre}
                      </button>
                    ))}
                    <button 
                      type="button"
                      onClick={() => setModals({ ...modals, participant: true })}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800 border border-dashed border-slate-300 dark:border-gray-600 text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
               </div>

               <Input label="Descripción" placeholder="Ej: Supermercado, Gasolina..." value={description} onChange={e => setDescription(e.target.value)} required />
               <Input label="Monto" type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
               
               <Button type="submit" disabled={addingExpense} className="mt-2">
                 {addingExpense ? 'Guardando...' : <><Plus size={18} /> Registrar Gasto</>}
               </Button>
            </form>
          </Card>

          <Card hover={false} className="border-l-4 border-indigo-500">
             <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-gray-400 mb-4 flex items-center gap-2">
               <ArrowRightLeft size={16} /> Balance de Cuentas
            </h3>
            
            {balance.transferencias.length === 0 ? (
              <div className="py-6 text-center">
                 <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-3 opacity-50" />
                 <p className="text-sm font-bold text-slate-500 dark:text-gray-400">Todo en orden. No hay deudas pendientes.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                 {balance.transferencias.map((t, i) => (
                   <div key={i} className="bg-slate-50 dark:bg-gray-950 p-3 rounded-xl border border-slate-100 dark:border-gray-800 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">{t.de} debe a</span>
                        <span className="text-sm font-bold dark:text-white uppercase">{t.para}</span>
                      </div>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-lg">${t.monto.toFixed(2)}</span>
                   </div>
                 ))}
                 
                 <div className="pt-4 flex gap-2">
                    <Button variant="secondary" className="flex-1 text-xs" onClick={copyBalance}>
                      {copied ? 'Copiado!' : <><Copy size={14} /> Copiar</>}
                    </Button>
                    <Button variant="secondary" className="flex-1 text-xs" onClick={() => window.open(`whatsapp://send?text=${encodeURIComponent(balance.text)}`)}>
                      <Share2 size={14} /> WhatsApp
                    </Button>
                 </div>
              </div>
            )}
          </Card>
        </section>

        {/* Right Column: Active Expenses */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <Card hover={false} className="min-h-[400px]">
             <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100 dark:border-gray-800">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-gray-400 flex items-center gap-2">
                   <Wallet size={16} /> Historial de Gastos
                </h3>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-tighter">
                   Total: ${balance.total?.toFixed(2)}
                </span>
             </div>

             {expenses.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 grayscale opacity-40">
                  <Receipt size={48} className="text-slate-300 dark:text-gray-700 mb-4" />
                  <p className="text-sm font-bold tracking-widest uppercase text-slate-400">Sin gastos aún</p>
               </div>
             ) : (
               <div className="flex flex-col divide-y divide-slate-100 dark:divide-gray-800">
                  {expenses.map(exp => (
                    <div key={exp.id} className="py-4 first:pt-0 group flex items-center justify-between">
                       <div className="flex gap-4 items-center">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-gray-800 flex items-center justify-center text-slate-500 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-colors">
                             <Receipt size={18} />
                          </div>
                          <div>
                             <h4 className="font-bold dark:text-white capitalize">{exp.descripcion}</h4>
                             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                Pagado por <span className="text-emerald-500">{exp.expand?.pagado_por?.nombre}</span>
                             </p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <span className="font-mono font-bold text-lg text-slate-700 dark:text-slate-300">${exp.monto.toFixed(2)}</span>
                          <button onClick={() => deleteExpense(exp.id)} className="p-2 text-slate-300 dark:text-gray-700 hover:text-rose-500 transition-colors">
                             <Trash2 size={16} />
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
             )}
          </Card>
        </section>
      </main>

      {/* Modals */}
      {modals.participant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <Card className="max-w-md w-full animate-in zoom-in-95 duration-200" hover={false}>
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                   <UserPlus className="text-indigo-500" /> Añadir Persona
                 </h2>
                 <button onClick={() => setModals({ ...modals, participant: false })} className="text-slate-400 hover:text-white"><X /></button>
              </div>
              <form onSubmit={handleAddParticipant} className="flex flex-col gap-6">
                 <Input 
                   label="Nombre de la persona" 
                   placeholder="Ej: Carlos..." 
                   value={participantName}
                   onChange={e => setParticipantName(e.target.value)}
                   autoFocus
                 />
                 <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1" onClick={() => setModals({ ...modals, participant: false })} type="button">Cancelar</Button>
                    <Button className="flex-1" type="submit" disabled={addingParticipant}>
                      {addingParticipant ? 'Cargando...' : 'Añadir'}
                    </Button>
                 </div>
              </form>
           </Card>
        </div>
      )}
    </div>
  );
}
