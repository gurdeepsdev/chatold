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

  // 🧑‍💼 advertiser_admin / publisher_admin
  if (role === 'advertiser_manager' || role === 'publisher_manager') {

    const [subs] = await crmDb.query(
      `SELECT sub_admin_id FROM manager_subadmins WHERE manager_id = ?`,
      [userId]
    );

    const subAdminIds = subs.map(s => s.sub_admin_id);

    if (subAdminIds.length > 0) {
      const placeholders = subAdminIds.map(() => '?').join(',');

      where += ` OR t.assigned_to IN (${placeholders}) OR t.assigned_by IN (${placeholders})`;

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

      where += ` OR t.assigned_to IN (${placeholders}) OR t.assigned_by IN (${placeholders})`;

      params.push(...managerIds, ...managerIds);
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
    'share_link': ['adv_executive', 'advertiser', 'advertiser_manager', 'operations', 'admin'],
    'pause_pid': ['adv_executive', 'advertiser', 'advertiser_manager', 'operations', 'admin'],
    
    // Raise Request  
    'raise_request': ['pub_executive', 'publisher', 'publisher_manager', 'admin'],
    
    // Optimize (visible to all)
    'optimize': ['pub_executive', 'publisher', 'publisher_manager', 'adv_executive', 'advertiser', 'advertiser_manager', 'operations', 'admin']
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
      // Add ALL assigned publisher_managers
      for (const publisherManager of publisherManagers) {
        hierarchyUsers.push(publisherManager);
        
        // Also get any advertiser_managers above this publisher_manager
        const [advertiserManagers] = await crmDb.query(
          `SELECT l.id, l.username, l.role 
           FROM login l 
           INNER JOIN manager_subadmins m ON l.id = m.manager_id
           WHERE m.sub_admin_id = ? AND l.role = 'advertiser_manager'`,
          [publisherManager.id]
        );
        
        // Add ALL advertiser_managers for this publisher_manager
        for (const advertiserManager of advertiserManagers) {
          if (!hierarchyUsers.find(u => u.id === advertiserManager.id)) {
            hierarchyUsers.push(advertiserManager);
          }
        }
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