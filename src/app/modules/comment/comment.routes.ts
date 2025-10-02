// comment.route.ts
import express from 'express';
import { CommentController } from './comment.controller';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

// Public routes - anyone can view comments
router.get('/', CommentController.getAllComment);
router.get('/:id', CommentController.getCommentById);

// Protected routes - require authentication
router.get(
  '/my/comments',
  auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),
  CommentController.getMyComment,
);

router.post(
  '/',
  auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),

  CommentController.createIntoDb,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),

  CommentController.updateIntoDb,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),
  CommentController.deleteIntoDb,
);

router.delete(
  '/soft/:id',
  auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),
  CommentController.softDeleteIntoDb,
);

export const CommentRoutes = router;
