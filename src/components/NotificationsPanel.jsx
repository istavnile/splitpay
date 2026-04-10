import React, { useState } from 'react';
import { Bell, X, Check, CheckCheck, Trash2, ArrowRightLeft, Upload, RefreshCw, MessageCircle, CreditCard } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';
import { useNavigate } from 'react-router-dom';

const TIPO_META = {
  gastos_subidos:      { icon: Upload,         color: 'text-blue-500',    bg: 'bg-blue-500/10',    label: 'Subió sus gastos' },
  gastos_actualizados: { icon: RefreshCw,       color: 'text-amber-500',   bg: 'bg-amber-500/10',   label: 'Actualizó los gastos' },
  listo:               { icon: Check,           color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: '¡Todo listo!' },
  pago_confirmado:     { icon: CreditCard,      color: 'text-purple-500',  bg: 'bg-purple-500/10',  label: 'Confirmó su pago' },
  mensaje:             { icon: MessageCircle,   color: 'text-slate-500',   bg: 'bg-slate-500/10',   label: 'Mensaje' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/50 hover:text-emerald-600 dark:hover:text-emerald-400 group w-full"
      >
        <Bell size={20} className="group-hover:scale-110 transition-transform" />
        <span className="text-sm tracking-wide">Notificaciones</span>
        {unreadCount > 0 && (
          <span className="ml-auto min-w-[20px] h-5 px-1 bg-emerald-500 text-white rounded-full text-[10px] font-black flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationsDrawer onClose={() => setOpen(false)} />}
    </>
  );
}

export function MobileNotificationBell() {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 text-slate-500 dark:text-gray-400 hover:text-emerald-600 transition-colors"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 text-white rounded-full text-[9px] font-black flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationsDrawer onClose={() => setOpen(false)} />}
    </>
  );
}

function NotificationsDrawer({ onClose }) {
  const { notifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();

  const handleClick = async (notif) => {
    if (!notif.leido) await markAsRead(notif.id);
    const eventoId = notif.id_evento || notif.expand?.id_evento?.id;
    if (eventoId) {
      navigate(`/event/${eventoId}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Panel */}
      <div
        className="relative w-full max-w-sm h-full bg-white dark:bg-gray-950 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-gray-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Bell size={18} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="font-black dark:text-white text-sm uppercase tracking-widest">Notificaciones</h2>
              <p className="text-[10px] text-slate-400 dark:text-gray-500 font-bold">
                {notifications.filter(n => !n.leido).length} sin leer
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some(n => !n.leido) && (
              <button
                onClick={markAllAsRead}
                title="Marcar todo como leído"
                className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all"
              >
                <CheckCheck size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
              <Bell size={40} className="text-slate-300" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sin notificaciones</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {notifications.map(notif => {
                const meta = TIPO_META[notif.tipo] || TIPO_META.mensaje;
                const Icon = meta.icon;
                const senderName = notif.expand?.emisor_id?.name || notif.expand?.emisor_id?.email?.split('@')[0] || 'Alguien';
                const eventName = notif.expand?.id_evento?.nombre_evento;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`group relative flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] ${
                      notif.leido
                        ? 'bg-slate-50 dark:bg-gray-900/50 border-slate-100 dark:border-gray-800 opacity-60 hover:opacity-100'
                        : 'bg-white dark:bg-gray-900 border-emerald-500/20 shadow-sm shadow-emerald-500/5'
                    }`}
                  >
                    {/* Unread dot */}
                    {!notif.leido && (
                      <span className="absolute top-3 right-10 w-2 h-2 bg-emerald-500 rounded-full" />
                    )}

                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center shrink-0`}>
                      <Icon size={16} className={meta.color} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black dark:text-white leading-snug">
                        <span className="text-emerald-600 dark:text-emerald-400">{senderName}</span>{' '}
                        {notif.contenido}
                      </p>
                      {eventName && (
                        <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 mt-1 uppercase tracking-widest truncate">
                          {eventName}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-300 dark:text-gray-600 mt-1 font-bold">
                        {timeAgo(notif.created)}
                      </p>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={e => { e.stopPropagation(); deleteNotification(notif.id); }}
                      className="p-1.5 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all shrink-0 mt-0.5"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
