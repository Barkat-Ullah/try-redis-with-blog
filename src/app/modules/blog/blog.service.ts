// blog.service.ts
import { Request } from 'express';

import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import redis from '../../utils/redisClient';
import { prisma } from '../../utils/prisma';

// ==================== HELPER FUNCTIONS ====================

/**
 * Cache key generator - সব cache keys এক জায়গায় manage করার জন্য
 */
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

/**
 * Cache TTL (Time To Live) - কতক্ষণ cache এ data রাখবে
 */
const CacheTTL = {
  blog: 3600, // 1 hour - individual blog
  list: 600, // 10 minutes - blog lists
  trending: 300, // 5 minutes - trending blogs
  userLike: 86400 * 30, // 30 days - user like tracking
};

/**
 * Cache invalidation - blog এর সাথে related সব cache মুছে দেয়
 */
const invalidateBlogCache = async (blogId: string, slug?: string) => {
  const keysToDelete = [CacheKeys.blog(blogId), CacheKeys.trending()];

  if (slug) {
    keysToDelete.push(CacheKeys.blogSlug(slug));
  }

  // Delete all blog list caches
  const listKeys = await redis.keys('blogs:all:*');
  const userBlogsKeys = await redis.keys('blogs:user:*');

  await redis.del(...keysToDelete, ...listKeys, ...userBlogsKeys);
};

// ==================== SERVICE FUNCTIONS ====================

/**
 * CREATE BLOG
 * Redis Usage:
 * 1. Blog তৈরি করার পর immediately cache করে
 * 2. All blogs list cache invalidate করে (কারণ নতুন blog আসছে)
 */
const createIntoDb = async (req: Request) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const { title, description, slug, tags, published } = req.body;

  // Check if slug already exists
  const existingBlog = await prisma.blogs.findUnique({
    where: { slug },
  });

  if (existingBlog) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Blog with this slug already exists',
    );
  }

  // Create blog in database
  const blog = await prisma.blogs.create({
    data: {
      title,
      description,
      slug,
      tags: tags || [],
      published: published || false,
      userId,
    },
    include: {
      user: {
        select: {
          id: true,
         fullName: true,
          email: true,
        },
      },
    },
  });

  // ✅ Redis: নতুন blog cache করো
  await redis.setex(
    CacheKeys.blog(blog.id),
    CacheTTL.blog,
    JSON.stringify(blog),
  );

  // ✅ Redis: Slug দিয়েও cache করো
  await redis.setex(
    CacheKeys.blogSlug(blog.slug),
    CacheTTL.blog,
    JSON.stringify(blog),
  );

  // ✅ Redis: List caches invalidate করো (নতুন blog আসছে তাই পুরানো list মুছে দাও)
  const listKeys = await redis.keys('blogs:all:*');
  const userBlogsKeys = await redis.keys(`blogs:user:${userId}*`);
  if (listKeys.length > 0 || userBlogsKeys.length > 0) {
    await redis.del(...listKeys, ...userBlogsKeys);
  }

  return blog;
};

/**
 * GET ALL BLOGS WITH PAGINATION
 * Redis Usage:
 * 1. প্রথমে cache check করে
 * 2. Cache miss হলে DB থেকে fetch করে cache করে
 * 3. Pagination অনুযায়ী আলাদা cache key use করে
 */
const getAllBlog = async (query: Record<string, any>) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;

  const cacheKey = CacheKeys.allBlogs(page, limit);

  // ✅ Redis: Cache থেকে check করো
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('✅ Cache HIT: Returning blogs from Redis');
    return JSON.parse(cached);
  }

  console.log('❌ Cache MISS: Fetching blogs from Database');

  // Database থেকে fetch করো
  const [blogs, total] = await Promise.all([
    prisma.blogs.findMany({
      where: {
        published: true,
        isDeleted: false,
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
           fullName: true,
            email: true,
          },
        },
      },
    }),
    prisma.blogs.count({
      where: {
        published: true,
        isDeleted: false,
      },
    }),
  ]);

  const result = {
    blogs,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };

  // ✅ Redis: Result cache করো (shorter TTL for lists)
  await redis.setex(cacheKey, CacheTTL.list, JSON.stringify(result));

  return result;
};

/**
 * GET MY BLOGS (User specific)
 * Redis Usage:
 * 1. User এর নিজের blogs আলাদা cache করে
 * 2. User ID based cache key use করে
 */
const getMyBlog = async (userId: string) => {
  const cacheKey = CacheKeys.myBlogs(userId);

  // ✅ Redis: Cache check করো
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('✅ Cache HIT: Returning my blogs from Redis');
    return JSON.parse(cached);
  }

  console.log('❌ Cache MISS: Fetching my blogs from Database');

  // Database থেকে fetch করো
  const blogs = await prisma.blogs.findMany({
    where: {
      userId,
      isDeleted: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      user: {
        select: {
          id: true,
         fullName: true,
          email: true,
        },
      },
    },
  });

  // ✅ Redis: My blogs cache করো
  await redis.setex(cacheKey, CacheTTL.blog, JSON.stringify(blogs));

  return blogs;
};

