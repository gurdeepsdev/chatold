const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { auth } = require('../middleware/auth');

// GET unread message counts per group (user-specific)
router.get('/unread-counts', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all groups the user is a member of
    const [groups] = await db.query(`
      SELECT DISTINCT g.id 
      FROM chat_groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
    `, [userId]);
    
    if (groups.length === 0) {
      return res.json({ unreadCounts: {} });
    }
    
    const groupIds = groups.map(g => g.id);
    
    // Get unread message counts for each group (user-specific)
    const [unreadCounts] = await db.query(`
      SELECT 
        m.group_id,
        COUNT(*) as unread_count
      FROM messages m
      LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = ? AND ms.status = 'seen'
      WHERE m.group_id IN (${groupIds.map(() => '?').join(',')})
      AND m.sender_id != ?
      AND ms.message_id IS NULL
      AND (m.recipient_id = ? OR m.secondary_recipient_id = ?)
      GROUP BY m.group_id
    `, [userId, ...groupIds, userId, userId, userId]);
    
    // Convert to object with group_id as key
    const countsMap = {};
    unreadCounts.forEach(row => {
      countsMap[row.group_id] = row.unread_count;
    });
    
    res.json({ unreadCounts: countsMap });
  } catch (error) {
    console.error('Failed to get unread counts:', error);
    res.status(500).json({ error: 'Failed to get unread counts' });
  }
});

module.exports = router;
