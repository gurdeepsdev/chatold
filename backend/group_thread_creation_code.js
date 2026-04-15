// =============================================================================
// COMPLETE GROUP & THREAD CREATION CODE WITH STATUS FILTERING
// =============================================================================

const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { auth } = require('../middleware/auth');

// =============================================================================
// 1. GET GROUPS & THREADS (with Live campaign filtering)
// =============================================================================

router.get('/', auth, async (req, res) => {
  try {
    // Get groups with campaign status filtering
    const [groups] = await db.query(`
      SELECT
        g.id, g.group_name, g.group_type, g.package_id, g.sub_id, g.campaign_type,
        g.created_at, g.is_archived, g.campaign_id, g.crm_campaign_data,
        c.campaign_name, c.geo, c.payout, c.payable_event, c.preview_url, c.kpi, c.mmp_tracker, c.status as campaign_status,
        u.full_name as created_by_name,
        (SELECT COUNT(*) FROM messages m WHERE m.group_id = g.id AND m.is_deleted = FALSE 
         AND (m.recipient_id = ? OR m.secondary_recipient_id = ?)) as message_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.group_id = g.id AND t.status = 'pending') as pending_tasks,
        (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) as member_count,
        (SELECT m2.sent_at FROM messages m2 WHERE m2.group_id = g.id ORDER BY m2.sent_at DESC LIMIT 1) as last_message_at
      FROM chat_groups g
      INNER JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
      LEFT JOIN campaigns c ON c.id = g.campaign_id
      LEFT JOIN users u ON u.id = g.created_by
      WHERE g.is_archived = FALSE AND (c.status IS NULL OR c.status = 'Live')
      ORDER BY last_message_at DESC, g.created_at DESC
    `, [req.user.id, req.user.id, req.user.id]);

    // Fetch group members
    if (groups.length > 0) {
      const groupIds = groups.map(g => g.id);
      const [allMembers] = await db.query(`
        SELECT gm.group_id, u.id, u.full_name, u.email, u.role, gm.role as group_role
        FROM group_members gm
        INNER JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id IN (${groupIds.map(() => '?').join(',')})
      `, groupIds);
      
      const membersByGroup = {};
      allMembers.forEach(m => {
        if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
        membersByGroup[m.group_id].push(m);
      });
      
      groups.forEach(g => {
        g.group_members = membersByGroup[g.id] || [];
      });
    }

    // Create threads from groups (only Live campaigns)
    const threads = {};
    groups.forEach(g => {
      const key = g.package_id || `custom_${g.id}`;
      if (!threads[key]) threads[key] = { package_id: key, groups: [] };
      threads[key].groups.push(g);
    });
 
    res.json({ groups, threads: Object.values(threads) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =============================================================================
// 2. CREATE GROUPS FROM CRM CAMPAIGN DATA (Live only)
// =============================================================================

router.post('/from-campaign-data', auth, async (req, res) => {
  // Only admin, advertiser_manager, advertiser, and adv_executive can create campaign groups
  const allowedRoles = ['admin', 'advertiser_manager', 'advertiser', 'adv_executive'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only admin, advertiser_manager, advertiser, and adv_executive can create campaign groups' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { campaign_subid, campaign_type = 'agency', additional_members = [] } = req.body;

    // Get CRM pool
    const crmPool = db.crmPool;
    if (!crmPool) {
      return res.status(500).json({ error: 'CRM database not configured' });
    }

    // Find campaign in CRM campaign_data table - ONLY LIVE CAMPAIGNS
    const [crmCampaigns] = await crmPool.query(`
      SELECT c.*, l.username
      FROM campaign_data c
      INNER JOIN login l ON l.id = c.user_id
      WHERE c.sub_campaign_id = ? AND c.user_id = ? AND c.status = 'Live'
    `, [campaign_subid, req.user.id]);

    if (!crmCampaigns.length) {
      return res.status(404).json({
        error: 'Campaign not found in CRM data with given sub campaign ID for this user. Only Live campaigns are allowed.',
        debug: {
          looking_for: {
            campaign_subid,
            user_id: req.user.id,
            status: 'Live'
          }
        }
      });
    }

    const crmCampaign = crmCampaigns[0];
    const adv_name = req.user.full_name?.split(' ')[0] || req.user.username;
    const advertiserId = req.user.id;
    const createdGroups = [];

    // Extract package_id from preview_url
    let package_id = null;
    
    if (crmCampaign.preview_url && crmCampaign.preview_url !== 'NA') {
      const url = crmCampaign.preview_url;

      if (url.includes('apps.apple.com')) {
        // iOS: Extract from /id{number} pattern
        const iosMatch = url.match(/\/id(\d+)/);
        if (iosMatch) {
          package_id = iosMatch[1];
        }
      } else if (url.includes('play.google.com')) {
        // Android: Extract from id={package_name} pattern
        const androidMatch = url.match(/[?&]id=([^&]+)/);
        if (androidMatch) {
          package_id = androidMatch[1];
        }
      } else {
        // Direct package_id (no URL format)
        package_id = url.trim();
      }
    }

    // Get OS platforms from campaign_data
    const [osPlatforms] = await crmPool.query(
      'SELECT DISTINCT os FROM campaign_data WHERE sub_campaign_id = ? AND os IS NOT NULL AND os != ""',
      [campaign_subid]
    );

    // Get adv_d values for this campaign
    const [advdResult] = await crmPool.query(
      'SELECT DISTINCT adv_d FROM campaign_data WHERE sub_campaign_id = ? AND adv_d IS NOT NULL AND adv_d != ""',
      [campaign_subid]
    );

    // Create groups for each OS and adv_d combination
    const platforms = osPlatforms.length > 0
      ? osPlatforms.map(o => o.os.toLowerCase().replace(/\s+/g, ''))
      : ['default'];

    for (const platform of platforms) {
      for (const advdData of advdResult.length > 0 ? advdResult : [{ adv_d: 'default' }]) {
        const groupName = platform === 'default' && advdResult.length === 0
          ? `${crmCampaign.campaign_name}_${adv_name}`
          : `${crmCampaign.campaign_name}_${adv_name}_${platform}_${advdData.adv_d}`;

        // Check if group already exists
        const [existing] = await conn.query(
          'SELECT id FROM chat_groups WHERE group_name = ?',
          [groupName]
        );

        if (existing.length) {
          continue; // Skip if group already exists
        }

        // Prepare CRM campaign data JSON
        const crmCampaignData = {
          ...crmCampaign,
          extracted_package_id: package_id
        };

        // Create group
        const [result] = await conn.query(
          `INSERT INTO chat_groups (group_name, campaign_id, package_id, sub_id, group_type, campaign_type, created_by, platform, adv_name, advertiser_id, crm_campaign_data) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            groupName,
            null, // No local campaign_id since we're using CRM data
            package_id, // Use extracted package_id
            crmCampaign.sub_campaign_id,
            'campaign',
            campaign_type,
            req.user.id,
            platform,
            adv_name,
            req.user.id,
            JSON.stringify(crmCampaignData)
          ]
        );
        const groupId = result.insertId;

        // Add default members
        const [allAdmins] = await getAllAdminUsers(crmPool);
        let defaultUsernames = [];
        
        if (campaign_type === 'direct') {
          defaultUsernames = ['akshat', 'ipsita'];
        } else {
          defaultUsernames = ['atique', 'anvisha'];
        }

        // Add creator and admins
        const memberUsernames = [...new Set([req.user.username, ...defaultUsernames, ...allAdmins])];
        
        for (const username of memberUsernames) {
          const [userRows] = await crmPool.query('SELECT id FROM login WHERE username = ?', [username]);
          if (userRows.length > 0) {
            await conn.query(
              'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
              [groupId, userRows[0].id, 'member']
            );
          }
        }

        createdGroups.push({
          id: groupId,
          group_name: groupName,
          campaign_id: null,
          package_id,
          sub_id: crmCampaign.sub_campaign_id,
          group_type: 'campaign',
          campaign_type,
          platform,
          adv_name,
          advertiser_id: req.user.id,
          created_at: new Date().toISOString()
        });
      }
    }

    await conn.commit();
    res.status(201).json({ groups: createdGroups });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to create campaign groups' });
  } finally { 
    conn.release(); 
  }
});

// =============================================================================
// 3. CREATE GROUPS FROM LOCAL CAMPAIGNS (Live only)
// =============================================================================

router.post('/from-campaign', auth, async (req, res) => {
  // Only admin, advertiser_manager, advertiser, and adv_executive can create campaign groups
  const allowedRoles = ['admin', 'advertiser_manager', 'advertiser', 'adv_executive'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only admin, advertiser_manager, advertiser, and adv_executive can create campaign groups' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { campaign_id, additional_members = [], campaign_type = 'agency' } = req.body;

    // Get campaign from local database - ONLY LIVE CAMPAIGNS
    const [campaigns] = await conn.query('SELECT * FROM campaigns WHERE id = ? AND status = "Live"', [campaign_id]);
    if (!campaigns.length) return res.status(404).json({ error: 'Campaign not found or not Live' });
    const campaign = campaigns[0];
    
    // Validate campaign status - only allow creation for Live campaigns
    if (campaign.status !== 'Live') {
      return res.status(400).json({ 
        error: 'Only Live campaigns are allowed for group creation' 
      });
    }

    // Extract package_id
    let packageId = campaign.package_id;
    if (!packageId && campaign.preview_url) {
      const match = campaign.preview_url.match(/[?&]id=([^&]+)/);
      packageId = match ? match[1] : campaign.preview_url.split('/').pop();
    }

    // Build group name
    const [advRows] = await conn.query('SELECT full_name FROM users WHERE id = ?', [campaign.advertiser_id]);
    const advName = advRows[0]?.full_name?.split(' ')[0] || 'Adv';
    const creatorName = req.user.full_name?.split(' ')[0] || 'AM';
    const groupName = `${campaign.campaign_name}_${advName}_${creatorName}`;

    // Create group
    const [result] = await conn.query(
      'INSERT INTO chat_groups (group_name, campaign_id, package_id, sub_id, group_type, campaign_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [groupName, campaign_id, packageId, campaign.sub_id, 'campaign', campaign_type, req.user.id]
    );
    const groupId = result.insertId;

    // Add default members based on campaign type
    const [allAdmins] = await conn.query("SELECT id FROM users WHERE role = 'admin'");
    let defaultUsernames = [];
    
    if (campaign_type === 'direct') {
      defaultUsernames = ['akshat', 'ipsita'];
    } else {
      defaultUsernames = ['atique', 'anvisha'];
    }

    const memberUsernames = [...new Set([req.user.username, ...defaultUsernames])];
    for (const username of memberUsernames) {
      const [userRows] = await conn.query('SELECT id FROM users WHERE username = ?', [username]);
      if (userRows.length > 0) {
        await conn.query(
          'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
          [groupId, userRows[0].id, 'member']
        );
      }
    }

    await conn.commit();
    res.status(201).json({ 
      message: 'Group created successfully',
      group: {
        id: groupId,
        group_name: groupName,
        campaign_id,
        package_id: packageId,
        sub_id: campaign.sub_id,
        group_type: 'campaign',
        campaign_type
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  } finally { 
    conn.release(); 
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function getAllAdminUsers(crmPool) {
  try {
    const [admins] = await crmPool.query(
      'SELECT username FROM login WHERE role = "admin"'
    );
    return admins.map(a => a.username);
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return [];
  }
}

module.exports = router;
