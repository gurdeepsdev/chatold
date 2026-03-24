# 🚀 CRM Chat System

A production-grade, encrypted, real-time campaign chat system for Advertisers, Publishers, and Admin users.

---

## 📁 Project Structure

```
crm-chat/
├── backend/              # Node.js + Express + Socket.io
│   ├── src/
│   │   ├── routes/       # REST API routes
│   │   ├── socket/       # Socket.io handlers
│   │   ├── middleware/   # Auth middleware
│   │   └── utils/        # DB + encryption
│   ├── schema.sql        # MySQL schema + seed data
│   └── .env.example      # Environment config
└── frontend/             # React PWA
    └── src/
        ├── components/   # UI components
        ├── context/      # Auth + Socket contexts
        ├── utils/        # API client
        └── styles/       # Global CSS
```

---

## ⚙️ Setup Instructions

### 1. MySQL Database

```sql
-- Create DB and run schema
mysql -u root -p < backend/schema.sql
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your DB credentials and secrets
npm install
npm run dev   # Development
npm start     # Production
```

**Required `.env` values:**
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=crm_chat
JWT_SECRET=your-256-bit-secret
ENCRYPTION_KEY=your-32-char-key-here!!!!!!!!!!!
CLIENT_URL=http://localhost:3000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start     # Development (port 3000)
npm run build # Production build
```

---

## 🔑 Demo Accounts (password: `password123`)

| Email | Role |
|-------|------|
| atique@crm.com | Admin (default group member) |
| anvisha@crm.com | Admin (default group member) |
| john@advertiser.com | Advertiser |
| mike@publisher.com | Publisher |
| sarah@crm.com | Account Manager |

---

## ✨ Features

### Campaign Integration
- Groups auto-created from CRM `campaigns` table
- `package_id` extracted from `preview_url` (or campaign.package_id field)
- `sub_id` pulled from `campaign.sub_id` (campaign_sub_id field)
- Auto group naming: `CampaignName_AdvName_AMName`
- Thread grouping by `package_id` in sidebar

### Task System
| Type | Auto-created | Shortcut |
|------|-------------|---------|
| Initial Setup | ✅ On group creation | — |
| Share Link | — | PT tab |
| Pause PID | — | PT tab |
| Raise Request | — | PT tab |

Task flow: `Pending → Accepted → Completed / Rejected`

### Sidebar Shortcuts (per group)
- **CD** – Campaign Details + Members
- **PT** – Pending Tasks
- **Follow Ups** – Track follow-up messages
- **Previews** – PID Live/Pause status
- **Summary** – Workflow timeline with timestamps

### Security
- AES-256-CBC encryption for all messages
- IV (initialization vector) stored per message
- JWT auth with 7-day expiry
- Role-based access control
- Admin cannot read raw encrypted messages

---

## 🔌 CRM Integration

To sync with your existing CRM:

### Option A: Direct DB Sync
Point `crm_chat.campaigns` to your CRM DB or create a sync job:

```sql
-- Sync from your CRM campaigns table
INSERT INTO crm_chat.campaigns (crm_campaign_id, campaign_name, package_id, sub_id, preview_url, ...)
SELECT id, name, package_id, campaign_sub_id, preview_url, ...
FROM your_crm.campaigns
ON DUPLICATE KEY UPDATE campaign_name = VALUES(campaign_name), ...;
```

### Option B: API Sync Endpoint
Call this endpoint from your CRM when campaigns are created/updated:

```bash
POST /api/campaigns/sync
Authorization: Bearer <admin_token>
{
  "crm_campaign_id": "camp_123",
  "campaign_name": "BetFed Casino",
  "package_id": "com.betfed.casino",
  "sub_id": "SUB_001",       # = campaign_sub_id from your CRM
  "preview_url": "https://...",
  "geo": "US,CA",
  "payout": 45.00,
  "payable_event": "FTD",
  "advertiser_id": 3
}
```

### Extracting PackageID from Preview URL
The system auto-extracts PackageID from preview_url using:
- URL parameter `?id=com.example.app`
- Or last path segment of URL
- Falls back to the `package_id` field in campaigns table

---

## 📡 Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `new_message` | Server→Client | New message in group |
| `user_typing` | Server→Client | Typing indicator |
| `task_update` | Server→Client | Task created/updated |
| `pid_status_update` | Server→Client | PID status changed |
| `user_status` | Server→Client | User online/offline |
| `join_group` | Client→Server | Join a group room |
| `typing` | Client→Server | Send typing event |
| `message_seen` | Client→Server | Mark message seen |

---

## 🗄️ Database Tables

| Table | Purpose |
|-------|---------|
| users | All CRM users |
| campaigns | Synced from CRM |
| chat_groups | Campaign/custom groups |
| group_members | Group membership |
| messages | Encrypted messages |
| message_status | Seen/delivered status |
| tasks | Task management |
| task_responses | Task action history |
| followups | Follow-up tracking |
| pid_status | Publisher PID status |
| notifications | Push notifications |
| audit_logs | Admin audit trail |
| workflow_summary | Group activity timeline |

---

## 🚀 Production Deployment

```bash
# Build frontend
cd frontend && npm run build

# Serve with nginx or Express static
# Backend as PM2 process
pm2 start backend/src/server.js --name crm-chat

# Or Docker
docker-compose up -d
```

### Nginx Config (recommended)
```nginx
location /api { proxy_pass http://localhost:5000; }
location /socket.io { proxy_pass http://localhost:5000; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
location / { root /var/www/crm-chat; try_files $uri /index.html; }
```
