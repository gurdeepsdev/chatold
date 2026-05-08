const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { auth } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');

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
      console.log("userId",userId,res)
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
        WHERE c.status = 'Live'
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
  (c.user_id = ? AND c.status = 'Live')

  -- ✅ Assigned campaigns (FIXED 🔥)
  OR (c.adv_d IN (
    SELECT adv_id 
    FROM advids 
    WHERE assign_id = ?
  ) AND c.status = 'Live')
      `;
      params = [userId, userId];
    }

    // 🧑 ADVERTISER
    else if (role === 'advertiser') {
      campaignsQuery = `
SELECT DISTINCT c.*, l.username
FROM campaign_data c
LEFT JOIN login l ON l.id = c.user_id
WHERE 
  -- ✅ Own campaigns
  (c.user_id = ? AND c.status = 'Live')

  -- ✅ Assigned campaigns (FIXED 🔥)
  OR (c.adv_d IN (
    SELECT adv_id 
    FROM advids 
    WHERE assign_id = ?
  ) AND c.status = 'Live')
      `;
      params = [userId, userId];
    }

    // 🧑‍💼 ADV EXECUTIVE
    else if (role === 'adv_executive') {
      campaignsQuery = `
SELECT DISTINCT c.*, l.username
FROM campaign_data c
LEFT JOIN login l ON l.id = c.user_id
WHERE 
  -- ✅ Own campaigns
  (c.user_id = ? AND c.status = 'Live')

  -- ✅ Assigned campaigns (FIXED 🔥)
  OR (c.adv_d IN (
    SELECT adv_id 
    FROM advids 
    WHERE assign_id = ?
  ) AND c.status = 'Live')
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
    `SELECT ps.*, u.full_name as updated_by_name,
       ps.created_at as share_date
     FROM pid_status ps LEFT JOIN users u ON u.id = ps.updated_by
     WHERE ps.group_id = ? ORDER BY ps.updated_at DESC`,
    [req.params.groupId]
  );
  res.json({ pids });
});

// ── Get PID links shared in tasks ─────────────────────────────────────
router.get('/shared-pids/group/:groupId', auth, async (req, res) => {
  try {
    console.log('🔍 Fetching shared PIDs for group:', req.params.groupId);
    
    const [tasks] = await db.query(
      `SELECT 
        t.id,
        t.group_id,
        t.title,
        t.task_type,
        t.pub_id,
        t.pid,
        t.link,
        t.assigned_to,
        t.created_at as share_date,
        u1.full_name as created_by_name,
        u2.full_name as assigned_to_name,
        g.group_name
       FROM tasks t
       JOIN users u1 ON u1.id = t.assigned_by
       LEFT JOIN users u2 ON u2.id = t.assigned_to
       JOIN chat_groups g ON g.id = t.group_id
       WHERE t.group_id = ? AND t.task_type = 'share_link' AND t.pub_id IS NOT NULL AND t.pid IS NOT NULL
       ORDER BY t.created_at DESC`,
      [req.params.groupId]
    );
    
    console.log('📊 Found share_link tasks:', tasks.length);
    
    const sharedPids = [];
    
    for (const task of tasks) {
      // Get data from crmclickorbits.adv_data table
      let advData = null;
      let pidStatus = 'live'; // Default to live
      
      try {
        const crmDb = db.crmPool; // Use crmclickorbits database
        if (!crmDb) {
          console.warn('⚠️ CRM database not available');
        } else {
          const [advDataResult] = await crmDb.query(
            'SELECT paused_date, pub_name FROM adv_data WHERE pid = ? AND pubid = ? LIMIT 1',
            [task.pid, task.pub_id]
          );
          
          if (advDataResult.length > 0) {
            advData = advDataResult[0];
            // Set status based on paused_date
            pidStatus = advData.paused_date ? 'paused' : 'live';
            console.log(`🎯 Found adv_data: PID=${task.pid}, PubID=${task.pub_id}, paused_date=${advData.paused_date}, pub_name=${advData.pub_name}`);
          } else {
            console.log(`🔍 No adv_data found for PID=${task.pid}, PubID=${task.pub_id}`);
          }
        }
      } catch (error) {
        console.error('Error fetching adv_data:', error);
        // Keep default 'live' status if crm database fails
      }
      
      let statusDisplay = pidStatus;
      if (pidStatus === 'paused' && advData?.paused_date) {
        // Format paused_date for display
        const pausedDate = new Date(advData.paused_date);
        statusDisplay = `paused (${pausedDate.toLocaleDateString('en-IN', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        })})`;
      }
      
      sharedPids.push({
        id: task.id,
        pub_id: task.pub_id,
        pid: task.pid,
        link: task.link,
        share_date: task.share_date,
        sender_name: task.created_by_name,
        assigned_to: task.assigned_to_name,
        status: statusDisplay,
        raw_status: pidStatus, // Keep original status for styling
        pub_name: advData?.pub_name || null,
        paused_date: advData?.paused_date || null
      });
    }
    
    console.log('✅ Final shared PIDs:', sharedPids.length);
    console.log('📋 Shared PIDs data:', JSON.stringify(sharedPids, null, 2));
    
    res.json({ sharedPids });
  } catch (error) {
    console.error('Error fetching shared PIDs:', error);
    res.status(500).json({ error: 'Failed to fetch shared PIDs' });
  }
});