/**
 * GET BLOG BY ID
 * Redis Usage:
 * 1. প্রথমে cache check করে
 * 2. Cache miss হলে DB থেকে fetch করে
 * 3. Views count increment করে (Redis counter use করে)
 */
const getBlogByIdFromDB = async (id: string) => {
  const cacheKey = CacheKeys.blog(id);

  // ✅ Redis: Cache থেকে check করো
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('✅ Cache HIT: Returning blog from Redis');

    // ✅ Redis: View count increment করো (async, don't wait)
    incrementViews(id);

    return JSON.parse(cached);
  }

  console.log('❌ Cache MISS: Fetching blog from Database');

  // Database থেকে fetch করো
  const blog = await prisma.blogs.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
         fullName: true,
          email: true,
        },
      },
    },
  });

  if (!blog || blog.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blog not found');
  }

  // ✅ Redis: Blog cache করো
  await redis.setex(cacheKey, CacheTTL.blog, JSON.stringify(blog));

  // ✅ Redis: View count increment করো
  incrementViews(id);

  return blog;
};

/**
 * GET BLOG BY SLUG
 * Redis Usage: Similar to getBlogById but uses slug-based cache key
 */
const getBlogBySlug = async (slug: string) => {
  const cacheKey = CacheKeys.blogSlug(slug);

  // ✅ Redis: Cache check করো
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('✅ Cache HIT: Returning blog by slug from Redis');
    const blog = JSON.parse(cached);
    incrementViews(blog.id);
    return blog;
  }

  console.log('❌ Cache MISS: Fetching blog by slug from Database');

  const blog = await prisma.blogs.findUnique({
    where: { slug },
    include: {
      user: {
        select: {
          id: true,
         fullName: true,
          email: true,
        },
      },
    },
  });

  if (!blog || blog.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blog not found');
  }

  // ✅ Redis: Cache করো
  await redis.setex(cacheKey, CacheTTL.blog, JSON.stringify(blog));
  incrementViews(blog.id);

  return blog;
};

/**
 * INCREMENT VIEWS (Redis Counter)
 * Redis Usage:
 * 1. Redis এ view count increment করে (super fast)
 * 2. প্রতি 10 views এ database update করে (batch update for performance)
 */
const incrementViews = async (blogId: string) => {
  const viewKey = CacheKeys.views(blogId);

  try {
    // ✅ Redis: Counter increment করো (atomic operation)
    const views = await redis.incr(viewKey);

    // ✅ Redis: প্রতি 10 views এ database sync করো (efficient batch update)
    if (views % 10 === 0) {
      await prisma.blogs.update({
        where: { id: blogId },
        data: {
          views: {
            increment: 10,
          },
        },
      });

      console.log(`📊 Database synced: ${blogId} - ${views} views`);
    }

    // ✅ Redis: Cache invalidate করো যাতে নতুন view count দেখায়
    await redis.del(CacheKeys.blog(blogId));
  } catch (error) {
    console.error('Error incrementing views:', error);
  }
};

/**
 * UPDATE BLOG
 * Redis Usage:
 * 1. Blog update করার পর সব related cache invalidate করে
 * 2. Updated blog নতুন করে cache করে
 */
const updateIntoDb = async (id: string, data: Partial<any>) => {
  // Check if blog exists
  const existingBlog = await prisma.blogs.findUnique({
    where: { id },
  });

  if (!existingBlog || existingBlog.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blog not found');
  }

  // If slug is being updated, check if it's unique
  if (data.slug && data.slug !== existingBlog.slug) {
    const slugExists = await prisma.blogs.findUnique({
      where: { slug: data.slug },
    });

    if (slugExists) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Blog with this slug already exists',
      );
    }
  }

  // Update blog
  const updatedBlog = await prisma.blogs.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
         fullName: true,
          email: true,
        },
      },
    },
  });

  // ✅ Redis: সব related cache invalidate করো
  await invalidateBlogCache(id, existingBlog.slug);

  // ✅ Redis: Updated blog নতুন করে cache করো
  await redis.setex(
    CacheKeys.blog(id),
    CacheTTL.blog,
    JSON.stringify(updatedBlog),
  );

  // ✅ Redis: New slug দিয়েও cache করো (if slug changed)
  if (updatedBlog.slug !== existingBlog.slug) {
    await redis.setex(
      CacheKeys.blogSlug(updatedBlog.slug),
      CacheTTL.blog,
      JSON.stringify(updatedBlog),
    );
  }

  return updatedBlog;
};

/**
 * HARD DELETE BLOG
 * Redis Usage:
 * 1. Blog delete করার পর সব cache মুছে দেয়
 */
