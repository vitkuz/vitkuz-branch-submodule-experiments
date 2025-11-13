import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface AuthToken {
  token: string;
  userId: string;
  expiresAt: Date;
}

export const hashPassword = (password: string, salt: string): string => {
  return createHash('sha256')
    .update(password + salt)
    .digest('hex');
};

export const generateToken = (userId: string): AuthToken => {
  const token: string = uuid();
  const expiresAt: Date = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  return {
    token,
    userId,
    expiresAt,
  };
};

export const validateToken = (token: AuthToken): boolean => {
  return token.expiresAt > new Date();
};
