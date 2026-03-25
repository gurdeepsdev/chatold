-- ============================================================
-- CRM Chat — Full migration (safe to re-run)
-- Run: mysql -u root -p crm_chat < migrate.sql
-- ============================================================

-- tasks table: new columns
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS fp              VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS f1              VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS f2              VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS optimise_scenario VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS attachment_url  VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255) NULL;

-- tasks: add 'optimise' to task_type enum
ALTER TABLE tasks MODIFY COLUMN task_type ENUM(
  'initial_setup','share_link','pause_pid','raise_request','optimise'
) NOT NULL DEFAULT 'share_link';

-- messages: task_ref_id column + task_notification type
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS task_ref_id INT NULL;

ALTER TABLE messages MODIFY COLUMN message_type ENUM(
  'text','image','audio','file','system','task_notification'
) NOT NULL DEFAULT 'text';

-- chat_groups: campaign_type, platform, and CRM data columns
ALTER TABLE chat_groups
  ADD COLUMN IF NOT EXISTS campaign_type ENUM('agency','direct') NOT NULL DEFAULT 'agency',
  ADD COLUMN IF NOT EXISTS platform VARCHAR(10) NULL, -- 'ios', 'android', or null
  ADD COLUMN IF NOT EXISTS adv_name VARCHAR(255) NULL, -- advertiser name from CRM
  ADD COLUMN IF NOT EXISTS advertiser_id INT NULL, -- advertiser user_id from CRM campaign_data
  ADD COLUMN IF NOT EXISTS crm_campaign_data JSON NULL; -- full CRM campaign data

-- campaigns: crm_source_id for external DB sync
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS crm_source_id INT NULL UNIQUE;

-- users: expanded roles and password_hash column
ALTER TABLE users MODIFY COLUMN role ENUM(
  'admin','advertiser_manager','publisher_manager','advertiser','publisher','am'
) NOT NULL DEFAULT 'am';

-- Add password_hash column for bcrypt authentication
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL AFTER email;

-- notifications: message_id column
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS message_id INT NULL;

-- reactions table for message reactions
CREATE TABLE IF NOT EXISTS reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_reaction (message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_message_reactions (message_id),
  INDEX idx_user_reactions (user_id)
);

SELECT 'Migration complete ✅' AS status;
