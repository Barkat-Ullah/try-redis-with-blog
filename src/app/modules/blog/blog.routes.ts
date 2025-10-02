import express from 'express';
import { BlogController } from './blog.controller';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

/**
 * PUBLIC ROUTES (No authentication required)
 */

// Get all blogs (with pagination & caching)
// Example: /api/blogs?page=1&limit=10
router.get('/', BlogController.getAllBlog);

// Get trending blogs (cached for 5 minutes)
// Example: /api/blogs/trending?limit=10
router.get('/trending', BlogController.getTrendingBlogs);

// Search blogs by tags (cached)
// Example: /api/blogs/search?tags=nodejs,typescript
router.get('/search', BlogController.searchByTags);
// Get my blogs (user-specific cache)
router.get(
  '/my-blogs',
  auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),
  BlogController.getMyBlog,
);

// Get blog by ID (cached + view increment)
// Example: /api/blogs/6123456789abcdef12345678
router.get('/:id', BlogController.getBlogById);

// Get blog by slug (cached + view increment)
// Example: /api/blogs/slug/my-first-blog-post
router.get('/slug/:slug', BlogController.getBlogBySlug);

/**
 * PROTECTED ROUTES (Authentication required)
 */

// Create new blog (cache + invalidate list)
router.post(
  '/create-blogs',
  auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),
  BlogController.createIntoDb,
);

// Update blog (cache invalidation + re-cache)
router.put(
  '/:id',
  auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),
  BlogController.updateIntoDb,
);

// Hard delete blog (cache invalidation)
router.delete(
  '/:id',
  auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),
  BlogController.deleteIntoDb,
);

// Soft delete blog (cache invalidation)
router.patch(
  '/:id/soft-delete',
  auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),
  BlogController.softDeleteIntoDb,
);

// Like blog (Redis counter + user tracking)
router.post(
  '/:id/like',
  auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),
  BlogController.likeBlog,
);

// Unlike blog (Redis counter decrement)
router.delete(
  '/:id/un-like',
  auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),
  BlogController.unlikeBlog,
);

export const BlogRoutes = router;
