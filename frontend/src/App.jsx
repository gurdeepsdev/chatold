// import React, { useState, useCallback } from 'react';
// import { Toaster } from 'react-hot-toast';
// import { AuthProvider, useAuth } from './context/AuthContext';
// import { SocketProvider } from './context/SocketContext';
// import { ThemeProvider } from './context/ThemeContext';
// import Sidebar from './components/Sidebar';
// import ChatView from './components/Chat/ChatView';
// import Login from './components/Login';
// import ThemeToggle from './components/ThemeToggle';
// import { PWAInstallButton, useNotifications } from './utils/NotificationManager';
// import './styles/globals.css';

// // Inject keyframe animations
// const styleEl = document.createElement('style');
// styleEl.textContent = `
//   @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.85;transform:scale(1.03)} }
//   @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
// `;
// document.head.appendChild(styleEl);

// // ── Banner asking user to allow notifications ──────────────────────────────
// function NotifPermissionBanner({ permission, onRequest, onDismiss }) {
//   const [dismissed, setDismissed] = useState(false);
//   if (permission !== 'default' || dismissed) return null;
//   return (
//     <div style={{
//       position: 'fixed', bottom: 80, right: 20,
//       background: '#161824', border: '1px solid #2a2f3d',
//       borderLeft: '3px solid #4f7dff', borderRadius: 12,
//       padding: '14px 18px', zIndex: 200, maxWidth: 320,
//       boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
//       display: 'flex', flexDirection: 'column', gap: 10,
//     }}>
//       <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
//         <span style={{ fontSize: 22 }}>🔔</span>
//         <div>
//           <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e5f0' }}>Enable Notifications</div>
//           <div style={{ fontSize: 11, color: '#8b92a5', marginTop: 2 }}>
//             Get notified of new messages, just like WhatsApp
//           </div>
//         </div>
//       </div>
//       <div style={{ display: 'flex', gap: 8 }}>
//         <button
//           onClick={onRequest}
//           style={{ flex: 1, background: '#4f7dff', border: 'none', borderRadius: 7, padding: '7px 12px', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
//         >Allow</button>
//         <button
//           onClick={() => setDismissed(true)}
//           style={{ background: '#1e2129', border: '1px solid #2a2f3d', borderRadius: 7, padding: '7px 12px', color: '#8b92a5', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
//         >Later</button>
//       </div>
//     </div>
//   );
// }

// // ── Inner app — rendered INSIDE SocketProvider so useSocket() works ────────
// function AppInner({ selectedGroup, setSelectedGroup }) {
//   // ✅ useNotifications calls useSocket() — safe here because we're inside SocketProvider
//   const handleGroupNotifClick = useCallback((groupId) => {
//     console.log('Notification clicked, navigate to group:', groupId);
//     // If you want to auto-select the group on notif click, do it here
//   }, []);

//   const { notifPermission, requestPermission } = useNotifications(handleGroupNotifClick);

//   return (
//     <>
//       {/* Theme Toggle */}
//       <ThemeToggle />
      
//       <div className="app-layout">
//         <Sidebar
//           selectedGroupId={selectedGroup?.id}
//           onSelectGroup={setSelectedGroup}
//         />
//         <ChatView group={selectedGroup} />
//       </div>

//       {/* Notification permission banner */}
//       <NotifPermissionBanner permission={notifPermission} onRequest={requestPermission} />

//       {/* PWA install button — bottom-right corner */}
//       <div style={{ position: 'fixed', bottom: 16, right: 20, zIndex: 150 }}>
//         <PWAInstallButton />
//       </div>
//     </>
//   );
// }

// // ── ChatApp: handles auth gate + provides SocketProvider ──────────────────
// function ChatApp() {
//   const { user, token, loading } = useAuth();
//   const [selectedGroup, setSelectedGroup] = useState(null);

//   if (loading) {
//     return (
//       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-muted)', fontSize: 14 }}>
//         <div style={{ textAlign: 'center' }}>
//           <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
//           <p>Loading CRM Chat...</p>
//         </div>
//       </div>
//     );
//   }

//   if (!user) return <Login />;

//   // SocketProvider wraps AppInner so useSocket() is available inside it
//   return (
//     <ThemeProvider>
//       <SocketProvider token={token}>
//         <AppInner
//           selectedGroup={selectedGroup}
//           setSelectedGroup={setSelectedGroup}
//         />
//       </SocketProvider>
//     </ThemeProvider>
//   );
// }

