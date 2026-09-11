import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import mongoose from 'mongoose';
import User, { IUser, UserRole, USER_ROLES } from '../models/User';
import { env } from '../config/env';
import { formatSuccessResponse } from '../utils/response';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const ensureDatabaseReady = (): void => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB connection unavailable');
  }
};

const stripPassword = <T extends { password?: string }>(user: T): Omit<T, 'password'> => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

const validateRole = (role?: UserRole): UserRole | undefined => {
  if (!role) {
    return undefined;
  }

  if (!USER_ROLES.includes(role)) {
    throw new Error('Invalid role provided');
  }

  return role;
};

export const registerUser = async (payload: RegisterInput) => {
  ensureDatabaseReady();

  const { name, email, password, role } = payload;

  if (!name || !name.trim()) {
    throw new Error('Name is required');
  }

  if (!email || !email.trim()) {
    throw new Error('Email is required');
  }

  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  const normalizedEmail = normalizeEmail(email);
  const validatedRole = validateRole(role);

  if (normalizedEmail.length === 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Please provide a valid email address');
  }

  const existingUser = await User.findOne({ email: normalizedEmail }).lean();

  if (existingUser) {
    throw new Error('User already exists');
  }

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const newUser = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role: validatedRole || 'DEVICE',
    isActive: true
  });

  const userResponse = stripPassword(newUser.toObject());

  return formatSuccessResponse(
    {
      user: userResponse,
      token: generateToken(newUser)
    },
    'User registered successfully'
  );
};

export const loginUser = async (payload: LoginInput) => {
  ensureDatabaseReady();

  const { email, password } = payload;

  if (!email || !email.trim()) {
    throw new Error('Email is required');
  }

  if (!password || password.length < 8) {
    throw new Error('Invalid email or password');
  }

  const normalizedEmail = normalizeEmail(email);

  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    throw new Error('Account is inactive');
  }

  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user);
  const userResponse = stripPassword(user.toObject());

  return formatSuccessResponse(
    {
      user: userResponse,
      token
    },
    'Login successful'
  );
};

export const getCurrentUser = async (userId: string) => {
  ensureDatabaseReady();

  const user = await User.findById(userId).lean();

  if (!user) {
    throw new Error('User not found');
  }

  const userResponse = stripPassword({ ...user });

  return formatSuccessResponse(userResponse, 'Current user profile retrieved');
};

export const generateToken = (user: IUser) => {
  const signOptions: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn']
  };

  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    },
    env.JWT_SECRET,
    signOptions
  );
};

export const getUserById = async (userId: string) => {
  const user = await User.findById(userId).lean();
  return user;
};

export const isDatabaseAvailable = async (): Promise<boolean> => {
  try {
    await User.exists({});
    return true;
  } catch {
    return false;
  }
};
