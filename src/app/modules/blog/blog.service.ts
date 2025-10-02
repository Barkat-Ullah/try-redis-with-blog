// blog.service.ts
import { Request } from 'express';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import redis from '../../utils/redisClient';
import { prisma } from '../../utils/prisma';

// ==================== HELPER FUNCTIONS ====================

const CacheKeys = {
  blog: (id: string) => `blog:${id}`,
  blogSlug: (slug: string) => `blog:slug:${slug}`,
  allBlogs: (page: number, limit: number) => `blogs:all:${page}:${limit}`,
  myBlogs: (userId: string) => `blogs:user:${userId}`,
  trending: () => `blogs:trending`,
  views: (id: string) => `blog:views:${id}`,
  likes: (id: string) => `blog:likes:${id}`,
  userLike: (userId: string, blogId: string) =>
    `blog:userlike:${userId}:${blogId}`,
};

const CacheTTL = {
  blog: 3600, // 1 hour
  list: 600, // 10 minutes
  trending: 300, // 5 minutes
  userLike: 86400 * 30, // 30 days
};

// ==================== CACHE HELPERS ====================

const safeRedisSet = async (key: string, ttl: number, value: string) => {
  try {
    await redis.setex(key, ttl, value);
  } catch (err) {
    console.error('Redis SETEX error:', err);
  }
};

const safeRedisDel = async (...keys: string[]) => {
  if (!keys.length) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    console.error('Redis DEL error:', err);
  }
};

const safeRedisGet = async (key: string) => {
  try {
    return await redis.get(key);
  } catch (err) {
    console.error('Redis GET error:', err);
    return null;
  }
};

// ==================== CACHE INVALIDATION ====================

const invalidateBlogCache = async (blogId: string, slug?: string) => {
  const keysToDelete = [CacheKeys.blog(blogId), CacheKeys.trending()];
  if (slug) keysToDelete.push(CacheKeys.blogSlug(slug));

  const listKeys = await redis.keys('blogs:all:*').catch(() => []);
  const userBlogsKeys = await redis.keys('blogs:user:*').catch(() => []);

  await safeRedisDel(...keysToDelete, ...listKeys, ...userBlogsKeys);
};

// ==================== SERVICE FUNCTIONS ====================

// CREATE BLOG
const createIntoDb = async (req: Request) => {
  const userId = req.user?.id;
  if (!userId)
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');

  const { title, description, slug, tags, published } = req.body;

  const existingBlog = await prisma.blogs.findUnique({ where: { slug } });
  if (existingBlog)
    throw new AppError(
      httpStatus.CONFLICT,
      'Blog with this slug already exists',
    );

  const blog = await prisma.blogs.create({
    data: {
      title,
      description,
      slug,
      tags: tags || [],
      published: published || false,
      userId,
    },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });

  await safeRedisSet(
    CacheKeys.blog(blog.id),
    CacheTTL.blog,
    JSON.stringify(blog),
  );
  await safeRedisSet(
    CacheKeys.blogSlug(blog.slug),
    CacheTTL.blog,
    JSON.stringify(blog),
  );

  const listKeys = await redis.keys('blogs:all:*').catch(() => []);
  const userBlogsKeys = await redis
    .keys(`blogs:user:${userId}*`)
    .catch(() => []);
  await safeRedisDel(...listKeys, ...userBlogsKeys);

  return blog;
};

