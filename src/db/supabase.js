import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

// Service role — solo para uso interno del backend, nunca exponer al cliente
// ws provee WebSocket nativo para Node < 22
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    global: { fetch, WebSocket },
  }
);
