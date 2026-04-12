const getMessageAccessFilter = async (crmDb, userId) => {
  

  // 🔹 STEP 1: Try CRM DB
  let user;

  const [rows] = await crmDb.query(
    `SELECT id, role FROM login WHERE id = ?`,
    [userId]
  );


  if (rows.length > 0) {
    user = rows[0];
  } else {

    const [fallbackRows] = await db.query(
      `SELECT id, role FROM login WHERE id = ?`,
      [userId]
    );


    if (fallbackRows.length > 0) {
      user = fallbackRows[0];
    } else {
      throw new Error('User role not found');
    }
  }

  const role = user.role;

  // 👑 ADMIN → ALL USERS
  if (role === 'admin') {
    return {
      where: `1=1`,
      params: [],
      role: role
    };
  }

  // 🔹 BASE CONDITION (own messages + messages sent to user)
  let where = `(m.sender_id = ? OR m.recipient_id = ?)`;
  let params = [userId, userId];

  // 🧑‍💼 advertiser_manager / publisher_manager
  if (role === 'advertiser_manager' || role === 'publisher_manager') {

    const [subs] = await crmDb.query(
      `SELECT sub_admin_id FROM manager_subadmins WHERE manager_id = ?`,
      [userId]
    );

    const subAdminIds = subs.map(s => s.sub_admin_id);

    if (subAdminIds.length > 0) {
      const placeholders = subAdminIds.map(() => '?').join(',');

      where += ` OR m.sender_id IN (${placeholders}) OR m.recipient_id IN (${placeholders})`;

      params.push(...subAdminIds, ...subAdminIds);
    }
  }

  // 🧑 advertiser / publisher
  if (role === 'advertiser' || role === 'publisher') {

    const [managers] = await crmDb.query(
      `SELECT manager_id FROM manager_subadmins WHERE sub_admin_id = ?`,
      [userId]
    );

    const managerIds = managers.map(m => m.manager_id);

    if (managerIds.length > 0) {
      const placeholders = managerIds.map(() => '?').join(',');

      where += ` OR m.sender_id IN (${placeholders}) OR m.recipient_id IN (${placeholders})`;

      params.push(...managerIds, ...managerIds);
    }
  }

  return {
    where,
    params,
    role: role
  };
};

// 🏷️ Convert role code to readable name
const getReadableRole = (role) => {
  const roleMap = {
    'admin': 'Administrator',
    'advertiser_manager': 'Advertiser Manager',
    'advertiser': 'Advertiser',
    'publisher_manager': 'Publisher Manager',
    'publisher': 'Publisher'
  };
  return roleMap[role] || role;
};

