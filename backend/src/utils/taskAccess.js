const getTaskAccessFilter = async (crmDb, userId) => {


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

  // 👑 ADMIN → ALL DATA
  if (role === 'admin') {
    return {
      where: `1=1`,
      params: []
    };
  }

  // 🔹 BASE CONDITION (own tasks)
  let where = `(t.assigned_to = ? OR t.assigned_by = ?)`;
  let params = [userId, userId];

  // 🆕 If advertiser-side users → see operations tasks
// if (['advertiser_manager', 'advertiser', 'adv_executive'].includes(role)) {

//   const [operationsUsers] = await crmDb.query(`
//     SELECT id FROM login WHERE role = 'operations'
//   `);

//   const opIds = operationsUsers.map(u => u.id);

//   if (opIds.length > 0) {
//     const placeholders = opIds.map(() => '?').join(',');

//     where += `
//       OR t.assigned_by IN (${placeholders})
//     `;

//     params.push(...opIds);
//   }
// }
  // 🆕 OPERATIONS → expose tasks to advertiser hierarchy
// if (role === 'operations') {

//   // Get advertiser side users (same group logic via manager_subadmins)
//   const [advUsers] = await crmDb.query(`
//     SELECT l.id
//     FROM login l
//     WHERE l.role IN ('advertiser_manager', 'advertiser', 'adv_executive')
//   `);

//   const advUserIds = advUsers.map(u => u.id);

//   if (advUserIds.length > 0) {
//     const placeholders = advUserIds.map(() => '?').join(',');

//     where += ` 
//       OR t.assigned_to IN (${placeholders}) 
//       OR t.assigned_by IN (${placeholders})
//     `;

//     params.push(...advUserIds, ...advUserIds);
//   }
// }

// 🆕 OPERATIONS → expose tasks ONLY to advertiser-side users in SAME group
// 🆕 OPERATIONS → expose tasks ONLY to advertiser-side users in SAME group
if (role === 'operations') {
    console.log('🔧 OPERATIONS ROLE - Processing...');

  // Step 1: Find which groups this operations user belongs to
  const [groupRows] = await crmDb.query(
    `SELECT manager_id, sub_admin_id 
     FROM manager_subadmins 
     WHERE manager_id = ? OR sub_admin_id = ?`,
    [userId, userId]
  );
  console.log('🔍 Operations user groups:', groupRows);

  // Collect all peer IDs from those group rows (excluding self)
  let groupMemberIds = [];
  for (const row of groupRows) {
    if (row.manager_id !== userId) groupMemberIds.push(row.manager_id);
    if (row.sub_admin_id !== userId) groupMemberIds.push(row.sub_admin_id);
  }
  groupMemberIds = [...new Set(groupMemberIds)];

  if (groupMemberIds.length > 0) {
    const placeholders = groupMemberIds.map(() => '?').join(',');

    // Step 2: From those peers, pick only advertiser-side roles
    const [advUsers] = await crmDb.query(
      `SELECT id FROM login 
       WHERE role IN ('advertiser_manager', 'advertiser', 'adv_executive')
       AND id IN (${placeholders})`,
      [...groupMemberIds]
    );

    const advUserIds = advUsers.map(u => u.id);

    if (advUserIds.length > 0) {
      const advPlaceholders = advUserIds.map(() => '?').join(',');
      
      // 🎯 KEY FIX: Replace base condition for operations users
      where = `t.assigned_by = ? OR t.assigned_to IN (${advPlaceholders})`;
      params = [userId, ...advUserIds]; // Reset params array
    }
  }
}

  // 🧑‍💼 Advertiser Manager
  if (role === 'advertiser_manager') {
    // Get assigned advertisers
    const [advertisers] = await crmDb.query(
      `SELECT sub_admin_id FROM manager_subadmins WHERE manager_id = ?`,
      [userId]
    );
    
    const advertiserIds = advertisers.map(s => s.sub_admin_id);
    
    if (advertiserIds.length > 0) {
      const placeholders = advertiserIds.map(() => '?').join(',');
      
      // See advertisers' tasks
      where += ` OR t.assigned_to IN (${placeholders}) OR t.assigned_by IN (${placeholders})`;
      params.push(...advertiserIds, ...advertiserIds);
      
      // Also see Adv Executives assigned to those advertisers
      const [advExecs] = await crmDb.query(
        `SELECT l.id FROM login l 
         INNER JOIN manager_subadmins m ON l.id = m.sub_admin_id
         WHERE m.manager_id IN (${placeholders}) AND l.role = 'adv_executive'`,
        advertiserIds
      );
      
      if (advExecs.length > 0) {
        const advExecIds = advExecs.map(ae => ae.id);
        const advPlaceholders = advExecIds.map(() => '?').join(',');
        
        where += ` OR t.assigned_to IN (${advPlaceholders}) OR t.assigned_by IN (${advPlaceholders})`;
        params.push(...advExecIds, ...advExecIds);
      }
    }
  }

  // 🧑‍💼 Publisher Manager
  if (role === 'publisher_manager') {
    // Get assigned publishers
    const [publishers] = await crmDb.query(
      `SELECT sub_admin_id FROM manager_subadmins WHERE manager_id = ?`,
      [userId]
    );
    
    const publisherIds = publishers.map(s => s.sub_admin_id);
    
    if (publisherIds.length > 0) {
      const placeholders = publisherIds.map(() => '?').join(',');
      
      // See publishers' tasks
      where += ` OR t.assigned_to IN (${placeholders}) OR t.assigned_by IN (${placeholders})`;
      params.push(...publisherIds, ...publisherIds);
      
      // Also see Pub Executives assigned to those publishers
      const [pubExecs] = await crmDb.query(
        `SELECT l.id FROM login l 
         INNER JOIN manager_subadmins m ON l.id = m.sub_admin_id
         WHERE m.manager_id IN (${placeholders}) AND l.role = 'pub_executive'`,
        publisherIds
      );
      
      if (pubExecs.length > 0) {
        const pubExecIds = pubExecs.map(pe => pe.id);
        const pubPlaceholders = pubExecIds.map(() => '?').join(',');
        
        where += ` OR t.assigned_to IN (${pubPlaceholders}) OR t.assigned_by IN (${pubPlaceholders})`;
        params.push(...pubExecIds, ...pubExecIds);
      }
    }
  }

  // 🧑 Advertiser
  if (role === 'advertiser') {
    // Get assigned Adv Executives
    const [advExecs] = await crmDb.query(
      `SELECT l.id FROM login l 
       INNER JOIN manager_subadmins m ON l.id = m.sub_admin_id
       WHERE m.manager_id = ? AND l.role = 'adv_executive'`,
      [userId]
    );
    
    if (advExecs && advExecs.length > 0) {
      const advExecIds = advExecs.map(ae => ae.id);
      const placeholders = advExecIds.map(() => '?').join(',');
      
      where += ` OR t.assigned_to IN (${placeholders}) OR t.assigned_by IN (${placeholders})`;
      params.push(...advExecIds, ...advExecIds);
    }
  }

  // 🧑 Publisher
  if (role === 'publisher') {
    // Get assigned Pub Executives
    const [pubExecs] = await crmDb.query(
      `SELECT l.id FROM login l 
       INNER JOIN manager_subadmins m ON l.id = m.sub_admin_id
       WHERE m.manager_id = ? AND l.role = 'pub_executive'`,
      [userId]
    );
    
    if (pubExecs && pubExecs.length > 0) {
      const pubExecIds = pubExecs.map(pe => pe.id);
      const placeholders = pubExecIds.map(() => '?').join(',');
      
      where += ` OR t.assigned_to IN (${placeholders}) OR t.assigned_by IN (${placeholders})`;
      params.push(...pubExecIds, ...pubExecIds);
    }
  }

      // 🆕 Advertiser side users → see operations tasks ONLY in same group
// 🆕 Campaign-based visibility using adv_d mapping
// 🆕 Campaign-based visibility using adv_d mapping
   // get groupId from URL
if (['advertiser_manager', 'advertiser', 'adv_executive'].includes(role)) {

  // -------------------------------
  // STEP 1: Get adv_ids
  // -------------------------------
  const [advRows] = await crmDb.query(
    `SELECT adv_id FROM advids WHERE user_id = ?`,
    [userId]
  );

  const advIds = advRows.map(a => a.adv_id);
  console.log("👉 ADV IDs from advids:", advIds);

  if (advIds.length > 0) {

    const placeholders = advIds.map(() => '?').join(',');

    // -------------------------------
    // STEP 2: Check campaign mapping
    // -------------------------------
    const [campaignRows] = await crmDb.query(
      `SELECT id, adv_d, sub_campaign_id 
       FROM crmclickorbits.campaign_data 
       WHERE adv_d IN (${placeholders})`,
      advIds
    );

    console.log("👉 Campaigns matched:", campaignRows);

    // -------------------------------
    // STEP 3: Check group mapping (IMPORTANT)
    // -------------------------------
    const [groupRows] = await crmDb.query(`
      SELECT cg.id, cg.sub_id, cd.sub_campaign_id, cd.adv_d
      FROM crm_chat.chat_groups cg
      JOIN crmclickorbits.campaign_data cd 
        ON cg.sub_id = cd.sub_campaign_id
      JOIN crmclickorbits.advids adv
        ON adv.adv_id = cd.adv_d
      WHERE adv.user_id = ?
    `, [userId]);

    console.log("👉 GROUPS FROM CAMPAIGN:", groupRows);

    // -------------------------------
    // STEP 4: Check tasks in those groups
    // -------------------------------
    if (groupRows.length > 0) {
      const groupIds = groupRows.map(g => g.id);
      const groupPlaceholders = groupIds.map(() => '?').join(',');

      const [taskRows] = await crmDb.query(`
        SELECT id, group_id, assigned_by
        FROM crm_chat.tasks
        WHERE group_id IN (${groupPlaceholders})
      `, groupIds);

      console.log("👉 TASKS IN GROUPS:", taskRows);
    }

    // -------------------------------
    // STEP 5: Check operations users
    // -------------------------------
    const [opsUsers] = await crmDb.query(
      `SELECT id FROM login WHERE role = 'operations'`
    );

    console.log("👉 OPERATIONS USERS:", opsUsers);

    // -------------------------------
    // STEP 6: FINAL WHERE CONDITION
    // -------------------------------


where += `
  OR (
    t.assigned_by IN (SELECT id FROM users WHERE role = 'operations')
  )
`;

    // ✅ Only push userId (REMOVE advIds push)
    params.push(userId);
  }
}
  return {
    where,
    params
  };
};