// GET ALL BLOGS WITH PAGINATION
const getAllBlog = async (query: Record<string, any>) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;

  const cacheKey = CacheKeys.allBlogs(page, limit);
  const cached = await safeRedisGet(cacheKey);
  if (cached) return JSON.parse(cached);

  const [blogs, total] = await Promise.all([
    prisma.blogs.findMany({
      where: { published: true, isDeleted: false },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.blogs.count({ where: { published: true, isDeleted: false } }),
  ]);

  const result = {
    blogs,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
  await safeRedisSet(cacheKey, CacheTTL.list, JSON.stringify(result));

  return result;
};

// GET MY BLOGS (User specific)
const getMyBlog = async (userId: string) => {
  const cacheKey = CacheKeys.myBlogs(userId);
  const cached = await safeRedisGet(cacheKey);
  if (cached) return JSON.parse(cached);

  const blogs = await prisma.blogs.findMany({
    where: { userId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });

  await safeRedisSet(cacheKey, CacheTTL.blog, JSON.stringify(blogs));
  return blogs;
};

// GET BLOG BY ID (Reusable)
const getBlog = async ({ id, slug }: { id?: string; slug?: string }) => {
  const cacheKey = id ? CacheKeys.blog(id) : CacheKeys.blogSlug(slug!);
  const cached = await safeRedisGet(cacheKey);
  if (cached) {
    const blog = JSON.parse(cached);
    await incrementViews(blog.id);

    const redisViews = parseInt(
      (await safeRedisGet(CacheKeys.views(blog.id))) || '0',
    );
    blog.views = blog.views + redisViews;
    return blog;
  }

  const blog = await prisma.blogs.findFirst({
    where: id ? { id } : { slug },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });

  if (!blog || blog.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Blog not found');

  await safeRedisSet(cacheKey, CacheTTL.blog, JSON.stringify(blog));
  await incrementViews(blog.id);

  return blog;
};

const getBlogByIdFromDB = async (id: string) => getBlog({ id });
const getBlogBySlug = async (slug: string) => getBlog({ slug });

// INCREMENT VIEWS
const incrementViews = async (blogId: string, currentUserId?: string) => {
  try {
    if (currentUserId) {
      const blog = await prisma.blogs.findUnique({
        where: { id: blogId },
        select: { userId: true },
      });
      if (blog?.userId === currentUserId) return;
    }

    const views = await redis.incr(CacheKeys.views(blogId));
    if (views % 10 === 0)
      await prisma.blogs.update({
        where: { id: blogId },
        data: { views: { increment: 10 } },
      });

    await safeRedisDel(CacheKeys.blog(blogId));
  } catch (err) {
    console.error('Error incrementing views:', err);
  }
};

// UPDATE BLOG
const updateIntoDb = async (id: string, data: Partial<any>) => {
  const existingBlog = await prisma.blogs.findUnique({ where: { id } });
  if (!existingBlog || existingBlog.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Blog not found');

  if (data.slug && data.slug !== existingBlog.slug) {
    const slugExists = await prisma.blogs.findUnique({
      where: { slug: data.slug },
    });
    if (slugExists)
      throw new AppError(
        httpStatus.CONFLICT,
        'Blog with this slug already exists',
      );
  }

  const updatedBlog = await prisma.blogs.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });

  await invalidateBlogCache(id, existingBlog.slug);
  await safeRedisSet(
    CacheKeys.blog(id),
    CacheTTL.blog,
    JSON.stringify(updatedBlog),
  );
  if (updatedBlog.slug !== existingBlog.slug)
    await safeRedisSet(
      CacheKeys.blogSlug(updatedBlog.slug),
      CacheTTL.blog,
      JSON.stringify(updatedBlog),
    );

  return updatedBlog;
};

// DELETE & SOFT DELETE
const deleteIntoDb = async (id: string) => {
  const blog = await prisma.blogs.findUnique({ where: { id } });
  if (!blog) throw new AppError(httpStatus.NOT_FOUND, 'Blog not found');

  await prisma.blogs.delete({ where: { id } });
  await invalidateBlogCache(id, blog.slug);

  return { message: 'Blog deleted successfully' };
};

const softDeleteIntoDb = async (id: string) => {
  const blog = await prisma.blogs.findUnique({ where: { id } });
  if (!blog || blog.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, 'Blog not found');

  await prisma.blogs.update({
    where: { id },
    data: { isDeleted: true, updatedAt: new Date() },
  });
  await invalidateBlogCache(id, blog.slug);

  return { message: 'Blog soft deleted successfully' };
};

// LIKE / UNLIKE BLOG
const likeBlog = async (blogId: string, userId: string) => {
  const userLikeKey = CacheKeys.userLike(userId, blogId);

  if (await safeRedisGet(userLikeKey))
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You have already liked this blog',
    );

  await safeRedisSet(userLikeKey, CacheTTL.userLike, '1');
  await redis.incr(CacheKeys.likes(blogId)).catch(() => {});
  await prisma.blogs.update({
    where: { id: blogId },
    data: { likes: { increment: 1 } },
  });
  await invalidateBlogCache(blogId);

  return { message: 'Blog liked successfully' };
};

const unlikeBlog = async (blogId: string, userId: string) => {
  const userLikeKey = CacheKeys.userLike(userId, blogId);

  if (!(await safeRedisGet(userLikeKey)))
    throw new AppError(httpStatus.BAD_REQUEST, "You haven't liked this blog");

  await safeRedisDel(userLikeKey);
  await redis.decr(CacheKeys.likes(blogId)).catch(() => {});
  await prisma.blogs.update({
    where: { id: blogId },
    data: { likes: { decrement: 1 } },
  });
  await invalidateBlogCache(blogId);

  return { message: 'Blog unliked successfully' };
};

// TRENDING BLOGS
const getTrendingBlogs = async (limit = 10) => {
  const cacheKey = CacheKeys.trending();
  const cached = await safeRedisGet(cacheKey);
  if (cached) return JSON.parse(cached);

  const blogs = await prisma.blogs.findMany({
    where: { published: true, isDeleted: false },
    orderBy: [{ views: 'desc' }, { likes: 'desc' }],
    take: limit,
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });

  await safeRedisSet(cacheKey, CacheTTL.trending, JSON.stringify(blogs));
  return blogs;
};

// SEARCH BY TAGS
const searchByTags = async (tags: string[]) => {
  const cacheKey = `blogs:search:tags:${tags.sort().join(',')}`;
  const cached = await safeRedisGet(cacheKey);
  if (cached) return JSON.parse(cached);

  const blogs = await prisma.blogs.findMany({
    where: { tags: { hasSome: tags }, published: true, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });

  await safeRedisSet(cacheKey, CacheTTL.list, JSON.stringify(blogs));
  return blogs;
};

export const BlogServices = {
  createIntoDb,
  getAllBlog,
  getMyBlog,
  getBlogByIdFromDB,
  getBlogBySlug,
  updateIntoDb,
  deleteIntoDb,
  softDeleteIntoDb,
  likeBlog,
  unlikeBlog,
  getTrendingBlogs,
  searchByTags,
};
