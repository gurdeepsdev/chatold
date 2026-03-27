const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { auth } = require('../middleware/auth');
const { encrypt } = require('../utils/encryption');

// Get all groups for user
router.get('/', auth, async (req, res) => {
  try {
    const [groups] = await db.query(`
      SELECT
        g.id, g.group_name, g.group_type, g.package_id, g.sub_id, g.campaign_type,
        g.created_at, g.is_archived, g.campaign_id, g.crm_campaign_data,
        c.campaign_name, c.geo, c.payout, c.payable_event, c.preview_url, c.kpi, c.mmp_tracker, c.status as campaign_status,
        u.full_name as created_by_name,
        (SELECT COUNT(*) FROM messages m WHERE m.group_id = g.id AND m.is_deleted = FALSE) as message_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.group_id = g.id AND t.status = 'pending') as pending_tasks,
        (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) as member_count,
        (SELECT m2.sent_at FROM messages m2 WHERE m2.group_id = g.id ORDER BY m2.sent_at DESC LIMIT 1) as last_message_at
      FROM chat_groups g
      INNER JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
      LEFT JOIN campaigns c ON c.id = g.campaign_id
      LEFT JOIN users u ON u.id = g.created_by
      WHERE g.is_archived = FALSE
      ORDER BY last_message_at DESC, g.created_at DESC
    `, [req.user.id]);

    // Get group members for each group
    for (const group of groups) {
      const [members] = await db.query(`
        SELECT u.id, u.full_name, u.email, u.role, gm.role as group_role
        FROM group_members gm
        INNER JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
        ORDER BY u.full_name
      `, [group.id]);
      
      group.group_members = members;
    }

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

// Create campaign groups by campaign_subid (admin, advertiser_manager, advertiser only - auto-detect advertiser)
router.post('/from-campaign-data', auth, async (req, res) => {
  // Only admin, advertiser_manager, and advertiser can create campaign groups
  const allowedRoles = ['admin', 'advertiser_manager', 'advertiser'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only admin, advertiser_manager, and advertiser can create campaign groups' });
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

    // Debug: Show what we're looking for
    console.log('Looking for campaign with sub_campaign_id:', campaign_subid);

    // Find campaign in CRM campaign_data table - auto-get advertiser
    const [crmCampaigns] = await crmPool.query(`
      SELECT c.*, l.username
      FROM campaign_data c
      INNER JOIN login l ON l.id = c.user_id
      WHERE c.sub_campaign_id = ?
    `, [campaign_subid]);

    console.log('Found campaigns:', crmCampaigns.length);

    if (!crmCampaigns.length) {
      return res.status(404).json({ 
        error: 'Campaign not found in CRM data with given sub campaign ID',
        debug: { looking_for: { campaign_subid } }
      });
    }

    const crmCampaign = crmCampaigns[0];
    const adv_name = crmCampaign.username; // Auto-extracted advertiser name
    const advertiser_id = crmCampaign.user_id; // Save user_id as advertiser_id
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

    console.log('Extracted package_id:', package_id, 'from preview_url:', crmCampaign.preview_url);

    // Find corresponding advertiser in our local users table by username
    const [advertiserUsers] = await conn.query(
      'SELECT id FROM users WHERE username = ?',
      [adv_name]
    );

    const advertiserId = advertiserUsers.length > 0 ? advertiserUsers[0].id : null;

    // Create separate groups for iOS and Android
    const platforms = ['ios', 'android'];
    
    for (const platform of platforms) {
      // Build group name: {campaign_name}_{advertiser_username}_{platform}
      const groupName = `${crmCampaign.campaign_name}_${adv_name}_${platform}`;

      // Check if group already exists
      const [existing] = await conn.query(
        'SELECT id FROM chat_groups WHERE group_name = ?',
        [groupName]
      );

      if (existing.length) {
        continue; // Skip if group already exists
      }

      // Prepare CRM campaign data JSON with extracted package_id
      const crmCampaignData = {
        ...crmCampaign,
        extracted_package_id: package_id
      };

      // Create group
      const [result] = await conn.query(
        `INSERT INTO chat_groups (group_name, campaign_id, package_id, sub_id, group_type, campaign_type, created_by, platform, adv_name, advertiser_id, crm_campaign_data) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          groupName, 
          null, // No local campaign_id since we're using CRM data
          package_id, // Use extracted package_id
          crmCampaign.sub_campaign_id, 
          'campaign', 
          campaign_type, 
          req.user.id, 
          platform,
          adv_name, // Use username as adv_name
          advertiser_id, // Use user_id as advertiser_id
          JSON.stringify(crmCampaignData) // Store full CRM campaign data with extracted package_id as JSON
        ]
      );
      const groupId = result.insertId;

      // ── Default members based on campaign type ──────────────────
      // Always add: creator + advertiser (if found) + all admins
      const [allAdmins] = await conn.query("SELECT id FROM users WHERE role = 'admin'");

      let defaultUsernames = [];
      if (campaign_type === 'direct') {
        // Direct campaigns: add akshat and ipsita
        defaultUsernames = ['akshat', 'ipsita'];
      }
      // Agency campaigns: no automatic users (only creator + advertiser + admins)

      const [defaultUsers] = await conn.query(
        'SELECT id FROM users WHERE username IN (?)',
        defaultUsernames.length > 0 ? defaultUsernames : ['']
      );

      // Debug logging
      console.log('Default usernames:', defaultUsernames);
      console.log('Found default users:', defaultUsers);

      const memberIds = new Set([
        req.user.id,
        ...(advertiserId ? [advertiserId] : []),
        ...allAdmins.map(u => u.id),
        ...defaultUsers.map(u => u.id),
        ...additional_members
      ].filter(Boolean));

      console.log('Final member IDs:', Array.from(memberIds));

      for (const userId of memberIds) {
        const groupRole = (userId === req.user.id || allAdmins.some(a => a.id === userId)) ? 'admin' : 'member';
        await conn.query(
          'INSERT IGNORE INTO group_members (group_id, user_id, role, added_by) VALUES (?, ?, ?, ?)',
          [groupId, userId, groupRole, req.user.id]
        );
      }

      // ── Auto-create default tasks ──────────────────────────
      // 1. Initial Setup
      await conn.query(
        'INSERT INTO tasks (group_id, task_type, title, description, assigned_by, status) VALUES (?, ?, ?, ?, ?, ?)',
        [groupId, 'initial_setup', 'Campaign Setup & Verification', 'Verify campaign details, KPIs, and tracking setup. Confirm GEO targeting and payout structure.', req.user.id, 'pending']
      );

      // 2. Share Link
      const [shareLinkTask] = await conn.query(
        'INSERT INTO tasks (group_id, task_type, title, description, assigned_by, status) VALUES (?, ?, ?, ?, ?, ?)',
        [groupId, 'share_link', 'Share Campaign Link', 'Share the campaign tracking link with the assigned publisher.', req.user.id, 'pending']
      );
      const shareLinkTaskId = shareLinkTask.insertId;

      // Post system message for share link task
      const { encrypt } = require('../utils/encryption');
      const { encrypted: enc1, iv: iv1 } = encrypt(`📌 Task created: "Share Campaign Link" [🔗 Share Link]`);
      await conn.query(
        `INSERT INTO messages (group_id, sender_id, message_type, encrypted_content, iv, task_ref_id)
         VALUES (?, ?, 'task_notification', ?, ?, ?)`,
        [groupId, req.user.id, enc1, iv1, shareLinkTaskId]
      );

      createdGroups.push({
        id: groupId,
        group_name: groupName,
        platform: platform,
        campaign_name: crmCampaign.campaign_name,
        adv_name: adv_name,
        campaign_subid: crmCampaign.sub_campaign_id
      });
    }

    await conn.commit();

    // Emit real-time notifications to group members
    const io = req.app.get('io');
    if (io) {
      for (const group of createdGroups) {
        // Get all members of the created group
        const [members] = await conn.query(
          'SELECT user_id FROM group_members WHERE group_id = ?',
          [group.id]
        );
        
        // Notify each member about the new group
        members.forEach(member => {
          io.to(`user_${member.user_id}`).emit('group_created', {
            type: 'group_created',
            group: {
              id: group.id,
              group_name: group.group_name,
              group_type: group.group_type,
              campaign_name: group.campaign_name,
              platform: group.platform,
              created_by: req.user.full_name,
              created_at: new Date()
            }
          });
        });

        // Emit campaign creation notification to all group members
        io.to(`group_${group.id}`).emit('campaign_created', {
          type: 'campaign_created',
          campaign: {
            id: null, // CRM campaigns don't have local ID yet
            campaign_name: group.campaign_name,
            campaign_subid: group.campaign_subid,
            platform: group.platform,
            advertiser_name: group.adv_name,
            created_by: req.user.full_name,
            created_at: new Date(),
            group_id: group.id,
            group_name: group.group_name
          },
          message: `New campaign "${group.campaign_name}" created by ${req.user.full_name}`
        });

        console.log('Campaign created event emitted (from-campaign-data):', {
          campaign_name: group.campaign_name,
          campaign_subid: group.campaign_subid,
          group_id: group.id,
          members_notified: members.length
        });
      }
    }

    res.status(201).json({ 
      message: `Created ${createdGroups.length} campaign groups from CRM data`,
      groups: createdGroups
    });

  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to create campaign groups' });
  } finally { conn.release(); }
});

// Create group from campaign (admin, advertiser_manager, advertiser only - existing - keep for backward compatibility)
router.post('/from-campaign', auth, async (req, res) => {
  // Only admin, advertiser_manager, and advertiser can create campaign groups
  const allowedRoles = ['admin', 'advertiser_manager', 'advertiser'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only admin, advertiser_manager, and advertiser can create campaign groups' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { campaign_id, additional_members = [], campaign_type = 'agency' } = req.body;

    const [campaigns] = await conn.query('SELECT * FROM campaigns WHERE id = ?', [campaign_id]);
    if (!campaigns.length) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = campaigns[0];

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

    const [result] = await conn.query(
      'INSERT INTO chat_groups (group_name, campaign_id, package_id, sub_id, group_type, campaign_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [groupName, campaign_id, packageId, campaign.sub_id, 'campaign', campaign_type, req.user.id]
    );
    const groupId = result.insertId;

    // ── Default members based on campaign type ──────────────────
    // Always add: creator + advertiser + all admins
    const [allAdmins] = await conn.query("SELECT id FROM users WHERE role = 'admin'");

    let defaultUsernames = [];
    if (campaign_type === 'direct') {
      // Direct campaigns: add Akshat + Ipsita
      defaultUsernames = ['akshat', 'ipsita'];
    } else {
      // Agency campaigns: add Atique + Anvisha
      defaultUsernames = ['atique', 'anvisha'];
    }
    const [defaultUsers] = await conn.query(
      'SELECT id FROM users WHERE username IN (?)', [defaultUsernames]
    );

    const memberIds = new Set([
      req.user.id,
      campaign.advertiser_id,
      ...allAdmins.map(u => u.id),
      ...defaultUsers.map(u => u.id),
      ...additional_members
    ].filter(Boolean));

    for (const userId of memberIds) {
      const groupRole = (userId === req.user.id || allAdmins.some(a => a.id === userId)) ? 'admin' : 'member';
      await conn.query(
        'INSERT IGNORE INTO group_members (group_id, user_id, role, added_by) VALUES (?, ?, ?, ?)',
        [groupId, userId, groupRole, req.user.id]
      );
    }

    // ── Auto-create TWO default tasks ──────────────────────────
    // 1. Initial Setup
    await conn.query(
      `INSERT INTO tasks (group_id, campaign_id, task_type, title, description, assigned_by, status)
       VALUES (?, ?, 'initial_setup', 'Campaign Setup & Verification',
       'Verify campaign details, KPIs, and tracking setup. Confirm GEO targeting and payout structure.',
       ?, 'pending')`,
      [groupId, campaign_id, req.user.id]
    );

    // 2. Share Link (auto-created as per requirement)
    const [shareLinkTask] = await conn.query(
      `INSERT INTO tasks (group_id, campaign_id, task_type, title, description, assigned_by, status)
       VALUES (?, ?, 'share_link', 'Share Campaign Link',
       'Share the campaign tracking link with the assigned publisher.',
       ?, 'pending')`,
      [groupId, campaign_id, req.user.id]
    );
    const shareLinkTaskId = shareLinkTask.insertId;

    // Post a system message for the share link task
    const shareLinkContent = `📌 Task created: "Share Campaign Link" [🔗 Share Link]`;
    const { encrypted: enc1, iv: iv1 } = encrypt(shareLinkContent);
    await conn.query(
      `INSERT INTO messages (group_id, sender_id, message_type, encrypted_content, iv, task_ref_id)
       VALUES (?, ?, 'task_notification', ?, ?, ?)`,
      [groupId, req.user.id, enc1, iv1, shareLinkTaskId]
    );

    // Log workflow
    await conn.query(
      'INSERT INTO workflow_summary (group_id, event_type, event_data, triggered_by) VALUES (?, ?, ?, ?)',
      [groupId, 'group_created', JSON.stringify({ campaign_name: campaign.campaign_name, group_name: groupName, campaign_type }), req.user.id]
    );

    await conn.commit();

    const [newGroup] = await conn.query(
      'SELECT g.*, c.campaign_name FROM chat_groups g LEFT JOIN campaigns c ON c.id = g.campaign_id WHERE g.id = ?',
      [groupId]
    );

    // Emit real-time notifications to group members
    const io = req.app.get('io');
    if (io && newGroup[0]) {
      // Get all members of the created group
      const [members] = await conn.query(
        'SELECT user_id FROM group_members WHERE group_id = ?',
        [groupId]
      );
      
      // Notify each member about the new group
      members.forEach(member => {
        io.to(`user_${member.user_id}`).emit('group_created', {
          type: 'group_created',
          group: {
            id: newGroup[0].id,
            group_name: newGroup[0].group_name,
            group_type: newGroup[0].group_type,
            campaign_name: newGroup[0].campaign_name,
            created_by: req.user.full_name,
            created_at: new Date()
          }
        });
      });

      // Emit campaign creation notification to all group members
      io.to(`group_${groupId}`).emit('campaign_created', {
        type: 'campaign_created',
        campaign: {
          id: campaign.id,
          campaign_name: campaign.campaign_name,
          geo: campaign.geo,
          payout: campaign.payout,
          status: campaign.status,
          advertiser_id: campaign.advertiser_id,
          advertiser_name: advRows[0]?.full_name || 'Unknown',
          package_id: packageId,
          sub_id: campaign.sub_id,
          preview_url: campaign.preview_url,
          kpi: campaign.kpi,
          mmp_tracker: campaign.mmp_tracker,
          created_by: req.user.full_name,
          created_at: new Date(),
          group_id: groupId,
          group_name: groupName
        },
        message: `New campaign "${campaign.campaign_name}" created by ${req.user.full_name}`
      });

      console.log('Campaign created event emitted:', {
        campaign_id: campaign.id,
        campaign_name: campaign.campaign_name,
        group_id: groupId,
        members_notified: members.length
      });
    }

    res.status(201).json({ group: newGroup[0], message: 'Group created successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  } finally { conn.release(); }
});

// Create custom group (admin only)
router.post('/custom', auth, async (req, res) => {
  // Only admin can create custom groups
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can create custom groups' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { group_name, member_ids = [] } = req.body;
    if (!group_name) return res.status(400).json({ error: 'Group name required' });

    const [result] = await conn.query(
      'INSERT INTO chat_groups (group_name, group_type, created_by) VALUES (?, ?, ?)',
      [group_name, 'custom', req.user.id]
    );
    const groupId = result.insertId;
    const memberIds = new Set([req.user.id, ...member_ids]);
    for (const userId of memberIds) {
      await conn.query(
        'INSERT IGNORE INTO group_members (group_id, user_id, role, added_by) VALUES (?, ?, ?, ?)',
        [groupId, userId, userId === req.user.id ? 'admin' : 'member', req.user.id]
      );
    }
    await conn.commit();

    // Emit real-time notifications to group members
    const io = req.app.get('io');
    if (io) {
      // Get all members of the created group
      const [members] = await conn.query(
        'SELECT user_id FROM group_members WHERE group_id = ?',
        [groupId]
      );
      
      // Notify each member about the new group
      members.forEach(member => {
        io.to(`user_${member.user_id}`).emit('group_created', {
          type: 'group_created',
          group: {
            id: groupId,
            group_name: group_name,
            group_type: 'custom',
            created_by: req.user.full_name,
            created_at: new Date()
          }
        });
      });
    }

    res.status(201).json({ group: { id: groupId, group_name }, message: 'Group created' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Failed to create group' });
  } finally { conn.release(); }
});

// Get group details + members
router.get('/:groupId', auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const [membership] = await db.query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, req.user.id]
    );
    if (!membership.length && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not a member of this group' });
    }
    const [groups] = await db.query(`
      SELECT g.*, c.campaign_name, c.geo, c.payout, c.payable_event, c.preview_url, c.kpi, c.mmp_tracker, c.status as campaign_status
      FROM chat_groups g
      LEFT JOIN campaigns c ON c.id = g.campaign_id
      WHERE g.id = ?
    `, [groupId]);
    const [members] = await db.query(`
      SELECT u.id, u.full_name, u.username, u.email, u.role, u.is_online, u.last_seen, gm.role as group_role
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
    `, [groupId]);
    res.json({ group: groups[0], members });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Add member (also auto-add publisher_manager if publisher is added)
router.post('/:groupId/members', auth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { groupId } = req.params;
    const { user_id } = req.body;

    await conn.query(
      'INSERT IGNORE INTO group_members (group_id, user_id, role, added_by) VALUES (?, ?, ?, ?)',
      [groupId, user_id, 'member', req.user.id]
    );

    // If added user is a publisher → auto-add their publisher_manager
    const [addedUser] = await conn.query('SELECT role FROM users WHERE id = ?', [user_id]);
    if (addedUser[0]?.role === 'publisher') {
      const [pubManagers] = await conn.query("SELECT id FROM users WHERE role = 'publisher_manager'");
      for (const pm of pubManagers) {
        await conn.query(
          'INSERT IGNORE INTO group_members (group_id, user_id, role, added_by) VALUES (?, ?, ?, ?)',
          [groupId, pm.id, 'member', req.user.id]
        );
      }
    }

    await conn.query(
      'INSERT INTO workflow_summary (group_id, event_type, event_data, triggered_by) VALUES (?, ?, ?, ?)',
      [groupId, 'member_added', JSON.stringify({ user_id }), req.user.id]
    );
    await conn.commit();
    res.json({ message: 'Member added' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Server error' });
  } finally { conn.release(); }
});

// Remove member
router.delete('/:groupId/members/:userId', auth, async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    await db.query('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
    res.json({ message: 'Member removed' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Workflow summary
router.get('/:groupId/summary', auth, async (req, res) => {
  try {
    const [events] = await db.query(`
      SELECT ws.*, u.full_name as triggered_by_name
      FROM workflow_summary ws
      LEFT JOIN users u ON u.id = ws.triggered_by
      WHERE ws.group_id = ?
      ORDER BY ws.created_at ASC
    `, [req.params.groupId]);
    res.json({ events });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