// 🎯 NEW: Role-based hierarchy functions for group creation
const getUsersByRole = async (crmDb, role) => {
  
  const [users] = await crmDb.query(
    `SELECT id, username, role FROM login WHERE role = ? ORDER BY username`,
    [role]
  );
  
  return users;
};

// Role-based visibility control for task actions
const canViewAction = (userRole, action) => {
  
  const visibilityRules = {
    // Share Link & Pause PID
    'share_link': ['adv_executive', 'advertiser', 'advertiser_manager', 'operations', 'optimization', 'admin'],
    'pause_pid': ['adv_executive', 'advertiser', 'advertiser_manager', 'operations', 'optimization', 'admin'],
    
    // Raise Request  
    'raise_request': ['pub_executive', 'publisher', 'publisher_manager', 'admin'],
    
    // Optimize (visible to all)
    'optimize': ['pub_executive', 'publisher', 'publisher_manager', 'adv_executive', 'advertiser', 'advertiser_manager', 'operations', 'optimization', 'admin']
  };
  
  const allowedRoles = visibilityRules[action] || [];
  const hasPermission = allowedRoles.includes(userRole);
  

  
  return hasPermission;
};

// Get visible actions for a user role
const getVisibleActions = (userRole) => {
  
  const allActions = ['share_link', 'pause_pid', 'raise_request', 'optimize'];
  const visibleActions = allActions.filter(action => canViewAction(userRole, action));
  

  
  return visibleActions;
};

