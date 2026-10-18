import express from 'express';
import dotenv from 'dotenv';
import { apiRouter } from '../src/server/routes.ts';

dotenv.config();

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Security and privacy headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Mount all REST API endpoints
app.use('/api', apiRouter);

// SEO convenient routes
app.get('/robots.txt', (_req, res) => res.redirect('/api/seo/robots.txt'));
app.get('/sitemap.xml', (_req, res) => res.redirect('/api/seo/sitemap.xml'));

export default app;
