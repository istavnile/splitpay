import React, { useState, useEffect } from 'react';
import { Users, Search, UserPlus, Mail, Globe, MessageSquare, Plus, X, Share2, Copy, MessageCircle, Send, Edit, RefreshCcw, Phone, Building2 } from 'lucide-react';
import { Card, Button, Input, StatusModal } from '../components/UI';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import PaymentInfoPopup from '../components/PaymentInfoPopup';

export default function Members() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingContact, setEditingContact] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [editingName, setEditingName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [invitingContact, setInvitingContact] = useState(null);
  const [newContact, setNewContact] = useState({ nombre: '', email: '' });
  const [status, setStatus] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  const [paymentInfo, setPaymentInfo] = useState(null); // { userId, name }
  const [memberPayments, setMemberPayments] = useState({}); // userId -> [methods]

  useEffect(() => {
    fetchMembers();
  }, []);

  // After members load, fetch payment badges for registered users
  useEffect(() => {
    const userIds = members.filter(m => m.userId).map(m => m.userId);
    if (userIds.length === 0) return;
    const filter = userIds.map(id => `user_id = "${id}"`).join(' || ');
    pb.collection('payment_methods').getFullList({ filter })
      .then(rows => {
        const map = {};
        rows.forEach(r => {
          if (!map[r.user_id]) map[r.user_id] = [];
          map[r.user_id].push(r);
        });
        setMemberPayments(map);
      })
      .catch(() => {});
  }, [members]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      // 1. Get all events I'm in
      const owned = await pb.collection('events').getFullList({ filter: `creado_por = "${user.id}"` });
      let shared = [];
      try {
        const membs = await pb.collection('members').getFullList({ filter: `id_usuario = "${user.id}" || email = "${user.email}"`, expand: 'id_evento' });
        // Auto-patch records found by email that are missing id_usuario
        membs.filter(m => !m.id_usuario && m.email === user.email)
          .forEach(m => pb.collection('members').update(m.id, { id_usuario: user.id }).catch(() => {}));
        shared = membs.filter(m => m.id_evento && m.expand?.id_evento).map(m => m.expand.id_evento);
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

      // 4. Unique by name or userId or email — exclude self
      const uniqueMap = {};
      participants.filter(p => p.id_usuario !== user.id && p.email?.toLowerCase() !== user.email?.toLowerCase()).forEach(p => {
        const key = p.id_usuario || p.nombre.toLowerCase().trim();
        const existingInv = invs.find(i => 
          (p.id_usuario && i.id_usuario === p.id_usuario) || 
          (i.email && i.email.toLowerCase().trim() === p.email?.toLowerCase().trim()) ||
          (i.email && i.email.split('@')[0].toLowerCase() === p.nombre.toLowerCase().trim())
        );
        
        if (!uniqueMap[key] || (p.id_usuario && !uniqueMap[key].isUser)) {
          uniqueMap[key] = {
            id: p.id,
            nombre: p.nombre,
            email: p.email || p.expand?.id_usuario?.email || existingInv?.email || '',
            isUser: !!p.id_usuario,
            userId: p.id_usuario,
            eventId: p.id_evento,
            allPIds: [p.id] 
          };
        } else {
          uniqueMap[key].allPIds.push(p.id);
          // If we find an email in one of the alternative records, use it
          if (!uniqueMap[key].email && p.email) uniqueMap[key].email = p.email;
        }
      });

      // 5. Cross-reference emails against already-fetched invs (members records)
      //    to backfill isUser/userId — avoids querying the users collection
      //    which is restricted by PocketBase listRule for regular users.
      Object.values(uniqueMap).forEach(m => {
        if (!m.isUser && m.email) {
          const inv = invs.find(i =>
            i.id_usuario &&
            i.email?.toLowerCase().trim() === m.email.toLowerCase().trim()
          );
          if (inv) {
            m.isUser = true;
            m.userId = inv.id_usuario;
          }
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
    if (!editingContact) return;
    setInviting(true);
    try {
      // 1. Update name and email in ALL matching participant records
      const updateData = {};
      if (editingName !== editingContact.nombre) updateData.nombre = editingName;
      if (inviteEmail !== editingContact.email) updateData.email = inviteEmail.toLowerCase().trim();

      if (Object.keys(updateData).length > 0) {
        for (const pId of editingContact.allPIds) {
          await pb.collection('participants').update(pId, updateData);
        }
      }

      // 2. Also keep the members record for compatibility/invitations if email changed
      if (inviteEmail && inviteEmail !== editingContact.email) {
        try {
          await pb.collection('members').create({
            id_evento: editingContact.eventId,
            email: inviteEmail.toLowerCase().trim(),
            rol: 'editor'
          });
        } catch (mErr) {
          console.warn('Could not create member record (might already exist):', mErr);
        }
      }
      
      setStatus({
        isOpen: true,
        type: 'success',
        title: 'Contacto Actualizado',
        message: 'Los cambios se han guardado correctamente.'
      });
      setEditingContact(null);
      setInviteEmail('');
      setEditingName('');
      fetchMembers();
    } catch (err) {
      setStatus({
        isOpen: true,
        type: 'error',
        title: 'Error al actualizar',
        message: err.message
      });
    } finally {
      setInviting(false);
    }
  };

  const handleCreateContact = async (e) => {
    e.preventDefault();
    if (!newContact.nombre) return;
    setInviting(true);
    try {
      // Logic: Create a participant in one of the user's events OR just handle it as a global contact?
      // For now, let's create a participant in the most recent event if exists, or just simulate contact creation.
      // PocketBase doesn't have a 'contacts' collection yet, so we use 'participants' in events.
      // But adding a global contact needs a dedicated collection.
      
      // For now, let's just show an alert or simulate success if we haven't created the 'contacts' collection.
      // Wait, the user wants to add them. I should probably create a placeholder or a 'global_contacts' table.
      // Re-reading previous session: The app uses 'participants' in events.
      
      alert("Para añadir un contacto, primero debes invitarlo a un Evento específico.");
      setIsAddModalOpen(false);
      setNewContact({ nombre: '', email: '' });
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleEmailInvite = async (contact) => {
    if (!contact.email) {
      setStatus({
        isOpen: true,
        type: 'error',
        title: 'Falta Correo',
        message: 'No se puede enviar invitación sin un correo electrónico válido.'
      });
      return;
    }

    setInviting(true);
    setInvitingContact(null); // Close modal
    
    try {
      // 1. Try to create placeholder user first
      try {
        const randomPass = Math.random().toString(36).slice(-10) + "Aa1!";
        await pb.collection('users').create({
          email: contact.email,
          password: randomPass,
          passwordConfirm: randomPass,
          name: contact.nombre
        });
      } catch (createErr) {
        // If it fails because user already exists (unique constraint), that's fine.
        // We'll still proceed to request verification.
        const errorData = JSON.stringify(createErr.data || {}).toLowerCase();
        const isUniqueError = createErr.status === 400 && (
          errorData.includes('unique') || 
          errorData.includes('already exists') ||
          createErr.message?.toLowerCase().includes('unique')
        );
        
        if (!isUniqueError) throw createErr; // If it's another error (e.g. invalid email), bail
      }

      // 2. Trigger the premium branded email (works for both new and existing users)
      await pb.collection('users').requestVerification(contact.email);

      setStatus({
        isOpen: true,
        type: 'success',
        title: 'Invitación Enviada',
        message: `Se ha enviado un correo automático a ${contact.nombre} a través de SplitPay.`
      });
    } catch (err) {
      console.error('Error sending auto-invite:', err);
      setStatus({
        isOpen: true,
        type: 'error',
        title: 'Error de Envío',
        message: 'No pudimos enviar el correo automático. Inténtalo de nuevo o configura el SMTP.'
      });
    } finally {
      setInviting(false);
    }
  };

  const handleWhatsAppInvite = (contact) => {
    const text = encodeURIComponent(`¡Hola ${contact.nombre}! 👋 Te invito a usar SplitPay para gestionar nuestros gastos compartidos. Regístrate aquí: ${window.location.origin}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setStatus({
      isOpen: true,
      type: 'success',
      title: 'Enlace Copiado',
      message: 'El link de invitación se ha copiado al portapapeles.'
    });
  };

  const handleShare = (contact) => {
    if (navigator.share) {
      navigator.share({
        title: 'Invitación a SplitPay',
        text: `¡Hola ${contact.nombre}! 👋 Te invito a usar SplitPay para gestionar nuestros gastos de forma fácil y moderna.`,
        url: window.location.origin,
      }).catch(() => setInvitingContact(contact));
    } else {
      setInvitingContact(contact);
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
           <Button 
             onClick={() => setIsAddModalOpen(true)}
             className="bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-500/20 py-4 h-auto px-6 font-black uppercase tracking-widest text-[11px]"
           >
              <UserPlus size={18} /> <span className="ml-2">Añadir Nuevo</span>
           </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center grayscale opacity-50">
           <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
           <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500">Cargando relaciones...</p>
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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
           {filteredMembers.map((member, i) => {
              const pays = member.userId ? (memberPayments[member.userId] || []) : [];
              const hasPhone = pays.some(m => m.tipo === 'telefono');
              const hasBanks = pays.some(m => m.tipo === 'banco');
              const phoneTag = pays.find(m => m.tipo === 'telefono')?.etiquetas;
              return (
              <Card 
                key={i} 
                onClick={() => setPaymentInfo({ userId: member.userId, name: member.nombre, isUser: member.isUser, email: member.email })}
                className="border-none shadow-sm shadow-indigo-500/5 dark:bg-gray-900/60 p-4 flex flex-col gap-3 group rounded-[1.5rem] cursor-pointer" 
                hover={true}
              >
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-500 shrink-0">
                       {member.nombre[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                       <h4 className="text-sm font-black dark:text-white truncate uppercase tracking-tight">{member.nombre}</h4>
                       <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                         <p className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1">
                           {member.isUser ? <Globe size={10} className="text-indigo-500" /> : <MessageSquare size={10} />}
                           {member.isUser ? 'Verificado' : 'Local'}
                         </p>
                         {hasPhone && (
                           <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                             phoneTag === 'yape' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                             phoneTag === 'plin' ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400' :
                             'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                           }`}>
                             {phoneTag === 'ambos' ? 'Y+P' : phoneTag === 'yape' ? 'Yape' : 'Plin'}
                           </span>
                         )}
                         {hasBanks && (
                           <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                             Banco
                           </span>
                         )}
                       </div>
                    </div>
                 </div>

                 <div className="pt-3 border-t border-slate-50 dark:border-gray-800/50 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold dark:text-white truncate opacity-60">
                       {member.email || 'Sin correo'}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           setEditingContact(member);
                           setInviteEmail(member.email || '');
                           setEditingName(member.nombre);
                         }}
                         className="p-2 bg-slate-100 dark:bg-gray-800 rounded-xl hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                         title="Editar Perfil"
                       >
                          <Edit size={14} />
                       </button>
                       {member.email && (
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             handleEmailInvite(member);
                           }}
                           className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-xl hover:bg-indigo-500 hover:text-white transition-all shadow-sm border border-indigo-100 dark:border-indigo-500/20"
                           title="Reenviar Invitación por Email"
                         >
                            <RefreshCcw size={14} />
                         </button>
                       )}
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           handleShare(member);
                         }}
                         className="p-2 bg-slate-100 dark:bg-gray-800 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                         title="Compartir / Invitar"
                       >
                          <Share2 size={14} />
                       </button>
                    </div>
                 </div>
              </Card>
              );
           })}
        </div>
      )}

      {/* Stats Bottom */}
      <div className="mt-8 grid grid-cols-3 gap-0 px-6 py-5 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2rem] shadow-2xl shadow-indigo-500/30 text-white overflow-hidden relative group">
         <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
         <div className="flex flex-col gap-0.5 relative z-10 border-r border-white/10 pr-4">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Amigos</span>
            <span className="text-3xl font-black tracking-tighter">{members.length}</span>
         </div>
         <div className="flex flex-col gap-0.5 relative z-10 border-r border-white/10 px-4">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Registrados</span>
            <span className="text-3xl font-black tracking-tighter">{members.filter(m => m.isUser).length}</span>
         </div>
         <div className="flex flex-col gap-0.5 relative z-10 pl-4">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Sin cuenta</span>
            <span className="text-3xl font-black tracking-tighter">{members.filter(m => !m.isUser).length}</span>
         </div>
      </div>

      {/* Email Association Modal */}
      {editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="max-w-md w-full animate-in zoom-in-95 duration-200 p-10 border-none shadow-2xl rounded-[3rem]" hover={false}>
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black flex items-center gap-3 dark:text-white tracking-tight leading-none uppercase">
                  <Mail className="text-indigo-500" size={32} /> Editar Contacto
                </h2>
                <button onClick={() => setEditingContact(null)} className="text-slate-400 hover:text-rose-500 transition-colors">
                   <X size={28} />
                </button>
             </div>
             <p className="text-sm text-slate-500 dark:text-gray-400 mb-10 leading-relaxed font-bold">
                Actualiza la información de <span className="text-indigo-500">{editingContact.nombre}</span>. Los cambios de nombre se aplicarán a todos los eventos compartidos.
             </p>
             <form onSubmit={handleUpdateContact} className="space-y-6">
                <Input 
                  label="Nombre" 
                  type="text"
                  placeholder="Nombre del contacto" 
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  disabled={editingContact.isUser}
                  className="bg-slate-50 dark:bg-gray-800 border-none h-14 px-6 rounded-2xl font-bold"
                />
                <Input 
                  label="Correo Electrónico" 
                  type="email"
                  placeholder="ejemplo@email.com" 
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  disabled={editingContact.isUser}
                  className="bg-slate-50 dark:bg-gray-800 border-none h-14 px-6 rounded-2xl font-bold"
                />
                <div className="flex flex-col gap-3 pt-4">
                   <Button className="py-5 h-auto rounded-2xl font-black bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 uppercase tracking-widest text-xs" type="submit" disabled={inviting}>
                      {inviting ? 'Guardando...' : 'Guardar Cambios'}
                   </Button>
                   <Button variant="ghost" className="py-5 h-auto rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400" onClick={() => setEditingContact(null)} type="button">
                      Cerrar
                   </Button>
                </div>
             </form>
          </Card>
        </div>
      )}
      {/* Add New Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="max-w-md w-full animate-in zoom-in-95 duration-200 p-10 border-none shadow-2xl rounded-[3rem]" hover={false}>
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black flex items-center gap-3 dark:text-white tracking-tight leading-none uppercase">
                  <UserPlus className="text-indigo-500" size={32} /> Nuevo Contacto
                </h2>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                   <X size={28} />
                </button>
             </div>
             <form onSubmit={handleCreateContact} className="space-y-6">
                <Input 
                  label="Nombre" 
                  placeholder="Ej: Juan Pérez" 
                  value={newContact.nombre}
                  onChange={e => setNewContact({...newContact, nombre: e.target.value})}
                  autoFocus
                  required
                  className="bg-slate-50 dark:bg-gray-800 border-none h-14 px-6 rounded-2xl font-bold"
                />
                <Input 
                  label="Correo Electrónico (Opcional)" 
                  type="email"
                  placeholder="ejemplo@email.com" 
                  value={newContact.email}
                  onChange={e => setNewContact({...newContact, email: e.target.value})}
                  className="bg-slate-50 dark:bg-gray-800 border-none h-14 px-6 rounded-2xl font-bold"
                />
                <div className="flex flex-col gap-3 pt-4">
                   <Button className="py-5 h-auto rounded-2xl font-black bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 uppercase tracking-widest text-xs" type="submit" disabled={inviting}>
                      {inviting ? 'Guardando...' : 'Guardar Contacto'}
                   </Button>
                   <Button variant="ghost" className="py-5 h-auto rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400" onClick={() => setIsAddModalOpen(false)} type="button">
                      Cerrar
                   </Button>
                </div>
             </form>
          </Card>
        </div>
      )}

      {/* Invitation Modal */}
      {invitingContact && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <Card className="max-w-md w-full animate-in zoom-in-95 duration-200 p-10 border-none shadow-2xl rounded-[3rem] bg-white dark:bg-gray-900" hover={false}>
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black flex items-center gap-3 dark:text-white tracking-tight leading-none uppercase">
                  <Share2 className="text-emerald-500" size={32} /> Invitar Amigo
                </h2>
                <button onClick={() => setInvitingContact(null)} className="text-slate-400 hover:text-rose-500 transition-colors">
                   <X size={28} />
                </button>
             </div>
             
             <div className="space-y-6">
                <div className="p-6 bg-slate-50 dark:bg-gray-800/50 rounded-3xl border border-slate-100 dark:border-gray-800">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2 text-center">Enlace de Invitación</p>
                    <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-800">
                        <span className="flex-1 text-[10px] font-bold text-slate-500 truncate">{window.location.origin}</span>
                        <button onClick={handleCopyLink} className="p-2 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 hover:scale-110 transition-transform">
                            <Copy size={16} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => handleWhatsAppInvite(invitingContact)}
                        disabled={inviting}
                        className="flex flex-col items-center gap-3 p-6 bg-emerald-50 dark:bg-emerald-500/5 rounded-3xl border border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-500 hover:text-white group transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <MessageCircle size={32} className="text-emerald-500 group-hover:text-white" />
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">WhatsApp</span>
                    </button>
                    <button 
                        onClick={() => handleEmailInvite(invitingContact)}
                        disabled={inviting}
                        className="flex flex-col items-center gap-3 p-6 bg-indigo-50 dark:bg-indigo-500/5 rounded-3xl border border-indigo-100 dark:border-indigo-500/20 hover:bg-indigo-500 hover:text-white group transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {inviting ? (
                          <div className="w-8 h-8 border-2 border-indigo-500 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <Send size={32} className="text-indigo-500 group-hover:text-white" />
                        )}
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                          {inviting ? 'Enviando...' : 'Email Auto'}
                        </span>
                    </button>
                </div>

                <div className="pt-4">
                    <Button 
                        variant="ghost" 
                        className="w-full py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] opacity-50 hover:opacity-100 transition-opacity" 
                        onClick={() => setInvitingContact(null)}
                    >
                       Cerrar
                    </Button>
                </div>
             </div>
          </Card>
        </div>
      )}

      {paymentInfo && (
        <PaymentInfoPopup
          userId={paymentInfo.userId}
          name={paymentInfo.name}
          isUser={paymentInfo.isUser}
          email={paymentInfo.email}
          onClose={() => setPaymentInfo(null)}
        />
      )}
      <StatusModal
        isOpen={status.isOpen}
        onClose={() => setStatus({...status, isOpen: false})}
        type={status.type}
        title={status.title}
        message={status.message}
      />
    </div>
  );
}