// // ── Root App ──────────────────────────────────────────────────────────────
// export default function App() {
//   return (
//     <AuthProvider>
//       <ChatApp />
//       <Toaster
//         position="top-right"
//         toastOptions={{
//           style: {
//             background: '#161824',
//             color: '#e2e5f0',
//             border: '1px solid #2a2f3d',
//             fontSize: '13px',
//             fontFamily: 'Sora, sans-serif',
//           },
//           success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
//           error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
//         }}
//       />
//     </AuthProvider>
//   );
// }

import React, { useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import ChatView from './components/Chat/ChatView';
import Login from './components/Login';
import ThemeToggle from './components/ThemeToggle';
import { PWAInstallButton, useNotifications } from './utils/NotificationManager';
import './styles/globals.css';

// Inject keyframe animations
const styleEl = document.createElement('style');
styleEl.textContent = `
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.85;transform:scale(1.03)} }
  @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
`;
document.head.appendChild(styleEl);

// ── Banner asking user to allow notifications ──────────────────────────────
function NotifPermissionBanner({ permission, onRequest, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);
  if (permission !== 'default' || dismissed) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 20,
      background: '#161824', border: '1px solid #2a2f3d',
      borderLeft: '3px solid #4f7dff', borderRadius: 12,
      padding: '14px 18px', zIndex: 200, maxWidth: 320,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>🔔</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e5f0' }}>Enable Notifications</div>
          <div style={{ fontSize: 11, color: '#8b92a5', marginTop: 2 }}>
            Get notified of new messages, just like WhatsApp
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onRequest}
          style={{ flex: 1, background: '#4f7dff', border: 'none', borderRadius: 7, padding: '7px 12px', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >Allow</button>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: '#1e2129', border: '1px solid #2a2f3d', borderRadius: 7, padding: '7px 12px', color: '#8b92a5', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
        >Later</button>
      </div>
    </div>
  );
}

// ── Inner app — rendered INSIDE SocketProvider so useSocket() works ────────
function AppInner({ selectedGroup, setSelectedGroup }) {
  const { on, leaveGroup } = useSocket();

  // FIX: Handle member_removed at the App level so we can clear the selected
  // group when the current user is removed from the group they have open.
  // Previously this only lived in Sidebar, which could only filter the list —
  // it had no access to setSelectedGroup, so the chat panel stayed open and
  // every API call inside it returned 403 ("Not a member").
  React.useEffect(() => {
    const unsub = on('member_removed', (data) => {
      // leaveGroup removes the group from activeGroups so a socket reconnect
      // does NOT re-subscribe the user to a room they no longer belong to.
      leaveGroup(data.group_id);

      // If the removed group is currently open, close it immediately.
      // This stops ChatMessages / CampaignDetails from making 403 API calls.
      if (selectedGroup && Number(selectedGroup.id) === Number(data.group_id)) {
        setSelectedGroup(null);
      }
    });
    return () => unsub();
  }, [on, leaveGroup, selectedGroup, setSelectedGroup]);

  const handleGroupNotifClick = useCallback((groupId) => {
    // If you want to auto-select the group on notif click, do it here
  }, []);

  const { notifPermission, requestPermission } = useNotifications(handleGroupNotifClick);

  return (
    <>
      <ThemeToggle />

      <div className="app-layout">
        <Sidebar
          selectedGroupId={selectedGroup?.id}
          onSelectGroup={setSelectedGroup}
        />
        <ChatView group={selectedGroup} />
      </div>

      <NotifPermissionBanner permission={notifPermission} onRequest={requestPermission} />

      <div style={{ position: 'fixed', bottom: 16, right: 20, zIndex: 150 }}>
        <PWAInstallButton />
      </div>
    </>
  );
}

// ── ChatApp: handles auth gate + provides SocketProvider ──────────────────
function ChatApp() {
  const { user, token, loading } = useAuth();
  const [selectedGroup, setSelectedGroup] = useState(null);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-muted)', fontSize: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
          <p>Loading CRM Chat...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  // SocketProvider wraps AppInner so useSocket() is available inside it
  return (
    <ThemeProvider>
      <SocketProvider token={token}>
        <AppInner
          selectedGroup={selectedGroup}
          setSelectedGroup={setSelectedGroup}
        />
      </SocketProvider>
    </ThemeProvider>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <ChatApp />
      {/* <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#161824',
            color: '#e2e5f0',
            border: '1px solid #2a2f3d',
            fontSize: '13px',
            fontFamily: 'Sora, sans-serif',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      /> */}
    </AuthProvider>
  );
}
