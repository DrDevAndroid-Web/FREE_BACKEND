import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { supabase } from '../db/supabase.js';
import { handleValidation, requireApiSecret } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/security.js';

const router = Router();

// GET /api/products?client_id=xxx — productos de un cliente
router.get(
  '/',
  query('client_id').isUUID(),
  handleValidation,
  async (req, res) => {
    const { data, error } = await supabase
      .from('vb_products')
      .select('*, vb_categories(name, slug)')
      .eq('client_id', req.query.client_id)
      .eq('available', true)
      .order('sort_order');

    if (error) return res.status(500).json({ error: 'Error consultando productos' });
    res.json(data);
  }
);

// POST /api/products — crear producto (requiere API_SECRET)
router.post(
  '/',
  writeLimiter,
  requireApiSecret,
  [
    body('client_id').isUUID(),
    body('name').isString().trim().isLength({ min: 1, max: 200 }).escape(),
    body('description').optional().isString().trim().isLength({ max: 500 }).escape(),
    body('price').isFloat({ min: 0 }),
    body('image_url').optional().isURL({ require_tld: false }),
    body('available').optional().isBoolean(),
    body('featured').optional().isBoolean(),
    body('whatsapp_message').optional().isString().trim().isLength({ max: 300 }).escape(),
    body('sort_order').optional().isInt({ min: 0 }),
    body('category_id').optional().isUUID(),
  ],
  handleValidation,
  async (req, res) => {
    // Verificar límite del plan antes de insertar
    const { data: client } = await supabase
      .from('vb_clients')
      .select('plan_id, vb_plans(products_limit)')
      .eq('id', req.body.client_id)
      .single();

    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { count } = await supabase
      .from('vb_products')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', req.body.client_id);

    const limit = client.vb_plans?.products_limit ?? 15;
    if (count >= limit) {
      return res.status(400).json({ error: `Límite de ${limit} productos alcanzado para este plan` });
    }

    const { data, error } = await supabase
      .from('vb_products')
      .insert(req.body)
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Error creando producto' });
    res.status(201).json(data);
  }
);

// PUT /api/products/:id — actualizar producto
router.put(
  '/:id',
  writeLimiter,
  requireApiSecret,
  param('id').isUUID(),
  [
    body('name').optional().isString().trim().isLength({ min: 1, max: 200 }).escape(),
    body('description').optional().isString().trim().isLength({ max: 500 }).escape(),
    body('price').optional().isFloat({ min: 0 }),
    body('available').optional().isBoolean(),
    body('featured').optional().isBoolean(),
    body('whatsapp_message').optional().isString().trim().isLength({ max: 300 }).escape(),
  ],
  handleValidation,
  async (req, res) => {
    const { data, error } = await supabase
      .from('vb_products')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(data);
  }
);

// DELETE /api/products/:id — eliminar producto
router.delete(
  '/:id',
  writeLimiter,
  requireApiSecret,
  param('id').isUUID(),
  handleValidation,
  async (req, res) => {
    const { error } = await supabase
      .from('vb_products')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: 'Error eliminando producto' });
    res.status(204).send();
  }
);

export default router;
