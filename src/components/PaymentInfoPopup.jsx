import React, { useState, useEffect } from 'react';
import { X, Phone, Building2, CreditCard, Copy, Check } from 'lucide-react';
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

export default function PaymentInfoPopup({ userId, name, onClose }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    pb.collection('payment_methods')
      .getFullList({ filter: `user_id = "${userId}"`, sort: 'tipo' })
      .then(rows => setMethods(rows))
      .catch(() => setMethods([]))
      .finally(() => setLoading(false));
  }, [userId]);

  const phones  = methods.filter(m => m.tipo === 'telefono');
  const bancos  = methods.filter(m => m.tipo === 'banco');
  const isEmpty = !loading && phones.length === 0 && bancos.length === 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
      <div
        className="relative w-full sm:max-w-sm bg-white dark:bg-gray-950 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center font-black text-indigo-500 text-sm">
              {name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-black dark:text-white uppercase tracking-tight leading-none">{name}</p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">Datos de pago</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-3 py-8 opacity-40">
              <CreditCard size={32} className="text-slate-300" />
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Sin datos de pago registrados
              </p>
            </div>
          ) : (
            <>
              {/* Teléfonos */}
              {phones.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-3 flex items-center gap-1.5">
                    <Phone size={11} /> Celular / Billeteras
                  </p>
                  <div className="space-y-2">
                    {phones.map(m => {
                      const tag = TAG_STYLES[m.etiquetas];
                      return (
                        <div key={m.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-800">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black dark:text-white tracking-tight">{m.telefono}</span>
                            {tag && (
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${tag.bg} ${tag.text} ${tag.border}`}>
                                {tag.label}
                              </span>
                            )}
                          </div>
                          <CopyBtn text={m.telefono} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bancos */}
              {bancos.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-3 flex items-center gap-1.5">
                    <Building2 size={11} /> Cuentas Bancarias
                  </p>
                  <div className="space-y-3">
                    {bancos.map(m => (
                      <div key={m.id} className="px-4 py-3 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black dark:text-white uppercase tracking-tight">{m.banco || 'Banco'}</span>
                          <div className="flex items-center gap-1.5">
                            {m.alias && (
                              <span className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase">{m.alias}</span>
                            )}
                            {m.moneda && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 uppercase">
                                {m.moneda}
                              </span>
                            )}
                          </div>
                        </div>
                        {m.numero_cuenta && (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">N° Cuenta</p>
                              <p className="text-xs font-bold dark:text-white mt-0.5">{m.numero_cuenta}</p>
                            </div>
                            <CopyBtn text={m.numero_cuenta} />
                          </div>
                        )}
                        {m.cci && (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">CCI</p>
                              <p className="text-xs font-bold dark:text-white mt-0.5">{m.cci}</p>
                            </div>
                            <CopyBtn text={m.cci} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
