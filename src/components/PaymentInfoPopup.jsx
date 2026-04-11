import React, { useState, useEffect } from 'react';
import { X, Phone, Building2, CreditCard, Copy, Check, Shield } from 'lucide-react';
import pb from '../lib/pocketbase';

const TAG_STYLES = {
  yape:   { label: 'Yape',  bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-500/20' },
  plin:   { label: 'Plin',  bg: 'bg-teal-500/10',   text: 'text-teal-600 dark:text-teal-400',     border: 'border-teal-200 dark:border-teal-500/20' },
  ambos:  { label: 'Yape & Plin', bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-500/20' },
};

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="p-1 text-slate-300 hover:text-emerald-500 transition-colors shrink-0" title="Copiar">
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  );
}

export default function PaymentInfoPopup({ userId, name, isUser, email, onClose }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    pb.collection('payment_methods')
      .getFullList({ filter: `user_id = "${userId}"`, sort: 'tipo' })
      .then(rows => setMethods(rows))
      .catch(() => setMethods([]))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleInviteEmail = async () => {
    if (!email) return alert("Este contacto no tiene un correo registrado.");
    setInviting(true);
    try {
      await pb.collection('users').requestVerification(email);
      alert("¡Invitación enviada con éxito!");
    } catch (err) {
      alert("Error al enviar invitación: " + err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleInviteWhatsApp = () => {
    const text = encodeURIComponent(`¡Hola ${name}! 👋 Te invito a usar SplitPay para gestionar nuestros gastos compartidos. Regístrate aquí: ${window.location.origin}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const phones  = methods.filter(m => m.tipo === 'telefono');
  const bancos  = methods.filter(m => m.tipo === 'banco');
  const isEmpty = !loading && phones.length === 0 && bancos.length === 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" />
      <div
        className="relative w-full sm:max-w-md bg-white dark:bg-gray-950 rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-300 overflow-hidden border-t border-white/10"
        onClick={e => e.stopPropagation()}
      >
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 blur-3xl -z-10" />

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-7">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-lg shadow-xl shadow-indigo-500/20">
              {name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-black dark:text-white uppercase tracking-tight leading-none">{name}</p>
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Datos de Transferencia
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all bg-slate-100 dark:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 pb-10 space-y-6 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consultando redes...</p>
            </div>
          ) : !isUser ? (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-20 h-20 bg-slate-100 dark:bg-gray-900 rounded-[2rem] flex items-center justify-center mb-6 text-slate-300 dark:text-gray-700">
                <CreditCard size={40} />
              </div>
              <h3 className="text-xl font-black dark:text-white uppercase tracking-tight mb-2">Contacto Local</h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 font-medium leading-relaxed mb-8 max-w-[240px]">
                Este contacto no está registrado. Invíta a <span className="text-indigo-500 font-bold">{name}</span> para que configure sus datos de pago.
              </p>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button 
                  onClick={handleInviteWhatsApp}
                  className="flex flex-col items-center gap-2 p-5 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-3xl border border-emerald-500/20 hover:bg-emerald-500 hover:text-white group transition-all"
                >
                  <Phone size={24} className="text-emerald-500 group-hover:text-white" />
                  <span className="text-[9px] font-black uppercase tracking-widest">WhatsApp</span>
                </button>
                <button 
                  onClick={handleInviteEmail}
                  disabled={inviting}
                  className="flex flex-col items-center gap-2 p-5 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-3xl border border-indigo-500/20 hover:bg-indigo-500 hover:text-white group transition-all"
                >
                  <X size={24} className="rotate-45 text-indigo-500 group-hover:text-white" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Email Auto</span>
                </button>
              </div>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center text-center py-12">
              <div className="w-16 h-16 bg-slate-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center mb-4 text-slate-200 dark:text-gray-800">
                <CreditCard size={32} />
              </div>
              <p className="text-sm font-black uppercase tracking-widest text-slate-400">
                Sin datos configurados
              </p>
              <p className="text-xs text-slate-500 mt-2 font-bold">El usuario aún no ha agregado métodos de pago.</p>
            </div>
          ) : (
            <>
              {/* Teléfonos */}
              {phones.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-gray-600 mb-4 flex items-center gap-2">
                    <Phone size={12} className="text-emerald-500" /> Celular / Billeteras
                  </p>
                  <div className="space-y-3">
                    {phones.map(m => {
                      const tag = TAG_STYLES[m.etiquetas];
                      return (
                        <div key={m.id} className="group flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-900 rounded-3xl border border-slate-100 dark:border-gray-800 transition-all">
                          <div className="flex flex-col gap-1">
                            <span className="text-lg font-black dark:text-white tracking-tight leading-none">{m.telefono}</span>
                            {tag && (
                              <span className={`text-[9px] font-black uppercase tracking-widest w-fit mt-1`}>
                                {tag.label}
                              </span>
                            )}
                          </div>
                          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                            <CopyBtn text={m.telefono} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bancos */}
              {bancos.length > 0 && (
                <div className="pt-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-gray-600 mb-4 flex items-center gap-2">
                    <Building2 size={12} className="text-indigo-500" /> Cuentas Bancarias
                  </p>
                  <div className="space-y-4">
                    {bancos.map(m => (
                      <div key={m.id} className="px-6 py-5 bg-slate-50 dark:bg-gray-900/50 rounded-[2rem] border border-slate-100 dark:border-gray-800 space-y-4 relative overflow-hidden">
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black dark:text-white uppercase tracking-tight">{m.banco || 'Banco'}</span>
                            {m.alias && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">· {m.alias}</span>}
                          </div>
                          {m.moneda && (
                            <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-widest">
                              {m.moneda}
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-3 relative z-10">
                          {m.numero_cuenta && (
                            <div className="flex items-center justify-between group">
                              <div>
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest opacity-60">N° de Cuenta</p>
                                <p className="text-sm font-black dark:text-white mt-0.5 tracking-tight">{m.numero_cuenta}</p>
                              </div>
                              <CopyBtn text={m.numero_cuenta} />
                            </div>
                          )}
                          {m.cci && (
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/10 group">
                              <div>
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest opacity-60">CCI Interbancario</p>
                                <p className="text-sm font-black dark:text-white mt-0.5 tracking-tight">{m.cci}</p>
                              </div>
                              <CopyBtn text={m.cci} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footnote */}
        <div className="px-8 py-5 bg-slate-50 dark:bg-gray-900/40 border-t border-slate-100 dark:border-gray-800 flex justify-center items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
          SplitPay Shield Protected <Shield size={10} className="text-emerald-500" />
        </div>
      </div>
    </div>
  );
}
