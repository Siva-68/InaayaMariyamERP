import { Router } from 'express';
import { listUsers, createUser, updateUser } from '../controllers/userController';
import { createUserSchema, updateUserSchema } from '../controllers/authController';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

// All user management routes require admin role
router.use(requireAuth, requireRole('admin'));

router.get('/', listUsers);
router.post('/', validateBody(createUserSchema), createUser);
router.patch('/:id', validateBody(updateUserSchema), updateUser);

export default router;
