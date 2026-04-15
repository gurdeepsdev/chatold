-- Find groups created from paused campaigns
SELECT g.id, g.group_name, g.campaign_id, c.status as campaign_status, c.campaign_name
FROM chat_groups g 
LEFT JOIN campaigns c ON c.id = g.campaign_id 
WHERE c.status != 'Live' AND c.status IS NOT NULL;

-- Delete groups created from paused campaigns (RUN THIS AFTER REVIEWING ABOVE RESULTS)
-- WARNING: This will permanently delete groups, messages, tasks, and members

-- Delete group members first
DELETE gm FROM group_members gm
INNER JOIN chat_groups g ON g.id = gm.group_id
LEFT JOIN campaigns c ON c.id = g.campaign_id
WHERE c.status != 'Live' AND c.status IS NOT NULL;

-- Delete tasks in these groups
DELETE t FROM tasks t
INNER JOIN chat_groups g ON g.id = t.group_id
LEFT JOIN campaigns c ON c.id = g.campaign_id
WHERE c.status != 'Live' AND c.status IS NOT NULL;

-- Delete messages in these groups
DELETE m FROM messages m
INNER JOIN chat_groups g ON g.id = m.group_id
LEFT JOIN campaigns c ON c.id = g.campaign_id
WHERE c.status != 'Live' AND c.status IS NOT NULL;

-- Finally delete the groups
DELETE g FROM chat_groups g
LEFT JOIN campaigns c ON c.id = g.campaign_id
WHERE c.status != 'Live' AND c.status IS NOT NULL;