// ── Debug: Find PID messages across all groups ─────────────────────────────
router.get('/debug/find-pid-messages', auth, async (req, res) => {
  try {
    console.log('🔍 Searching for PID messages across all groups...');
    
    const [allMessages] = await db.query(
      `SELECT 
        m.id,
        m.group_id,
        m.encrypted_content,
        m.iv,
        m.sent_at,
        u.full_name as sender_name,
        g.group_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       JOIN chat_groups g ON g.id = m.group_id
       WHERE m.is_deleted = FALSE
       ORDER BY m.sent_at DESC
       LIMIT 200`
    );
    
    const pidMessages = [];
    
    for (const msg of allMessages) {
      try {
        const content = decrypt(msg.encrypted_content, msg.iv);
        
        if (content && (content.includes('PubID') || content.includes('PID') || content.includes('appsflyer'))) {
          // Check if it's actually a PID link (has PubID: and PID: pattern or appsflyer link)
          const hasActualPid = content.includes('PubID:') && content.includes('PID:') || 
                              content.includes('appsflyer.com') ||
                              (content.match(/PubID[:\s]*[A-Za-z0-9_-]+/i) && content.match(/PID[:\s]*[A-Za-z0-9_-]+/i));
          
          pidMessages.push({
            group_id: msg.group_id,
            group_name: msg.group_name,
            message_id: msg.id,
            sender_name: msg.sender_name,
            sent_at: msg.sent_at,
            content: content,
            isActualPidLink: hasActualPid
          });
        }
      } catch (error) {
        // Skip decryption errors
      }
    }
    
    console.log('🎯 Found PID messages:', pidMessages.length);
    pidMessages.forEach(msg => {
      const marker = msg.isActualPidLink ? '🎯' : '📝';
      console.log(`${marker} Group ${msg.group_id} (${msg.group_name}): ${msg.content.substring(0, 100)}...`);
    });
    
    const actualPidLinks = pidMessages.filter(msg => msg.isActualPidLink);
    console.log('✅ Actual PID links found:', actualPidLinks.length);
    
    res.json({ pidMessages });
  } catch (error) {
    console.error('Error finding PID messages:', error);
    res.status(500).json({ error: 'Failed to find PID messages' });
  }
});

// ── Debug: Find PID data in task entries ───────────────────────────────
router.get('/debug/find-pid-tasks', auth, async (req, res) => {
  try {
    console.log('🔍 Searching for PID data in share_link tasks...');
    
    const [tasks] = await db.query(
      `SELECT 
        t.id,
        t.group_id,
        t.title,
        t.task_type,
        t.pub_id,
        t.pid,
        t.link,
        t.assigned_to,
        t.created_at,
        u1.full_name as created_by_name,
        u2.full_name as assigned_to_name,
        g.group_name
       FROM tasks t
       JOIN users u1 ON u1.id = t.assigned_by
       LEFT JOIN users u2 ON u2.id = t.assigned_to
       JOIN chat_groups g ON g.id = t.group_id
       WHERE t.task_type = 'share_link'
       ORDER BY t.created_at DESC
       LIMIT 50`
    );
    
    const pidTasks = [];
    
    for (const task of tasks) {
      if (task.pub_id && task.pid) {
        pidTasks.push({
          group_id: task.group_id,
          group_name: task.group_name,
          task_id: task.id,
          task_title: task.title,
          created_by: task.created_by_name,
          assigned_to: task.assigned_to_name,
          created_at: task.created_at,
          pub_id: task.pub_id,
          pid: task.pid,
          link: task.link,
          pub_am: task.pub_am
        });
      }
    }
    
    console.log('🎯 Found PID tasks:', pidTasks.length);
    pidTasks.forEach(task => {
      console.log(`📋 Group ${task.group_id} (${task.group_name}): PubID=${task.pub_id}, PID=${task.pid}`);
      console.log(`  🎯 Link: ${task.link?.substring(0, 100)}...`);
    });
    
    res.json({ pidTasks });
  } catch (error) {
    console.error('Error finding PID tasks:', error);
    res.status(500).json({ error: 'Failed to find PID tasks' });
  }
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
