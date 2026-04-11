import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import pb from '../lib/pocketbase';
import { Button, Card, Input, StatusModal } from '../components/UI';
import { User, Camera, Lock, Shield, Smartphone, Globe, Bell, Phone, Building2, Plus, Trash2, X, CreditCard } from 'lucide-react';
import AvatarCropper from '../components/AvatarCropper';

export default function Settings() {
  const { user, refresh, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [cropFile, setCropFile] = useState(null);   // raw file waiting to be cropped
  const [croppedBlob, setCroppedBlob] = useState(null); // final blob ready to upload
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

  // Payment methods
  const [payMethods, setPayMethods]       = useState([]);
  const [savingPay, setSavingPay]         = useState(false);
  const [newBank, setNewBank]             = useState({ banco: '', numero_cuenta: '', cci: '', moneda: 'SOL', alias: '' });
  const [showBankForm, setShowBankForm]   = useState(false);

  const phoneMethod   = payMethods.find(m => m.tipo === 'telefono');
  const bankMethods   = payMethods.filter(m => m.tipo === 'banco');

  const [phoneForm, setPhoneForm] = useState({ telefono: '', etiquetas: 'yape' });

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

  // Load payment methods
  useEffect(() => {
    if (!user) return;
    pb.collection('payment_methods')
      .getFullList({ filter: `user_id = "${user.id}"`, sort: 'tipo,created' })
      .then(rows => {
        setPayMethods(rows);
        const phone = rows.find(r => r.tipo === 'telefono');
        if (phone) setPhoneForm({ telefono: phone.telefono || '', etiquetas: phone.etiquetas || 'yape' });
      })
      .catch(() => {});
  }, [user]);

  const savePhone = async (e) => {
    e.preventDefault();
    if (!phoneForm.telefono.trim()) return;
    setSavingPay(true);
    try {
      const existing = payMethods.find(m => m.tipo === 'telefono');
      if (existing) {
        const updated = await pb.collection('payment_methods').update(existing.id, {
          telefono: phoneForm.telefono.trim(),
          etiquetas: phoneForm.etiquetas,
        });
        setPayMethods(prev => prev.map(m => m.id === updated.id ? updated : m));
      } else {
        const created = await pb.collection('payment_methods').create({
          user_id: user.id,
          tipo: 'telefono',
          telefono: phoneForm.telefono.trim(),
          etiquetas: phoneForm.etiquetas,
        });
        setPayMethods(prev => [...prev, created]);
      }
      setStatus({ isOpen: true, type: 'success', title: 'Guardado', message: 'Número guardado correctamente.' });
    } catch (err) {
      setStatus({ isOpen: true, type: 'error', title: 'Error', message: err.message });
    } finally {
      setSavingPay(false);
    }
  };

  const saveBank = async (e) => {
    e.preventDefault();
    if (!newBank.banco.trim() && !newBank.numero_cuenta.trim()) return;
    setSavingPay(true);
    try {
      const created = await pb.collection('payment_methods').create({
        user_id: user.id,
        tipo: 'banco',
        banco: newBank.banco.trim(),
        numero_cuenta: newBank.numero_cuenta.trim(),
        cci: newBank.cci.trim(),
        moneda: newBank.moneda,
        alias: newBank.alias.trim(),
      });
      setPayMethods(prev => [...prev, created]);
      setNewBank({ banco: '', numero_cuenta: '', cci: '', moneda: 'SOL', alias: '' });
      setShowBankForm(false);
    } catch (err) {
      setStatus({ isOpen: true, type: 'error', title: 'Error', message: err.message });
    } finally {
      setSavingPay(false);
    }
  };

  const deletePayMethod = async (id) => {
    try {
      await pb.collection('payment_methods').delete(id);
      setPayMethods(prev => prev.filter(m => m.id !== id));
    } catch (_) {}
  };

  // Open cropper when user picks a file
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) setCropFile(file);
    // Reset input so re-selecting the same file triggers onChange again
    e.target.value = '';
  };

  // Called by AvatarCropper on confirm
  const handleCropConfirm = (blob, previewUrl) => {
    setCroppedBlob(blob);
    setAvatarPreview(previewUrl);
    setCropFile(null);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let updateData;
      if (croppedBlob) {
        const data = new FormData();
        data.append('name', formData.name);
        data.append('username', formData.username);
        data.append('moneda_preferida', formData.moneda_preferida);
        data.append('avatar', croppedBlob, 'avatar.jpg');
        updateData = data;
      } else {
        updateData = { name: formData.name, moneda_preferida: formData.moneda_preferida };
      }

      const updated = await pb.collection('users').update(user.id, updateData);
      // Directly patch the authStore model so moneda_preferida persists on reload
      pb.authStore.save(pb.authStore.token, { ...pb.authStore.model, ...updated });
      await refresh();
      setCroppedBlob(null);
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
        
        {/* Main Column */}
        <section className="md:col-span-12 lg:col-span-7 flex flex-col gap-8">
           <Card className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white/70 dark:bg-gray-900/50 backdrop-blur-md" hover={false}>
              <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-gray-500 mb-8 flex items-center gap-2">
                 <User size={14} className="text-emerald-500" /> Detalles Personales
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
              <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-gray-500 mb-8 flex items-center gap-2">
                 <Lock size={14} className="text-emerald-500" /> Seguridad
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
           <div className="pt-4">
              <Button type="submit" disabled={loading} variant="secondary" className="w-full sm:w-auto rounded-xl px-10 h-14 font-black uppercase tracking-widest text-[10px]">
                 {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
              </Button>
           </div>
        </form>
     </Card>
           <Card className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white/70 dark:bg-gray-900/50 backdrop-blur-md" hover={false}>
              <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-gray-500 mb-8 flex items-center gap-2">
                 <CreditCard size={14} className="text-emerald-500" /> Datos de Pago
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Phone / Yape / Plin */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-gray-400 mb-4 flex items-center gap-2">
                  <Phone size={13} /> Celular / Billetera Digital
                </p>
                <form onSubmit={savePhone} className="space-y-6">
                   <Input
                     label="Número de celular"
                     placeholder="Ej: 987 654 321"
                     value={phoneForm.telefono}
                     onChange={e => setPhoneForm({ ...phoneForm, telefono: e.target.value })}
                     className="bg-slate-50 dark:bg-gray-800 border-none h-14 px-6 rounded-2xl font-bold"
                   />
                   <div>
                     <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 ml-1 block mb-3">Disponible para</label>
                     <div className="flex bg-slate-100 dark:bg-gray-800 rounded-2xl p-1.5 w-fit gap-1">
                       {[['yape', 'Yape'], ['plin', 'Plin'], ['ambos', 'Ambos']].map(([val, lbl]) => (
                         <button
                           key={val}
                           type="button"
                           onClick={() => setPhoneForm({ ...phoneForm, etiquetas: val })}
                           className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${phoneForm.etiquetas === val ? 'bg-white dark:bg-gray-700 text-emerald-500 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                         >
                           {lbl}
                         </button>
                       ))}
                     </div>
                   </div>
                   <Button type="submit" disabled={savingPay || !phoneForm.telefono.trim()} className="w-full rounded-2xl py-4 h-auto font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-500/20">
                     {savingPay ? 'Guardando...' : phoneMethod ? 'Actualizar Billetera' : 'Guardar Billetera'}
                   </Button>
                 </form>
              </div>

              {/* Bank accounts */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-gray-400 mb-4 flex items-center gap-2">
                  <Building2 size={13} /> Cuentas Bancarias
                </p>

                {/* Existing */}
                <div className="space-y-2 mb-4">
                  {bankMethods.map(m => (
                    <div key={m.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700">
                      <div>
                        <p className="text-xs font-black dark:text-white uppercase tracking-tight">{m.banco || 'Banco'} {m.alias ? <span className="font-normal text-slate-400 normal-case">· {m.alias}</span> : ''}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">{m.numero_cuenta} {m.moneda ? `· ${m.moneda}` : ''}</p>
                      </div>
                      <button onClick={() => deletePayMethod(m.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors rounded-xl hover:bg-rose-500/10">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {showBankForm ? (
                  <form onSubmit={saveBank} className="space-y-3 p-4 bg-slate-50 dark:bg-gray-800/50 rounded-2xl border border-slate-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nueva cuenta</p>
                      <button type="button" onClick={() => setShowBankForm(false)} className="text-slate-400 hover:text-rose-500">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Banco" placeholder="BCP, Interbank..." value={newBank.banco} onChange={e => setNewBank({ ...newBank, banco: e.target.value })} />
                      <Input label="Alias (opcional)" placeholder="Principal, Ahorros..." value={newBank.alias} onChange={e => setNewBank({ ...newBank, alias: e.target.value })} />
                    </div>
                    <Input label="N° de Cuenta" placeholder="123-456789-0-12" value={newBank.numero_cuenta} onChange={e => setNewBank({ ...newBank, numero_cuenta: e.target.value })} />
                    <Input label="CCI (opcional)" placeholder="00312312345678901234" value={newBank.cci} onChange={e => setNewBank({ ...newBank, cci: e.target.value })} />
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-gray-400 ml-1 block mb-2">Moneda</label>
                      <div className="flex bg-slate-100 dark:bg-gray-700 rounded-xl p-1 w-fit">
                        {[['SOL', 'S/. SOL'], ['USD', '$ USD']].map(([val, lbl]) => (
                          <button key={val} type="button" onClick={() => setNewBank({ ...newBank, moneda: val })}
                            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${newBank.moneda === val ? 'bg-white dark:bg-gray-600 text-emerald-600 shadow-sm' : 'text-slate-400'}`}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button type="submit" disabled={savingPay} className="w-full rounded-2xl">
                      {savingPay ? 'Guardando...' : 'Agregar Cuenta'}
                    </Button>
                  </form>
                ) : (
                  <button onClick={() => setShowBankForm(true)} className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 dark:border-gray-700 rounded-2xl text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-all font-black text-xs tracking-widest w-full justify-center">
                    <Plus size={14} /> Agregar Cuenta Bancaria
                  </button>
                )}
              </div>
            </div>
           </Card>
        </section>

        {/* Aside Column */}
        <section className="md:col-span-12 lg:col-span-5 flex flex-col gap-8">
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
      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
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
