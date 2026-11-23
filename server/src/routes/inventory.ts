import { Router } from 'express';
import {
  recordStockIn,
  adjustStock,
  getProductMovements,
  stockInSchema,
  adjustStockSchema,
} from '../controllers/inventoryController';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

// Stock-in: admin only
router.post('/stock-in', requireAuth, requireRole('admin'), validateBody(stockInSchema), recordStockIn);

// Stock adjustment: admin only
router.post('/adjust', requireAuth, requireRole('admin'), validateBody(adjustStockSchema), adjustStock);

// Stock movements history: admin and accountant
router.get('/movements/:productId', requireAuth, requireRole('admin', 'accountant'), getProductMovements);

export default router;
