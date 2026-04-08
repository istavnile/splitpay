import React from 'react';

export const Button = ({ children, className = '', variant = 'primary', ...props }) => {
  const variants = {
    primary: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20',
    secondary: 'bg-slate-200 dark:bg-gray-800 hover:bg-slate-300 dark:hover:bg-gray-700 text-slate-900 dark:text-slate-100',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/20',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-400',
  };

  return (
    <button
      className={`px-4 py-2.5 rounded-xl font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Input = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && <label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-gray-400 ml-1">{label}</label>}
      <input
        className={`bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${error ? 'border-rose-500 ring-rose-500/20' : ''}`}
        {...props}
      />
      {error && <span className="text-[10px] text-rose-500 font-bold ml-1 uppercase">{error}</span>}
    </div>
  );
};

export const Card = ({ children, className = '', hover = true }) => {
  return (
    <div className={`glass rounded-2xl p-6 transition-all duration-300 ${hover ? 'hover:-translate-y-1 hover:shadow-2xl' : ''} ${className}`}>
      {children}
    </div>
  );
};

export const Modal = ({ isOpen, onClose, title, children, className = '' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <Card 
        className={`max-w-md w-full animate-in zoom-in-95 duration-200 p-8 border-none shadow-2xl bg-white dark:bg-gray-900 rounded-[2.5rem] relative ${className}`} 
        hover={false}
      >
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-rose-500 transition-colors bg-slate-100 dark:bg-gray-800 rounded-xl"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        {title && (
          <h2 className="text-2xl font-black mb-6 dark:text-white tracking-tighter uppercase leading-none">{title}</h2>
        )}
        {children}
      </Card>
    </div>
  );
};

export const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, type = 'danger' }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-8">
        <p className="text-slate-500 dark:text-gray-400 font-bold leading-relaxed">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            variant={type === 'danger' ? 'danger' : 'primary'} 
            className="flex-1 py-4 h-auto rounded-2xl font-black uppercase tracking-widest text-xs" 
            onClick={() => { onConfirm(); onClose(); }}
          >
            {type === 'danger' ? 'Eliminar Definitivamente' : 'Confirmar'}
          </Button>
          <Button 
            variant="ghost" 
            className="flex-1 py-4 h-auto rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400" 
            onClick={onClose}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
};
