-- 🔄 Migration: Add recipient fields to messages table
-- 📅 Date: 2025-04-02
-- 🎯 Purpose: Support user assignment and recipient selection in messages

-- 🔍 Check if recipient_id column exists
SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  AND table_name = 'messages'
  AND column_name = 'recipient_id'
);

-- 🆕 Add recipient_id column if it doesn't exist
SET @sql = IF(@exists = 0, 
  'ALTER TABLE messages ADD COLUMN recipient_id INT NULL AFTER sender_id',
  'SELECT "recipient_id column already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 🔍 Check if secondary_recipient_id column exists
SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  AND table_name = 'messages'
  AND column_name = 'secondary_recipient_id'
);

-- 🆕 Add secondary_recipient_id column if it doesn't exist
SET @sql = IF(@exists = 0, 
  'ALTER TABLE messages ADD COLUMN secondary_recipient_id INT NULL AFTER recipient_id',
  'SELECT "secondary_recipient_id column already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 🔗 Add foreign key constraints if they don't exist
-- Note: This might fail if there are existing records with invalid IDs
-- You may need to clean up data first or run without constraints

-- Add index for better performance
SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
  AND table_name = 'messages'
  AND index_name = 'idx_recipient_id'
);

SET @sql = IF(@exists = 0, 
  'CREATE INDEX idx_recipient_id ON messages(recipient_id)',
  'SELECT "idx_recipient_id index already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
  AND table_name = 'messages'
  AND index_name = 'idx_secondary_recipient_id'
);

SET @sql = IF(@exists = 0, 
  'CREATE INDEX idx_secondary_recipient_id ON messages(secondary_recipient_id)',
  'SELECT "idx_secondary_recipient_id index already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 📊 Update existing messages to have a default recipient (optional)
-- This is a data migration step - uncomment if you want to update existing messages
-- UPDATE messages SET recipient_id = (
--   SELECT MIN(user_id) 
--   FROM group_members 
--   WHERE group_id = messages.group_id 
--   AND user_id != messages.sender_id
--   LIMIT 1
-- ) WHERE recipient_id IS NULL;

-- ✅ Migration complete
SELECT 'Message recipient fields migration completed successfully' as status;
