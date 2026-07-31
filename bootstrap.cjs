// bootstrap.cjs — punto de entrada CJS que parchea WebSocket ANTES de cargar el ESM
// Necesario para Node 18/20 donde @supabase/realtime-js requiere WebSocket global
'use strict';

const { WebSocket } = require('ws');

// Inyectar en todos los lugares donde websocket-factory.js busca
global.WebSocket = WebSocket;
globalThis.WebSocket = WebSocket;

// Ahora cargar el servidor ESM — el parche ya está en su lugar
import('./server.js').catch(err => {
  console.error('Error al iniciar el servidor:', err);
  process.exit(1);
});
