import { Router } from 'express';
import { body, param } from 'express-validator';
import { supabase } from '../db/supabase.js';
import { handleValidation, requireApiSecret } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/security.js';

const router = Router();

// GET /api/clients — listar todos los clientes activos
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('vb_clients')
    .select('id, client_id, business_name, slug, plan_id, business_type, active, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Error consultando clientes' });
  res.json(data);
});

// GET /api/clients/:slug — obtener cliente por slug
router.get(
  '/:slug',
  param('slug').isSlug().trim(),
  handleValidation,
  async (req, res) => {
    const { data, error } = await supabase
      .from('vb_clients')
      .select('*, vb_sites(*), vb_plans(*)')
      .eq('slug', req.params.slug)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(data);
  }
);

// POST /api/clients — crear cliente (requiere API_SECRET)
router.post(
  '/',
  writeLimiter,
  requireApiSecret,
  [
    body('client_id').isSlug().trim().notEmpty(),
    body('business_name').isString().trim().isLength({ min: 2, max: 100 }),
    body('slug').isSlug().trim().notEmpty(),
    body('plan_id').isIn(['free', 'starter', 'pro']),
    body('business_type').optional().isString().trim().isLength({ max: 100 }),
    body('owner_name').optional().isString().trim().isLength({ max: 100 }),
    body('owner_phone').optional().isMobilePhone('any'),
    body('owner_email').optional().isEmail().normalizeEmail(),
  ],
  handleValidation,
  async (req, res) => {
    const { client_id, business_name, slug, plan_id, business_type, owner_name, owner_phone, owner_email } = req.body;

    const { data, error } = await supabase
      .from('vb_clients')
      .insert({ client_id, business_name, slug, plan_id, business_type, owner_name, owner_phone, owner_email })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Cliente o slug ya existe' });
      return res.status(500).json({ error: 'Error creando cliente' });
    }
    res.status(201).json(data);
  }
);

// PUT /api/clients/:slug/status — activar/desactivar cliente
router.put(
  '/:slug/status',
  writeLimiter,
  requireApiSecret,
  param('slug').isSlug().trim(),
  body('active').isBoolean(),
  handleValidation,
  async (req, res) => {
    const { data, error } = await supabase
      .from('vb_clients')
      .update({ active: req.body.active })
      .eq('slug', req.params.slug)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(data);
  }
);

export default router;
