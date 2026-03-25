const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors   = require('cors');
const morgan = require('morgan');
const path   = require('path');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);

// Resolve upload dir to absolute path once — both multer and static use this
const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
require('fs').mkdirSync(UPLOAD_DIR, { recursive: true });

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'https://chat.pidmetric.com',
    methods: ['GET','POST','PUT','PATCH','DELETE'],
    credentials: true,
  },
  maxHttpBufferSize: 60 * 1024 * 1024,
  transports: ['websocket','polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set('io', io);
app.set('UPLOAD_DIR', UPLOAD_DIR);  // routes can get it via req.app.get('UPLOAD_DIR')

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ✅ Serve uploads — same absolute path multer writes to
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders(res, filePath) {
    // Force download for non-image/audio files
    const ext = path.extname(filePath).toLowerCase();
    const inline = ['.jpg','.jpeg','.png','.gif','.webp','.mp3','.wav','.ogg','.webm','.m4a'];
    if (!inline.includes(ext)) {
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    }
  }
}));

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/groups',        require('./routes/groups'));
app.use('/api/messages',      require('./routes/messages'));
app.use('/api/tasks',         require('./routes/tasks'));
app.use('/api/campaigns',     require('./routes/campaigns'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/health', (req, res) => res.json({ status:'ok', port:process.env.PORT||5000, upload_dir:UPLOAD_DIR }));

require('./socket')(io);

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5500;
server.listen(PORT, () => {
  console.log(`🚀 Server on port ${PORT}`);
  console.log(`📁 Uploads: ${UPLOAD_DIR}`);
});

module.exports = { app, server, io };
