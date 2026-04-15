import { Request, Response, NextFunction } from 'express';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, error: { code: 'NO_TOKEN', message: 'Auth required' } });
  next();
};

export const authorize = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => next();