// 🔍 Get user assignment information for secondary recipient option
const getUserAssignmentInfo = async (crmDb, db, userId, targetUserId) => {
  try {
    // Get target user's role to determine if we need to add their managers
    const [targetUserRows] = await crmDb.query(
      `SELECT id, role FROM login WHERE id = ?`,
      [targetUserId]
    );
    
    const targetUserRole = targetUserRows.length > 0 ? targetUserRows[0].role : null;
    
    // Check if target user is assigned to someone
    const [assignments] = await crmDb.query(
      `SELECT manager_id FROM manager_subadmins WHERE sub_admin_id = ?`,
      [targetUserId]
    );

    const secondaryUsers = [];
    const managerIds = new Set(); // Use Set to avoid duplicates
    
    // Add target user's managers
    if (assignments.length > 0) {
      assignments.forEach(a => managerIds.add(a.manager_id));
    }
    
    // Add target user's managers if they are pub_executive or adv_executive
    if (targetUserRole === 'pub_executive' || targetUserRole === 'adv_executive') {
      console.log(`CC Debug: Target user ${targetUserId} has role ${targetUserRole} - adding hierarchy`);
      
      const [targetUserAssignments] = await crmDb.query(
        `SELECT manager_id FROM manager_subadmins WHERE sub_admin_id = ?`,
        [targetUserId]
      );
      
      if (targetUserAssignments.length > 0) {
        console.log(`CC Debug: Found ${targetUserAssignments.length} direct managers for target user`);
        
        // Add direct managers (publishers for pub_executive, advertisers for adv_executive)
        targetUserAssignments.forEach(a => managerIds.add(a.manager_id));
        
        // Now get the managers of these managers (publisher_managers for publishers, advertiser_managers for advertisers)
        const directManagerIds = targetUserAssignments.map(a => a.manager_id);
        if (directManagerIds.length > 0) {
          const placeholders = directManagerIds.map(() => '?').join(',');
          const [secondLevelManagers] = await crmDb.query(
            `SELECT DISTINCT manager_id FROM manager_subadmins WHERE sub_admin_id IN (${placeholders})`,
            directManagerIds
          );
          
          console.log(`CC Debug: Found ${secondLevelManagers.length} second-level managers`);
          
          // Add second-level managers
          secondLevelManagers.forEach(m => managerIds.add(m.manager_id));
        }
      } else {
        console.log(`CC Debug: No direct managers found for target user ${targetUserId}`);
      }
    }
    
    if (managerIds.size > 0) {
      // Get manager details from CRM DB (login table)
      const managerIdArray = Array.from(managerIds);
      const placeholders = managerIdArray.map(() => '?').join(',');
      const [managers] = await crmDb.query(
        `SELECT id, username, role FROM login WHERE id IN (${placeholders})`,
        managerIdArray
      );
      
      // Get full names from Chat DB (users table)
      if (managers.length > 0) {
        const managerUserIds = managers.map(m => m.id);
        const userPlaceholders = managerUserIds.map(() => '?').join(',');
        const [userDetails] = await db.query(
          `SELECT id, full_name FROM users WHERE id IN (${userPlaceholders})`,
          managerUserIds
        );
        
        // Combine login and users data
        const managersWithReadableRoles = managers.map(manager => {
          const userDetail = userDetails.find(u => u.id === manager.id);
          return {
            id: manager.id,
            username: manager.username,
            role: manager.role,
            full_name: userDetail?.full_name || `User ${manager.id}`,
            readable_role: getReadableRole(manager.role)
          };
        });
        
        secondaryUsers.push(...managersWithReadableRoles);
      }
    }
    
    console.log(`CC Debug: Final result for target user ${targetUserId}: ${secondaryUsers.length} secondary users`);
    secondaryUsers.forEach(user => {
      console.log(`CC Debug: - ${user.full_name} (${user.role})`);
    });

    return {
      isAssigned: assignments.length > 0 || secondaryUsers.length > 0,
      secondaryUsers: secondaryUsers
    };
  } catch (error) {
    return {
      isAssigned: false,
      secondaryUsers: []
    };
  }
};

// 🎯 Get available recipients for a user in a group
const getAvailableRecipients = async (crmDb, db, groupId, currentUserId) => {
  try {
    // Get ALL group members except current user
    const [members] = await db.query(`
      SELECT gm.user_id, u.full_name, u.role
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ? AND gm.user_id != ?
      ORDER BY u.full_name
    `, [groupId, currentUserId]);

    // 🎯 CORE RULE: Any group member can message any other member
    // No hierarchy restrictions for messaging - only for task assignment
    return members;
  } catch (error) {
    return [];
  }
};

// 🔐 Check if user can message recipient based on hierarchy
const canUserMessageRecipient = async (crmDb, senderId, recipientId, senderRole) => {
  try {
    // 🎯 CORE RULE: Any group member can message any other group member
    // No hierarchy restrictions for messaging - only for task assignment
    // Only check if both users exist in the system
    
    // Get sender info
    const [senderRows] = await crmDb.query(
      `SELECT id FROM login WHERE id = ?`,
      [senderId]
    );
    
    if (senderRows.length === 0) return false;
    
    // Get recipient info
    const [recipientRows] = await crmDb.query(
      `SELECT id FROM login WHERE id = ?`,
      [recipientId]
    );

    if (recipientRows.length === 0) return false;

    // Allow messaging between any valid users in the same group
    return true;
  } catch (error) {
    console.error('Error checking message permission:', error);
    return false;
  }
};

module.exports = { 
  getMessageAccessFilter, 
  getUserAssignmentInfo, 
  getAvailableRecipients,
  canUserMessageRecipient 
};
