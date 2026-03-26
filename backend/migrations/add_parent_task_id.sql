-- Add parent_task_id column to tasks table for sub-task relationships
ALTER TABLE tasks ADD COLUMN parent_task_id INT NULL;

-- Add foreign key constraint
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_parent 
FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- Add index for better performance
CREATE INDEX idx_tasks_parent_id ON tasks(parent_task_id);
