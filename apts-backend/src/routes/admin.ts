import express from "express";
import pool from "../db/pool";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let dateClause = "";
    const appsParams: any[] = [];

    if (start_date && end_date) {
      dateClause = `AND created_at BETWEEN $1 AND $2`;
      appsParams.push(start_date, end_date);
    }

    const devRes = await pool.query(
      `SELECT id, username FROM users WHERE role = 'developer'`
    );
    const bidRes = await pool.query(
      `SELECT id, username FROM users WHERE role = 'bidder'`
    );
    const configsRes = await pool.query(
      `SELECT developer_id, bidder_id, rate, last_paid_at FROM bidder_configs`
    );
    const usersRes = await pool.query(`SELECT id, username FROM users`);

    // Apply deduplication: get only unique jobs per (title, company, submitted_by)
    // Duplicates are only considered when title, company, AND bidder (submitted_by) match
    const appsQuery = `
      SELECT developer_id, submitted_by, created_at 
      FROM (
        SELECT ja.*,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(ja.title), LOWER(ja.company_name), ja.submitted_by 
            ORDER BY ja.created_at ASC
          ) as rn
        FROM jobapplications ja
        WHERE TRUE ${dateClause}
      ) ranked
      WHERE ranked.rn = 1
    `;
    const appsRes = await pool.query(appsQuery, appsParams);

    const paymentsRes = await pool.query(
      `SELECT developer_id, bidder_id, SUM(amount) as total_paid FROM bidder_payments GROUP BY developer_id, bidder_id`
    );

    const developers = devRes.rows;
    const bidders = bidRes.rows;
    const apps = appsRes.rows;
    const configs = configsRes.rows;
    const payments = paymentsRes.rows;
    const usersMap = Object.fromEntries(
      usersRes.rows.map((u) => [u.id, u.username])
    );

    const paymentsMap = new Map();
    for (const p of payments) {
      paymentsMap.set(`${p.developer_id}-${p.bidder_id}`, parseFloat(p.total_paid));
    }

    const devList = developers.map((dev) => {
      const devApps = apps.filter((a) => a.developer_id === dev.id);
      const assignedBidders = configs.filter((c) => c.developer_id === dev.id);
      return {
        id: dev.id,
        username: dev.username,
        bidder_count: assignedBidders.length,
        application_count: devApps.length,
        bidders: assignedBidders.map((b) => {
          const appsByBidder = apps.filter(
            (a) => a.submitted_by === b.bidder_id && a.developer_id === dev.id
          );

          const unpaidApps = appsByBidder.filter((a) => {
            return !b.last_paid_at || new Date(a.created_at) > new Date(b.last_paid_at);
          });

          return {
            id: b.bidder_id,
            username: usersMap[b.bidder_id],
            application_count: appsByBidder.length,
            unpaid_count: unpaidApps.length,
            rate: parseFloat(b.rate ?? 0),
            paid_amount: paymentsMap.get(`${dev.id}-${b.bidder_id}`) || 0,
          };
        }),
      };
    });

    res.json({
      totalDevelopers: developers.length,
      totalBidders: bidders.length,
      developers: devList,
    });
  } catch (err) {
    console.error("Admin stats error", err);
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

// ✅ GET all users (developers & bidders & managers)
router.get("/users", authenticateToken, async (req, res) => {
  try {
    const usersRes = await pool.query(
      `SELECT id, username, role FROM users WHERE role IN ('developer', 'bidder', 'manager') ORDER BY created_at DESC`
    );

    const users = usersRes.rows;

    // Add bidder_configs to link bidder → developer
    const configsRes = await pool.query(`
      SELECT bc.bidder_id, bc.developer_id, u.username AS developer_username
      FROM bidder_configs bc
      JOIN users u ON u.id = bc.developer_id
    `);

    const devMap: Record<string, { id: string; username: string }> = {};
    configsRes.rows.forEach((c) => {
      devMap[c.bidder_id] = {
        id: c.developer_id,
        username: c.developer_username,
      };
    });

    // Add developer_managers to link developer → manager
    const dmRes = await pool.query(`
      SELECT dm.developer_id, dm.manager_id, u.username AS manager_username
      FROM developer_managers dm
      JOIN users u ON u.id = dm.manager_id
    `);
    const managerMap: Record<string, { id: string; username: string }> = {};
    dmRes.rows.forEach((r) => {
      managerMap[r.developer_id] = {
        id: r.manager_id,
        username: r.manager_username,
      };
    });

    const enrichedUsers = users.map((u) => {
      let out = { ...u };
      if (u.role === "bidder" && devMap[u.id]) {
        out = { ...out, developer: devMap[u.id] };
      }
      if (u.role === "developer" && managerMap[u.id]) {
        out = { ...out, manager: managerMap[u.id] };
      }
      return out;
    });

    res.json(enrichedUsers);
  } catch (err) {
    console.error("Failed to fetch users:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// ✅ GET managers list (for assign dropdown)
router.get("/managers", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username FROM users WHERE role = 'manager' ORDER BY username`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch managers:", err);
    res.status(500).json({ error: "Failed to load managers" });
  }
});

// ✅ POST assign manager to developer (replaces any existing assignment for this developer)
router.post("/developer-managers", authenticateToken, async (req, res) => {
  const { developer_id, manager_id } = req.body;
  if (!developer_id || !manager_id) {
    res.status(400).json({ error: "developer_id and manager_id required" });
    return;
  }
  try {
    await pool.query(
      `DELETE FROM developer_managers WHERE developer_id = $1`,
      [developer_id]
    );
    await pool.query(
      `INSERT INTO developer_managers (developer_id, manager_id) VALUES ($1, $2)`,
      [developer_id, manager_id]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Failed to assign manager to developer:", err);
    res.status(500).json({ error: "Assign failed" });
  }
});

// ✅ DELETE unassign manager from developer
router.delete("/developer-managers", authenticateToken, async (req, res) => {
  const { developer_id, manager_id } = req.query;
  if (!developer_id || !manager_id) {
    res.status(400).json({ error: "developer_id and manager_id required" });
    return;
  }
  try {
    await pool.query(
      `DELETE FROM developer_managers WHERE developer_id = $1 AND manager_id = $2`,
      [developer_id, manager_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to unassign:", err);
    res.status(500).json({ error: "Unassign failed" });
  }
});


// ✅ CREATE user
router.post("/users", authenticateToken, async (req, res) => {
  const { username, passwordHash, role } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING *`,
      [username, passwordHash, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to create user:", err);
    res.status(500).json({ error: "Create failed" });
  }
});

// ✅ UPDATE user
router.patch("/users/:id", authenticateToken, async (req, res) => {
  const { username, passwordHash } = req.body;

  try {
    if (passwordHash) {
      await pool.query(
        `UPDATE users SET username = $1, password_hash = $2 WHERE id = $3`,
        [username, passwordHash, req.params.id]
      );
    } else {
      await pool.query(`UPDATE users SET username = $1 WHERE id = $2`, [
        username,
        req.params.id,
      ]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});


// ✅ DELETE user
router.delete("/users/:id", authenticateToken, async (req, res) => {
  const userId = req.params.id;
  try {
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete user:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

router.patch("/bidders/:id/reassign", authenticateToken, async (req, res) => {
  const bidderId = req.params.id;
  const { newDeveloperId } = req.body;

  try {
    // Check if an existing config exists
    const existing = await pool.query(
      "SELECT * FROM bidder_configs WHERE bidder_id = $1",
      [bidderId]
    );

    if (newDeveloperId) {
      if (existing.rows.length > 0) {
        // Update existing config
        await pool.query(
          "UPDATE bidder_configs SET developer_id = $1 WHERE bidder_id = $2",
          [newDeveloperId, bidderId]
        );
      } else {
        // Create new config
        await pool.query(
          "INSERT INTO bidder_configs (bidder_id, developer_id) VALUES ($1, $2)",
          [bidderId, newDeveloperId]
        );
      }
    } else {
      // 🧨 No developer selected — remove assignment
      await pool.query("DELETE FROM bidder_configs WHERE bidder_id = $1", [
        bidderId,
      ]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Failed to reassign bidder:", err);
    res.status(500).json({ error: "Failed to reassign bidder" });
  }
});


export default router;
