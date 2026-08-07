import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Define the shape of the decoded token
interface DecodedToken {
  id: string;
  username: string;
  role: string;
}

// Extend Express' Request interface to include `user`
export interface AuthenticatedRequest extends Request {
  user?: DecodedToken;
}

// Middleware to verify JWT and attach the decoded user to the request
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Unauthorized: No token provided" });
    return;
  }

  // Expect header format: "Bearer <token>"
  const token = authHeader?.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Unauthorized: Token missing" });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded) => {
    if (err) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    req.user = decoded as DecodedToken;
    next();
  });
};
