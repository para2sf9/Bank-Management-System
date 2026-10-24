import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './routes/auth.js';
import { dataRouter } from './routes/data.js';
import { transferRouter } from './routes/transfers.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const app = express();
const port = Number(process.env.PORT || 4000);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters');
}
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin && origin !== clientOrigin) return res.status(403).json({ error: 'Request origin not allowed' });
  }
  next();
});
app.get('/api/health', (_req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'connecting' }));
app.use('/api/auth', authRouter);
app.use('/api', dataRouter);
app.use('/api/transfers', transferRouter);
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.name === 'ValidationError') return res.status(400).json({ error: 'Please check the submitted details.' });
  if (err?.code === 11000) return res.status(409).json({ error: 'That record already exists.' });
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.' });
});

mongoose.set('strictQuery', true);
try {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/northstar_demo?replicaSet=rs0');
  app.listen(port, () => console.log(`Northstar demo API listening on http://localhost:${port}`));
} catch (error) {
  console.error('MongoDB connection failed. Check MONGODB_URI and confirm the replica set is initialized.', error.message);
  process.exit(1);
}
