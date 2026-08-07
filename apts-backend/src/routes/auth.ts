import express from "express";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db/pool";
import { User } from "../types/user";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";

const router = express.Router();

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { username, password, role } = req.body;
  if(role === 'admin') {
    res.status(403).json({ error: "Admin role is not allowed" });
    return;
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO Users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role",
      [username, hash, role]
    );
    const user: User = result.rows[0];
    res.status(201).json({
      id: user.id,
      name: user.username,
      role: user.role,
    });
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { name, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM Users WHERE username = $1", [
      name,
    ]);
    const user: User = result.rows?.[0];
    if (!user) res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" }
    );

    res.json({ id: user.id, name: user.username, role: user.role, token });
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

router.get(
  "/me",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // We can now safely access req.user because the middleware has verified the token.
    const { id } = req.user!; // The exclamation mark tells TypeScript that user is defined here.
    try {
      const result = await pool.query(
        "SELECT id, username, role, theme_preference FROM Users WHERE id = $1",
        [id]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "User not found" });
      }
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error });
    }
  }
);

// Get theme preference for authenticated user
router.get(
  "/theme",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.user!;
    try {
      const result = await pool.query(
        "SELECT theme_preference FROM Users WHERE id = $1",
        [id]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({ theme_preference: result.rows[0].theme_preference || "light" });
    } catch (error) {
      res.status(500).json({ error });
    }
  }
);

// Update theme preference for authenticated user
router.patch(
  "/theme",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.user!;
    const { theme_preference } = req.body;
    
    if (theme_preference && !["light", "dark"].includes(theme_preference)) {
      res.status(400).json({ error: "Theme preference must be 'light' or 'dark'" });
      return;
    }

    try {
      await pool.query(
        "UPDATE Users SET theme_preference = COALESCE($1, theme_preference) WHERE id = $2",
        [theme_preference, id]
      );
      res.json({ success: true, theme_preference: theme_preference || "light" });
    } catch (error) {
      res.status(500).json({ error });
    }
  }
);

export default router;
