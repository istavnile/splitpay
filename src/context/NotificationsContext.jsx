import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import pb from '../lib/pocketbase';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fireBrowserNotif = useCallback((title, body) => {
    if (localStorage.getItem('sp_push_enabled') !== 'true') return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        body,
        icon: '/icon.png',
        badge: '/favicon.png',
        tag: 'splitpay-notif',
      });
    } catch (_) {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const records = await pb.collection('mensajes').getFullList({
        filter: `receptor_id = "${user.id}"`,
        sort: '-created',
        expand: 'emisor_id,id_evento',
      });
      setNotifications(records);
      setUnreadCount(records.filter(r => !r.leido).length);
    } catch (_) {}
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotifications();

    pb.collection('mensajes').subscribe('*', (e) => {
      if (e.record.receptor_id !== user.id && e.record.emisor_id !== user.id) return;
      fetchNotifications();
      // Browser push notification for incoming messages
      if (e.action === 'create' && e.record.receptor_id === user.id) {
        if (localStorage.getItem('sp_notif_enabled') !== 'false') {
          const senderName = e.record.expand?.emisor_id?.name || 'SplitPay';
          const body = e.record.contenido || 'Tienes un nuevo mensaje';
          fireBrowserNotif(`📩 ${senderName}`, body);
        }
      }
    }).catch(() => {});

    return () => {
      pb.collection('mensajes').unsubscribe('*');
    };
  }, [user, fetchNotifications]);

  const sendMessage = async (receptorId, tipo, contenido, idEvento = null) => {
    if (!user || receptorId === user.id) return;
    try {
      await pb.collection('mensajes').create({
        ...(idEvento ? { id_evento: idEvento } : {}),
        emisor_id: user.id,
        receptor_id: receptorId,
        tipo,
        contenido,
        leido: false,
      });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const markAsRead = async (notifId) => {
    try {
      await pb.collection('mensajes').update(notifId, { leido: true });
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, leido: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (_) {}
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.leido);
    await Promise.all(unread.map(n =>
      pb.collection('mensajes').update(n.id, { leido: true }).catch(() => {})
    ));
    setNotifications(prev => prev.map(n => ({ ...n, leido: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (notifId) => {
    try {
      await pb.collection('mensajes').delete(notifId);
      const notif = notifications.find(n => n.id === notifId);
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      if (notif && !notif.leido) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (_) {}
  };

  return (
    <NotificationsContext.Provider value={{
      notifications,
      unreadCount,
      sendMessage,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      refresh: fetchNotifications,
      fireBrowserNotif,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
