import React, { useState, useEffect } from 'react';
import { Users, Search, UserPlus, Mail, Globe, MessageSquare, Plus, X, Check, ArrowRight, Trash2 } from 'lucide-react';
import { Card, Button, Input } from '../components/UI';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';

export default function Members() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingContact, setEditingContact] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      // 1. Get all events I'm in
      const owned = await pb.collection('events').getFullList({ filter: `creado_por = "${user.id}"` });
      let shared = [];
      try {
        const membs = await pb.collection('members').getFullList({ filter: `id_usuario = "${user.id}"`, expand: 'id_evento' });
        shared = membs.filter(m => m.id_evento).map(m => m.expand.id_evento);
      } catch (e) {}

      const allEventIds = [...new Set([...owned, ...shared].map(e => e.id))];

      if (allEventIds.length === 0) {
        setMembers([]);
        return;
      }

      // 2. Get all participants in those events
      const participants = await pb.collection('participants').getFullList({
        filter: allEventIds.map(id => `id_evento = "${id}"`).join(' || '),
        expand: 'id_usuario'
      });

      // 3. Get all member invitations for these events to link emails
      const invs = await pb.collection('members').getFullList({
        filter: allEventIds.map(id => `id_evento = "${id}"`).join(' || ')
      });

      // 4. Unique by name
      const uniqueMap = {};
      participants.forEach(p => {
        const key = p.nombre.toLowerCase().trim();
        const existingInv = invs.find(i => i.email.split('@')[0].toLowerCase() === key || i.id_usuario === p.id_usuario);
        
        if (!uniqueMap[key] || p.id_usuario) {
          uniqueMap[key] = {
            id: p.id,
            nombre: p.nombre,
            email: existingInv?.email || '',
            isUser: !!p.id_usuario,
            userId: p.id_usuario,
            eventId: p.id_evento // Just for reference
          };
        }
      });

      setMembers(Object.values(uniqueMap));
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContact = async (e) => {
    e.preventDefault();
    if (!inviteEmail || !editingContact) return;
    setInviting(true);
    try {
      // Create a member record to invite them if they are not already a user
      await pb.collection('members').create({
        id_evento: editingContact.eventId,
        email: inviteEmail.toLowerCase().trim(),
        rol: 'editor'
      });
      
      alert(`Invitación vinculada y enviada a ${inviteEmail}`);
      setEditingContact(null);
      setInviteEmail('');
      fetchMembers();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setInviting(false);
    }
  };

  const filteredMembers = members.filter(m => 
    m.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto pb-20 px-4 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
           <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 mb-3 block">Comunidad SplitPay</span>
           <h2 className="text-4xl md:text-5xl font-black dark:text-white tracking-tighter uppercase leading-none">Mis Contactos</h2>
           <p className="text-slate-500 dark:text-gray-400 mt-4 font-bold">Gestiona a las personas con las que compartes gastos frecuentemente.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nombre..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-12 pr-6 py-4 bg-white/70 dark:bg-gray-900/50 backdrop-blur-md border border-slate-100 dark:border-gray-800 rounded-3xl text-sm font-black w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
              />
           </div>
           <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-500/20 py-4 h-auto px-6 font-black uppercase tracking-widest text-[11px]">
              <UserPlus size={18} /> <span className="ml-2">Añadir Nuevo</span>
           </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center grayscale opacity-50">
           <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
           <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando relaciones...</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-24 text-center bg-white/20 dark:bg-gray-900/40 border-dashed border-2 border-slate-200 dark:border-gray-800 rounded-[3rem]" hover={false}>
          <div className="w-24 h-24 bg-slate-100 dark:bg-gray-800 rounded-[2rem] flex items-center justify-center mb-8 text-slate-300 dark:text-gray-700">
            <Users size={48} />
          </div>
          <h3 className="text-2xl font-black dark:text-white uppercase tracking-tight">Aún no tienes contactos</h3>
          <p className="text-slate-500 dark:text-gray-400 mt-4 max-w-xs font-bold leading-relaxed">Invita a tus amigos a tus eventos para que aparezcan aquí automáticamente con su historial.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
           {filteredMembers.map((member, i) => (
              <Card key={i} className="border-none shadow-sm shadow-indigo-500/5 dark:bg-gray-900/60 p-8 flex flex-col gap-6 group rounded-[2.5rem]" hover={true}>
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
                       {member.nombre[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                       <h4 className="text-xl font-black dark:text-white truncate uppercase tracking-tighter">{member.nombre}</h4>
                       <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                          {member.isUser ? <Globe size={12} className="text-indigo-500" /> : <MessageSquare size={12} />}
                          {member.isUser ? 'Usuario Verificado' : 'Contacto Local'}
                       </p>
                    </div>
                 </div>
                 
                 <div className="pt-6 border-t border-slate-50 dark:border-gray-800/50 flex flex-col gap-4">
                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">
                       <span>Correo Electrónico</span>
                       {member.email ? <Check size={14} className="text-emerald-500" /> : <X size={14} className="text-rose-500" />}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                       <span className="text-sm font-bold dark:text-white truncate opacity-70">
                          {member.email || 'Sin correo asociado'}
                       </span>
                       <button 
                         onClick={() => { setEditingContact(member); setInviteEmail(member.email); }}
                         className="p-3 bg-slate-100 dark:bg-gray-800 rounded-2xl hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                       >
                          <Mail size={18} />
                       </button>
                    </div>
                 </div>

                 {member.email && !member.isUser && (
                   <button 
                     onClick={() => { setEditingContact(member); setInviteEmail(member.email); handleUpdateContact(new Event('submit')); }}
                     className="mt-2 w-full py-4 h-auto rounded-2xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all font-black uppercase tracking-widest text-[10px]"
                   >
                     Reenviar Invitación
                   </button>
                 )}
              </Card>
           ))}
        </div>
      )}

      {/* Stats Bottom */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 p-10 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[3rem] shadow-2xl shadow-indigo-500/30 text-white overflow-hidden relative group">
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
         <div className="flex flex-col gap-2 relative z-10 border-r border-white/10">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Amigos</span>
            <span className="text-5xl font-black tracking-tighter">{members.length}</span>
         </div>
         <div className="flex flex-col gap-2 relative z-10 border-r border-white/10">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Usuarios App</span>
            <span className="text-5xl font-black tracking-tighter">{members.filter(m => m.isUser).length}</span>
         </div>
         <div className="flex flex-col gap-2 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Contactos Locales</span>
            <span className="text-5xl font-black tracking-tighter">{members.filter(m => !m.isUser).length}</span>
         </div>
      </div>

      {/* Email Association Modal */}
      {editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="max-w-md w-full animate-in zoom-in-95 duration-200 p-10 border-none shadow-2xl rounded-[3rem]" hover={false}>
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black flex items-center gap-3 dark:text-white tracking-tight leading-none uppercase">
                  <Mail className="text-indigo-500" size={32} /> Vincular Correo
                </h2>
                <button onClick={() => setEditingContact(null)} className="text-slate-400 hover:text-rose-500 transition-colors">
                   <X size={28} />
                </button>
             </div>
             <p className="text-sm text-slate-500 dark:text-gray-400 mb-10 leading-relaxed font-bold">
                Asocia un correo a <span className="text-indigo-500">{editingContact.nombre}</span> para invitarle a SplitPay y compartir balances automáticamente.
             </p>
             <form onSubmit={handleUpdateContact} className="space-y-8">
                <Input 
                  label="Correo Electrónico" 
                  type="email"
                  placeholder="ejemplo@email.com" 
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  autoFocus
                  required
                  className="bg-slate-50 dark:bg-gray-800 border-none h-14 px-6 rounded-2xl font-bold"
                />
                <div className="flex flex-col gap-3 pt-4">
                   <Button className="py-5 h-auto rounded-2xl font-black bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 uppercase tracking-widest text-xs" type="submit" disabled={inviting}>
                      {inviting ? 'Procesando...' : 'Vincular e Invitar'}
                   </Button>
                   <Button variant="ghost" className="py-5 h-auto rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400" onClick={() => setEditingContact(null)} type="button">
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
