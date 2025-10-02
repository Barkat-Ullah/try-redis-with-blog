// ==================== BLOG CONTROLLER ====================
// blog.controller.ts

import catchAsync from '../../utils/catchAsync';
import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import { Request, Response } from 'express';
import { BlogServices } from './blog.service';

/**
 * CREATE BLOG
 * Redis: নতুন blog create করে cache করে
 */
const createIntoDb = catchAsync(async (req: Request, res: Response) => {
  const result = await BlogServices.createIntoDb(req);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Successfully created blog',
    data: result,
  });
});

/**
 * GET ALL BLOGS (with pagination)
 * Redis: Cache থেকে fetch করে, না থাকলে DB থেকে নিয়ে cache করে
 */
const getAllBlog = catchAsync(async (req: Request, res: Response) => {
  const result = await BlogServices.getAllBlog(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved all blogs',
    data: result,
  });
});

/**
 * GET MY BLOGS
 * Redis: User specific blogs cache করে
 */
const getMyBlog = catchAsync(async (req: Request, res: Response) => {
  const result = await BlogServices.getMyBlog(req.user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved my blogs',
    data: result,
  });
});

/**
 * GET BLOG BY ID
 * Redis: Individual blog cache + view count increment
 */
const getBlogById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await BlogServices.getBlogByIdFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved blog',
    data: result,
  });
});

/**
 * GET BLOG BY SLUG
 * Redis: Slug-based cache + view count increment
 */
const getBlogBySlug = catchAsync(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const result = await BlogServices.getBlogBySlug(slug);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved blog',
    data: result,
  });
});

/**
 * UPDATE BLOG
 * Redis: Update করার পর cache invalidate করে + নতুন data cache করে
 */
const updateIntoDb = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await BlogServices.updateIntoDb(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully updated blog',
    data: result,
  });
});

/**
 * DELETE BLOG (Hard Delete)
 * Redis: Delete করার পর সব cache invalidate করে
 */
const deleteIntoDb = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await BlogServices.deleteIntoDb(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully deleted blog',
    data: result,
  });
});

/**
 * SOFT DELETE BLOG
 * Redis: Soft delete করার পর cache invalidate করে
 */
const softDeleteIntoDb = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await BlogServices.softDeleteIntoDb(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully soft deleted blog',
    data: result,
  });
});

/**
 * LIKE BLOG
 * Redis: User like tracking + like counter (super fast)
 */
const likeBlog = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id || req.body.userId;

  const result = await BlogServices.likeBlog(id, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully liked blog',
    data: result,
  });
});

/**
 * UNLIKE BLOG
 * Redis: Remove user like + decrement counter
 */
const unlikeBlog = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id || req.body.userId;

  const result = await BlogServices.unlikeBlog(id, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully un liked blog',
    data: result,
  });
});

/**
 * GET TRENDING BLOGS
 * Redis: Trending calculation cache করে (short TTL)
 */
const getTrendingBlogs = catchAsync(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const result = await BlogServices.getTrendingBlogs(limit);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved trending blogs',
    data: result,
  });
});

/**
 * SEARCH BY TAGS
 * Redis: Search results cache করে
 */
const searchByTags = catchAsync(async (req: Request, res: Response) => {
  const tags = (req.query.tags as string)?.split(',') || [];
  const result = await BlogServices.searchByTags(tags);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully searched blogs',
    data: result,
  });
});

export const BlogController = {
  createIntoDb,
  getAllBlog,
  getMyBlog,
  getBlogById,
  getBlogBySlug,
  updateIntoDb,
  deleteIntoDb,
  softDeleteIntoDb,
  likeBlog,
  unlikeBlog,
  getTrendingBlogs,
  searchByTags,
};
