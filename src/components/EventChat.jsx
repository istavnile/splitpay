import React, { useState, useEffect, useRef } from 'react';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, X, Send, Trash2 } from 'lucide-react';

function timeStr(dateStr) {
  return new Date(dateStr).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function dateGroup(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function EventChat({ eventId }) {
  const { user } = useAuth();
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [open, setOpen]           = useState(false);
  const [unread, setUnread]       = useState(0);
  const endRef   = useRef(null);
  const inputRef = useRef(null);
  // track last seen count so we can compute new messages while closed
  const lastSeenCount = useRef(0);

  useEffect(() => {
    if (!eventId) return;
    fetchMessages();

    pb.collection('chat_mensajes').subscribe('*', (e) => {
      if (e.record.id_evento !== eventId) return;
      if (e.action === 'create') {
        pb.collection('chat_mensajes')
          .getOne(e.record.id, { expand: 'emisor_id' })
          .then(full => {
            setMessages(prev => {
              const next = [...prev, full];
              if (!open) setUnread(next.length - lastSeenCount.current);
              return next;
            });
          })
          .catch(() => {
            setMessages(prev => {
              const next = [...prev, e.record];
              if (!open) setUnread(next.length - lastSeenCount.current);
              return next;
            });
          });
      } else if (e.action === 'delete') {
        setMessages(prev => prev.filter(m => m.id !== e.record.id));
      }
    }).catch(() => {});

    return () => { pb.collection('chat_mensajes').unsubscribe('*'); };
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
    } catch (_) {}
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

  return (
    <>
      {/* ── Floating panel ────────────────────────────────────────── */}
      {open && (
        <div className="fixed bottom-24 right-5 z-[150] w-[340px] max-w-[calc(100vw-2rem)] flex flex-col rounded-[1.75rem] overflow-hidden shadow-2xl shadow-slate-900/30 border border-slate-100 dark:border-gray-800 animate-in slide-in-from-bottom-4 fade-in duration-200 bg-white dark:bg-gray-950">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-slate-900 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <MessageSquare size={15} className="text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-black text-white uppercase tracking-tight leading-none">Chat</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{messages.length} mensajes</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 h-72 overflow-y-auto px-4 py-3 space-y-1 scroll-smooth">
            {loading ? (
              <div className="flex items-center justify-center h-full opacity-40">
                <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
                <MessageSquare size={30} className="text-slate-300" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Sin mensajes. ¡Saluda!
                </p>
              </div>
            ) : (
              items.map(item => {
                if (item.type === 'date') {
                  return (
                    <div key={item.key} className="flex items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-slate-100 dark:bg-gray-800" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-gray-600 whitespace-nowrap">
                        {item.label}
                      </span>
                      <div className="flex-1 h-px bg-slate-100 dark:bg-gray-800" />
                    </div>
                  );
                }

                const isMe       = item.emisor_id === user?.id;
                const senderName = item.expand?.emisor_id?.name
                  || item.expand?.emisor_id?.email?.split('@')[0]
                  || 'Alguien';

                return (
                  <div key={item.id} className={`group flex gap-2 items-end ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!isMe && (
                      <div className="w-6 h-6 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center font-black text-[10px] shrink-0 mb-0.5">
                        {senderName[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && (
                        <span className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-wide px-1">
                          {senderName}
                        </span>
                      )}
                      <div className="relative flex items-end gap-1">
                        {isMe && (
                          <button
                            onClick={() => deleteMessage(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-400 transition-all shrink-0 mb-0.5"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                        <div className={`px-3.5 py-2 text-[13px] font-semibold leading-snug break-words ${
                          isMe
                            ? 'bg-emerald-500 text-white rounded-2xl rounded-br-sm'
                            : 'bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-white rounded-2xl rounded-bl-sm'
                        }`}>
                          {item.contenido}
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-300 dark:text-gray-600 px-1">
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
          <div className="px-4 py-3 border-t border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-950">
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(e); }}
                placeholder="Escribe un mensaje..."
                maxLength={500}
                className="flex-1 bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-2xl px-4 py-2.5 text-[13px] font-semibold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center transition-all active:scale-95 shrink-0 self-end"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── FAB button ────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-5 right-5 z-[150] w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all active:scale-95 hover:scale-105 ${
          open
            ? 'bg-slate-900 dark:bg-gray-800 text-white'
            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30'
        }`}
      >
        {open ? <X size={22} /> : <MessageSquare size={22} />}
        {!open && unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-rose-500 text-white rounded-full text-[10px] font-black flex items-center justify-center shadow-lg">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </>
  );
}
