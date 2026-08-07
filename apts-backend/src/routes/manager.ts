import express from "express";
import { AuthenticatedRequest, authenticateToken } from "../middleware/auth";
import pool from "../db/pool";
import { Response } from "express";
import { parseISO, isValid } from "date-fns";

const router = express.Router();

function requireManager(
  req: AuthenticatedRequest,
  res: Response,
  next: express.NextFunction
) {
  if (req.user?.role !== "manager") {
    res.status(403).json({ error: "Forbidden: manager role required" });
    return;
  }
  next();
}

router.use(authenticateToken);
router.use(requireManager);

// Helper: get developer IDs assigned to this manager
async function getAssignedDeveloperIds(managerId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT developer_id FROM developer_managers WHERE manager_id = $1`,
    [managerId]
  );
  return result.rows.map((r: { developer_id: string }) => r.developer_id);
}

// GET /manager/developers - Developers assigned to this manager
router.get("/developers", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const managerId = req.user!.id;
    const result = await pool.query(
      `SELECT u.id, u.username
       FROM developer_managers dm
       JOIN users u ON u.id = dm.developer_id
       WHERE dm.manager_id = $1
       ORDER BY u.username`,
      [managerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching manager developers:", err);
    res.status(500).json({ error: "Failed to fetch developers" });
  }
});

// GET /manager/bidders - Bidders of assigned developers (for filters)
router.get("/bidders", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const managerId = req.user!.id;
    const result = await pool.query(
      `SELECT DISTINCT u.id, u.username
       FROM users u
       JOIN bidder_configs bc ON bc.bidder_id = u.id
       JOIN developer_managers dm ON dm.developer_id = bc.developer_id
       WHERE dm.manager_id = $1
       ORDER BY u.username`,
      [managerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching manager bidders:", err);
    res.status(500).json({ error: "Failed to fetch bidders" });
  }
});

// GET /manager/applications - Applications from assigned developers' bidders
router.get("/applications", async (req: AuthenticatedRequest, res: Response) => {
  const { page = 1, limit = 10, status, company_name, bidder_id } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const managerId = req.user!.id;

  try {
    const devIds = await getAssignedDeveloperIds(managerId);
    if (devIds.length === 0) {
      res.json({ data: [], total: 0 });
      return;
    }

    const filters: string[] = [`ja.developer_id = ANY($1)`];
    const params: (string | number | string[])[] = [devIds];
    let paramIndex = 2;

    if (status) {
      filters.push(`ja.status = $${paramIndex++}`);
      params.push(String(status));
    }
    if (company_name) {
      filters.push(`ja.company_name ILIKE $${paramIndex++}`);
      params.push(`%${company_name}%`);
    }
    if (bidder_id) {
      filters.push(`ja.submitted_by = $${paramIndex++}`);
      params.push(String(bidder_id));
    }

    const whereClause = `WHERE ${filters.join(" AND ")}`;

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

    const total = await pool.query(
      `SELECT COUNT(*) FROM (
        SELECT ja.id,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(ja.title), LOWER(ja.company_name), ja.submitted_by
            ORDER BY ja.created_at ASC
          ) as rn
        FROM jobapplications ja
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
    console.error("Error fetching manager applications:", err);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// GET /manager/payments - Payment overview for assigned developers' bidders
router.get("/payments", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const managerId = req.user!.id;
    const devIds = await getAssignedDeveloperIds(managerId);
    if (devIds.length === 0) {
      res.json([]);
      return;
    }

    const bidderStats = await pool.query(
      `SELECT
    u.id AS bidder_id,
    u.username,
    bc.rate,
    bc.last_paid_at,
    (SELECT username FROM users WHERE id = bc.developer_id) AS developer_username,
    (
      SELECT COUNT(*)
      FROM (
        SELECT ja.id,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(ja.title), LOWER(ja.company_name), ja.submitted_by
            ORDER BY ja.created_at ASC
          ) as rn
        FROM jobapplications ja
        WHERE ja.submitted_by = u.id AND ja.developer_id = bc.developer_id
          AND ja.created_at > COALESCE(bc.last_paid_at, '1970-01-01')
          AND ja.qualification IS DISTINCT FROM 'no confirmation email'
          AND ja.qualification IS DISTINCT FROM 'not remote'
          AND ja.qualification IS DISTINCT FROM 'no recent job'
          AND ja.qualification IS DISTINCT FROM 'no software job'
      ) ranked
      WHERE ranked.rn = 1
    ) AS application_count,
    (
      SELECT COALESCE(json_agg(sub), '[]'::json)
      FROM (
        SELECT *
        FROM bidder_payments bp
        WHERE bp.bidder_id = u.id AND bp.developer_id = bc.developer_id
        ORDER BY bp.paid_at DESC
        LIMIT 10
      ) sub
    ) AS payment_history
  FROM users u
  JOIN bidder_configs bc ON u.id = bc.bidder_id
  WHERE bc.developer_id = ANY($1)
  ORDER BY u.username, developer_username`,
      [devIds]
    );

    const rows = bidderStats.rows.map((row: Record<string, unknown>) => ({
      ...row,
      rate: row.rate != null ? parseFloat(String(row.rate)) : null,
      application_count: Number(row.application_count ?? 0),
    }));
    res.json(rows);
  } catch (err) {
    console.error("Error fetching manager payments:", err);
    res.status(500).json({ error: "Failed to load payments" });
  }
});

