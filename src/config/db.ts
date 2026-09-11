import mongoose from 'mongoose';
import logger from '../utils/logger';

let isConnected = false;

export const connectDatabase = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    logger.warn('MONGODB_URI is not configured, continuing without a MongoDB connection');
    return;
  }

  try {
    if (isConnected) {
      logger.info('MongoDB connection already established');
      return;
    }

    await mongoose.connect(mongoUri);
    isConnected = true;
    logger.info('MongoDB connected successfully');
  } catch (error) {
    isConnected = false;
    logger.warn('MongoDB connection unavailable during startup; server will continue in degraded mode');
    logger.warn(error instanceof Error ? error.message : String(error));
  }
};

export const getDatabaseStatus = (): string => (isConnected ? 'connected' : 'disconnected');
