-- Create hierarchy assignment tables for role-based group creation

-- Publisher Assignments Table
CREATE TABLE IF NOT EXISTS publisher_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pub_executive_id INT NOT NULL,
  assigned_publisher INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pub_executive_id) REFERENCES login(id),
  FOREIGN KEY (assigned_publisher) REFERENCES login(id),
  UNIQUE KEY unique_assignment (pub_executive_id, assigned_publisher)
);

-- Manager Assignments Table (used for both publisher and advertiser managers)
CREATE TABLE IF NOT EXISTS manager_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subordinate_id INT NOT NULL, -- Can be publisher_id or advertiser_id
  assigned_manager INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subordinate_id) REFERENCES login(id),
  FOREIGN KEY (assigned_manager) REFERENCES login(id),
  UNIQUE KEY unique_assignment (subordinate_id, assigned_manager)
);

-- Advertiser Assignments Table
CREATE TABLE IF NOT EXISTS advertiser_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  adv_executive_id INT NOT NULL,
  assigned_advertiser INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (adv_executive_id) REFERENCES login(id),
  FOREIGN KEY (assigned_advertiser) REFERENCES login(id),
  UNIQUE KEY unique_assignment (adv_executive_id, assigned_advertiser)
);

-- Insert sample data for testing (optional)
INSERT IGNORE INTO publisher_assignments (pub_executive_id, assigned_publisher) VALUES
(1, 2), -- pub_executive -> publisher
(3, 4); -- pub_executive -> publisher

INSERT IGNORE INTO manager_assignments (subordinate_id, assigned_manager) VALUES
(2, 5), -- publisher -> publisher_manager
(4, 6), -- publisher -> publisher_manager
(7, 8), -- advertiser -> advertiser_manager
(9, 10); -- advertiser -> advertiser_manager

INSERT IGNORE INTO advertiser_assignments (adv_executive_id, assigned_advertiser) VALUES
(7, 9), -- adv_executive -> advertiser
(11, 12); -- adv_executive -> advertiser
