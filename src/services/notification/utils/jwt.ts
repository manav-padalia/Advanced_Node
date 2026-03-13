import { jwt } from '@ecommerce/shared/packages';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export const verifyAccessToken = (token: string): JWTPayload => {
  const secret = process.env.JWT_ACCESS_SECRET || 'default-secret';
  return jwt.verify(token, secret) as JWTPayload;
};
