import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, getCurrentUser, loginSchema } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

// Rate limit login route: 5 attempts per minute per IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many login attempts. Please try again after 1 minute.',
    },
  },
});

router.post('/login', loginLimiter, validateBody(loginSchema), login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, getCurrentUser);

export default router;
