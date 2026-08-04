import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data, ...(message && { message }) });
}

export function sendError(res: Response, error: string, statusCode = 400, details?: unknown): Response {
  return res.status(statusCode).json(
    details !== undefined
      ? { success: false, error, details }
      : { success: false, error }
  );
}