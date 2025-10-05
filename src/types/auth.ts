export interface AuthUser {
  id: string;
  role: string;
  organizationId: string;
  name: string;
  email: string;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
