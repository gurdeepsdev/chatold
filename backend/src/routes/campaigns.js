const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { auth } = require('../middleware/auth');

// ── Helper: build absolute URL for files ──────────────────────
function absoluteUrl(req, relativePath) {
  if (!relativePath) return null;
  if (relativePath.startsWith('http')) return relativePath;
  return `${req.protocol}://${req.get('host')}${relativePath}`;
}

// Get available advertisers and campaign_subids for campaign creation
// router.get('/campaign-data', auth, async (req, res) => {
//   try {
//     const crmPool = db.crmPool;
    
//     if (!crmPool) {
//       return res.status(500).json({ error: 'CRM database not configured' });
//     }

//     // Get unique advertisers from CRM campaign_data table by joining with login table
//     const [advertisers] = await crmPool.query(`
//       SELECT DISTINCT l.username
//       FROM campaign_data c
//       INNER JOIN login l ON l.id = c.user_id
//       WHERE c.user_id IS NOT NULL AND l.username IS NOT NULL AND l.username != ''
//       ORDER BY l.username
//     `);

//     // Get all campaign_subids from CRM campaign_data table
//     const [subIds] = await crmPool.query(`
//       SELECT DISTINCT sub_campaign_id, campaign_name, user_id
//       FROM campaign_data 
//       WHERE sub_campaign_id IS NOT NULL AND sub_campaign_id != ''
//       ORDER BY sub_campaign_id
//     `);

