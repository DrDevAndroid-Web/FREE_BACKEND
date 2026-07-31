import { validationResult } from 'express-validator';

// Middleware: detiene la request si hay errores de validación
export function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// Middleware: verifica API_SECRET en header x-api-secret (endpoints de escritura)
// OWASP A07 — autenticación simple para operaciones admin
export function requireApiSecret(req, res, next) {
  const secret = req.headers['x-api-secret'];
  if (!secret || secret !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}