// GET /manager/analytics/bidder-activity
router.get(
  "/analytics/bidder-activity",
  async (req: AuthenticatedRequest, res: Response) => {
    const managerId = req.user!.id;
    const { interval = "daily", start, end } = req.query;

    const groupFormat =
      interval === "weekly"
        ? "IYYY-IW"
        : interval === "monthly"
        ? "YYYY-MM"
        : "YYYY-MM-DD";

    const startDate = isValid(parseISO(String(start)))
      ? start
      : "CURRENT_DATE - INTERVAL '6 days'";
    const endDate = isValid(parseISO(String(end)))
      ? end
      : "CURRENT_DATE + INTERVAL '1 day'";

    try {
      const devIds = await getAssignedDeveloperIds(managerId);
      if (devIds.length === 0) {
        res.json([]);
        return;
      }

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
          WHERE ja.developer_id = ANY($2)
            AND ja.created_at >= $3::date
            AND ja.created_at < ($4::date + INTERVAL '1 day')
            AND (ja.qualification IS NULL OR (ja.qualification IS DISTINCT FROM 'no confirmation email' AND ja.qualification IS DISTINCT FROM 'not remote' AND ja.qualification IS DISTINCT FROM 'no recent job' AND ja.qualification IS DISTINCT FROM 'no software job'))
        ) ranked
        WHERE ranked.rn = 1
        GROUP BY ranked.bidder_name, label
        ORDER BY label ASC
        `,
        [groupFormat, devIds, startDate, endDate]
      );

      const raw = result.rows;
      const grouped: Record<string, Record<string, string | number>> = {};
      raw.forEach(
        ({
          bidder_name,
          label,
          application_count,
        }: {
          bidder_name: string;
          label: string;
          application_count: string;
        }) => {
          if (!grouped[label]) grouped[label] = { label };
          grouped[label][bidder_name] = Number(application_count);
        }
      );
      const bidderSet = new Set(raw.map((r: { bidder_name: string }) => r.bidder_name));
      const finalData = Object.values(grouped).map((entry) => {
        for (const bidder of bidderSet) {
          if (!(bidder in entry)) entry[bidder] = 0;
        }
        return entry;
      });

      res.json(finalData);
    } catch (err) {
      console.error("Error in manager bidder-activity analytics:", err);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  }
);

// GET /manager/analytics/interviews
router.get(
  "/analytics/interviews",
  async (req: AuthenticatedRequest, res: Response) => {
    const managerId = req.user!.id;
    const { interval = "daily", start, end } = req.query;

    const groupFormat =
      interval === "weekly"
        ? "IYYY-IW"
        : interval === "monthly"
        ? "YYYY-MM"
        : "YYYY-MM-DD";

    const startDate = isValid(parseISO(String(start)))
      ? start
      : "CURRENT_DATE - INTERVAL '6 days'";
    const endDate = isValid(parseISO(String(end)))
      ? end
      : "CURRENT_DATE + INTERVAL '1 day'";

    try {
      const devIds = await getAssignedDeveloperIds(managerId);
      if (devIds.length === 0) {
        res.json({ dailyTotals: [], perBidder: [] });
        return;
      }

      const dailyResult = await pool.query(
        `
        SELECT
          TO_CHAR(i.created_at, $1) AS date,
          COUNT(*) AS count
        FROM InterviewStages i
        JOIN jobapplications ja ON i.job_application_id = ja.id
        WHERE ja.developer_id = ANY($2)
          AND i.created_at >= $3::date
          AND i.created_at < ($4::date + INTERVAL '1 day')
        GROUP BY TO_CHAR(i.created_at, $1)
        ORDER BY date ASC
        `,
        [groupFormat, devIds, startDate, endDate]
      );

      const bidderResult = await pool.query(
        `
        SELECT
          u.username AS bidder_name,
          COUNT(*) AS count
        FROM InterviewStages i
        JOIN jobapplications ja ON i.job_application_id = ja.id
        JOIN users u ON u.id = ja.submitted_by
        WHERE ja.developer_id = ANY($1)
          AND i.created_at >= $2::date
          AND i.created_at < ($3::date + INTERVAL '1 day')
        GROUP BY u.username
        ORDER BY count DESC, u.username ASC
        `,
        [devIds, startDate, endDate]
      );

      res.json({
        dailyTotals: dailyResult.rows.map(
          (row: { date: string; count: string }) => ({
            date: row.date,
            count: Number(row.count),
          })
        ),
        perBidder: bidderResult.rows.map(
          (row: { bidder_name: string; count: string }) => ({
            bidder: row.bidder_name,
            count: Number(row.count),
          })
        ),
      });
    } catch (err) {
      console.error("Error in manager interview analytics:", err);
      res.status(500).json({ error: "Failed to fetch interview analytics" });
    }
  }
);

export default router;
