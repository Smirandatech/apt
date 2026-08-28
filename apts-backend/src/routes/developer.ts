import express from "express";
import multer from "multer";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import pool from "../db/pool";
import { Request, Response } from "express";
import { drive, uploadToDrive } from "../utils/uploadToDrive";
import { parseISO, isValid } from "date-fns";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /developer/templates - Get all resume templates for logged-in developer
router.get("/templates", authenticateToken, async (req: any, res: Response) => {
  try {
    const developerId = req.user.id;
    const result = await pool.query(
      "SELECT * FROM resume_templates WHERE developer_id = $1 ORDER BY created_at DESC",
      [developerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching templates:", err);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// POST /developer/templates - Upload a new resume template
router.post(
  "/templates",
  authenticateToken,
  upload.single("file"),
  async (req: any, res: Response): Promise<void> => {
    try {
      const developerId = req.user.id;
      const { name, company_count, prompt, demographics } = req.body;

      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: "No file uploaded." });
        return;
      }

      // Upload file to Google Drive
      // const fileUrl = await uploadToDrive(
      //   req.file.buffer,
      //   req.file.originalname,
      //   "18xm2sSKhI9azGoMKC6r0dTIDG3HVBNVl",
      //   true
      // );
      const fileUrl = "https://drive.google.com/uc?id=1LEo7c97sdx6W49fxV4s9NBvC-RY1Ogyz&export=download";

      const result = await pool.query(
        `INSERT INTO resume_templates (name, file_url, developer_id, company_count, prompt, demographics)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          name,
          fileUrl,
          developerId,
          Number(company_count ?? 0),
          prompt,
          demographics,
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Error uploading template:", err);
      res.status(500).json({ error: "Template upload failed" });
    }
  }
);

// PATCH /developer/templates/:id
router.patch(
  "/templates/:id",
  authenticateToken,
  upload.single("file"), // 👈 enable file upload
  async (req: AuthenticatedRequest, res) => {
    const { name, company_count, prompt, demographics } = req.body;
    const templateId = req.params.id;

    try {
      let fileUrl;
      if (req.file) {
        fileUrl = await uploadToDrive(
          req.file.buffer,
          req.file.originalname,
          "18xm2sSKhI9azGoMKC6r0dTIDG3HVBNVl",
          true
        );
      }

      await pool.query(
        `UPDATE resume_templates
         SET name = COALESCE($1, name),
             company_count = COALESCE($2, company_count),
             file_url = COALESCE($3, file_url),
             developer_id = $4,
             prompt = COALESCE($5, prompt),
             demographics = $6
         WHERE id = $7 AND developer_id = $4`,
        [
          name,
          company_count,
          fileUrl,
          req.user?.id,
          prompt,
          demographics,
          templateId,
        ]
      );

      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error updating template:", err);
      res.status(500).json({ error: "Failed to update template" });
    }
  }
);

router.delete(
  "/templates/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const templateId = req.params.id;

    try {
      const result = await pool.query(
        "SELECT file_url FROM resume_templates WHERE id = $1 AND developer_id = $2",
        [templateId, req.user?.id]
      );

      const template = result.rows[0];
      if (!template) {
        res.status(404).json({ error: "Template not found" });
        return;
      }

      // Extract Google Drive file ID
      const match = template.file_url.match(/id=([^&]+)/);
      const fileId = match?.[1];

      if (fileId) {
        try {
          await drive.files.delete({ fileId });
        } catch (err) {
          console.warn(
            "Drive file delete failed (maybe already gone):",
            (err as Error).message
          );
        }
      }

      // Delete DB record
      await pool.query("DELETE FROM resume_templates WHERE id = $1", [
        templateId,
      ]);

      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error deleting resume template:", err);
      res.status(500).json({ error: "Failed to delete resume template" });
    }
  }
);

// GET /developer/bidders - Get all bidders for the logged-in developer
router.get("/bidders", authenticateToken, async (req: any, res: Response) => {
  try {
    const developerId = req.user.id;
    const result = await pool.query(
      `SELECT u.id, u.username, bc.template_id, bc.drive_folder_id, bc.rate
       FROM bidder_configs bc
       JOIN users u ON u.id = bc.bidder_id
       WHERE bc.developer_id = $1`,
      [developerId]
    );

    const rows = result.rows.map((row) => ({
      ...row,
      rate: row.rate ? parseFloat(row.rate) : 0,
    }));
    res.json(rows);
  } catch (err) {
    console.error("Error fetching bidders:", err);
    res.status(500).json({ error: "Failed to fetch bidders" });
  }
});

// POST /developer/bidders - Assign a template and folder to a bidder
router.post("/bidders", authenticateToken, async (req: any, res: Response) => {
  try {
    const developerId = req.user.id;
    const { bidder_id, template_id, drive_folder_id, rate } = req.body;

    await pool.query(
      `INSERT INTO bidder_configs (developer_id, bidder_id, template_id, drive_folder_id, rate)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (bidder_id)
       DO UPDATE SET template_id = $3, drive_folder_id = $4, rate = $5`,
      [developerId, bidder_id, template_id, drive_folder_id, rate]
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error updating bidder config:", err);
    res.status(500).json({ error: "Failed to update bidder config" });
  }
});

router.get(
  "/unassigned-bidders",
  authenticateToken,
  async (_req: any, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT id, username
       FROM users
       WHERE role = 'bidder'
         AND id NOT IN (SELECT bidder_id FROM bidder_configs)`
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch unassigned bidders" });
    }
  }
);

router.post(
  "/assign-bidder",
  authenticateToken,
  async (req: any, res: Response) => {
    const { bidder_id } = req.body;
    const developer_id = req.user.id;

    await pool.query(
      `INSERT INTO bidder_configs (developer_id, bidder_id) VALUES ($1, $2)`,
      [developer_id, bidder_id]
    );

    res.json({ success: true });
  }
);

// DELETE /developer/bidders/:bidderId - Unassign a bidder
router.delete(
  "/bidders/:bidderId",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { bidderId } = req.params;

      await pool.query(
        `DELETE FROM bidder_configs WHERE bidder_id = $1 AND developer_id = $2`,
        [bidderId, req.user?.id]
      );

      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error unassigning bidder:", err);
      res.status(500).json({ error: "Failed to unassign bidder" });
    }
  }
);

// GET /developer/applications - Paginated applications for this developer
router.get(
  "/applications",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const { page = 1, limit = 10, status, company_name, bidder_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const developerId = req.user?.id;

    const filters: string[] = ["developer_id = $1"];
    const params: any[] = [developerId];
    let paramIndex = 2;

    if (status) {
      filters.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (company_name) {
      filters.push(`company_name ILIKE $${paramIndex++}`);
      params.push(`%${company_name}%`);
    }

    if (bidder_id) {
      filters.push(`submitted_by = $${paramIndex++}`);
      params.push(`${bidder_id}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    try {
      // Apply deduplication: keep only the earliest record per (title, company, submitted_by)
      // Using a subquery with ROW_NUMBER to deduplicate before pagination
      // Duplicates are only considered when title, company, AND bidder (submitted_by) match
      const result = await pool.query(
        `SELECT * FROM (
          SELECT ja.*, u.username AS bidder_name,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(ja.title), LOWER(ja.company_name), ja.submitted_by 
              ORDER BY ja.created_at ASC
            ) as rn
          FROM jobapplications ja
          JOIN users u ON ja.submitted_by = u.id
          ${whereClause}
        ) ranked
        WHERE rn = 1
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      // Count total after deduplication
      const total = await pool.query(
        `SELECT COUNT(*) FROM (
          SELECT ja.*, u.username AS bidder_name,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(ja.title), LOWER(ja.company_name), ja.submitted_by 
              ORDER BY ja.created_at ASC
            ) as rn
          FROM jobapplications ja
          JOIN users u ON ja.submitted_by = u.id
          ${whereClause}
        ) ranked
        WHERE rn = 1`,
        params
      );

      res.json({
        data: result.rows,
        total: Number(total.rows[0].count),
      });
    } catch (err) {
      console.error("Error fetching developer applications:", err);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  }
);

// GET /developer/other-developers - Get list of other developers who have jobs (for filtering dropdown)
router.get(
  "/other-developers",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const currentDeveloperId = req.user?.id;
    try {
      const result = await pool.query(
        `SELECT DISTINCT dev.id, dev.username
         FROM jobapplications ja
         JOIN users dev ON ja.developer_id = dev.id
         WHERE ja.developer_id != $1
           AND ja.developer_id IS NOT NULL
           AND ja.submitted_by != $1
           AND ja.created_at >= CURRENT_DATE - INTERVAL '7 days'
         ORDER BY dev.username ASC`,
        [currentDeveloperId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Error fetching other developers:", err);
      res.status(500).json({ error: "Failed to fetch other developers" });
    }
  }
);

// GET /developer/other-developers-jobs - Get jobs from other developers, excluding current developer's existing jobs
router.get(
  "/other-developers-jobs",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const { page = 1, limit = 10, status, company_name, developer_id } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const currentDeveloperId = req.user?.id;

    try {
      // First, get all unique (title, company) combinations from current developer's jobs
      const currentDevJobs = await pool.query(
        `SELECT DISTINCT LOWER(title) as title_lower, LOWER(company_name) as company_lower
         FROM jobapplications
         WHERE developer_id = $1`,
        [currentDeveloperId]
      );

      // Build filters for other developers' jobs
      // Jobs where submitted_by != currentDeveloperId (jobs from other developers)
      // AND developer_id != currentDeveloperId (jobs belonging to other developers)
      // AND created_at >= last 7 days
      const filters: string[] = [
        "ja.submitted_by != $1",
        "ja.developer_id != $1",
        "ja.developer_id IS NOT NULL",
        "ja.created_at >= CURRENT_DATE - INTERVAL '7 days'"
      ];
      const params: any[] = [currentDeveloperId];
      let paramIndex = 2;

      // Exclude jobs that match current developer's title+company combinations
      if (currentDevJobs.rows.length > 0) {
        // Use NOT EXISTS to exclude matching title+company combinations
        const exclusionSubquery = `
          NOT EXISTS (
            SELECT 1 FROM jobapplications ja_exclude
            WHERE ja_exclude.developer_id = $1
              AND LOWER(ja_exclude.title) = LOWER(ja.title)
              AND LOWER(ja_exclude.company_name) = LOWER(ja.company_name)
          )
        `;
        filters.push(exclusionSubquery);
      }

      if (status) {
        filters.push(`ja.status = $${paramIndex++}`);
        params.push(status);
      }

      if (company_name) {
        filters.push(`ja.company_name ILIKE $${paramIndex++}`);
        params.push(`%${company_name}%`);
      }

      if (developer_id) {
        filters.push(`ja.developer_id = $${paramIndex++}`);
        params.push(developer_id);
      }

      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

      // Fetch other developers' jobs with deduplication
      // Deduplicate based on (title, company, submitted_by) - keep earliest created
      // Duplicates are only considered when title, company, AND bidder (submitted_by) match
      // Join with developer (via developer_id) to get developer's name instead of bidder's name
      const result = await pool.query(
        `SELECT * FROM (
          SELECT ja.*, 
            dev.username AS bidder_name,
            dev.username AS developer_name,
            u.username AS submitted_by_name,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(ja.title), LOWER(ja.company_name), ja.submitted_by
              ORDER BY ja.created_at ASC
            ) as rn
          FROM jobapplications ja
          JOIN users u ON ja.submitted_by = u.id
          JOIN users dev ON ja.developer_id = dev.id
          ${whereClause}
        ) ranked
        WHERE rn = 1
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      // Count total after deduplication and filtering
      const total = await pool.query(
        `SELECT COUNT(*) FROM (
          SELECT ja.*, dev.username AS bidder_name,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(ja.title), LOWER(ja.company_name), ja.submitted_by
              ORDER BY ja.created_at ASC
            ) as rn
          FROM jobapplications ja
          JOIN users u ON ja.submitted_by = u.id
          JOIN users dev ON ja.developer_id = dev.id
          ${whereClause}
        ) ranked
        WHERE rn = 1`,
        params
      );

      res.json({
        data: result.rows,
        total: Number(total.rows[0].count),
      });
    } catch (err) {
      console.error("Error fetching other developers' jobs:", err);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  }
);

// 🔹 Save developer settings like API keys and model preference
router.patch(
  "/settings",
  authenticateToken,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (req.user?.role !== "developer") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { openai_api_key, deepseek_api_key, preferred_ai_model } = req.body;

    try {
      await pool.query(
        `
        UPDATE users 
        SET 
          openai_api_key = COALESCE($1, openai_api_key),
          deepseek_api_key = COALESCE($2, deepseek_api_key),
          preferred_ai_model = COALESCE($3, preferred_ai_model)
        WHERE id = $4
        `,
        [openai_api_key, deepseek_api_key, preferred_ai_model, req.user.id]
      );

      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Failed to update developer settings:", err);
      res.status(500).json({ error: "Failed to update settings" });
    }
  }
);


// 🔹 Get current settings for this developer
router.get(
  "/settings",
  authenticateToken,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (req.user?.role !== "developer") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    try {
      const result = await pool.query(
        `
        SELECT openai_api_key, deepseek_api_key, preferred_ai_model 
        FROM users 
        WHERE id = $1
        `,
        [req.user.id]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Failed to load developer settings:", err);
      res.status(500).json({ error: "Failed to load settings" });
    }
  }
);


router.get(
  "/payments",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const bidderStats = await pool.query(
        `SELECT 
    u.id AS bidder_id,
    u.username,
    bc.rate,
    COALESCE(app.count, 0) AS application_count,
    bc.last_paid_at,
    (
      SELECT COALESCE(json_agg(sub), '[]'::json)
      FROM (
        SELECT *
        FROM bidder_payments
        WHERE bidder_id = u.id AND developer_id = $1
        ORDER BY paid_at DESC
        LIMIT 10
      ) sub
    ) AS payment_history
  FROM users u
  JOIN bidder_configs bc ON u.id = bc.bidder_id
  LEFT JOIN (
    SELECT submitted_by, COUNT(*) AS count
    FROM (
      SELECT ja.submitted_by,
        ROW_NUMBER() OVER (
          PARTITION BY LOWER(ja.title), LOWER(ja.company_name), ja.submitted_by 
          ORDER BY ja.created_at ASC
        ) as rn
      FROM jobapplications ja
      JOIN bidder_configs bc ON ja.submitted_by = bc.bidder_id
      WHERE ja.created_at > COALESCE(bc.last_paid_at, '1970-01-01') AND ja.developer_id = $1
        AND ja.qualification IS DISTINCT FROM 'no confirmation email'
        AND ja.qualification IS DISTINCT FROM 'not remote'
        AND ja.qualification IS DISTINCT FROM 'no recent job'
        AND ja.qualification IS DISTINCT FROM 'no software job'
    ) ranked
    WHERE rn = 1
    GROUP BY submitted_by
  ) app ON app.submitted_by = u.id
  WHERE bc.developer_id = $1`,
        [req.user?.id]
      );

      res.json(bidderStats.rows);
    } catch (err) {
      console.error("Error fetching payments:", err);
      res.status(500).json({ error: "Failed to load payments" });
    }
  }
);

router.post(
  "/pay-bidder/:bidderId",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    const { bidderId } = req.params;

    const stats = await pool.query(
      `SELECT COUNT(*) as count, bc.rate
     FROM bidder_configs bc
     JOIN users u ON u.id = bc.bidder_id
     LEFT JOIN (
       SELECT a.id, a.submitted_by, a.created_at,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(a.title), LOWER(a.company_name), a.submitted_by 
           ORDER BY a.created_at ASC
         ) as rn
       FROM jobapplications a
       WHERE a.submitted_by = bc.bidder_id 
         AND (a.created_at > bc.last_paid_at OR bc.last_paid_at IS NULL)
         AND a.qualification IS DISTINCT FROM 'no confirmation email'
         AND a.qualification IS DISTINCT FROM 'not remote'
         AND a.qualification IS DISTINCT FROM 'no recent job'
         AND a.qualification IS DISTINCT FROM 'no software job'
     ) ranked ON ranked.submitted_by = bc.bidder_id AND ranked.rn = 1
     WHERE bc.bidder_id = $1 AND bc.developer_id = $2
     GROUP BY bc.rate`,
      [bidderId, req.user?.id]
    );

    const { count, rate } = stats.rows[0];
    const amount = parseFloat(rate) * Number(count);

    await pool.query(
      `INSERT INTO bidder_payments (bidder_id, developer_id, amount, application_count)
     VALUES ($1, $2, $3, $4)`,
      [bidderId, req.user?.id, amount, count]
    );

    await pool.query(
      `UPDATE bidder_configs SET last_paid_at = CURRENT_TIMESTAMP
     WHERE bidder_id = $1 AND developer_id = $2`,
      [bidderId, req.user?.id]
    );

    res.json({ success: true });
  }
);

router.get(
  "/payment-history",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    const result = await pool.query(
      `SELECT bp.*, u.username AS bidder_name
     FROM bidder_payments bp
     JOIN users u ON u.id = bp.bidder_id
     WHERE bp.developer_id = $1
     ORDER BY bp.paid_at DESC`,
      [req.user?.id]
    );

    res.json(result.rows);
  }
);

// PATCH /developer/payments/:bidderId/last-paid-at
router.patch(
  "/payments/:bidderId/last-paid-at",
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    const { bidderId } = req.params;
    const { last_paid_at } = req.body;

    try {
      await pool.query(
        `UPDATE bidder_configs
         SET last_paid_at = $1
         WHERE bidder_id = $2 AND developer_id = $3`,
        [last_paid_at || null, bidderId, req.user?.id]
      );

      res.json({ success: true });
    } catch (err) {
      console.error("Failed to update last_paid_at:", err);
      res.status(500).json({ error: "Failed to update" });
    }
  }
);

// DELETE /developer/payment-history/:paymentId
router.delete(
  "/payment-history/:paymentId",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) : Promise<void> => {
    const { paymentId } = req.params;

    try {
      // First, get the payment being deleted (we need bidder_id)
      const { rows } = await pool.query(
        `SELECT * FROM bidder_payments WHERE id = $1 AND developer_id = $2`,
        [paymentId, req.user?.id]
      );

      const payment = rows[0];
      if (!payment) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }

      const bidderId = payment.bidder_id;

      // Delete the payment
      await pool.query(
        `DELETE FROM bidder_payments WHERE id = $1 AND developer_id = $2`,
        [paymentId, req.user?.id]
      );

      // Get the next latest payment
      const nextPayment = await pool.query(
        `SELECT MAX(paid_at) AS latest_paid_at
         FROM bidder_payments
         WHERE bidder_id = $1 AND developer_id = $2`,
        [bidderId, req.user?.id]
      );

      const newLastPaidAt = nextPayment.rows[0].latest_paid_at || null;

      // Update last_paid_at in bidder_configs
      await pool.query(
        `UPDATE bidder_configs
         SET last_paid_at = $1
         WHERE bidder_id = $2 AND developer_id = $3`,
        [newLastPaidAt, bidderId, req.user?.id]
      );

      res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete payment:", err);
      res.status(500).json({ error: "Failed to delete payment" });
    }
  }
);


// Add to developer router
router.get(
  "/analytics/bidder-activity",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const developerId = req.user?.id;
    const { interval = "daily", start, end } = req.query;

    const groupFormat =
      interval === "weekly"
        ? "IYYY-IW"
        : interval === "monthly"
        ? "YYYY-MM"
        : "YYYY-MM-DD";

    const startDate = isValid(parseISO(String(start))) ? start : "CURRENT_DATE - INTERVAL '6 days'";
    const endDate = isValid(parseISO(String(end))) ? end : "CURRENT_DATE + INTERVAL '1 day'";

    try {
      // Apply deduplication: count only unique jobs per (title, company, submitted_by)
      // Duplicates are only considered when title, company, AND bidder (submitted_by) match
      const result = await pool.query(
        `
        SELECT 
          ranked.bidder_name,
          TO_CHAR(ranked.created_at, $1) AS label,
          COUNT(*) AS application_count
        FROM (
          SELECT ja.*, u.username AS bidder_name,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(ja.title), LOWER(ja.company_name), ja.submitted_by 
              ORDER BY ja.created_at ASC
            ) as rn
          FROM jobapplications ja
          JOIN users u ON u.id = ja.submitted_by
          JOIN bidder_configs bc ON bc.bidder_id = u.id
          WHERE bc.developer_id = $2
            AND ja.created_at >= $3::date
            AND ja.created_at < ($4::date + INTERVAL '1 day')
            AND ja.qualification IS DISTINCT FROM 'no confirmation email'
            AND ja.qualification IS DISTINCT FROM 'not remote'
            AND ja.qualification IS DISTINCT FROM 'no recent job'
            AND ja.qualification IS DISTINCT FROM 'no software job'
        ) ranked
        WHERE ranked.rn = 1
        GROUP BY ranked.bidder_name, label
        ORDER BY label ASC
        `,
        [groupFormat, developerId, startDate, endDate]
      );

      const raw = result.rows;
      const grouped: Record<string, Record<string, number>> = {};

      raw.forEach(({ bidder_name, label, application_count }) => {
        if (!grouped[label]) grouped[label] = { label };
        grouped[label][bidder_name] = Number(application_count);
      });

      const bidderSet = new Set(raw.map((r) => r.bidder_name));
      const finalData = Object.values(grouped).map((entry) => {
        for (const bidder of bidderSet) {
          if (!(bidder in entry)) entry[bidder] = 0;
        }
        return entry;
      });

      res.json(finalData);
    } catch (err) {
      console.error("Error in bidder-activity analytics:", err);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  }
);

// Interview analytics endpoint
router.get(
  "/analytics/interviews",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const developerId = req.user?.id;
    const { interval = "daily", start, end } = req.query;

    const groupFormat =
      interval === "weekly"
        ? "IYYY-IW"
        : interval === "monthly"
        ? "YYYY-MM"
        : "YYYY-MM-DD";

    const startDate = isValid(parseISO(String(start))) ? start : "CURRENT_DATE - INTERVAL '6 days'";
    const endDate = isValid(parseISO(String(end))) ? end : "CURRENT_DATE + INTERVAL '1 day'";

    try {
      // Interview totals grouped by interval
      const dailyResult = await pool.query(
        `
        SELECT 
          TO_CHAR(i.created_at, $1) AS date,
          COUNT(*) AS count
        FROM InterviewStages i
        JOIN JobApplications ja ON i.job_application_id = ja.id
        WHERE ja.developer_id = $2
          AND i.created_at >= $3::date
          AND i.created_at < ($4::date + INTERVAL '1 day')
        GROUP BY TO_CHAR(i.created_at, $1)
        ORDER BY date ASC
        `,
        [groupFormat, developerId, startDate, endDate]
      );

      // Interviews per bidder
      const bidderResult = await pool.query(
        `
        SELECT 
          u.username AS bidder_name,
          COUNT(*) AS count
        FROM InterviewStages i
        JOIN JobApplications ja ON i.job_application_id = ja.id
        JOIN users u ON u.id = ja.submitted_by
        WHERE ja.developer_id = $1
          AND i.created_at >= $2::date
          AND i.created_at < ($3::date + INTERVAL '1 day')
        GROUP BY u.username
        ORDER BY count DESC, u.username ASC
        `,
        [developerId, startDate, endDate]
      );

      res.json({
        dailyTotals: dailyResult.rows.map(row => ({
          date: row.date,
          count: Number(row.count)
        })),
        perBidder: bidderResult.rows.map(row => ({
          bidder: row.bidder_name,
          count: Number(row.count)
        }))
      });
    } catch (err) {
      console.error("Error in interview analytics:", err);
      res.status(500).json({ error: "Failed to fetch interview analytics" });
    }
  }
);

export default router;
