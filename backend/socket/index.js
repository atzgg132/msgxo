// backend/socket/index.js
module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // -- Group chat events as before --
    socket.on('joinRoom', (groupId) => {
      socket.join(groupId);
      console.log(`User ${socket.id} joined group: ${groupId}`);
    });

    socket.on('leaveRoom', (groupId) => {
      socket.leave(groupId);
      console.log(`User ${socket.id} left group: ${groupId}`);
    });

    socket.on('newMessage', (data) => {
      // data = { groupId, content, senderName } ...
      io.to(data.groupId).emit('messageReceived', data);
    });

    // -- Direct message events (optional) --
    // You might want to create unique "rooms" for pairs of users
    socket.on('joinDirect', (roomId) => {
      // e.g. roomId is some deterministic string like userAId_userBId
      socket.join(roomId);
      console.log(`User ${socket.id} joined DM room: ${roomId}`);
    });

    socket.on('newDirectMessage', (data) => {
      // data = { roomId, content, from, to }
      io.to(data.roomId).emit('directMessageReceived', data);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};