// Get assigned hierarchy users for a selected user
const getAssignedHierarchyUsers = async (crmDb, userId) => {
  
  const [user] = await crmDb.query(
    `SELECT id, username, role FROM login WHERE id = ?`,
    [userId]
  );
  
  
  if (!user || user.length === 0) {
    return [];
  }
  
  const userData = user[0];
  const role = userData.role;
  console.log(`👉 User role: ${role}`);
  let hierarchyUsers = [];
  
  // 📌 Publisher Flow
  if (role === 'pub_executive') {
    // Get assigned publishers (manager_id where sub_admin_id = pub_executive)
    const [publishers] = await crmDb.query(
      `SELECT l.id, l.username, l.role 
       FROM login l 
       INNER JOIN manager_subadmins m ON l.id = m.manager_id
       WHERE m.sub_admin_id = ? AND l.role = 'publisher'`,
      [userId]
    );
    
    if (publishers && publishers.length > 0) {
      // Add ALL assigned publishers
      for (const publisher of publishers) {
        hierarchyUsers.push(publisher);
        
        // Get each publisher's publisher_managers (manager_id where sub_admin_id = publisher)
        const [publisherManagers] = await crmDb.query(
          `SELECT l.id, l.username, l.role 
           FROM login l 
           INNER JOIN manager_subadmins m ON l.id = m.manager_id
           WHERE m.sub_admin_id = ? AND l.role = 'publisher_manager'`,
          [publisher.id]
        );
        
        // Add ALL publisher_managers for this publisher
        for (const publisherManager of publisherManagers) {
          if (!hierarchyUsers.find(u => u.id === publisherManager.id)) {
            hierarchyUsers.push(publisherManager);
          }
        }
      }
    }
  }
  
  if (role === 'publisher') {
    // Get assigned publisher_managers (manager_id where sub_admin_id = publisher)
    const [publisherManagers] = await crmDb.query(
      `SELECT l.id, l.username, l.role 
       FROM login l 
       INNER JOIN manager_subadmins m ON l.id = m.manager_id
       WHERE m.sub_admin_id = ? AND l.role = 'publisher_manager'`,
      [userId]
    );
    
    if (publisherManagers && publisherManagers.length > 0) {
      // Add ALL assigned publisher_managers only
      for (const publisherManager of publisherManagers) {
        hierarchyUsers.push(publisherManager);
      }
    }
  }
  
  // 📌 Advertiser Flow
  if (role === 'adv_executive') {
    // Get assigned advertisers (manager_id where sub_admin_id = adv_executive)
    const [advertisers] = await crmDb.query(
      `SELECT l.id, l.username, l.role 
       FROM login l 
       INNER JOIN manager_subadmins m ON l.id = m.manager_id
       WHERE m.sub_admin_id = ? AND l.role = 'advertiser'`,
      [userId]
    );
    
    if (advertisers && advertisers.length > 0) {
      // Add ALL assigned advertisers
      for (const advertiser of advertisers) {
        hierarchyUsers.push(advertiser);
        
        // Get each advertiser's advertiser_managers (manager_id where sub_admin_id = advertiser)
        const [advertiserManagers] = await crmDb.query(
          `SELECT l.id, l.username, l.role 
           FROM login l 
           INNER JOIN manager_subadmins m ON l.id = m.manager_id
           WHERE m.sub_admin_id = ? AND l.role = 'advertiser_manager'`,
          [advertiser.id]
        );
        
        // Add ALL advertiser_managers for this advertiser
        for (const advertiserManager of advertiserManagers) {
          if (!hierarchyUsers.find(u => u.id === advertiserManager.id)) {
            hierarchyUsers.push(advertiserManager);
          }
        }
      }
    }
  }
  // advertiser_manager is the top of the advertiser hierarchy — nothing above to add
  if (role === 'advertiser') {
    // Get assigned advertiser_managers (manager_id where sub_admin_id = advertiser)
    const [advertiserManagers] = await crmDb.query(
      `SELECT l.id, l.username, l.role 
       FROM login l 
       INNER JOIN manager_subadmins m ON l.id = m.manager_id
       WHERE m.sub_admin_id = ? AND l.role = 'advertiser_manager'`,
      [userId]
    );
    
    
    if (advertiserManagers && advertiserManagers.length > 0) {
      // Add ALL assigned advertiser_managers
      for (const advertiserManager of advertiserManagers) {
        hierarchyUsers.push(advertiserManager);
      }
    }
  }
  
  return hierarchyUsers;
};

