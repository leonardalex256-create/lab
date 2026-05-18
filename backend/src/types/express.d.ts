declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth` after a valid Bearer JWT. */
      userId?: number;
      /** Role string from JWT payload. */
      userRole?: string;
    }
  }
}

export {};
