import React, { useState, useEffect, useRef } from 'react';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { MessageSquare, X, Send, Trash2, AlertCircle } from 'lucide-react';

// PocketBase returns "2026-04-10 12:34:56.789Z" — space instead of T
// Safari and Firefox don't parse that format, so we normalise it first.
function pbDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  return new Date(dateStr.replace(' ', 'T'));
}

function timeStr(dateStr) {
  const d = pbDate(dateStr);
  if (isNaN(d)) return '';
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function dateGroup(dateStr) {
  const d = pbDate(dateStr);
  if (isNaN(d)) return '';
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function EventChat({ eventId }) {
  const { user } = useAuth();
  const { fireBrowserNotif } = useNotifications();
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [open, setOpen]           = useState(false);
  const [unread, setUnread]       = useState(0);
  const [height, setHeight]       = useState(450);
  const [fetchError, setFetchError] = useState(false);
  const endRef   = useRef(null);
  const inputRef = useRef(null);
  const isResizing = useRef(false);
  // track last seen count so we can compute new messages while closed
  const lastSeenCount = useRef(0);

  useEffect(() => {
    if (!eventId) return;
    fetchMessages();

    // Using '*' (wildcard) is the most robust way to subscribe to collection changes
    // as it works across all PocketBase versions without requiring custom topics.
    pb.collection('chat_mensajes').subscribe('*', (e) => {
      // Client-side filtering to only react to messages for THIS event
      if (e.record.id_evento !== eventId) return;

      if (e.action === 'create') {
        pb.collection('chat_mensajes')
          .getOne(e.record.id, { expand: 'emisor_id' })
          .then(full => {
            setMessages(prev => {
              if (prev.some(m => m.id === full.id)) return prev;
              const next = [...prev, full];
              if (!open) {
                setUnread(next.length - lastSeenCount.current);
                // Browser notification for messages from others
                if (full.emisor_id !== user?.id) {
                  const sender = full.expand?.emisor_id?.name || 'Alguien';
                  fireBrowserNotif(`💬 ${sender}`, full.contenido || '...');
                }
              }
              return next;
            });
          })
          .catch(() => {
            setMessages(prev => {
              if (prev.some(m => m.id === e.record.id)) return prev;
              const next = [...prev, e.record];
              if (!open) setUnread(next.length - lastSeenCount.current);
              return next;
            });
          });
      } else if (e.action === 'delete') {
        setMessages(prev => prev.filter(m => m.id !== e.record.id));
      }
    }).catch(err => {
      console.error('Error subscribing to chat:', err);
    });

    return () => {
      try {
        pb.collection('chat_mensajes').unsubscribe('*');
      } catch (e) {}
    };
  }, [eventId]);

  // Scroll to bottom & clear unread when opened
  useEffect(() => {
    if (open) {
      lastSeenCount.current = messages.length;
      setUnread(0);
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 60);
    }
  }, [open, messages.length]);

  const fetchMessages = async () => {
    try {
      const records = await pb.collection('chat_mensajes').getFullList({
        filter: `id_evento = "${eventId}"`,
        sort: 'created',
        expand: 'emisor_id',
      });
      setMessages(records);
      lastSeenCount.current = records.length;
      setFetchError(false);
    } catch (err) {
      console.error('chat_mensajes fetch error:', err);
      setFetchError(true);
    }
    setLoading(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try {
      await pb.collection('chat_mensajes').create({
        id_evento: eventId,
        emisor_id: user.id,
        contenido: text,
      });
    } catch (_) { setInput(text); }
    setSending(false);
    inputRef.current?.focus();
  };

  const deleteMessage = async (msgId) => {
    try { await pb.collection('chat_mensajes').delete(msgId); } catch (_) {}
  };

  // Build grouped items
  const items = [];
  let lastDate = null;
  messages.forEach(msg => {
    const dg = dateGroup(msg.created);
    if (dg !== lastDate) {
      items.push({ type: 'date', key: `d-${msg.id}`, label: dg });
      lastDate = dg;
    }
    items.push({ type: 'msg', ...msg });
  });

  // Resize logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      // Chat is fixed at bottom-24 (96px). clientHeight is roughly window.innerHeight - clientY - 96
      const newHeight = window.innerHeight - e.clientY - 80; 
      setHeight(Math.max(300, Math.min(window.innerHeight * 0.8, newHeight)));
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizing = (e) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <>
      {/* ── Floating panel ────────────────────────────────────────── */}
      {open && (
        <div 
          className="fixed bottom-24 right-5 z-[150] w-[340px] max-w-[calc(100vw-2rem)] flex flex-col rounded-[2.5rem] overflow-hidden shadow-[0_30px_90px_-20px_rgba(0,0,0,0.5)] border border-white/10 animate-in slide-in-from-bottom-4 fade-in duration-200 bg-white dark:bg-gray-950"
          style={{ height: `${height}px` }}
        >
          {/* Resize Handle (Top Bar) */}
          <div 
            onMouseDown={startResizing}
            className="absolute top-0 left-0 w-full h-4 cursor-ns-resize flex items-center justify-center group z-[160]"
          >
            <div className="w-10 h-1 bg-slate-200 dark:bg-gray-800 rounded-full group-hover:bg-violet-500 transition-colors mt-2" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 bg-slate-900 dark:bg-gray-900 pt-7">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                <MessageSquare size={16} className="text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-black text-white uppercase tracking-tight leading-none">Chat</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1.5">{messages.length} mensajes</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5 scroll-smooth">
            {loading ? (
              <div className="flex items-center justify-center h-full opacity-40">
                <div className="w-6 h-6 border-3 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : fetchError ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center">
                  <AlertCircle size={24} className="text-rose-400" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-rose-400">
                  Colección no disponible
                </p>
                <p className="text-[9px] text-slate-400 dark:text-gray-600 leading-relaxed">
                  Crea la colección <code className="text-violet-400">chat_mensajes</code> en PocketBase con los campos:<br/>
                  <span className="text-slate-300 dark:text-gray-500">id_evento (relation), emisor_id (relation), contenido (text)</span>
                </p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 opacity-30">
                <div className="w-16 h-16 rounded-[2rem] bg-slate-100 dark:bg-gray-900 flex items-center justify-center">
                  <MessageSquare size={32} className="text-slate-300" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
                  Sin mensajes.<br/>Saluda a tu comunidad.
                </p>
              </div>
            ) : (
              items.map(item => {
                if (item.type === 'date') {
                  return (
                    <div key={item.key} className="flex items-center gap-3 py-4">
                      <div className="flex-1 h-px bg-slate-50 dark:bg-gray-900" />
                      <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-300 dark:text-gray-700 whitespace-nowrap">
                        {item.label}
                      </span>
                      <div className="flex-1 h-px bg-slate-50 dark:bg-gray-900" />
                    </div>
                  );
                }

                const isMe       = item.emisor_id === user?.id;
                const senderName = item.expand?.emisor_id?.name
                  || item.expand?.emisor_id?.email?.split('@')[0]
                  || 'Alguien';

                return (
                  <div key={item.id} className={`group flex gap-3 items-end mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!isMe && (
                      <div className="w-7 h-7 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center font-black text-[11px] shrink-0 mb-1 border border-violet-500/5">
                        {senderName[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className={`max-w-[80%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && (
                        <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-wide px-2">
                          {senderName}
                        </span>
                      )}
                      <div className="relative flex items-center gap-2">
                        {isMe && (
                          <button
                            onClick={() => deleteMessage(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        <div className={`px-4 py-2.5 text-[13.5px] font-semibold leading-relaxed break-words shadow-sm ${
                          isMe
                            ? 'bg-emerald-500 text-white rounded-[1.25rem] rounded-br-[0.25rem]'
                            : 'bg-slate-50 dark:bg-gray-900 text-slate-800 dark:text-gray-100 rounded-[1.25rem] rounded-bl-[0.25rem] border border-slate-100 dark:border-white/5'
                        }`}>
                          {item.contenido}
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-300 dark:text-gray-700 px-2 font-black uppercase tracking-widest">
                        {timeStr(item.created)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="px-5 py-4 border-t border-slate-100 dark:border-gray-900 bg-white/50 dark:bg-gray-950/50 backdrop-blur-xl">
            <form onSubmit={sendMessage} className="flex gap-2.5 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(100, e.target.scrollHeight)}px`;
                  }}
                  onKeyDown={e => { 
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(e);
                      e.target.style.height = '42px';
                    } 
                  }}
                  placeholder="Escribe un mensaje..."
                  maxLength={500}
                  className="w-full bg-slate-50 dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl px-5 py-3 text-[14px] font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all resize-none overflow-hidden block h-[42px]"
                />
              </div>
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="w-11 h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center transition-all shadow-lg shadow-emerald-500/20 active:scale-90 shrink-0 mb-0.5"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── FAB button ────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-5 right-5 z-[150] h-14 px-4 lg:px-5 rounded-2xl shadow-2xl flex items-center gap-2.5 transition-all active:scale-95 hover:scale-105 ${
          open
            ? 'bg-slate-900 dark:bg-gray-800 text-white'
            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30'
        }`}
      >
        {open ? <X size={22} /> : <MessageSquare size={22} />}
        {!open && (
          <span className="hidden lg:block text-[11px] font-black uppercase tracking-widest whitespace-nowrap">
            Chatea ahora
          </span>
        )}
        {!open && unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-rose-500 text-white rounded-full text-[10px] font-black flex items-center justify-center shadow-lg">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </>
  );
}