//     res.json({
//       advertisers: advertisers.map(adv => ({
//         id: adv.username, // Use username as ID
//         name: adv.full_name || adv.username, // Show full name if available, otherwise username
//         username: adv.username
//       })),
//       sub_ids: subIds.map(row => ({
//         sub_id: row.sub_campaign_id,
//         campaign_name: row.campaign_name,
//         user_id: row.user_id
//       }))
//     });
//   } catch (err) {
//     console.error('Error fetching campaign data from CRM:', err);
//     res.status(500).json({ error: 'Failed to fetch campaign data' });
//   }
// });
router.get('/campaign-data', auth, async (req, res) => {
  try {
    const crmPool = db.crmPool;
    if (!crmPool) {
      return res.status(500).json({ error: 'CRM database not configured' });
    }

    const userId = req.user.id;

    // 🔹 STEP 1: Get role from login table
    const [[loginUser]] = await crmPool.query(
      `SELECT role FROM login WHERE id = ?`,
      [userId]
    );

    if (!loginUser) {
      return res.status(404).json({ error: 'User role not found' });
    }

    const role = loginUser.role;

    let campaignsQuery = '';
    let params = [];

    // 👑 ADMIN → all campaigns
    if (role === 'admin') {
      campaignsQuery = `
        SELECT c.*, l.username
        FROM campaign_data c
        LEFT JOIN login l ON l.id = c.user_id
      `;
    }
    // 🧑‍💼 ADVERTISER MANAGER
    else if (role === 'advertiser_manager') {
      campaignsQuery = `
   SELECT DISTINCT c.*, l.username
FROM campaign_data c
LEFT JOIN login l ON l.id = c.user_id
WHERE 
  -- ✅ Own campaigns
  c.user_id = ?

  -- ✅ Sub advertisers
  OR c.user_id IN (
    SELECT sub_admin_id 
    FROM manager_subadmins 
    WHERE manager_id = ?
  )

  -- ✅ Assigned campaigns (FIXED 🔥)
  OR c.adv_d IN (
    SELECT adv_id 
    FROM advids 
    WHERE assign_id = ?
  )
      `;
      params = [userId, userId, userId];
    }

    // 🧑 ADVERTISER
    else if (role === 'advertiser') {
      campaignsQuery = `
SELECT DISTINCT c.*, l.username
FROM campaign_data c
LEFT JOIN login l ON l.id = c.user_id
WHERE 
  -- ✅ Own campaigns
  c.user_id = ?

  -- ✅ Assigned campaigns (FIXED 🔥)
  OR c.adv_d IN (
    SELECT adv_id 
    FROM advids 
    WHERE assign_id = ?
  )
      `;
      params = [userId, userId];
    }

    else {
      return res.status(403).json({ error: 'Unauthorized role' });
    }

    // 🔹 STEP 2: Fetch campaigns
    const [campaigns] = await crmPool.query(campaignsQuery, params);
    // 🔹 STEP 3: Extract advertisers (deduplicated)
    const advertisersMap = new Map();
    campaigns.forEach(c => {
      if (c.username) {
        advertisersMap.set(c.username, {
          id: c.username,
          name: c.username
        });
      }
    });

    // 🔹 STEP 4: Extract sub_ids (deduplicated by user_id + sub_campaign_id + adv_d)
    const subIdMap = new Map();
    campaigns.forEach(c => {
      if (c.sub_campaign_id) {
        // Use composite key to ensure each user sees their own campaigns
        // Include adv_d to create separate campaigns when they differ
        const compositeKey = `${c.sub_campaign_id}_${c.user_id}_${c.adv_d || 'null'}`;
        subIdMap.set(compositeKey, {
          sub_id: c.sub_campaign_id,
          campaign_name: c.campaign_name,
          user_id: c.user_id,
          adv_d: c.adv_d
        });
      }
    });

    // 🔹 FINAL RESPONSE
    res.json({
      advertisers: Array.from(advertisersMap.values()),
      sub_ids: Array.from(subIdMap.values())
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaign data' });
  }
});

// ── GET /api/campaigns — merge local + CRM source DB ─────────
router.get('/', auth, async (req, res) => {
  try {
    // Always load from local crm_chat.campaigns first
    const [localCampaigns] = await db.query(
      `SELECT c.*, u.full_name as advertiser_name
       FROM campaigns c LEFT JOIN users u ON u.id = c.advertiser_id
       WHERE c.status != 'archived' ORDER BY c.campaign_name`
    );

    // If CRM source DB is configured, sync any missing campaigns
    const crmPool = db.crmPool;
    if (crmPool) {
      try {
        const table = process.env.CRM_CAMPAIGN_TABLE || 'campaigns';
        const [crmRows] = await crmPool.query(
          `SELECT * FROM \`${table}\` WHERE status != 'archived' ORDER BY campaign_name`
        );

        // Upsert CRM campaigns into local DB
        for (const c of crmRows) {
          const [exist] = await db.query(
            'SELECT id FROM campaigns WHERE crm_source_id = ?', [c.id]
          );
          if (!exist.length) {
            await db.query(
              `INSERT IGNORE INTO campaigns
               (crm_source_id, campaign_name, geo, payout, payable_event,
                preview_url, kpi, mmp_tracker, status, package_id, sub_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [c.id, c.campaign_name, c.geo || '', c.payout || 0,
               c.payable_event || '', c.preview_url || '',
               c.kpi || '', c.mmp_tracker || '',
               c.status || 'active', c.package_id || null, c.sub_id || null]
            ).catch(() => {}); // ignore duplicate errors
          }
        }

        // Re-fetch after sync
        const [refreshed] = await db.query(
          `SELECT c.*, u.full_name as advertiser_name
           FROM campaigns c LEFT JOIN users u ON u.id = c.advertiser_id
           WHERE c.status != 'archived' ORDER BY c.campaign_name`
        );
        return res.json({ campaigns: refreshed, synced_from_crm: crmRows.length });
      } catch (crmErr) {
        console.warn('CRM sync error (non-fatal):', crmErr.message);
        // Fall through and return local campaigns
      }
    }

    res.json({ campaigns: localCampaigns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/campaigns/sync — manual sync trigger ───────────
router.post('/sync', auth, async (req, res) => {
  const crmPool = db.crmPool;
  if (!crmPool) return res.status(400).json({ error: 'CRM source DB not configured. Set CRM_DB_HOST in .env' });

  try {
    const table = process.env.CRM_CAMPAIGN_TABLE || 'campaigns';
    const [crmRows] = await crmPool.query(`SELECT * FROM \`${table}\``);
    let inserted = 0, updated = 0;

    for (const c of crmRows) {
      const [exist] = await db.query('SELECT id FROM campaigns WHERE crm_source_id = ?', [c.id]);
      if (exist.length) {
        await db.query(
          `UPDATE campaigns SET campaign_name=?, geo=?, payout=?, payable_event=?,
           preview_url=?, kpi=?, mmp_tracker=?, status=?, package_id=?, sub_id=?
           WHERE crm_source_id=?`,
          [c.campaign_name, c.geo, c.payout, c.payable_event,
           c.preview_url, c.kpi, c.mmp_tracker, c.status,
           c.package_id, c.sub_id, c.id]
        );
        updated++;
      } else {
        await db.query(
          `INSERT INTO campaigns (crm_source_id, campaign_name, geo, payout, payable_event,
           preview_url, kpi, mmp_tracker, status, package_id, sub_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.id, c.campaign_name, c.geo, c.payout, c.payable_event,
           c.preview_url, c.kpi, c.mmp_tracker, c.status,
           c.package_id, c.sub_id]
        );
        inserted++;
      }
    }

    res.json({ message: `Sync complete: ${inserted} inserted, ${updated} updated`, total: crmRows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
});

// ── GET /api/campaigns/:id ─────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  const [rows] = await db.query(
    'SELECT c.*, u.full_name as advertiser_name FROM campaigns c LEFT JOIN users u ON u.id = c.advertiser_id WHERE c.id = ?',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Campaign not found' });
  res.json({ campaign: rows[0] });
});

// ── PID status ────────────────────────────────────────────────
router.get('/pid-status/group/:groupId', auth, async (req, res) => {
  const [pids] = await db.query(
    `SELECT ps.*, u.full_name as updated_by_name
     FROM pid_status ps LEFT JOIN users u ON u.id = ps.updated_by
     WHERE ps.group_id = ? ORDER BY ps.updated_at DESC`,
    [req.params.groupId]
  );
  res.json({ pids });
});

router.post('/pid-status', auth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { group_id, campaign_id, pub_id, pid, pub_am, status, pause_reason, scenario, feedback } = req.body;
    const [existing] = await conn.query(
      'SELECT id FROM pid_status WHERE group_id = ? AND pub_id = ? AND pid = ?',
      [group_id, pub_id, pid]
    );
    if (existing.length) {
      await conn.query(
        'UPDATE pid_status SET status=?, pause_reason=?, scenario=?, feedback=?, updated_by=?, updated_at=NOW() WHERE id=?',
        [status, pause_reason || null, scenario || null, feedback || null, req.user.id, existing[0].id]
      );
    } else {
      await conn.query(
        'INSERT INTO pid_status (group_id, campaign_id, pub_id, pid, pub_am, status, pause_reason, scenario, feedback, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [group_id, campaign_id || null, pub_id, pid, pub_am || null, status, pause_reason || null, scenario || null, feedback || null, req.user.id]
      );
    }
    await conn.query(
      'INSERT INTO workflow_summary (group_id, event_type, event_data, triggered_by) VALUES (?, ?, ?, ?)',
      [group_id, `pid_${status}`, JSON.stringify({ pub_id, pid, reason: pause_reason }), req.user.id]
    );
    await conn.commit();
    const io = req.app.get('io');
    if (io) io.to(`group_${group_id}`).emit('pid_status_update', { pub_id, pid, status });
    res.json({ message: 'PID status updated' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Server error' });
  } finally { conn.release(); }
});

module.exports = router;
