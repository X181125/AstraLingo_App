import type { Response } from 'express';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function ok(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ success: true, data });
}
