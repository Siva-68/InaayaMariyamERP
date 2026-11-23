import { Router } from 'express';
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getPriceHistory,
  createProductSchema,
  updateProductSchema,
} from '../controllers/productController';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

// Read operations are available to all authenticated users
router.get('/', requireAuth, listProducts);
router.get('/:id', requireAuth, getProductById);

// Price history: admin and accountant
router.get('/:id/price-history', requireAuth, requireRole('admin', 'accountant'), getPriceHistory);

// Write operations: admin only
router.post('/', requireAuth, requireRole('admin'), validateBody(createProductSchema), createProduct);
router.patch('/:id', requireAuth, requireRole('admin'), validateBody(updateProductSchema), updateProduct);
router.delete('/:id', requireAuth, requireRole('admin'), deleteProduct);

export default router;
