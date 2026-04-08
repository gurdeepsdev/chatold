const getTaskAccessFilter = async (crmDb, userId) => {

  console.log("👉 USER ID:", userId);

  // 🔹 STEP 1: Try CRM DB
  let user;

  const [rows] = await crmDb.query(
    `SELECT id, role FROM login WHERE id = ?`,
    [userId]
  );

  console.log("👉 LOGIN ROW (CRM):", rows);

  if (rows.length > 0) {
    user = rows[0];
  } else {
    console.log("⚠️ Not found in CRM, trying main DB...");

    const [fallbackRows] = await db.query(
      `SELECT id, role FROM login WHERE id = ?`,
      [userId]
    );

    console.log("👉 LOGIN ROW (MAIN DB):", fallbackRows);

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
  console.log(`👉 Getting users for role: ${role}`);
  
  const [users] = await crmDb.query(
    `SELECT id, username, role FROM login WHERE role = ? ORDER BY username`,
    [role]
  );
  
  console.log(`👉 Found ${users.length} users for role ${role}`);
  return users;
};

// Role-based visibility control for task actions
const canViewAction = (userRole, action) => {
  console.log(`🔍 CHECKING ACTION: ${action} for role: ${userRole}`);
  
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
  
  console.log(`📋 Action "${action}" allowed roles:`, allowedRoles);
  console.log(`👤 User role "${userRole}" has permission:`, hasPermission);
  
  return hasPermission;
};

// Get visible actions for a user role
const getVisibleActions = (userRole) => {
  console.log(`🔍 GETTING VISIBLE ACTIONS FOR ROLE: ${userRole}`);
  
  const allActions = ['share_link', 'pause_pid', 'raise_request', 'optimize'];
  const visibleActions = allActions.filter(action => canViewAction(userRole, action));
  
  console.log(`📋 All available actions:`, allActions);
  console.log(`✅ Visible actions for ${userRole}:`, visibleActions);
  
  return visibleActions;
};

// Get assigned hierarchy users for a selected user
const getAssignedHierarchyUsers = async (crmDb, userId) => {
  console.log(`👉 Getting hierarchy for user: ${userId}`);
  
  const [user] = await crmDb.query(
    `SELECT id, username, role FROM login WHERE id = ?`,
    [userId]
  );
  
  console.log(`👉 User found:`, user);
  
  if (!user || user.length === 0) {
    console.log('⚠️ User not found in CRM database');
    return [];
  }
  
  const userData = user[0];
  const role = userData.role;
  console.log(`👉 User role: ${role}`);
  let hierarchyUsers = [];
  
  // 📌 Publisher Flow
  if (role === 'pub_executive') {
    // Get assigned publisher (manager_id where sub_admin_id = pub_executive)
    const [publisher] = await crmDb.query(
      `SELECT l.id, l.username, l.role 
       FROM login l 
       INNER JOIN manager_subadmins m ON l.id = m.manager_id
       WHERE m.sub_admin_id = ? AND l.role = 'publisher'`,
      [userId]
    );
    
    console.log('👉 Found publisher for pub_executive:', publisher);
    
    if (publisher && publisher.length > 0) {
      hierarchyUsers.push(publisher[0]);
      
      // Get publisher's publisher_manager (manager_id where sub_admin_id = publisher)
      const [publisherManager] = await crmDb.query(
        `SELECT l.id, l.username, l.role 
         FROM login l 
         INNER JOIN manager_subadmins m ON l.id = m.manager_id
         WHERE m.sub_admin_id = ? AND l.role = 'publisher_manager'`,
        [publisher[0].id]
      );
      
      console.log('👉 Found publisher_manager for publisher:', publisherManager);
      
      if (publisherManager && publisherManager.length > 0) {
        hierarchyUsers.push(publisherManager[0]);
      }
    }
  }
  
  if (role === 'publisher') {
    // Get assigned publisher_manager (manager_id where sub_admin_id = publisher)
    const [publisherManager] = await crmDb.query(
      `SELECT l.id, l.username, l.role 
       FROM login l 
       INNER JOIN manager_subadmins m ON l.id = m.manager_id
       WHERE m.sub_admin_id = ? AND l.role = 'publisher_manager'`,
      [userId]
    );
    
    console.log('👉 Found publisher_manager for publisher:', publisherManager);
    
    if (publisherManager && publisherManager.length > 0) {
      hierarchyUsers.push(publisherManager[0]);
    }
  }
  
  // 📌 Advertiser Flow
  if (role === 'adv_executive') {
    // Get assigned advertiser (manager_id where sub_admin_id = adv_executive)
    const [advertiser] = await crmDb.query(
      `SELECT l.id, l.username, l.role 
       FROM login l 
       INNER JOIN manager_subadmins m ON l.id = m.manager_id
       WHERE m.sub_admin_id = ? AND l.role = 'advertiser'`,
      [userId]
    );
    
    console.log('👉 Found advertiser for adv_executive:', advertiser);
    
    if (advertiser && advertiser.length > 0) {
      hierarchyUsers.push(advertiser[0]);
      
      // Get advertiser's advertiser_manager (manager_id where sub_admin_id = advertiser)
      const [advertiserManager] = await crmDb.query(
        `SELECT l.id, l.username, l.role 
         FROM login l 
         INNER JOIN manager_subadmins m ON l.id = m.manager_id
         WHERE m.sub_admin_id = ? AND l.role = 'advertiser_manager'`,
        [advertiser[0].id]
      );
      
      console.log('👉 Found advertiser_manager for advertiser:', advertiserManager);
      
      if (advertiserManager && advertiserManager.length > 0) {
        hierarchyUsers.push(advertiserManager[0]);
      }
    }
  }
  
  if (role === 'advertiser') {
    // Get assigned advertiser_manager (manager_id where sub_admin_id = advertiser)
    const [advertiserManager] = await crmDb.query(
      `SELECT l.id, l.username, l.role 
       FROM login l 
       INNER JOIN manager_subadmins m ON l.id = m.manager_id
       WHERE m.sub_admin_id = ? AND l.role = 'advertiser_manager'`,
      [userId]
    );
    
    console.log('👉 Found advertiser_manager for advertiser:', advertiserManager);
    
    if (advertiserManager && advertiserManager.length > 0) {
      hierarchyUsers.push(advertiserManager[0]);
    }
  }
  
  console.log(`👉 Hierarchy users for ${role}:`, hierarchyUsers);
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
  
  console.log(`Expanded to ${expandedUsers.length} total users`);
  return expandedUsers;
};

// Get all admin users (auto-added to every group)
const getAllAdminUsers = async (crmDb) => {
  console.log('getAllAdminUsers - DB connection type:', typeof crmDb);
  console.log('getAllAdminUsers - DB connection config:', crmDb?.config?.database);
  
  // Always use CRM DB for user/role queries
  const [admins] = await crmDb.query(
    `SELECT id, username, role FROM login WHERE role = 'admin' ORDER BY username`
  );
  console.log('getAllAdminUsers - Found admins:', admins.length);
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