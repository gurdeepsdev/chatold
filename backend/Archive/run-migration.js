const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '160.153.172.237',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'crm_user',
      password: process.env.DB_PASSWORD || 'Clickorbits@123',
      database: process.env.DB_NAME || 'crm_chat'
    });

    console.log('Connected to database, running migration...');

    // Add parent_task_id column
    await connection.execute(`
      ALTER TABLE tasks ADD COLUMN parent_task_id INT NULL
    `);
    console.log('✅ Added parent_task_id column');

    // Add foreign key constraint
    await connection.execute(`
      ALTER TABLE tasks ADD CONSTRAINT fk_tasks_parent 
      FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
    `);
    console.log('✅ Added foreign key constraint');

    // Add index
    await connection.execute(`
      CREATE INDEX idx_tasks_parent_id ON tasks(parent_task_id)
    `);
    console.log('✅ Added index');

    await connection.end();
    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_KEY_EXISTS') {
      console.log('⚠️  Migration already applied (column/constraint already exists)');
    } else {
      console.error('❌ Migration failed:', error.message);
    }
    process.exit(1);
  }
}

runMigration();
