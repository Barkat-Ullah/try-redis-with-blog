import { Request } from 'express';
import { Comment } from '@prisma/client';
import httpStatus from 'http-status';
import { prisma } from '../../utils/prisma';
import AppError from '../../errors/AppError';

// Create a new comment or reply
const createIntoDb = async (req: Request) => {
  const { content, blogId, parentId } = req.body;
  const userId = req.user.id;

  // Validate blog exists and is published
  const blog = await prisma.blogs.findUnique({
    where: { id: blogId, isDeleted: false, published: true },
  });

  if (!blog) {
    throw new AppError(httpStatus.NOT_FOUND, 'Blog not found or not published');
  }

  // If parentId exists, validate parent comment exists
  if (parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentId, isDeleted: false },
    });

    if (!parentComment) {
      throw new AppError(httpStatus.NOT_FOUND, 'Parent comment not found');
    }

    // Ensure parent comment belongs to same blog
    if (parentComment.blogId !== blogId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Parent comment does not belong to this blog',
      );
    }
  }

  // Create comment
  const comment = await prisma.comment.create({
    data: {
      content,
      blogId,
      userId,
      parentId: parentId || null,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profile: true,
        },
      },
    },
  });

  return comment;
};

// Get all comments with filters and pagination
const getAllComment = async (query: Record<string, any>) => {
  const { page = 1, limit = 10, blogId, userId, parentId, searchTerm } = query;

  const skip = (Number(page) - 1) * Number(limit);

  const whereConditions: any = {
    isDeleted: false,
  };

  if (blogId) {
    whereConditions.blogId = blogId;
  }

  if (userId) {
    whereConditions.userId = userId;
  }

  // If parentId is explicitly null, get only parent comments
  if (parentId === 'null' || parentId === null) {
    whereConditions.parentId = null;
  } else if (parentId) {
    whereConditions.parentId = parentId;
  }

  if (searchTerm) {
    whereConditions.content = {
      contains: searchTerm,
      mode: 'insensitive',
    };
  }

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: whereConditions,
      skip,
      take: Number(limit),
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profile: true,
          },
        },
        replies: {
          where: { isDeleted: false },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                profile: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        _count: {
          select: {
            replies: {
              where: { isDeleted: false },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.comment.count({ where: whereConditions }),
  ]);

  return {
    data: comments,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

// Get all comments by a specific user (my comments)
const getMyComment = async (userId: string) => {
  const comments = await prisma.comment.findMany({
    where: {
      userId,
      isDeleted: false,
    },
    include: {
      blog: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      parent: {
        select: {
          id: true,
          content: true,
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      },
      _count: {
        select: {
          replies: {
            where: { isDeleted: false },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return comments;
};

// Get comment by ID with all replies
const getCommentByIdFromDB = async (id: string) => {
  const comment = await prisma.comment.findUnique({
    where: { id, isDeleted: false },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profile: true,
        },
      },
      blog: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      parent: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              profile: true,
            },
          },
        },
      },
      replies: {
        where: { isDeleted: false },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profile: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      _count: {
        select: {
          replies: {
            where: { isDeleted: false },
          },
        },
      },
    },
  });

  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  return comment;
};

// Update comment (only content can be updated)
const updateIntoDb = async (id: string, data: Partial<Comment>) => {
  // Check if comment exists
  const existingComment = await prisma.comment.findUnique({
    where: { id, isDeleted: false },
  });

  if (!existingComment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  // Only allow content update
  const updatedComment = await prisma.comment.update({
    where: { id },
    data: {
      content: data.content,
      isEdited: true,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profile: true,
        },
      },
    },
  });

  return updatedComment;
};

// Hard delete comment and all its replies
const deleteIntoDb = async (id: string) => {
  const comment = await prisma.comment.findUnique({
    where: { id },
  });

  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  // Use transaction to delete comment and all replies
  await prisma.$transaction(async tx => {
    // Delete all replies first
    await tx.comment.deleteMany({
      where: { parentId: id },
    });

    // Then delete the parent comment
    await tx.comment.delete({
      where: { id },
    });
  });

  return { message: 'Comment and all replies deleted successfully' };
};

// Soft delete comment
const softDeleteIntoDb = async (id: string) => {
  const comment = await prisma.comment.findUnique({
    where: { id },
  });

  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  // Soft delete the comment
  const updatedComment = await prisma.comment.update({
    where: { id },
    data: {
      isDeleted: true,
    },
  });

  return updatedComment;
};

export const CommentServices = {
  createIntoDb,
  getAllComment,
  getMyComment,
  getCommentByIdFromDB,
  updateIntoDb,
  deleteIntoDb,
  softDeleteIntoDb,
};
