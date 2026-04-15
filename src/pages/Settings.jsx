import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import pb from '../lib/pocketbase';
import { Button, Card, Input, StatusModal, Modal } from '../components/UI';
import { User, Camera, Lock, Shield, Smartphone, Globe, Bell, Phone, Building2, Plus, Trash2, X, CreditCard, Check, Sparkles, Zap } from 'lucide-react';
import AvatarCropper from '../components/AvatarCropper';

export default function Settings() {
  const { user, refresh, loading: authLoading } = useAuth();
  const { lang, changeLang, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // Preferences stored in localStorage
  const [notifEnabled, setNotifEnabled] = useState(() => localStorage.getItem('sp_notif_enabled') !== 'false');
  const [pushEnabled, setPushEnabled]   = useState(() => localStorage.getItem('sp_push_enabled') === 'true');
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
      .getFullList({ filter: `user_id = "${user.id}"` })
      .then(records => {
        setPayMethods(records);
        const phone = records.find(m => m.tipo === 'telefono');
        if (phone) {
          setPhoneForm({ telefono: phone.telefono || '', etiquetas: phone.etiquetas || 'yape' });
        }
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
                   <Input
                      label="Nueva Contraseña"
                      type="password"
                      value={passwords.new}
                      onChange={e => setPasswords({...passwords, new: e.target.value})}
                   />
                   <Input
                      label="Confirmar"
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

                <button onClick={() => setShowBankForm(true)} className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 dark:border-gray-800 rounded-2xl text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-all font-black text-xs tracking-widest w-full justify-center group/btn">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-gray-800 flex items-center justify-center text-slate-400 group-hover/btn:bg-emerald-500 group-hover/btn:text-white transition-all">
                    <Plus size={14} />
                  </div>
                  Agregar Cuenta Bancaria
                </button>
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
                 <Button variant="secondary" onClick={() => setShowPremiumModal(true)} className="bg-white text-indigo-600 hover:bg-white/90 border-none">{t('settings.viewSub')}</Button>
              </div>
           </Card>

           <Card className="border-none bg-white/70 dark:bg-gray-900/50 backdrop-blur-md" hover={false}>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-500 mb-6">{t('settings.preferences')}</h3>
              <div className="space-y-2">

                {/* Language */}
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <Globe size={18} className="text-slate-400" />
                    <span className="text-sm font-bold dark:text-white uppercase tracking-tight">{t('settings.language')}</span>
                  </div>
                  <div className="flex bg-slate-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
                    {[['es','ES'],['en','EN']].map(([code, lbl]) => (
                      <button
                        key={code}
                        onClick={() => changeLang(code)}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${lang === code ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >{lbl}</button>
                    ))}
                  </div>
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <Bell size={18} className={notifEnabled ? 'text-emerald-500' : 'text-slate-400'} />
                    <div>
                      <span className="text-sm font-bold dark:text-white uppercase tracking-tight block">{t('settings.notifications')}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{notifEnabled ? t('settings.notifOn') : t('settings.notifOff')}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !notifEnabled;
                      setNotifEnabled(next);
                      localStorage.setItem('sp_notif_enabled', String(next));
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors ${notifEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-gray-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifEnabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>

                {/* Push / App Móvil */}
                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <Smartphone size={18} className={pushEnabled ? 'text-indigo-500' : 'text-slate-400'} />
                    <div>
                      <span className="text-sm font-bold dark:text-white uppercase tracking-tight block">{t('settings.mobileApp')}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{pushEnabled ? t('settings.mobileOn') : t('settings.mobileOff')}</span>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!pushEnabled) {
                        const perm = await Notification.requestPermission();
                        if (perm !== 'granted') return;
                      }
                      const next = !pushEnabled;
                      setPushEnabled(next);
                      localStorage.setItem('sp_push_enabled', String(next));
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors ${pushEnabled ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-gray-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${pushEnabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>

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
      <Modal
        isOpen={showBankForm}
        onClose={() => setShowBankForm(false)}
        title="Nueva Cuenta Bancaria"
      >
        <form onSubmit={saveBank} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input 
              label="Banco" 
              placeholder="BCP, Interbank..." 
              value={newBank.banco} 
              onChange={e => setNewBank({ ...newBank, banco: e.target.value })} 
            />
            <Input 
              label="Alias (opcional)" 
              placeholder="Principal, Ahorros..." 
              value={newBank.alias} 
              onChange={e => setNewBank({ ...newBank, alias: e.target.value })} 
            />
          </div>
          <Input 
            label="Número de Cuenta" 
            placeholder="123-456789-0-12" 
            value={newBank.numero_cuenta} 
            onChange={e => setNewBank({ ...newBank, numero_cuenta: e.target.value })} 
          />
          <Input 
            label="CCI (opcional)" 
            placeholder="003-123-123456789012-34" 
            value={newBank.cci} 
            onChange={e => setNewBank({ ...newBank, cci: e.target.value })} 
          />
          
          <div className="bg-slate-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-slate-100 dark:border-gray-800">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 block mb-3 ml-1">Moneda de la cuenta</label>
            <div className="flex bg-slate-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
              {[['SOL', 'S/. SOL'], ['USD', '$ USD']].map(([val, lbl]) => (
                <button 
                  key={val} 
                  type="button" 
                  onClick={() => setNewBank({ ...newBank, moneda: val })}
                  className={`flex-1 py-3 rounded-lg text-xs font-black transition-all ${
                    newBank.moneda === val 
                      ? 'bg-white dark:bg-gray-700 text-emerald-500 shadow-xl shadow-emerald-500/10' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-gray-300'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              variant="ghost" 
              className="flex-1 rounded-2xl py-4 h-auto font-black uppercase tracking-widest text-[10px] text-slate-400" 
              onClick={() => setShowBankForm(false)}
              type="button"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={savingPay || !newBank.banco.trim() || !newBank.numero_cuenta.trim()} 
              className="flex-[2] rounded-2xl py-4 h-auto font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-500/20"
            >
              {savingPay ? 'Guardando...' : 'Añadir Cuenta'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Premium Modal — rendered via portal to escape stacking context of <main> */}
      {showPremiumModal && createPortal(
        <>
          <style>{`
            @keyframes sp-backdrop { from { opacity:0 } to { opacity:1 } }
            @keyframes sp-card-in {
              from { opacity:0; transform: scale(0.88) translateY(28px); }
              to   { opacity:1; transform: scale(1)    translateY(0);    }
            }
            @keyframes sp-item-in {
              from { opacity:0; transform: translateY(14px); }
              to   { opacity:1; transform: translateY(0);    }
            }
            @keyframes sp-float {
              0%,100% { transform: translateY(0)    rotate(-4deg) scale(1);    }
              50%     { transform: translateY(-10px) rotate( 4deg) scale(1.08); }
            }
            @keyframes sp-orb {
              0%,100% { opacity:.12; transform:scale(1);   }
              50%     { opacity:.28; transform:scale(1.25); }
            }
            .spm-backdrop { animation: sp-backdrop 0.25s ease both; }
            .spm-card     { animation: sp-card-in  0.45s cubic-bezier(0.34,1.4,0.64,1) both; }
            .spm-item     { animation: sp-item-in  0.38s ease both; opacity:0; }
            .spm-float    { animation: sp-float    2.8s  ease-in-out infinite; }
            .spm-orb      { animation: sp-orb      4s    ease-in-out infinite; }
          `}</style>

          <div
            className="spm-backdrop absolute inset-0 flex items-start justify-center p-4 py-6 bg-black/75 backdrop-blur-md pointer-events-auto overflow-y-auto"
            onClick={() => setShowPremiumModal(false)}
          >
            <div
              className="spm-card relative max-w-sm w-full my-auto bg-gradient-to-br from-emerald-500 via-teal-600 to-indigo-600 rounded-[3rem] shadow-2xl shadow-emerald-500/30 p-6 md:p-10 text-white overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Orbs */}
              <div className="spm-orb absolute -top-10 -right-10 w-48 h-48 bg-emerald-300 rounded-full blur-3xl pointer-events-none" />
              <div className="spm-orb absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-400 rounded-full blur-3xl pointer-events-none" style={{ animationDelay:'1.6s' }} />

              <button onClick={() => setShowPremiumModal(false)} className="absolute top-6 right-6 p-2 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-colors border border-white/20">
                <X size={15} />
              </button>

              <div className="relative z-10 flex flex-col items-center text-center gap-4">
                {/* Star */}
                <div className="spm-item w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-[1.5rem] md:rounded-[1.8rem] flex items-center justify-center shadow-2xl border border-white/25" style={{ animationDelay:'0ms' }}>
                  <span className="spm-float inline-block">
                    <Sparkles size={38} className="text-yellow-300 drop-shadow-lg" />
                  </span>
                </div>

                {/* Title */}
                <div className="spm-item" style={{ animationDelay:'80ms' }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-2">Early Adopter</p>
                  <h3 className="text-3xl font-black uppercase tracking-tight leading-tight">Premium<br/>Para Siempre</h3>
                </div>

                {/* Description */}
                <p className="spm-item text-sm text-white/80 leading-relaxed font-medium" style={{ animationDelay:'160ms' }}>
                  Gracias por ser uno de los primeros usuarios de{' '}
                  <span className="font-black text-white">SplitPay</span>.
                  Como fundador, tendrás acceso premium de por vida — sin cargos, sin vencimientos.
                </p>

                {/* Staggered features */}
                <div className="w-full space-y-2 pt-1">
                  {['Eventos ilimitados','Chat en tiempo real','Recibos PDF','Gastos colaborativos','Soporte prioritario'].map((f, i) => (
                    <div
                      key={f}
                      className="spm-item flex items-center gap-3 px-4 py-2.5 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20"
                      style={{ animationDelay: `${250 + i * 80}ms` }}
                    >
                      <div className="w-5 h-5 rounded-full bg-emerald-400/40 border border-emerald-200/50 flex items-center justify-center shrink-0">
                        <Check size={11} className="text-emerald-100" />
                      </div>
                      <span className="text-sm font-bold">{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  onClick={() => setShowPremiumModal(false)}
                  className="spm-item w-full py-4 bg-white text-emerald-600 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white/90 active:scale-95 transition-all shadow-xl shadow-black/20 mt-1 flex items-center justify-center gap-2"
                  style={{ animationDelay:'670ms' }}
                >
                  <Zap size={14} className="text-emerald-500" /> Entendido
                </button>
              </div>
            </div>
          </div>
        </>,
        document.getElementById('modal-root') || document.body
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
