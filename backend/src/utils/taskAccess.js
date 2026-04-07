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
module.exports = { getTaskAccessFilter };