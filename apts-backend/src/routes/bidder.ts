// src/routes/bidder.ts
import express from "express";
import pool from "../db/pool";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth";

const router = express.Router();

/**
 * GET /api/bidder/demographics - Get assigned template demographics for the bidder
 */
router.get(
  "/demographics",
  authenticateToken,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const bidderId = req.user?.id;

    try {
      const result = await pool.query(
        `
        SELECT rt.demographics
        FROM resume_templates rt
        JOIN bidder_configs bc ON bc.template_id = rt.id
        WHERE bc.bidder_id = $1
        `,
        [bidderId]
      );

      if (result.rows.length === 0 || !result.rows[0].demographics) {
        res.status(404).json({ message: "No demographics found" });
        return;
      }

      res.json(result.rows[0].demographics);
    } catch (err) {
      console.error("Error fetching demographics:", err);
      res.status(500).json({ error: "Failed to fetch demographics" });
    }
  }
);

/**
 * GET /api/bidder/daily-jobs
 * Returns daily application counts for the authenticated bidder from jobapplications table.
 *
 * Query params (optional):
 *   - tz   : IANA timezone (e.g., "America/New_York"), default "UTC"
 *   - from : YYYY-MM-DD (inclusive)
 *   - to   : YYYY-MM-DD (inclusive)
 *
 * Response:
 *   [{ date: "YYYY-MM-DD", count: number }, ...]
 */
router.get(
  "/daily-jobs",
  authenticateToken,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const bidderId = req.user?.id;
    const tz = (req.query.tz as string) || "UTC";
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    try {
      const params: any[] = [bidderId, tz];
      const where: string[] = [`submitted_by = $1`];

      if (from) {
        params.push(from);
        where.push(`timezone($2, created_at)::date >= $${params.length}`);
      }
      if (to) {
        params.push(to);
        where.push(`timezone($2, created_at)::date <= $${params.length}`);
      }

      // Apply deduplication: count only unique jobs per (title, company, submitted_by)
      // Duplicates are only considered when title, company, AND bidder (submitted_by) match
      const sql = `
        SELECT
          to_char(timezone($2, ranked.created_at)::date, 'YYYY-MM-DD') AS date,
          COUNT(*)::int AS count
        FROM (
          SELECT ja.*,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(ja.title), LOWER(ja.company_name), ja.submitted_by 
              ORDER BY ja.created_at ASC
            ) as rn
          FROM jobapplications ja
          WHERE ${where.join(" AND ")}
            AND qualification IS DISTINCT FROM 'no confirmation email'
            AND qualification IS DISTINCT FROM 'not remote'
            AND qualification IS DISTINCT FROM 'no recent job'
            AND qualification IS DISTINCT FROM 'no software job'
        ) ranked
        WHERE ranked.rn = 1
        GROUP BY 1
        ORDER BY 1
      `;

      const result = await pool.query(sql, params);
      res.json(result.rows);
    } catch (err) {
      console.error("Error fetching daily jobs:", err);
      res.status(500).json({ error: "Failed to fetch daily jobs" });
    }
  }
);

export default router;
