import express from "express";
import pool from "../db/pool";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";
import { isSoftwareJob } from "../utils/softwareJob";

const router = express.Router();

// POST /api/applications - Submit job application
router.post("/", authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { title, company_name, job_description_url, job_description, resume_url, metadata } =
    req.body;
  const submitted_by = req.user?.id;

  const bCResult = await pool.query(
    `SELECT * FROM bidder_configs bc
    WHERE bc.bidder_id = $1`,
    [req.user?.id]
  );

  if (bCResult.rowCount === 0) {
    res.status(400).json({ error: "No bidder config found" });
    return;
  }

  const bidderConfig = bCResult.rows[0];

  const qualification = isSoftwareJob(title, job_description)
    ? null
    : "no software job";

  try {
    const result = await pool.query(
      `INSERT INTO JobApplications 
        (title, company_name, job_description_url, job_description, resume_url, submitted_by, metadata, developer_id, qualification)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, company_name, job_description_url, resume_url, status, metadata, created_at, developer_id, qualification`,
      [
        title,
        company_name,
        job_description_url,
        job_description,
        resume_url,
        submitted_by,
        metadata || {},
        bidderConfig?.developer_id,
        qualification,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error submitting application:", err);
    res.status(500).json({ error: "Failed to submit application" });
  }
});

// GET /api/applications - Fetch applications for logged-in user
// GET /api/applications?page=1&limit=10&status=interviewing&company=Acme
router.get("/", authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { page = 1, limit = 10, status, company_name } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const userId = req.user?.id;

  const filters: string[] = ["submitted_by = $1"];
  const params: any[] = [userId];
  let paramIndex = 2;

  if (status) {
    filters.push(`status = $${paramIndex++}`);
    params.push(status);
  }

  if (company_name) {
    filters.push(`company_name ILIKE $${paramIndex++}`);
    params.push(`%${company_name}%`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    // Apply deduplication: keep only the earliest record per (title, company, submitted_by)
    // Using a subquery with ROW_NUMBER to deduplicate before pagination
    // Duplicates are only considered when title, company, AND bidder (submitted_by) match
    const result = await pool.query(
      `SELECT * FROM (
        SELECT *, 
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(title), LOWER(company_name), submitted_by 
            ORDER BY created_at ASC
          ) as rn
        FROM JobApplications ${whereClause}
      ) ranked
      WHERE rn = 1
      ORDER BY created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Count total after deduplication
    const total = await pool.query(
      `SELECT COUNT(*) FROM (
        SELECT *, 
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(title), LOWER(company_name), submitted_by 
            ORDER BY created_at ASC
          ) as rn
        FROM JobApplications ${whereClause}
      ) ranked
      WHERE rn = 1`,
      params
    );

    res.json({
      data: result.rows,
      total: Number(total.rows[0].count),
    });
  } catch (err) {
    console.error("Error fetching paginated applications:", err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// DELETE /api/applications/:id
router.delete("/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM JobApplications WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Not found or unauthorized" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting application:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/applications/bulk - Bulk update applications
router.put("/bulk", authenticateToken, async (req: AuthenticatedRequest, res) :Promise<void> => {
  const { updates } = req.body;

  if (!Array.isArray(updates)) {
    res.status(400).json({ error: "Invalid updates format" });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const update of updates) {
        const {
          id,
          title,
          company_name,
          job_description,
          job_description_url,
          resume_url,
          metadata,
          status,
          qualification,
        } = update;

        await client.query(
          `UPDATE JobApplications
           SET title = COALESCE($1, title),
               company_name = COALESCE($2, company_name),
               job_description = COALESCE($3, job_description),
               job_description_url = COALESCE($4, job_description_url),
               resume_url = COALESCE($5, resume_url),
               metadata = COALESCE($6, metadata),
               status = COALESCE($7, status),
               qualification = COALESCE($8, qualification)
           WHERE id = $9`,
          [
            title,
            company_name,
            job_description,
            job_description_url,
            resume_url,
            metadata || {},
            status,
            qualification,
            id,
          ]
        );

        // Optional: Auto-create interview stage if needed
        if (status === "interviewing") {
          const checkInterview = await client.query(
            "SELECT 1 FROM InterviewStages WHERE job_application_id = $1 LIMIT 1",
            [id]
          );
          if (checkInterview.rowCount === 0) {
            await client.query(
              `INSERT INTO InterviewStages (job_application_id, stage_name, status, notes)
               VALUES ($1, 'recruiter', 'scheduling', 'Auto-created on bulk update')`,
              [id]
            );
          }
        }
      }

      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Bulk update failed:", err);
      res.status(500).json({ error: "Bulk update failed" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Database connection error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// PUT /api/applications/:id - Update a job application
router.put("/:id", authenticateToken, async (req: AuthenticatedRequest, res) : Promise<void> => {
  const { id } = req.params;
  const {
    title,
    company_name,
    job_description,
    job_description_url,
    resume_url,
    metadata,
    status,
    qualification,
  } = req.body;

  try {
    // Ensure application belongs to the user
    const check = await pool.query(
      "SELECT * FROM JobApplications WHERE id = $1",
      [id]
    );

    if (check.rowCount === 0) {
      res.status(403).json({ error: "Not authorized to edit this application" });
      return;
    }

    const updateResult = await pool.query(
      `UPDATE JobApplications
       SET title = $1,
           company_name = $2,
           job_description = $3,
           job_description_url = $4,
           resume_url = $5,
           metadata = $6,
           status = $7,
           qualification = $8
       WHERE id = $9
       RETURNING *`,
      [
        title,
        company_name,
        job_description,
        job_description_url,
        resume_url,
        metadata || {},
        status,
        qualification,
        id,
      ]
    );

    const updated = updateResult.rows[0];

    if (status === "interviewing") {
      const checkInterview = await pool.query(
        "SELECT 1 FROM InterviewStages WHERE job_application_id = $1 LIMIT 1",
        [id]
      );

      if (checkInterview.rowCount === 0) {
        await pool.query(
          `INSERT INTO InterviewStages (job_application_id, stage_name, status, notes)
           VALUES ($1, $2, $3, $4)`,
          [
            id,
            "recruiter",
            "scheduling",
            "Auto-created on status update",
          ]
        );
      }
    }

    res.json(updated);
  } catch (err) {
    console.error("Error updating application:", err);
    res.status(500).json({ error: "Failed to update application" });
  }
});

export default router;
