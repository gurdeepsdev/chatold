const db = require('./src/utils/db');

async function cleanupPausedGroups() {
  try {
    console.log('🔍 Finding groups created from paused campaigns...');
    
    // Find groups created from non-Live campaigns
    const [pausedGroups] = await db.query(`
      SELECT g.id, g.group_name, g.campaign_id, c.status as campaign_status, c.campaign_name
      FROM chat_groups g 
      LEFT JOIN campaigns c ON c.id = g.campaign_id 
      WHERE c.status != 'Live' AND c.status IS NOT NULL
    `);
    
    if (pausedGroups.length > 0) {
      console.log(`📋 Found ${pausedGroups.length} groups from paused campaigns:`);
      pausedGroups.forEach(g => {
        console.log(`  - Group ${g.id}: ${g.group_name} (Campaign: ${g.campaign_name} - Status: ${g.campaign_status})`);
      });
      
      // Option 1: Delete these groups
      console.log('\n🗑️  Deleting groups created from paused campaigns...');
      
      for (const group of pausedGroups) {
        // Delete group members first
        await db.query('DELETE FROM group_members WHERE group_id = ?', [group.id]);
        
        // Delete tasks in this group
        await db.query('DELETE FROM tasks WHERE group_id = ?', [group.id]);
        
        // Delete messages in this group
        await db.query('DELETE FROM messages WHERE group_id = ?', [group.id]);
        
        // Finally delete the group
        await db.query('DELETE FROM chat_groups WHERE id = ?', [group.id]);
        
        console.log(`  ✅ Deleted group ${group.id}: ${group.group_name}`);
      }
      
      console.log(`\n🎉 Successfully cleaned up ${pausedGroups.length} groups from paused campaigns!`);
      
    } else {
      console.log('✅ No groups found from paused campaigns');
    }
    
    // Verify cleanup
    const [remainingGroups] = await db.query(`
      SELECT g.id, g.group_name, g.campaign_id, c.status as campaign_status
      FROM chat_groups g 
      LEFT JOIN campaigns c ON c.id = g.campaign_id 
      WHERE c.status != 'Live' AND c.status IS NOT NULL
    `);
    
    if (remainingGroups.length === 0) {
      console.log('✅ Verification passed: No remaining groups from paused campaigns');
    } else {
      console.log(`⚠️  Warning: ${remainingGroups.length} groups still remain from paused campaigns`);
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

cleanupPausedGroups();
