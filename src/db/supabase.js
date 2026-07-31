import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

// Service role — solo para uso interno del backend, nunca exponer al cliente
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    // Desactivar realtime — no se usa en el backend, evita error de WebSocket en Node < 22
    realtime: { timeout: 0 },
    global: {
      fetch,
      WebSocket: class FakeWS { constructor() {} },
    },
  }
);
