const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { auth } = require('../middleware/auth');
const { encrypt } = require('../utils/encryption');

// Get all groups for user with user-specific message counts
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

module.exports = router;
