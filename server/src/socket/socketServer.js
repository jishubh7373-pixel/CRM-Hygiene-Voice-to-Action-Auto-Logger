const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

let io = null;

const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [config.clientUrl, `${config.clientUrl}/`],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret);
      socket.user = decoded;
      socket.organizationId = decoded.organizationId;
      next();
    } catch (err) {
      return next(new Error('Invalid socket authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const room = `org:${socket.organizationId}`;
    socket.join(room);
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user.email}) joined room ${room}`);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

const emitToOrganization = (organizationId, eventName, data) => {
  if (io) {
    io.to(`org:${organizationId}`).emit(eventName, data);
  }
};

const getSocketInstance = () => io;

module.exports = {
  initSocketServer,
  emitToOrganization,
  getSocketInstance,
};
