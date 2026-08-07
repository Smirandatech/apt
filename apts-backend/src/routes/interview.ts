// src/routes/interviews.ts
import express from "express";
import pool from "../db/pool";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";

const router = express.Router();

// 🔹 GET all interviews for a specific job application
router.get("/:applicationId", authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { applicationId } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM InterviewStages WHERE job_application_id = $1 ORDER BY scheduled_at ASC",
      [applicationId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching interviews:", err);
    res.status(500).json({ error: "Failed to fetch interviews" });
  }
});

// 🔹 GET all interviews globally admin see all, dev see only their own
router.get("/", authenticateToken, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  const isDev = user?.role === "developer";

  try {
    let query = `
      SELECT i.*, a.title, a.company_name, a.resume_url, a.job_description_url, a.developer_id
      FROM InterviewStages i
      JOIN JobApplications a ON i.job_application_id = a.id
    `;
    let params: any[] = [];

    if (isDev) {
      query += " WHERE a.developer_id = $1";
      params.push(user?.id);
    }

    query += " ORDER BY i.scheduled_at ASC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching all interviews:", err);
    res.status(500).json({ error: "Failed to fetch interview stages" });
  }
});

// 🔹 POST create a new interview stage
router.post("/:applicationId", authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { applicationId } = req.params;
  const { stage_name, status, scheduled_at, notes, metadata } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO InterviewStages (job_application_id, stage_name, status, scheduled_at, notes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        applicationId,
        stage_name,
        status || "scheduled",
        scheduled_at || null,
        notes || null,
        metadata || {},
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating interview:", err);
    res.status(500).json({ error: "Failed to create interview" });
  }
});

// 🔹 PUT update an interview stage
router.put("/:id", authenticateToken, async (req: AuthenticatedRequest, res) : Promise<void> => {
  const { id } = req.params;
  const { stage_name, status, scheduled_at, notes, metadata } = req.body;

  try {
    const check = await pool.query("SELECT * FROM InterviewStages WHERE id = $1", [id]);
    if (check.rowCount === 0) {
      res.status(404).json({ error: "Interview not found" });
      return;
    }

    const result = await pool.query(
      `UPDATE InterviewStages
       SET stage_name = $1,
           status = $2,
           scheduled_at = $3,
           notes = $4,
           metadata = $5
       WHERE id = $6
       RETURNING *`,
      [
        stage_name,
        status,
        scheduled_at || null,
        notes || null,
        metadata || {},
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating interview:", err);
    res.status(500).json({ error: "Failed to update interview" });
  }
});

export default router;
