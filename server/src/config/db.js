const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

let isConnected = false;

const connectDB = async (customUri = null) => {
  const uri = customUri || config.mongo.uri;

  try {
    mongoose.set('strictQuery', true);

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });

    isConnected = true;
    logger.info('MongoDB connected successfully', { uri: uri.replace(/:([^@]+)@/, ':****@') });
    return mongoose.connection;
  } catch (error) {
    isConnected = false;
    logger.error('MongoDB connection failure', { error: error.message });
    throw error;
  }
};

mongoose.connection.on('connected', () => {
  isConnected = true;
  logger.info('Mongoose event: Connected to database');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  logger.error('Mongoose event: Connection error', { error: err.message });
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  logger.warn('Mongoose event: Disconnected from database');
});

const getDbStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    isConnected: mongoose.connection.readyState === 1,
  };
};

module.exports = {
  connectDB,
  getDbStatus,
  connection: mongoose.connection,
};
