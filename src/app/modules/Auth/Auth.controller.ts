import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AuthServices } from './Auth.service';

const loginWithOtp = catchAsync(async (req, res) => {
  const result = await AuthServices.loginUser(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User logged in successfully',
    data: result,
  });
});

const registerWithOtp = catchAsync(async (req, res) => {
  const result = await AuthServices.registerUser(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'User Created Successfully',
    data: result,
  });
});

const getAllUsers = catchAsync(async (req, res) => {
  const result = await AuthServices.getAllUsersFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Users retrieved successfully',
    data: result,
  });
});

const getMyProfile = catchAsync(async (req, res) => {
  const authUser = req.user.id;
  const result = await AuthServices.myProfile(authUser);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'User Created Successfully',
    data: result,
  });
});

export const AuthControllers = {
  loginWithOtp,
  registerWithOtp,
  getMyProfile,
  getAllUsers,
};
