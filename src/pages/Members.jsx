import React, { useState, useEffect } from 'react';
import { Users, Search, UserPlus, Mail, Globe, MessageSquare, Plus } from 'lucide-react';
import { Card, Button, Input } from '../components/UI';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';

export default function Members() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
        filter: allEventIds.map(id => `id_evento = "${id}"`).join(' || ')
      });

      // 3. Unique by name
      const uniqueMap = {};
      participants.forEach(p => {
        const key = p.nombre.toLowerCase().trim();
        if (!uniqueMap[key] || p.expand?.id_usuario) {
          uniqueMap[key] = {
            id: p.id,
            nombre: p.nombre,
            email: p.email || 'Contacto local',
            isUser: !!p.expand?.id_usuario
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

  const filteredMembers = members.filter(m => 
    m.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
           <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-500 mb-2 block">Comunidad</span>
           <h2 className="text-4xl font-black dark:text-white tracking-tight uppercase">Mis Contactos</h2>
           <p className="text-slate-500 dark:text-gray-400 mt-2">Gestiona a las personas con las que compartes gastos frecuentemente.</p>
        </div>
        <div className="flex gap-2">
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nombre..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-12 pr-6 py-4 bg-white/70 dark:bg-gray-900/50 backdrop-blur-md border border-slate-100 dark:border-gray-800 rounded-2xl text-sm font-bold w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
              />
           </div>
           <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-500/20">
              <UserPlus size={18} /> <span className="hidden sm:inline">Añadir</span>
           </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
           <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : filteredMembers.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center bg-white/20 dark:bg-gray-900/20 border-dashed border-2 border-slate-200 dark:border-gray-800" hover={false}>
          <div className="w-20 h-20 bg-slate-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-6 text-slate-300 dark:text-gray-700">
            <Users size={40} />
          </div>
          <h3 className="text-xl font-bold dark:text-white">Aún no tienes contactos</h3>
          <p className="text-slate-500 dark:text-gray-400 mt-2 max-w-xs text-sm">Invita a tus amigos a tus eventos para que aparezcan aquí automáticamente.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           {filteredMembers.map((member, i) => (
              <Card key={i} className="border-none shadow-sm dark:bg-gray-900/50 p-6 flex items-center gap-4 group" hover={true}>
                 <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                    {member.nombre[0].toUpperCase()}
                 </div>
                 <div className="flex-1 min-w-0">
                    <h4 className="font-bold dark:text-white truncate uppercase tracking-tight">{member.nombre}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                       {member.isUser ? <Globe size={10} className="text-indigo-500" /> : <MessageSquare size={10} />}
                       {member.isUser ? 'Usuario SplitPay' : 'Contacto Local'}
                    </p>
                 </div>
                 <button className="p-2 text-slate-300 hover:text-indigo-500 transition-colors">
                    <Mail size={18} />
                 </button>
              </Card>
           ))}
        </div>
      )}

      {/* Stats Bottom */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-indigo-500 rounded-[2.5rem] shadow-2xl shadow-indigo-500/30 text-white overflow-hidden relative">
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
         <div className="flex flex-col gap-2 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Amigos</span>
            <span className="text-4xl font-black">{members.length}</span>
         </div>
         <div className="flex flex-col gap-2 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Frecuencia Alta</span>
            <span className="text-4xl font-black">{Math.floor(members.length * 0.4)}</span>
         </div>
         <div className="flex flex-col gap-2 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Pendientes de Invitación</span>
            <span className="text-4xl font-black">{members.filter(m => !m.isUser).length}</span>
         </div>
      </div>

    </div>
  );
}
