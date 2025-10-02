import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { authValidation } from './Auth.validation';
import { AuthControllers } from './Auth.controller';
import clientInfoParser from '../../middlewares/clientInfoPerser';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();
router.get(
  '/',
  // auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),
  AuthControllers.getAllUsers,
);

router.get(
  '/my-profile',
  auth(UserRoleEnum.USER, UserRoleEnum.SUPERADMIN),
  AuthControllers.getMyProfile,
);
router.post(
  '/login',
  clientInfoParser,
  validateRequest.body(authValidation.loginUser),
  AuthControllers.loginWithOtp,
);

router.post('/register', clientInfoParser, AuthControllers.registerWithOtp);

export const AuthRouters = router;
