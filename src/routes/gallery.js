import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { supabase } from '../db/supabase.js';
import { handleValidation, requireApiSecret } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/security.js';

const router = Router();

// GET /api/gallery?client_id=xxx
router.get(
  '/',
  query('client_id').isUUID(),
  handleValidation,
  async (req, res) => {
    const { data, error } = await supabase
      .from('vb_gallery_images')
      .select('id, url, alt_text, caption, sort_order')
      .eq('client_id', req.query.client_id)
      .eq('active', true)
      .order('sort_order');

    if (error) return res.status(500).json({ error: 'Error consultando galería' });
    res.json(data);
  }
);

// POST /api/gallery
router.post(
  '/',
  writeLimiter,
  requireApiSecret,
  [
    body('client_id').isUUID(),
    body('url').isURL({ require_tld: false }),
    body('alt_text').optional().isString().trim().isLength({ max: 200 }).escape(),
    body('caption').optional().isString().trim().isLength({ max: 300 }).escape(),
    body('sort_order').optional().isInt({ min: 0 }),
  ],
  handleValidation,
  async (req, res) => {
    const { data, error } = await supabase
      .from('vb_gallery_images')
      .insert(req.body)
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Error añadiendo imagen' });
    res.status(201).json(data);
  }
);

// DELETE /api/gallery/:id
router.delete(
  '/:id',
  writeLimiter,
  requireApiSecret,
  param('id').isUUID(),
  handleValidation,
  async (req, res) => {
    const { error } = await supabase
      .from('vb_gallery_images')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: 'Error eliminando imagen' });
    res.status(204).send();
  }
);

export default router;
