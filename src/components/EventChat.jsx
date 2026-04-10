import React, { useState, useEffect, useRef } from 'react';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import { Send, MessageSquare, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!eventId) return;
    fetchMessages();

    pb.collection('chat_mensajes').subscribe('*', (e) => {
      if (e.record.id_evento !== eventId) return;
      if (e.action === 'create') {
        // Expand manually since realtime doesn't expand
        pb.collection('chat_mensajes').getOne(e.record.id, { expand: 'emisor_id' })
          .then(full => setMessages(prev => [...prev, full]))
          .catch(() => setMessages(prev => [...prev, e.record]));
      } else if (e.action === 'delete') {
        setMessages(prev => prev.filter(m => m.id !== e.record.id));
      }
    }).catch(() => {});

    return () => { pb.collection('chat_mensajes').unsubscribe('*'); };
  }, [eventId]);

  // Scroll to bottom when messages change or panel opens
  useEffect(() => {
    if (!collapsed) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [messages, collapsed]);

  const fetchMessages = async () => {
    try {
      const records = await pb.collection('chat_mensajes').getFullList({
        filter: `id_evento = "${eventId}"`,
        sort: 'created',
        expand: 'emisor_id',
      });
      setMessages(records);
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
    } catch (_) {
      setInput(text); // restore on error
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const deleteMessage = async (msgId) => {
    try {
      await pb.collection('chat_mensajes').delete(msgId);
    } catch (_) {}
  };

  // Build grouped items (date separators + messages)
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

  const unread = messages.length;

  return (
    <div className="border-none shadow-sm dark:bg-gray-900/50 bg-white dark:bg-gray-900 rounded-[2rem] overflow-hidden">
      {/* Header / Toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-4 md:px-6 md:py-5 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <h3 className="text-xs font-black dark:text-white tracking-tight flex items-center gap-2.5 uppercase">
          <div className="w-7 h-7 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <MessageSquare className="text-violet-500" size={14} />
          </div>
          Chat del Evento
          {unread > 0 && (
            <span className="px-2 py-0.5 bg-violet-500/10 text-violet-500 rounded-full text-[10px] font-black">
              {unread}
            </span>
          )}
        </h3>
        {collapsed
          ? <ChevronDown size={16} className="text-slate-400" />
          : <ChevronUp   size={16} className="text-slate-400" />}
      </button>

      {!collapsed && (
        <>
          {/* Messages list */}
          <div className="h-80 overflow-y-auto px-4 md:px-5 pb-3 space-y-1 scroll-smooth">
            {loading ? (
              <div className="flex items-center justify-center h-full opacity-40">
                <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
                <MessageSquare size={34} className="text-slate-300" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Sin mensajes todavía. ¡Saluda!
                </p>
              </div>
            ) : (
              items.map(item => {
                if (item.type === 'date') {
                  return (
                    <div key={item.key} className="flex items-center gap-3 py-3">
                      <div className="flex-1 h-px bg-slate-100 dark:bg-gray-800" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-gray-600 whitespace-nowrap">
                        {item.label}
                      </span>
                      <div className="flex-1 h-px bg-slate-100 dark:bg-gray-800" />
                    </div>
                  );
                }

                const isMe        = item.emisor_id === user.id;
                const senderName  = item.expand?.emisor_id?.name
                  || item.expand?.emisor_id?.email?.split('@')[0]
                  || 'Alguien';
                const initial     = senderName[0]?.toUpperCase() || '?';

                return (
                  <div
                    key={item.id}
                    className={`group flex gap-2 items-end ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Avatar (others only) */}
                    {!isMe && (
                      <div className="w-7 h-7 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center font-black text-[10px] shrink-0 mb-1">
                        {initial}
                      </div>
                    )}

                    <div className={`max-w-[72%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                      {/* Sender label (others only) */}
                      {!isMe && (
                        <span className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-wider px-1">
                          {senderName}
                        </span>
                      )}

                      {/* Bubble */}
                      <div className="relative flex items-end gap-1">
                        {/* Delete (own messages, on hover) */}
                        {isMe && (
                          <button
                            onClick={() => deleteMessage(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-400 transition-all shrink-0 mb-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}

                        <div className={`px-4 py-2.5 text-sm font-semibold leading-snug break-words ${
                          isMe
                            ? 'bg-emerald-500 text-white rounded-2xl rounded-br-sm'
                            : 'bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-white rounded-2xl rounded-bl-sm'
                        }`}>
                          {item.contenido}
                        </div>
                      </div>

                      {/* Timestamp */}
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
          <div className="px-4 md:px-5 py-4 border-t border-slate-100 dark:border-gray-800">
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(e); }}
                placeholder="Escribe un mensaje..."
                maxLength={500}
                className="flex-1 bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400/40 transition-all"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="w-10 h-10 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center transition-all active:scale-95 shrink-0 self-end"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
