// import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
// import { io } from 'socket.io-client';

// const SocketContext = createContext(null);

// export const SocketProvider = ({ children, token }) => {
//   const socketRef    = useRef(null);
//   const [connected, setConnected] = useState(false);
//   const [onlineUsers, setOnlineUsers] = useState({});

//   // event → Set<handler> — survives reconnects
//   const listenersRef  = useRef({});
//   // groups to join once connected
//   const pendingJoins  = useRef(new Set());
//   // all groups ever joined (so we can rejoin after reconnect)
//   const activeGroups  = useRef(new Set());

//   const reattach = useCallback((socket) => {
//     Object.entries(listenersRef.current).forEach(([ev, handlers]) => {
//       handlers.forEach(h => { socket.off(ev, h); socket.on(ev, h); });
//     });
//   }, []);

//   const rejoin = useCallback((socket) => {
//     activeGroups.current.forEach(gid => socket.emit('join_group', gid));
//     pendingJoins.current.forEach(gid => {
//       socket.emit('join_group', gid);
//       activeGroups.current.add(gid);
//     });
//     pendingJoins.current.clear();
//   }, []);

//   useEffect(() => {
//     if (!token) return;

//     // Use environment variable for API URL
//     const apiUrl = process.env.REACT_APP_API_URL;
//     const socketUrl = apiUrl.replace('/api', '');



//     //   auth: { token },
//     //   reconnectionAttempts: Infinity,
//     //   reconnectionDelay: 1000,
//     //   reconnectionDelayMax: 5000,
//     //   transports: ['websocket', 'polling'],
//     //   // Add production-specific options
//     //   forceNew: true,
//     //   secure: true,
//     // });
//     const socket = io(socketUrl, {
//   auth: { token },
//   reconnectionAttempts: Infinity,
//   reconnectionDelay: 1000,
//   reconnectionDelayMax: 5000,
//   transports: ['websocket', 'polling'],
//   forceNew: true
// });
// socket.on('connect', () => {
//   setConnected(true);

//   reattach(socket);
//   rejoin(socket);
// });

// socket.on('connect_error', err => {

// });

//     socket.on('task_assigned', (data) => {
//     });

//     socket.on('task_update', (data) => {
//     });

//     socket.on('message_deleted', (data) => {
//     });

//     socket.on('campaign_created', (data) => {
//     });
//     socket.on('disconnect', reason => {
//       setConnected(false);
//     });

//     socket.on('connect_error', err => console.warn('[Socket] error:', err.message));

//     socket.on('user_status', ({ user_id, is_online }) =>
//       setOnlineUsers(prev => ({ ...prev, [user_id]: is_online }))
//     );

//     socketRef.current = socket;
//     return () => { socket.removeAllListeners(); socket.disconnect(); socketRef.current = null; };
//   }, [token, reattach, rejoin]);

//   // Stable on() — stores handler AND attaches to live socket; returns unsub fn
//   const on = useCallback((event, handler) => {
//     if (!listenersRef.current[event]) listenersRef.current[event] = new Set();
//     listenersRef.current[event].add(handler);
//     const s = socketRef.current;
//     if (s) { s.off(event, handler); s.on(event, handler); }
//     return () => {
//       listenersRef.current[event]?.delete(handler);
//       socketRef.current?.off(event, handler);
//     };
//   }, []);

//   // joinGroup is safe to call at any time — queues if socket not ready
//   const joinGroup = useCallback((groupId) => {
//     const id = Number(groupId);
//     activeGroups.current.add(id);
//     if (socketRef.current?.connected) socketRef.current.emit('join_group', id);
//     else pendingJoins.current.add(id);
//   }, []);

//   const sendTyping = useCallback((groupId, isTyping) =>
//     socketRef.current?.emit('typing', { groupId: Number(groupId), isTyping }), []);

//   // markSeen — fire and forget, no need to be reactive
//   const markSeen = useCallback((messageId, groupId) =>
//     socketRef.current?.emit('message_seen', { messageId, groupId: Number(groupId) }), []);

//   const emit = useCallback((ev, data) => socketRef.current?.emit(ev, data), []);

//   return (
//     <SocketContext.Provider value={{ connected, onlineUsers, joinGroup, sendTyping, markSeen, on, emit, socket: socketRef }}>
//       {children}
//     </SocketContext.Provider>
//   );
// };

// export const useSocket = () => useContext(SocketContext);
// export default SocketContext;

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children, token }) => {
  const socketRef   = useRef(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});

  // event → Set<handler> — survives reconnects
  const listenersRef = useRef({});
  // groups to join once connected
  const pendingJoins = useRef(new Set());
  // all groups the user is currently a member of (used to rejoin on reconnect)
  // FIX: must be kept in sync when the user is removed from a group, otherwise
  // rejoin() re-subscribes them to rooms they no longer belong to — causing
  // ghost membership and events arriving after removal.
  const activeGroups = useRef(new Set());

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

    const apiUrl = process.env.REACT_APP_API_URL;
    const socketUrl = apiUrl.replace('/api', '');

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
      reattach(socket);
      rejoin(socket);
    });

    socket.on('disconnect', reason => {
      setConnected(false);
    });

    socket.on('connect_error', err => console.warn('[Socket] error:', err.message));

    socket.on('user_status', ({ user_id, is_online }) =>
      setOnlineUsers(prev => ({ ...prev, [user_id]: is_online }))
    );

    // FIX: Removed the empty no-op stub handlers that were registered here for
    // 'task_assigned', 'task_update', 'message_deleted', 'campaign_created'.
    // Socket.IO fires listeners in registration order — those stubs were
    // intercepting events before component-level on() handlers could see them
    // in some socket.io versions. All real handling belongs in component effects
    // via the on() API below, not here in the provider.

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

  // joinGroup — queues if socket not ready, tracks in activeGroups for rejoin
  const joinGroup = useCallback((groupId) => {
    const id = Number(groupId);
    activeGroups.current.add(id);
    if (socketRef.current?.connected) socketRef.current.emit('join_group', id);
    else pendingJoins.current.add(id);
  }, []);

  // leaveGroup — FIX: removes group from activeGroups so reconnect does NOT
  // re-subscribe the user to a room they were removed from. Without this, the
  // first removal works but on the next socket reconnect the user silently
  // rejoins the room and starts receiving events again (ghost membership).
  const leaveGroup = useCallback((groupId) => {
    const id = Number(groupId);
    activeGroups.current.delete(id);
    pendingJoins.current.delete(id);
    // No socket leave_group emit needed — the backend removes DB membership,
    // and the socket room is ephemeral per-connection. On next reconnect
    // the backend's join_group handler will reject them via DB membership check.
  }, []);

  const sendTyping = useCallback((groupId, isTyping) =>
    socketRef.current?.emit('typing', { groupId: Number(groupId), isTyping }), []);

  const markSeen = useCallback((messageId, groupId) =>
    socketRef.current?.emit('message_seen', { messageId, groupId: Number(groupId) }), []);

  const emit = useCallback((ev, data) => socketRef.current?.emit(ev, data), []);

  return (
    <SocketContext.Provider value={{ connected, onlineUsers, joinGroup, leaveGroup, sendTyping, markSeen, on, emit, socket: socketRef }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
export default SocketContext;
