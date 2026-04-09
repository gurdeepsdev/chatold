const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { auth } = require('../middleware/auth');
const { encrypt } = require('../utils/encryption');
const {
  getUsersByRole,
  getAssignedHierarchyUsers,
  expandUsersWithHierarchy,
  getAllAdminUsers
} = require('../utils/taskAccess');

// Get all groups for user
router.get('/', auth, async (req, res) => {
  try {
    console.log('=== DEBUG: Message Count Analysis ===');
    console.log('User ID:', req.user.id, 'User:', req.user.full_name);

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
      WHERE g.is_archived = FALSE
      ORDER BY last_message_at DESC, g.created_at DESC
    `, [req.user.id, req.user.id, req.user.id]);

    // Debug: Check first group in detail
    if (groups.length > 0) {
      const firstGroup = groups[0];
      console.log(`\n--- Group: ${firstGroup.group_name} (ID: ${firstGroup.id}) ---`);
      console.log('API Count:', firstGroup.message_count);

      // Check total messages in group
      const [totalMessages] = await db.query(`
        SELECT COUNT(*) as total FROM messages m 
        WHERE m.group_id = ? AND m.is_deleted = FALSE
      `, [firstGroup.id]);
      console.log('Total messages in group:', totalMessages[0].total);

      // Check messages where user is recipient
      const [userMessages] = await db.query(`
        SELECT COUNT(*) as user_msg FROM messages m 
        WHERE m.group_id = ? AND m.is_deleted = FALSE 
        AND (m.recipient_id = ? OR m.secondary_recipient_id = ?)
      `, [firstGroup.id, req.user.id, req.user.id]);
      console.log('Messages where user is recipient:', userMessages[0].user_msg);

      // Show sample messages with recipient details
      const [sampleMessages] = await db.query(`
        SELECT 
          m.id,
          m.recipient_id,
          m.secondary_recipient_id,
          m.sender_id,
          u_recipient.full_name as recipient_name,
          u_secondary.full_name as secondary_name,
          u_sender.full_name as sender_name
        FROM messages m
        LEFT JOIN users u_recipient ON u_recipient.id = m.recipient_id
        LEFT JOIN users u_secondary ON u_secondary.id = m.secondary_recipient_id
        LEFT JOIN users u_sender ON u_sender.id = m.sender_id
        WHERE m.group_id = ? AND m.is_deleted = FALSE
        ORDER BY m.sent_at DESC
        LIMIT 3
      `, [firstGroup.id]);

      console.log('Sample messages:');
      sampleMessages.forEach(m => {
        console.log(`  ID ${m.id}: ${m.sender_name} -> ${m.recipient_name || 'NULL'}${m.secondary_name ? ' + ' + m.secondary_name : ''} (User is recipient: ${m.recipient_id === req.user.id || m.secondary_recipient_id === req.user.id})`);
      });
      console.log('========================================\n');
    }

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
    console.log('=== THREAD GROUPING DEBUG ===');
    groups.forEach(g => {
      console.log(`Group: ${g.group_name}, Package ID: ${g.package_id}, ID: ${g.id}`);
      const key = g.package_id || `custom_${g.id}`;
      if (!threads[key]) threads[key] = { package_id: key, groups: [] };
      threads[key].groups.push(g);
    });
    console.log('Final threads:', Object.keys(threads).map(k => `${k}: ${threads[k].groups.length} groups`));
    console.log('=== END THREAD DEBUG ===\n');

    res.json({ groups, threads: Object.values(threads) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create campaign groups by campaign_subid (admin, advertiser_manager, advertiser only - auto-detect advertiser)
router.post('/from-campaign-data', auth, async (req, res) => {
  console.log('CAMPAIGN GROUP CREATION ENDPOINT CALLED!');

  // Only admin, advertiser_manager, advertiser, and adv_executive can create campaign groups
  const allowedRoles = ['admin', 'advertiser_manager', 'advertiser', 'adv_executive'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only admin, advertiser_manager, advertiser, and adv_executive can create campaign groups' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { campaign_subid, campaign_type = 'agency', additional_members = [] } = req.body;

    console.log('=== CAMPAIGN GROUP CREATION DEBUG ===');
    console.log('campaign_subid:', campaign_subid);
    console.log('campaign_type:', campaign_type);
    console.log('additional_members:', additional_members);
    console.log('additional_members type:', typeof additional_members);
    console.log('additional_members length:', additional_members?.length);
    console.log('Is array?', Array.isArray(additional_members));

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
      WHERE c.sub_campaign_id = ? AND c.user_id = ?
    `, [campaign_subid, req.user.id]);

    console.log('Found campaigns:', crmCampaigns.length);
    console.log('Campaign search by user_id:', req.user.id);

    if (!crmCampaigns.length) {
      return res.status(404).json({
        error: 'Campaign not found in CRM data with given sub campaign ID for this user',
        debug: {
          looking_for: {
            campaign_subid,
            user_id: req.user.id
          }
        }
      });
    }

    const crmCampaign = crmCampaigns[0];
    const adv_name = req.user.full_name?.split(' ')[0] || req.user.username; // Use creator's name
    const advertiserId = req.user.id; // Use creator's ID directly
    const createdGroups = [];

    // Extract package_id from preview_url
    let package_id = null;
    console.log('=== PACKAGE_ID EXTRACTION DEBUG ===');
    console.log('Campaign preview_url:', crmCampaign.preview_url);
    console.log('Campaign preview_url type:', typeof crmCampaign.preview_url);
    console.log('Campaign preview_url === "NA":', crmCampaign.preview_url === 'NA');

    if (crmCampaign.preview_url && crmCampaign.preview_url !== 'NA') {
      const url = crmCampaign.preview_url;
      console.log('Processing URL:', url);

      if (url.includes('apps.apple.com')) {
        // iOS: Extract from /id{number} pattern
        const iosMatch = url.match(/\/id(\d+)/);
        if (iosMatch) {
          package_id = iosMatch[1];
          console.log('iOS package_id extracted:', package_id);
        } else {
          console.log('iOS regex match failed');
        }
      } else if (url.includes('play.google.com')) {
        // Android: Extract from id={package_name} pattern
        const androidMatch = url.match(/[?&]id=([^&]+)/);
        if (androidMatch) {
          package_id = androidMatch[1];
          console.log('Android package_id extracted:', package_id);
        } else {
          console.log('Android regex match failed');
        }
      } else {
        // Direct package_id (no URL format)
        package_id = url.trim();
        console.log('Direct package_id set:', package_id);
      }
    } else {
      console.log('No preview_url or preview_url is NA');
    }

    console.log('Final package_id:', package_id);
    console.log('=== END PACKAGE_ID DEBUG ===\n');

    console.log('Extracted package_id:', package_id, 'from preview_url:', crmCampaign.preview_url);

    // Get available OS platforms for this campaign (instead of hardcoded iOS/Android)
     const [osPlatforms] = await crmPool.query(
      `SELECT DISTINCT os FROM campaign_data WHERE sub_campaign_id = ? AND user_id = ? AND os IS NOT NULL AND os != ''`,
      [campaign_subid, req.user.id]
     );

     console.log('Available OS platforms for campaign:', osPlatforms.map(o => o.os));

     // Get adv_d for this campaign
     const [advdResult] = await crmPool.query(
      `SELECT DISTINCT adv_d FROM campaign_data WHERE sub_campaign_id = ? AND user_id = ? AND adv_d IS NOT NULL AND adv_d != ''`,
      [campaign_subid, req.user.id]
     );

     console.log('Available OS platforms for campaign:', osPlatforms.map(o => o.os));
     console.log('Available adv_d for campaign:', advdResult.map(a => a.adv_d));

     // If no OS data found, default to creating one group without OS specification
     const platforms = osPlatforms.length > 0
      ? osPlatforms.map(o => o.os.toLowerCase().replace(/\s+/g, '')) // Clean OS names (e.g., "iOS" -> "ios")
      : ['default']; // Fallback for campaigns without OS data

     // Create groups for each OS and adv_d combination
     for (const platform of platforms) {
      for (const advdData of advdResult.length > 0 ? advdResult : [{ adv_d: 'default' }]) {
        // Build group name: {campaign_name}_{advertiser_username}_{platform}_{adv_d}
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
            req.user.id, // Use user_id as advertiser_id
            JSON.stringify(crmCampaignData) // Store full CRM campaign data with extracted package_id as JSON
          ]
        );
        const groupId = result.insertId;

        // ── Default members based on campaign type and hierarchy ──────────────────
        // Always add: creator + advertiser (if found) + all admins
        const allAdmins = await getAllAdminUsers(db.crmPool); // Use CRM DB for admin users

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

        // 🔄 NEW: Expand additional members with hierarchy
        let expandedMembers = [];
        if (additional_members && Array.isArray(additional_members) && additional_members.length > 0) {
          console.log('Processing additional_members:', additional_members);

          // Get full user objects for additional members
          const [additionalUserObjects] = await conn.query(
            `SELECT id, full_name, email, role FROM users WHERE id IN (${additional_members.map(() => '?').join(',')})`,
            additional_members
          );

          console.log('Additional user objects from chat DB:', additionalUserObjects);

          // Expand with hierarchy using CRM database
          expandedMembers = await expandUsersWithHierarchy(crmPool, additionalUserObjects);
          console.log('Expanded members after hierarchy:', expandedMembers);
        } else {
          console.log('No additional_members to process');
        }

        // Auto-add creator's hierarchy for advertiser roles
        let creatorHierarchy = [];
        if (req.user.role === 'advertiser' || req.user.role === 'adv_executive') {
          console.log(`Auto-adding hierarchy for creator role: ${req.user.role}`);

          // Get creator's user object from CRM database
          const [creatorUser] = await crmPool.query(
            `SELECT id, username, role FROM login WHERE id = ?`,
            [req.user.id]
          );

          if (creatorUser && creatorUser.length > 0) {
            creatorHierarchy = await expandUsersWithHierarchy(crmPool, creatorUser);
            console.log('Creator hierarchy auto-added:', creatorHierarchy);
            console.log('Creator user details:', creatorUser[0]);
          } else {
            console.log('⚠️ Creator hierarchy NOT added - creatorUser length:', creatorUser.length);
          }
        }

        const memberIds = new Set([
          req.user.id,
          ...(advertiserId ? [advertiserId] : []),
          ...allAdmins.map(u => u.id),
          ...defaultUsers.map(u => u.id),
          ...expandedMembers.map(u => u.id),
          ...creatorHierarchy.map(u => u.id)
        ].filter(Boolean));

        console.log('=== FINAL MEMBER INSERTION ===');
        console.log('Creator ID:', req.user.id);
        console.log('Creator role:', req.user.role);
        console.log('Advertiser ID:', advertiserId);
        console.log('All admins:', allAdmins.map(u => u.id));
        console.log('Default users:', defaultUsers.map(u => u.id));
        console.log('Expanded members:', expandedMembers.map(u => u.id));
        console.log('Creator hierarchy:', creatorHierarchy.map(u => u.id));
        console.log('Final member IDs Set:', Array.from(memberIds));
        console.log('Expected vs Actual:');
        console.log('Expected: [26, 5, 53, 20, 24, 52]');
        console.log('Actual:', Array.from(memberIds));

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
          group_type: campaign_type, // Add missing group_type field
          platform: platform,
          campaign_name: crmCampaign.campaign_name,
          adv_name: adv_name,
          campaign_subid: crmCampaign.sub_campaign_id
        });
        
        console.log(`🔌 Added group to createdGroups: ${groupId} - ${groupName}`);
        console.log(`🔌 Current createdGroups length: ${createdGroups.length}`);
      

    } // closes advdData loop
    } // closes platform loop

    await conn.commit();

    console.log('🔌 About to emit real-time notifications...');
    console.log('🔌 Created groups count:', createdGroups.length);
    console.log('🔌 Created groups:', createdGroups.map(g => ({ id: g.id, name: g.group_name })));

    // Emit real-time notifications to group members
    const io = req.app.get('io');
    console.log('=== SOCKET EMISSION DEBUG ===');
    console.log('IO available:', !!io);
    console.log('IO type:', typeof io);
    
    if (io) {
      console.log('Socket IO available, emitting group_created events...');
      console.log('Created groups to process:', createdGroups.length);
      
      for (const group of createdGroups) {
        console.log(`Processing group ${group.id}: ${group.group_name}`);
        
        try {
          // Get all members of the created group
          const [members] = await conn.query(
            'SELECT user_id FROM group_members WHERE group_id = ?',
            [group.id]
          );
          
          console.log(`Found ${members.length} members for group ${group.id}:`, members.map(m => m.user_id));

          // Notify each member about the new group
          for (const member of members) {
            console.log(`Emitting group_created to user_${member.user_id}`);
            
            // Check if user is connected
            const sockets = await io.in(`user_${member.user_id}`).allSockets();
            console.log(`Sockets in user_${member.user_id}:`, Array.from(sockets).length);
            
            io.to(`user_${member.user_id}`).emit('group_created', {
              type: 'group_created',
              group: {
                id: group.id,
                group_name: group.group_name,
                group_type: group.group_type,
                campaign_name: group.campaign_name,
                platform: group.platform,
                created_by: req.user.full_name,
                created_at: new Date(),
                member_ids: members.map(m => m.user_id) // Add member IDs for frontend validation
              }
            });
            
            console.log(`Successfully emitted to user_${member.user_id}`);
          }
        } catch (error) {
          console.error(`Error processing group ${group.id}:`, error);
        }
      }
    } else {
      console.log('Socket IO not available - no real-time notifications sent');
    }
    console.log('=== END SOCKET EMISSION DEBUG ===');

    res.status(201).json({
      message: `Created ${createdGroups.length} campaign groups from CRM data`,
      groups: createdGroups
    });
  }catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to create campaign groups' });
  } finally { conn.release(); }

})

  // Create group from campaign (admin, advertiser_manager, advertiser only - existing - keep for backward compatibility)
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

      // 🔄 NEW: Always add all admins to custom groups
      const allAdmins = await getAllAdminUsers(db.crmPool); // Use CRM DB for admin users

      // 🔄 NEW: Expand member_ids with hierarchy
      let expandedMembers = [];
      if (member_ids && Array.isArray(member_ids) && member_ids.length > 0) {
        // Get full user objects for selected members
        const [memberObjects] = await conn.query(
          `SELECT id, full_name, email, role FROM users WHERE id IN (${member_ids.map(() => '?').join(',')})`,
          member_ids
        );

        // Expand with hierarchy using CRM database
        expandedMembers = await expandUsersWithHierarchy(db.crmPool, memberObjects);
      }

      const memberIds = new Set([
        req.user.id,
        ...allAdmins.map(u => u.id),
        ...expandedMembers.map(u => u.id)
      ].filter(Boolean));

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

  // Get users grouped by roles (for group creation)
  router.get('/users-by-roles', auth, async (req, res) => {
    console.log('GET /api/groups/users-by-roles - called by user:', req.user?.role);

    try {
      const crmPool = db.crmPool;
      if (!crmPool) {
        console.log('CRM database not configured');
        return res.status(500).json({ error: 'CRM database not configured' });
      }

      console.log('Fetching users from CRM database...');

      // Get all users from CRM database
      const [allUsers] = await crmPool.query(
        `SELECT id, username, role FROM login WHERE role IN ('pub_executive', 'publisher', 'publisher_manager', 'adv_executive', 'advertiser', 'advertiser_manager') ORDER BY role, username`
      );

      console.log('Found users:', allUsers.length, 'for roles');

      // Group users by role
      const usersByRole = {
        publisher_side: {
          pub_executive: allUsers.filter(u => u.role === 'pub_executive'),
          publisher: allUsers.filter(u => u.role === 'publisher'),
          publisher_manager: allUsers.filter(u => u.role === 'publisher_manager')
        },
        advertiser_side: {
          adv_executive: allUsers.filter(u => u.role === 'adv_executive'),
          advertiser: allUsers.filter(u => u.role === 'advertiser'),
          advertiser_manager: allUsers.filter(u => u.role === 'advertiser_manager')
        }
      };

      console.log('Users by role:', {
        publisher_side: {
          pub_executive: usersByRole.publisher_side.pub_executive.length,
          publisher: usersByRole.publisher_side.publisher.length,
          publisher_manager: usersByRole.publisher_side.publisher_manager.length
        },
        advertiser_side: {
          adv_executive: usersByRole.advertiser_side.adv_executive.length,
          advertiser: usersByRole.advertiser_side.advertiser.length,
          advertiser_manager: usersByRole.advertiser_side.advertiser_manager.length
        }
      });

      res.json({ users_by_role: usersByRole });
    } catch (err) {
      console.error('Error fetching users by roles:', err);
      res.status(500).json({ error: 'Failed to fetch users by roles' });
    }
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

  // Expand users with hierarchy (for group creation)
  router.post('/expand-hierarchy', auth, async (req, res) => {
    try {
      const { user_ids } = req.body;

      if (!user_ids || !Array.isArray(user_ids)) {
        return res.status(400).json({ error: 'user_ids array required' });
      }

      const conn = await db.getConnection();

      // Get full user objects for selected users
      const [userObjects] = await conn.query(
        `SELECT id, full_name, email, role FROM users WHERE id IN (${user_ids.map(() => '?').join(',')})`,
        user_ids
      );

      // Get CRM pool for hierarchy expansion and admin users
      const crmPool = db.crmPool;
      if (!crmPool) {
        return res.status(500).json({ error: 'CRM database not configured' });
      }

      // Expand with hierarchy using CRM database
      const expandedUsers = await expandUsersWithHierarchy(crmPool, userObjects);

      res.json({ users: expandedUsers });
    } catch (err) {
      console.error('Hierarchy expansion error:', err);
      res.status(500).json({ error: 'Failed to expand hierarchy' });
    }
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

      // Emit real-time member update to all group members
      const io = req.app.get('io');
      if (io) {
        io.to(`group_${groupId}`).emit('member_added', {
          group_id: parseInt(groupId),
          user_id: parseInt(user_id),
          added_by: req.user.id,
          added_by_name: req.user.full_name,
          timestamp: new Date()
        });
        console.log('👥 Member added and emitted to group:', groupId);
      }

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
