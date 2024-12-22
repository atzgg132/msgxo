require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');

const app = express();
app.use(cors());
app.use(express.json());

// Connect DB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('DB connection error:', err);
    process.exit(1);
  });

// Expose app-level references
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// We'll also store `io` in app, so controllers can broadcast easily
app.set('socketio', io);

// Track userId in socket query
io.use((socket, next) => {
  const userId = socket.handshake.query.userId;
  if(!userId) {
    return next(new Error('Missing userId in socket query'));
  }
  socket.userId = userId;
  next();
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id, 'for userId:', socket.userId);

  // Join personal room
  const personalRoom = `user_${socket.userId}`;
  socket.join(personalRoom);

  // Join group room or direct room
  socket.on('joinRoom', (groupId) => {
    socket.join(groupId);
  });
  socket.on('joinDirect', (roomId) => {
    socket.join(roomId);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
