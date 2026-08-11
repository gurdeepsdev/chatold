const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '160.153.172.237',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'crm_user',
      password: process.env.DB_PASSWORD || 'Clickorbits@123',
      database: process.env.DB_NAME || 'crm_chat'
  });
  
  try {
    console.log('Checking database schema...');
    
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'messages' 
        AND COLUMN_NAME = 'additional_files'
    `);
    
    if (columns.length === 0) {
      await connection.execute(`
        ALTER TABLE messages ADD COLUMN additional_files JSON NULL
      `);
      console.log('✅ Added additional_files column to messages table');
    } else {
      console.log('⚠️ Column already exists');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}
runMigration();