const deleteIntoDb = async (id: string) => {
  const blog = await prisma.blogs.findUnique({
    where: { id },
  });

  if (!blog) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blog not found');
  }

  // Hard delete
  await prisma.blogs.delete({
    where: { id },
  });

  // ✅ Redis: সব related cache মুছে দাও
  await invalidateBlogCache(id, blog.slug);

  return { message: 'Blog deleted successfully' };
};

/**
 * SOFT DELETE BLOG
 * Redis Usage: Same as hard delete - cache invalidation
 */
const softDeleteIntoDb = async (id: string) => {
  const blog = await prisma.blogs.findUnique({
    where: { id },
  });

  if (!blog || blog.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blog not found');
  }

  // Soft delete
  const deletedBlog = await prisma.blogs.update({
    where: { id },
    data: {
      isDeleted: true,
      updatedAt: new Date(),
    },
  });

  // ✅ Redis: সব related cache মুছে দাও
  await invalidateBlogCache(id, blog.slug);

  return { message: 'Blog soft deleted successfully' };
};

/**
 * LIKE BLOG
 * Redis Usage:
 * 1. User already liked কিনা check করে (Redis set use করে)
 * 2. Like count increment করে (Redis counter)
 * 3. Database update করে
 */
const likeBlog = async (blogId: string, userId: string) => {
  const likeKey = CacheKeys.likes(blogId);
  const userLikeKey = CacheKeys.userLike(userId, blogId);

  // ✅ Redis: Check if user already liked (fast lookup)
  const alreadyLiked = await redis.get(userLikeKey);
  if (alreadyLiked) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You have already liked this blog',
    );
  }

  // ✅ Redis: Mark user as liked (30 days TTL)
  await redis.setex(userLikeKey, CacheTTL.userLike, '1');

  // ✅ Redis: Increment like counter
  await redis.incr(likeKey);

  // Database update
  await prisma.blogs.update({
    where: { id: blogId },
    data: {
      likes: {
        increment: 1,
      },
    },
  });

  // ✅ Redis: Blog cache invalidate করো (নতুন like count দেখানোর জন্য)
  await redis.del(CacheKeys.blog(blogId));

  return { message: 'Blog liked successfully' };
};

/**
 * UNLIKE BLOG
 * Redis Usage: Remove user like and decrement counter
 */
const unlikeBlog = async (blogId: string, userId: string) => {
  const likeKey = CacheKeys.likes(blogId);
  const userLikeKey = CacheKeys.userLike(userId, blogId);

  // ✅ Redis: Check if user liked
  const hasLiked = await redis.get(userLikeKey);
  if (!hasLiked) {
    throw new AppError(httpStatus.BAD_REQUEST, "You haven't liked this blog");
  }

  // ✅ Redis: Remove user like
  await redis.del(userLikeKey);

  // ✅ Redis: Decrement like counter
  await redis.decr(likeKey);

  // Database update
  await prisma.blogs.update({
    where: { id: blogId },
    data: {
      likes: {
        decrement: 1,
      },
    },
  });

  // ✅ Redis: Cache invalidate
  await redis.del(CacheKeys.blog(blogId));

  return { message: 'Blog unliked successfully' };
};

/**
 * GET TRENDING BLOGS
 * Redis Usage:
 * 1. Trending blogs cache করে (short TTL - 5 minutes)
 * 2. Views + Likes এর combination দিয়ে sort করে
 */
const getTrendingBlogs = async (limit = 10) => {
  const cacheKey = CacheKeys.trending();

  // ✅ Redis: Trending blogs cache check
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('✅ Cache HIT: Returning trending blogs from Redis');
    return JSON.parse(cached);
  }

  console.log('❌ Cache MISS: Fetching trending blogs from Database');

  // Calculate trending score: views * 0.7 + likes * 0.3
  const blogs = await prisma.blogs.findMany({
    where: {
      published: true,
      isDeleted: false,
    },
    orderBy: [{ views: 'desc' }, { likes: 'desc' }],
    take: limit,
    include: {
      user: {
        select: {
          id: true,
         fullName: true,
          email: true,
        },
      },
    },
  });

  // ✅ Redis: Trending blogs cache করো (short TTL - frequently updated)
  await redis.setex(cacheKey, CacheTTL.trending, JSON.stringify(blogs));

  return blogs;
};

/**
 * SEARCH BY TAGS
 * Redis Usage: Cache search results by tags combination
 */
const searchByTags = async (tags: string[]) => {
  const cacheKey = `blogs:search:tags:${tags.sort().join(',')}`;

  // ✅ Redis: Search results cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('✅ Cache HIT: Returning search results from Redis');
    return JSON.parse(cached);
  }

  console.log('❌ Cache MISS: Searching blogs in Database');

  const blogs = await prisma.blogs.findMany({
    where: {
      tags: {
        hasSome: tags,
      },
      published: true,
      isDeleted: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      user: {
        select: {
          id: true,
         fullName: true,
          email: true,
        },
      },
    },
  });

  // ✅ Redis: Cache search results
  await redis.setex(cacheKey, CacheTTL.list, JSON.stringify(blogs));

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
