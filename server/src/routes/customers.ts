import { Router } from 'express';
import { lookupCustomer, listCustomers } from '../controllers/customerController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/lookup', lookupCustomer);
router.get('/', listCustomers);

export default router;
