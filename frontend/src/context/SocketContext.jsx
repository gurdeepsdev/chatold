import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children, token }) => {
  const socketRef    = useRef(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});

  // event → Set<handler> — survives reconnects
  const listenersRef  = useRef({});
  // groups to join once connected
  const pendingJoins  = useRef(new Set());
  // all groups ever joined (so we can rejoin after reconnect)
  const activeGroups  = useRef(new Set());

  const reattach = useCallback((socket) => {
    Object.entries(listenersRef.current).forEach(([ev, handlers]) => {
      handlers.forEach(h => { socket.off(ev, h); socket.on(ev, h); });
    });
  }, []);

  const rejoin = useCallback((socket) => {
    activeGroups.current.forEach(gid => socket.emit('join_group', gid));
    pendingJoins.current.forEach(gid => {
      socket.emit('join_group', gid);
      activeGroups.current.add(gid);
    });
    pendingJoins.current.clear();
  }, []);

  useEffect(() => {
    if (!token) return;

    // Extract the base URL without /api for Socket.IO connection
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5500';
    const socketUrl = apiUrl.replace('/api', '');

    console.log('[Socket] Connecting to:', socketUrl);
    console.log('[Socket] API URL:', apiUrl);

    // const socket = io(socketUrl, {
    //   auth: { token },
    //   reconnectionAttempts: Infinity,
    //   reconnectionDelay: 1000,
    //   reconnectionDelayMax: 5000,
    //   transports: ['websocket', 'polling'],
    //   // Add production-specific options
    //   forceNew: true,
    //   secure: true,
    // });
    const socket = io(socketUrl, {
  auth: { token },
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ['websocket', 'polling'],
  forceNew: true
});
socket.on('connect', () => {
  setConnected(true);
  console.log('🔍 [Socket] connected with ID:', socket.id);
  console.log('🔍 [Socket] User ID from token:', socket.user?.id);
  console.log('🔍 [Socket] Socket available for events:', !!socket);
  reattach(socket);
  rejoin(socket);
});

socket.on('connect_error', err => {
  console.error('🔍 [Socket] Connection error:', err);
  console.error('🔍 [Socket] Error details:', err.message);
});

    socket.on('task_assigned', (data) => {
      console.log('[Socket] task_assigned event received:', data);
    });

    socket.on('task_update', (data) => {
      console.log('[Socket] task_update event received:', data);
    });

    socket.on('message_deleted', (data) => {
      console.log('[Socket] message_deleted event received:', data);
    });

    socket.on('campaign_created', (data) => {
      console.log('🔍 [SocketContext] campaign_created event received:', data);
    });
    socket.on('disconnect', reason => {
      setConnected(false);
      console.log('[Socket] disconnected:', reason);
    });

    socket.on('connect_error', err => console.warn('[Socket] error:', err.message));

    socket.on('user_status', ({ user_id, is_online }) =>
      setOnlineUsers(prev => ({ ...prev, [user_id]: is_online }))
    );

    socketRef.current = socket;
    return () => { socket.removeAllListeners(); socket.disconnect(); socketRef.current = null; };
  }, [token, reattach, rejoin]);

  // Stable on() — stores handler AND attaches to live socket; returns unsub fn
  const on = useCallback((event, handler) => {
    if (!listenersRef.current[event]) listenersRef.current[event] = new Set();
    listenersRef.current[event].add(handler);
    const s = socketRef.current;
    if (s) { s.off(event, handler); s.on(event, handler); }
    return () => {
      listenersRef.current[event]?.delete(handler);
      socketRef.current?.off(event, handler);
    };
  }, []);

  // joinGroup is safe to call at any time — queues if socket not ready
  const joinGroup = useCallback((groupId) => {
    const id = Number(groupId);
    activeGroups.current.add(id);
    if (socketRef.current?.connected) socketRef.current.emit('join_group', id);
    else pendingJoins.current.add(id);
  }, []);

  const sendTyping = useCallback((groupId, isTyping) =>
    socketRef.current?.emit('typing', { groupId: Number(groupId), isTyping }), []);

  // markSeen — fire and forget, no need to be reactive
  const markSeen = useCallback((messageId, groupId) =>
    socketRef.current?.emit('message_seen', { messageId, groupId: Number(groupId) }), []);

  const emit = useCallback((ev, data) => socketRef.current?.emit(ev, data), []);

  return (
    <SocketContext.Provider value={{ connected, onlineUsers, joinGroup, sendTyping, markSeen, on, emit, socket: socketRef }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
export default SocketContext;
