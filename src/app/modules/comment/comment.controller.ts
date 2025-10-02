import catchAsync from '../../utils/catchAsync';
import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import { Request, Response } from 'express';
import { CommentServices } from './comment.service';
import { prisma } from '../../utils/prisma';
import AppError from '../../errors/AppError';


const createIntoDb = catchAsync(async (req: Request, res: Response) => {
  const result = await CommentServices.createIntoDb(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Successfully created comment',
    data: result,
  });
});

const getAllComment = catchAsync(async (req: Request, res: Response) => {
  const result = await CommentServices.getAllComment(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved all comments',
    data: result,
  });
});

const getMyComment = catchAsync(async (req: Request, res: Response) => {
  const result = await CommentServices.getMyComment(req.user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved my comments',
    data: result,
  });
});

const getCommentById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CommentServices.getCommentByIdFromDB(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved comment',
    data: result,
  });
});

const updateIntoDb = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Check if user owns the comment
  const comment = await prisma.comment.findUnique({
    where: { id, isDeleted: false },
  });

  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  if (comment.userId !== userId && req.user.role !== 'SUPERADMIN') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not authorized to update this comment',
    );
  }

  const result = await CommentServices.updateIntoDb(id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully updated comment',
    data: result,
  });
});

const deleteIntoDb = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Check if user owns the comment or is blog author
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: {
      blog: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  // Allow delete if: user is comment author, blog author, or superadmin
  const isCommentAuthor = comment.userId === userId;
  const isBlogAuthor = comment.blog.userId === userId;
  const isSuperAdmin = req.user.role === 'SUPERADMIN';

  if (!isCommentAuthor && !isBlogAuthor && !isSuperAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not authorized to delete this comment',
    );
  }

  const result = await CommentServices.deleteIntoDb(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully deleted comment',
    data: result,
  });
});

const softDeleteIntoDb = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Check if user owns the comment
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: {
      blog: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  // Allow soft delete if: user is comment author, blog author, or superadmin
  const isCommentAuthor = comment.userId === userId;
  const isBlogAuthor = comment.blog.userId === userId;
  const isSuperAdmin = req.user.role === 'SUPERADMIN';

  if (!isCommentAuthor && !isBlogAuthor && !isSuperAdmin) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not authorized to delete this comment',
    );
  }

  const result = await CommentServices.softDeleteIntoDb(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully soft deleted comment',
    data: result,
  });
});

export const CommentController = {
  createIntoDb,
  getAllComment,
  getMyComment,
  getCommentById,
  updateIntoDb,
  deleteIntoDb,
  softDeleteIntoDb,
};