// 🔄 Expand selected users with their hierarchy
const expandUsersWithHierarchy = async (crmDb, selectedUsers) => {
  console.log(`👉 Expanding hierarchy for ${selectedUsers.length} selected users`);
  
  let expandedUsers = [...selectedUsers];
  
  for (const user of selectedUsers) {
    const hierarchyUsers = await getAssignedHierarchyUsers(crmDb, user.id);
    
    // Add hierarchy users that aren't already in the list
    for (const hierarchyUser of hierarchyUsers) {
      if (!expandedUsers.find(u => u.id === hierarchyUser.id)) {
        expandedUsers.push(hierarchyUser);
      }
    }
  }
  
  return expandedUsers;
};

// Get all admin users (auto-added to every group)
const getAllAdminUsers = async (crmDb) => {

  // Always use CRM DB for user/role queries
  const [admins] = await crmDb.query(
    `SELECT id, username, role FROM login WHERE role = 'admin' ORDER BY username`
  );
  return admins;
};



module.exports = { 
  getTaskAccessFilter, 
  getUsersByRole,
  getAssignedHierarchyUsers,
  expandUsersWithHierarchy,
  getAllAdminUsers,
  canViewAction,        // 🆕 Export visibility functions
  getVisibleActions    // 🆕 Export visibility functions
};