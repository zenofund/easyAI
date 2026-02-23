import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const envPath = process.env.NODE_ENV === 'production' 
  ? path.resolve(__dirname, '../.env') 
  : path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });

// Also try loading from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
