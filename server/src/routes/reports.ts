import { Router } from 'express';
import {
  getDashboard,
  exportExcel,
  exportPdf,
  listDailyReports,
  triggerDailyReport,
  downloadDailyReport,
  retryDelivery,
} from '../controllers/reportController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Dashboard and reports require user to be authenticated
router.use(requireAuth);

router.get('/dashboard', getDashboard);
router.get('/export/excel', exportExcel);
router.get('/export/pdf', exportPdf);

// ── Daily Automated & Manual Reports (Admin Only) ───────────
router.get('/daily', requireRole('admin'), listDailyReports);
router.post('/daily/generate', requireRole('admin'), triggerDailyReport);
router.get('/daily/:id/download', requireRole('admin'), downloadDailyReport);
router.post('/daily/:id/retry', requireRole('admin'), retryDelivery);

export default router;
