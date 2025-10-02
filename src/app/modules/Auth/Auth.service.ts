import { User } from '@prisma/client';
import { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import { prisma } from '../../utils/prisma';
import AppError from '../../errors/AppError';
import { StatusCodes } from 'http-status-codes';
import { comparePasswords, hashedPassword } from './Auth.utils';
import { generateToken } from '../../utils/generateToken';
import config from '../../../config';

const registerUser = async (payload: User) => {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (existingUser)
    throw new AppError(StatusCodes.BAD_REQUEST, 'Email already in use!');

  payload.password = await hashedPassword(payload.password);

  const user = await prisma.user.create({
    data: payload,
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
    },
  });
  const accessToken = await generateToken(
    {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.role,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as SignOptions['expiresIn'],
  );
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    accessToken: accessToken,
  };
};

const loginUser = async (payload: { email: string; password: string }) => {
  const { email, password } = payload;
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user)
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid credentials!');

  const isPasswordValid = await comparePasswords(password, user.password);
  if (!isPasswordValid)
    throw new AppError(StatusCodes.BAD_REQUEST, 'Wrong Password!');

  const accessToken = await generateToken(
    {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.role,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as SignOptions['expiresIn'],
  );

  return {
    accessToken,
  };
};

const getAllUsersFromDB = async (query: any) => {
  const result = await prisma.user.findMany();
  return result;
};

const myProfile = async (authUser: JwtPayload): Promise<User> => {
  const result = await prisma.user.findUnique({
    where: {
      id: authUser.id,
    },
    include: { Blogs: true },
  });

  if (!result) throw new AppError(StatusCodes.NOT_FOUND, 'Profile not found!');

  return result;
};

export const AuthServices = {
  registerUser,
  loginUser,
  myProfile,
  getAllUsersFromDB,
};
