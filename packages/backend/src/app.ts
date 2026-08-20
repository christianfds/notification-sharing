import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';

import authRouter from './modules/auth/auth.router';
import userRouter from './modules/users/user.router';
import categoryRouter from './modules/categories/category.router';
import templateRouter from './modules/templates/template.router';
import notificationRouter from './modules/notifications/notification.router';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/v1/auth', authRouter());
app.use('/api/v1/users', userRouter());
app.use('/api/v1/categories', categoryRouter());
app.use('/api/v1/templates', templateRouter());
app.use('/api/v1/notifications', notificationRouter());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env['NODE_ENV'] === 'production') {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');

  app.use(express.static(frontendDist));
  app.get('/{*splat}', (req, res, next) => {
    const isApiRequest = req.path === '/api' || req.path.startsWith('/api/');
    const isHealthRequest = req.path === '/health' || req.path.startsWith('/health/');

    if (isApiRequest || isHealthRequest) {
      next();
      return;
    }

    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

export default app;
