import express from 'express';
import { BlogController } from './blog.controller';
import auth from '../../middlewares/auth'; 

const router = express.Router();

/**
 * PUBLIC ROUTES (No authentication required)
 */

// Get all blogs (with pagination & caching)
// Example: /api/blogs?page=1&limit=10
router.get('/blogs', BlogController.getAllBlog);

// Get trending blogs (cached for 5 minutes)
// Example: /api/blogs/trending?limit=10
router.get('/blogs/trending', BlogController.getTrendingBlogs);

// Search blogs by tags (cached)
// Example: /api/blogs/search?tags=nodejs,typescript
router.get('/blogs/search', BlogController.searchByTags);

// Get blog by ID (cached + view increment)
// Example: /api/blogs/6123456789abcdef12345678
router.get('/blogs/:id', BlogController.getBlogById);

// Get blog by slug (cached + view increment)
// Example: /api/blogs/slug/my-first-blog-post
router.get('/blogs/slug/:slug', BlogController.getBlogBySlug);

/**
 * PROTECTED ROUTES (Authentication required)
 */

// Create new blog (cache + invalidate list)
router.post('/blogs', auth(), BlogController.createIntoDb);

// Get my blogs (user-specific cache)
router.get('/my-blogs', auth(), BlogController.getMyBlog);

// Update blog (cache invalidation + re-cache)
router.put('/blogs/:id', auth(), BlogController.updateIntoDb);

// Hard delete blog (cache invalidation)
router.delete('/blogs/:id', auth(), BlogController.deleteIntoDb);

// Soft delete blog (cache invalidation)
router.patch('/blogs/:id/soft-delete', auth(), BlogController.softDeleteIntoDb);

// Like blog (Redis counter + user tracking)
router.post('/blogs/:id/like', auth(), BlogController.likeBlog);

// Unlike blog (Redis counter decrement)
router.delete('/blogs/:id/like', auth(), BlogController.unlikeBlog);

export default router;
