const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors   = require('cors');
const morgan = require('morgan');
const path   = require('path');
require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// FIX: Global process-level safety net.
//
// Without these, ANY unhandled async error anywhere in the codebase (route
// handlers, socket events, utilities) silently kills the entire server.
// These handlers log the error and keep the process alive.
//
// NOTE: These must be registered BEFORE anything else runs.
// ─────────────────────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION — server will NOT exit:', err);
  // Do NOT process.exit() here — keep the server alive
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED PROMISE REJECTION at:', promise, '— reason:', reason);
  // Do NOT process.exit() here — keep the server alive
});

// ─────────────────────────────────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);

// Resolve upload dir to absolute path once — both multer and static use this
const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
require('fs').mkdirSync(UPLOAD_DIR, { recursive: true });


const allowedOrigins = [
  process.env.CLIENT_URL || 'https://chat.pidmetric.com',
  'http://localhost:5173', 'https://pidmetric.com','http://localhost:3000'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.options('*', cors());





const io = new Server(server, {
  cors: {
     origin: allowedOrigins,
  
 //origin: process.env.CLIENT_URL || 'https://chat.pidmetric.com',
    methods: ['GET','POST','PUT','PATCH','DELETE'],
    credentials: true,
  },
  maxHttpBufferSize: 60 * 1024 * 1024,
  transports: ['websocket','polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
  upgrade: true,
  rememberUpgrade: true,
});

app.set('io', io);
app.set('UPLOAD_DIR', UPLOAD_DIR);
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// const io = new Server(server, {
//   cors: {
//     origin: process.env.CLIENT_URL || 'http://localhost:3000',
//     methods: ['GET','POST','PUT','PATCH','DELETE'],
//     credentials: true,
//   },
//   maxHttpBufferSize: 60 * 1024 * 1024,
//   transports: ['websocket','polling'],
//   pingTimeout: 60000,
//   pingInterval: 25000,
//   allowEIO3: true,
//   upgrade: true,
//   rememberUpgrade: true,
// });

// app.set('io', io);
// app.set('UPLOAD_DIR', UPLOAD_DIR);

// app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve uploads — same absolute path multer writes to
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const inline = ['.jpg','.jpeg','.png','.gif','.webp','.mp3','.wav','.ogg','.webm','.m4a'];
    if (!inline.includes(ext)) {
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    }
  }
}));

// Dedicated download endpoint — serves any uploaded file with its original filename.
// The stored filename (hashed) is in the URL; the original name comes via ?name=
// path.basename strips all directory components so there is no traversal risk.
app.get('/api/download/:filename', (req, res) => {
  const storedFilename = path.basename(req.params.filename);
  const filePath = path.join(UPLOAD_DIR, storedFilename);
  const downloadName = req.query.name || storedFilename;

  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'File not found' });
    }
  });
});

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/groups',        require('./routes/groups'));
app.use('/api/messages',      require('./routes/messages'));
app.use('/api/tasks',         require('./routes/tasks'));
app.use('/api/campaigns',     require('./routes/campaigns'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/health', (req, res) => res.json({ status:'ok', port:process.env.PORT||5000, upload_dir:UPLOAD_DIR }));

require('./socket')(io);

// Global Express error handler
app.use((err, req, res, next) => {
  console.error('Express error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5500;
server.listen(PORT, () => {
  console.log(`🚀 Server on port ${PORT}`);
  console.log(`📁 Uploads: ${UPLOAD_DIR}`);
});

module.exports = { app, server, io };
