import { Request, Response } from 'express';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ success: false, error: `Route non trouvée : ${req.method} ${req.originalUrl}` });
}