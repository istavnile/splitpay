import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import pb from '../lib/pocketbase';
import { Button, Card, Input, StatusModal } from '../components/UI';
import { User, Camera, Lock, Mail, Shield, Smartphone, Globe, Bell, Check, X } from 'lucide-react';

export default function Settings() {
  const { user, refresh, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
    moneda_preferida: user?.moneda_preferida || '$',
  });
  const [passwords, setPasswords] = useState({
    old: '',
    new: '',
    confirm: '',
  });
  const [status, setStatus] = useState({ isOpen: false, type: 'success', title: '', message: '' });

  if (authLoading) {
    return (
      <div className="flex justify-center items-center py-20 min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Sync with user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        moneda_preferida: user.moneda_preferida || '$',
      });
    }
  }, [user]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('username', formData.username);
      data.append('moneda_preferida', formData.moneda_preferida);

      const avatarFile = document.getElementById('avatar-input').files[0];
      if (avatarFile) {
        data.append('avatar', avatarFile);
      }

      // Use plain object if no file is being uploaded for improved reliability
      const updateData = avatarFile 
        ? data 
        : {
            name: formData.name,
            moneda_preferida: formData.moneda_preferida
          };

      await pb.collection('users').update(user.id, updateData);
      console.log('User updated with moneda:', formData.moneda_preferida);
      await refresh();
      setStatus({
        isOpen: true,
        type: 'success',
        title: '¡Efectuado!',
        message: 'Tu perfil y preferencias se han actualizado correctamente.'
      });
    } catch (err) {
      setStatus({
        isOpen: true,
        type: 'error',
        title: 'Error de Guardado',
        message: 'No pudimos actualizar tu perfil: ' + err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) return alert('Las contraseñas no coinciden');
    setLoading(true);
    try {
      await pb.collection('users').update(user.id, {
        password: passwords.new,
        passwordConfirm: passwords.confirm,
        oldPassword: passwords.old,
      });
      setStatus({
        isOpen: true,
        type: 'success',
        title: 'Contraseña Actualizada',
        message: 'Tu seguridad es nuestra prioridad. Contraseña cambiada con éxito.'
      });
      setPasswords({ old: '', new: '', confirm: '' });
    } catch (err) {
      setStatus({
        isOpen: true,
        type: 'error',
        title: 'Error de Seguridad',
        message: 'No se pudo cambiar la contraseña: ' + err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const avatarUrl = user?.avatar 
    ? `${pb.baseUrl}/api/files/users/${user.id}/${user.avatar}`
    : `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=10b981&color=fff`;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto pb-20">
      <div className="mb-10">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500 mb-2 block">Configuración</span>
        <h2 className="text-4xl font-black dark:text-white tracking-tight">Mi Cuenta</h2>
        <p className="text-slate-500 dark:text-gray-400 mt-2">Gestiona tu perfil, seguridad y preferencias.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Profile Section */}
        <section className="md:col-span-12 lg:col-span-7 flex flex-col gap-6">
          <Card className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white/70 dark:bg-gray-900/50 backdrop-blur-md" hover={false}>
             <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-8 flex items-center gap-2">
                <User size={16} /> Detalles Personales
             </h3>
             
             <form onSubmit={handleUpdateProfile} className="space-y-8">
                <div className="flex flex-col items-center sm:flex-row gap-8 mb-10">
                   <div className="relative group">
                      <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-gray-800">
                         <img 
                            src={avatarPreview || avatarUrl} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                         />
                      </div>
                      <label 
                        htmlFor="avatar-input" 
                        className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white cursor-pointer shadow-lg hover:scale-110 transition-transform"
                      >
                         <Camera size={18} />
                      </label>
                      <input 
                        id="avatar-input" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleAvatarChange}
                      />
                   </div>
                   <div className="flex-1 text-center sm:text-left">
                      <h4 className="text-xl font-black dark:text-white mb-1 uppercase tracking-tight">{formData.name || 'Sin Nombre'}</h4>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{formData.email}</p>
                      <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter mt-2">Miembro desde Octubre 2023</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <Input 
                      label="Nombre Completo" 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})}
                   />
                   <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-gray-400 ml-1 block mb-1.5">Moneda Global</label>
                      <div className="flex bg-slate-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
                         <button 
                           type="button"
                           onClick={() => setFormData({...formData, moneda_preferida: '$'})}
                           className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${formData.moneda_preferida === '$' ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-white'}`}
                         >
                           $ USD
                         </button>
                         <button 
                           type="button"
                           onClick={() => setFormData({...formData, moneda_preferida: 'S/.'})}
                           className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${formData.moneda_preferida === 'S/.' ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-white'}`}
                         >
                           S/. PEN
                         </button>
                      </div>
                   </div>
                </div>
                <Input label="Email Address" value={formData.email} disabled wrapperClassName="opacity-60" className="cursor-not-allowed" />

                <div className="pt-4">
                   <Button type="submit" disabled={loading} className="w-full sm:w-auto px-8 py-4 rounded-2xl shadow-xl shadow-emerald-500/20">
                      {loading ? 'Guardando...' : 'Guardar Cambios'}
                   </Button>
                </div>
             </form>
          </Card>

          <Card className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white/70 dark:bg-gray-900/50 backdrop-blur-md" hover={false}>
             <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-8 flex items-center gap-2">
                <Lock size={16} /> Seguridad
             </h3>
             <form onSubmit={handleChangePassword} className="space-y-6">
                <Input 
                   label="Contraseña Actual" 
                   type="password" 
                   value={passwords.old} 
                   onChange={e => setPasswords({...passwords, old: e.target.value})}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <Input 
                      label="Nueva Contraseña" 
                      type="password" 
                      value={passwords.new} 
                      onChange={e => setPasswords({...passwords, new: e.target.value})}
                   />
                   <Input 
                      label="Confirmar Nueva Contraseña" 
                      type="password" 
                      value={passwords.confirm} 
                      onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                   />
                </div>
                <Button type="submit" disabled={loading} variant="secondary" className="w-full sm:w-auto rounded-2xl">
                   {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
                </Button>
             </form>
          </Card>
        </section>

        {/* Aside Section: Preferences */}
        <section className="md:col-span-12 lg:col-span-5 flex flex-col gap-6">
           <Card className="border-none bg-indigo-500 text-white shadow-xl shadow-indigo-500/20" hover={false}>
              <div className="flex flex-col gap-4">
                 <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Shield size={24} />
                 </div>
                 <h4 className="text-xl font-black tracking-tight uppercase">Plan Premium Activado</h4>
                 <p className="text-sm text-indigo-100 mb-4 opacity-80">Tienes acceso a todas las funciones colaborativas y almacenamiento ilimitado de recibos.</p>
                 <Button variant="secondary" className="bg-white text-indigo-600 hover:bg-white/90 border-none">Ver Suscripción</Button>
              </div>
           </Card>

           <Card className="border-none bg-white/70 dark:bg-gray-900/50 backdrop-blur-md" hover={false}>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-6">Preferencias</h3>
              <div className="space-y-4">
                 {[
                    { icon: Globe, label: 'Idioma', value: 'Español' },
                    { icon: Bell, label: 'Notificaciones', value: 'Activadas' },
                    { icon: Smartphone, label: 'App Móvil', value: 'Sincronizada' },
                 ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors cursor-pointer group">
                       <div className="flex items-center gap-3">
                          <item.icon size={18} className="text-slate-400 group-hover:text-emerald-500" />
                          <span className="text-sm font-bold dark:text-white uppercase tracking-tight">{item.label}</span>
                       </div>
                       <span className="text-xs text-slate-500 dark:text-gray-500 font-bold">{item.value}</span>
                    </div>
                 ))}
              </div>
           </Card>
        </section>

      </div>
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
