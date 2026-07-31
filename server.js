import 'dotenv/config';
import { WebSocket } from 'ws';
// Parchear globalThis antes de que @supabase/realtime-js se inicialice (necesario en Node < 22)
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket;
import express from 'express';
import { securityMiddleware } from './src/middleware/security.js';
import clientsRouter from './src/routes/clients.js';
import productsRouter from './src/routes/products.js';
import galleryRouter from './src/routes/gallery.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares de seguridad OWASP (helmet, cors, rate limiting)
app.use(securityMiddleware);

// Parseo de JSON con límite — OWASP A05 previene payloads gigantes
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

// Rutas
app.use('/api/clients', clientsRouter);
app.use('/api/products', productsRouter);
app.use('/api/gallery', galleryRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

// 404 — OWASP A05: no revelar información de rutas inexistentes
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Error handler — OWASP A09: log interno, sin exponer stack al cliente
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()} — ${err.message}`);
  if (err.message.startsWith('CORS bloqueado')) {
    return res.status(403).json({ error: 'Origen no permitido' });
  }
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`VersaBold Backend corriendo en puerto ${PORT} [${process.env.NODE_ENV}]`);
});
