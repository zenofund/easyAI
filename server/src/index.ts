import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
// Priority:
// 1. server/.env (if exists)
// 2. root/.env (if exists)
const serverEnvPath = path.resolve(__dirname, '../.env');
const rootEnvPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: serverEnvPath });
dotenv.config({ path: rootEnvPath });

import chatRoutes from './routes/chat';
import sessionRoutes from './routes/sessions';
import usageRoutes from './routes/usage';
import sharedRoutes from './routes/shared';
import authRoutes from './routes/auth';
import transcribeRoutes from './routes/transcribe';
import documentRoutes from './routes/documents';
import planRoutes from './routes/plans';
import subscriptionRoutes from './routes/subscriptions';
import userRoutes from './routes/users';
import paymentRoutes from './routes/payments';
import adminRoutes from './routes/admin';
import toolsRoutes from './routes/tools';
import notificationRoutes from './routes/notifications';
import draftingRoutes from './routes/drafting';
import artifactRoutes from './routes/artifacts';

const app = express();
const port = process.env.PORT || 3000;

const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Always allow localhost in all environments for easier development/testing
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    if (corsOrigins.indexOf(origin) !== -1 || corsOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(null, true); // TEMPORARILY ALLOW ALL FOR DEBUGGING
    }
  },
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/shared', sharedRoutes);
app.use('/api/transcribe', transcribeRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/drafting', draftingRoutes);
app.use('/api/artifacts', artifactRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend build (dist) for non-API routes
const distPath = path.resolve(__dirname, '../../dist');


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS Origins: ${process.env.CORS_ORIGINS}`);
});
