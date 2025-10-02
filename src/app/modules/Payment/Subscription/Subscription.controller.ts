import catchAsync from '../../utils/catchAsync';
import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import { Request, Response } from 'express';
import { SubscriptionServices } from './Subscription.service';

const createIntoDb = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionServices.createIntoDb(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Successfully created Subscription',
    data: result,
  });
});

const getAllSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionServices.getAllSubscription(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved all Subscription',
    data: result,
  });
});

const assignSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await SubscriptionServices.assignSubscriptionToUser(
    userId,
    req.body,
  );

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    // message: result.message,
    data: result,
  });
});

const getMySubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await SubscriptionServices.getMySubscription(userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved my Subscription ',
    data: result,
  });
});
const getSubscriptionById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SubscriptionServices.getSubscriptionByIdFromDB(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved Subscription by id',
    data: result,
  });
});

const updateIntoDb = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SubscriptionServices.updateIntoDb(id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully updated Subscription',
    data: result,
  });
});

const deleteIntoDb = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SubscriptionServices.deleteIntoDb(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully deleted Subscription',
    data: result,
  });
});

const deleteMySubscription = catchAsync(async (req, res) => {
  const userId = req.user.id;
  console.log('user', userId);
  const result = await SubscriptionServices.deleteMySubscription(userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Your subscription has been successfully deleted',
    data: result,
  });
});

export const SubscriptionController = {
  createIntoDb,
  getAllSubscription,
  assignSubscription,
  getSubscriptionById,
  updateIntoDb,
  deleteIntoDb,
  getMySubscription,
  deleteMySubscription,
};
