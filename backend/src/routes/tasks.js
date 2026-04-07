const express = require('express');
const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../utils/db');
const { auth }             = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const { getTaskAccessFilter } = require('../utils/taskAccess');

// Multer for task attachments — same UPLOAD_DIR as messages
const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,req.app.get('UPLOAD_DIR')||path.resolve('uploads')),
  filename:   (req,file,cb)=>cb(null,Date.now()+'-'+Math.random().toString(36).slice(2,9)+path.extname(file.originalname)),
});
const upload=multer({storage,limits:{fileSize:52428800}});

/* GET tasks for group */
router.get('/group/:groupId',auth,async(req,res)=>{
  try{
        const userId = req.user.id;

    const crmDb = db.crmPool;   // 👈 crmclickorbits
    const chatDb = db;          // 👈 crm_chat

    // 🔹 GET FILTER FROM CRM DB
    const { where, params } = await getTaskAccessFilter(crmDb, userId);
  const [tasks] = await db.query(`
  SELECT t.*,
    u1.full_name AS assigned_to_name,
    u2.full_name AS assigned_by_name,
    c.campaign_name,
    parent.task_type AS parent_task_type
  FROM tasks t
  LEFT JOIN users u1 ON u1.id=t.assigned_to
  LEFT JOIN users u2 ON u2.id=t.assigned_by
  LEFT JOIN campaigns c ON c.id=t.campaign_id
  LEFT JOIN tasks parent ON parent.id=t.parent_task_id
  WHERE t.group_id=? 
  AND (   ${where}   

  
  )
  ORDER BY 
    CASE t.status 
      WHEN 'pending' THEN 1 
      WHEN 'accepted' THEN 2 
      ELSE 3 
    END,
    t.created_at DESC
`, [req.params.groupId, userId, userId, ...params]);
    
    // Get sub-tasks for each main task
    const tasksWithSubs = await Promise.all(tasks.map(async (task) => {
      if (task.parent_task_id === null) {
       const [subTasks] = await db.query(`
  SELECT t.*,
    u1.full_name AS assigned_to_name,
    u2.full_name AS assigned_by_name
  FROM tasks t
  LEFT JOIN users u1 ON u1.id=t.assigned_to
  LEFT JOIN users u2 ON u2.id=t.assigned_by
  WHERE t.parent_task_id=? 
   
    AND (${where})

  
  ORDER BY t.created_at DESC
`, [task.id, userId, userId, ...params]);
        return{...task,subTasks};
      }
      return task;
    }));
    
    // Filter out sub-tasks from main list (they're included as subTasks)
    const mainTasks = tasksWithSubs.filter(task => task.parent_task_id === null);
    
    res.json({tasks: mainTasks});
  }catch (e) {
  console.error("🔥 TASK API ERROR:", e);
  console.error("🔥 STACK:", e.stack);
  res.status(500).json({ error: e.message || 'Server error' });
}
});

/* POST create task */
router.post('/',auth,upload.single('attachment'),async(req,res)=>{
  const conn=await db.getConnection();
  try{
    await conn.beginTransaction();
    const b=req.body;
    const{group_id,campaign_id,task_type,description,assigned_to,
          pub_id,pid,link,pause_reason,request_type,request_details,
          fp,f1,f2,optimise_scenario,due_date,entries,pause_entries,optimise_entries}=b;

    // Only group_id and task_type are required - NO TITLE VALIDATION
    if(!group_id||!task_type)
      return res.status(400).json({error:'group_id and task_type required'});

    const attachment_url=req.file?`/uploads/${req.file.filename}`:null;
    const attachment_name=req.file?req.file.originalname:null;

    // Parse entries for share_link tasks
    let parsedEntries = [];
    if (task_type === 'share_link' && entries) {
      try {
        parsedEntries = typeof entries === 'string' ? JSON.parse(entries) : entries;
      } catch (e) {
        return res.status(400).json({error:'Invalid entries format'});
      }
    }

    // Parse pause_entries for pause_pid tasks
    let parsedPauseEntries = [];
    if (task_type === 'pause_pid' && pause_entries) {
      try {
        parsedPauseEntries = typeof pause_entries === 'string' ? JSON.parse(pause_entries) : pause_entries;
      } catch (e) {
        return res.status(400).json({error:'Invalid pause_entries format'});
      }
    }

    // Parse optimise_entries for optimise tasks
    let parsedOptimiseEntries = [];
    if (task_type === 'optimise' && optimise_entries) {
      try {
        console.log('🔍 Backend received optimise_entries:', optimise_entries);
        parsedOptimiseEntries = typeof optimise_entries === 'string' ? JSON.parse(optimise_entries) : optimise_entries;
        console.log('🔍 Backend parsed optimise_entries:', parsedOptimiseEntries);
        
        // Handle attachment objects in optimise entries
        parsedOptimiseEntries = parsedOptimiseEntries.map((entry, index) => {
          console.log(`🔍 Backend processing optimise entry ${index}:`, entry);
          if (entry.attachment && typeof entry.attachment === 'object') {
            const processedEntry = {
              ...entry,
              attachment: entry.attachment.name || entry.attachment.filename || null,
              attachment_name: entry.attachment.name || entry.attachment.filename || null
            };
            console.log(`🔍 Backend processed optimise entry ${index} (object):`, processedEntry);
            return processedEntry;
          }
          console.log(`🔍 Backend keeping optimise entry ${index} as-is:`, entry);
          return entry;
        });
        console.log('🔍 Backend final optimise_entries after processing:', parsedOptimiseEntries);
      } catch (e) {
        console.error('🔍 Backend optimise_entries parse error:', e);
        return res.status(400).json({error:'Invalid optimise_entries format'});
      }
    }

    // Create main task for single-entry task types (raise_request, initial_setup, etc.)
    let taskId;
    let subTaskIds = [];
    
    if (task_type === 'raise_request' || task_type === 'initial_setup') {
      const [mainTask] = await conn.query(
        `INSERT INTO tasks (
          group_id,
          campaign_id,
          task_type,
          description,
          assigned_to,
          assigned_by,
          request_type,
          request_details,
          pub_id,
          pid,
          fp,
          f1,
          f2,
          optimise_scenario,
          attachment_url,
          attachment_name
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          group_id,
          campaign_id || null,
          task_type,
          description || null,
          assigned_to || null,
          req.user.id,
          request_type || null,
          request_details || null,
          pub_id || null,
          pid || null,
          fp || null,
          f1 || null,
          f2 || null,
          optimise_scenario || null,
          attachment_url,
          attachment_name
        ]
      );
      taskId = mainTask.insertId;
    }

// ✅ FIX: HANDLE SHARE LINK SEPARATELY (NO PARENT TASK)
if (task_type === 'share_link') {
  let subTaskIds = [];

  for (const entry of parsedEntries) {
    if (entry.pub_id || entry.pid || entry.link) {
      const [subR] = await conn.query(
        `INSERT INTO tasks (
          group_id,
          campaign_id,
          task_type,
          assigned_to,
          assigned_by,
          pub_id,
          pid,
          link,
          note,
          geo,
          attachment_url,
          attachment_name
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          group_id,
          campaign_id || null,
          task_type,
          entry.assigned_to || null,
          req.user.id,
          entry.pub_id || null,
          entry.pid || null,
          entry.link || null,
          entry.note || null,
          entry.geo || null,
          attachment_url,
          attachment_name
        ]
      );

      subTaskIds.push(subR.insertId);
    }
  }

  await conn.commit();

  // Fetch the created tasks to return proper format
  const [createdTasks] = await conn.query(
    `SELECT * FROM tasks WHERE id IN (${subTaskIds.map(() => '?').join(',')})`,
    subTaskIds
  );

    const assignees = [...new Set(parsedEntries
  .filter(e => e.assigned_to && e.assigned_to !== 'null')
  .map(e => e.assigned_to)
)];
 let assigneeText = '';

if (assignees.length > 0) {
  const [users] = await conn.query(
    `SELECT id, full_name FROM users WHERE id IN (?)`,
    [assignees]
  );

  const names = users.map(u => u.full_name);

  assigneeText = names.length > 0 ? ` → ${names.join(', ')}` : '';
}
  // Post task-notification message in chat
  const taskLabel = '🔗 Share Link';
  const entryCount = parsedEntries.filter(e => e.pub_id || e.pid || e.link).length;
  const chatContent = `📌 Task created: [${taskLabel}]${entryCount > 1 ? ` (${entryCount} entries)` : ''}\n👤 Created by: ${req.user.full_name}${assigneeText}`;
  const {encrypted, iv} = encrypt(chatContent);
  const [mRes] = await conn.query(
    `INSERT INTO messages (group_id,sender_id,message_type,encrypted_content,iv,task_ref_id)
     VALUES(?,?,'task_notification',?,?,?)`,
    [group_id, req.user.id, encrypted, iv, null]
  );

  await conn.query(
    'INSERT INTO workflow_summary (group_id,event_type,event_data,triggered_by) VALUES(?,?,?,?)',
    [group_id, 'task_created', JSON.stringify({task_type: 'share_link', entries: subTaskIds.length}), req.user.id]
  );

  // Emit real-time message to group
  const io = req.app.get('io');
  if (io) {
    io.to(`group_${group_id}`).emit('new_message', {
      id: mRes.insertId,
      group_id: Number(group_id),
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      sender_role: req.user.role,
      message_type: 'task_notification',
      content: chatContent,
      task_ref: {task_id: taskId, task_type: 'share_link', task_title: taskLabel},
      sent_at: new Date(),
    });
  }

  return res.status(201).json({
    task: null, // No parent task for share_link
    subTasks: createdTasks
  });
}

    // ✅ FIX: HANDLE PAUSE_PID SEPARATELY (NO PARENT TASK)
if (task_type === 'pause_pid') {
  let subTaskIds = [];

  for (const entry of parsedPauseEntries) {
    if (entry.pub_id || entry.pid || entry.pause_reason) {
      const [subR] = await conn.query(
        `INSERT INTO tasks (
          group_id,
          campaign_id,
          task_type,
          assigned_to,
          assigned_by,
          pub_id,
          pid,
          link,
          geo,
          pause_reason,
          attachment_url,
          attachment_name
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          group_id,
          campaign_id || null,
          task_type,
          entry.assigned_to || null,
          req.user.id,
          entry.pub_id || null,
          entry.pid || null,
          null,
                    entry.geo || null,

          entry.pause_reason || null,
          attachment_url,
          attachment_name
        ]
      );

      subTaskIds.push(subR.insertId);
    }
  }

  await conn.commit();

  // Fetch the created tasks to return proper format
  const [createdTasks] = await conn.query(
    `SELECT * FROM tasks WHERE id IN (${subTaskIds.map(() => '?').join(',')})`,
    subTaskIds
  );

  const assignees = [...new Set(parsedPauseEntries
  .filter(e => e.assigned_to && e.assigned_to !== 'null')
  .map(e => e.assigned_to)
)];
 let assigneeText = '';

if (assignees.length > 0) {
  const [users] = await conn.query(
    `SELECT id, full_name FROM users WHERE id IN (?)`,
    [assignees]
  );

  const names = users.map(u => u.full_name);

  assigneeText = names.length > 0 ? ` → ${names.join(', ')}` : '';
}

  // Post task-notification message in chat
  const taskLabel = '⏸️ Pause PID';
  const entryCount = parsedPauseEntries.filter(e => e.pub_id || e.pid || e.pause_reason).length;
  const chatContent = `📌 Task created: [${taskLabel}]${entryCount > 1 ? ` (${entryCount} entries)` : ''}\n👤 Created by: ${req.user.full_name}${assigneeText}`;
  const {encrypted, iv} = encrypt(chatContent);
  const [mRes] = await conn.query(
    `INSERT INTO messages (group_id,sender_id,message_type,encrypted_content,iv,task_ref_id)
     VALUES(?,?,'task_notification',?,?,?)`,
    [group_id, req.user.id, encrypted, iv, null]
  );

  await conn.query(
    'INSERT INTO workflow_summary (group_id,event_type,event_data,triggered_by) VALUES(?,?,?,?)',
    [group_id, 'task_created', JSON.stringify({task_type: 'pause_pid', entries: subTaskIds.length}), req.user.id]
  );

  // Emit real-time message to group
  const io = req.app.get('io');
  if (io) {
    io.to(`group_${group_id}`).emit('new_message', {
      id: mRes.insertId,
      group_id: Number(group_id),
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      sender_role: req.user.role,
      message_type: 'task_notification',
      content: chatContent,
      task_ref: {task_id: taskId, task_type: 'pause_pid', task_title: taskLabel},
      sent_at: new Date(),
    });
  }

  return res.status(201).json({
    task: null, // No parent task for pause_pid
    subTasks: createdTasks
  });
}

// ✅ FIX: HANDLE OPTIMISE SEPARATELY (NO PARENT TASK)
// if (task_type === 'optimise') {
//   let subTaskIds = [];

//   for (const entry of parsedOptimiseEntries) {
//     if (entry.pub_id || entry.pid || entry.fp || entry.fa || entry.f1 || entry.f2 || entry.optimise_scenario) {
//       const [subR] = await conn.query(
//         `INSERT INTO tasks (
//           group_id,
//           campaign_id,
//           task_type,
//           assigned_to,
//           assigned_by,
//           pub_id,
//           pid,
//           link,
//           fp,
//           fa,
//           f1,
//           f2,
//           optimise_scenario,
//           attachment_url,
//           attachment_name
//         )
//         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//         [
//           group_id,
//           campaign_id || null,
//           task_type,
//           entry.assigned_to || null,
//           req.user.id,
//           entry.pub_id || null,
//           entry.pid || null,
//           null,
//           entry.fp || null,
//           entry.fa || null,
//           entry.f1 || null,
//           entry.f2 || null,
//           entry.optimise_scenario || null,
//           entry.attachment || null,
//           entry.attachment_name || null
//         ]
//       );

//       subTaskIds.push(subR.insertId);
//     }
//   }

//   await conn.commit();

//   // Fetch the created tasks to return proper format
//   const [createdTasks] = await conn.query(
//     `SELECT * FROM tasks WHERE id IN (${subTaskIds.map(() => '?').join(',')})`,
//     subTaskIds
//   );

//   // Post task-notification message in chat
//   const taskLabel = '⚡ Optimise';
//   const entryCount = parsedOptimiseEntries.filter(e => e.pub_id || e.pid || e.fp  || e.f1 || e.f2 || e.optimise_scenario).length;
//   const chatContent = `📌 Task created: [${taskLabel}]${entryCount > 1 ? ` (${entryCount} entries)` : ''}`;
//   const {encrypted, iv} = encrypt(chatContent);
//   const [mRes] = await conn.query(
//     `INSERT INTO messages (group_id,sender_id,message_type,encrypted_content,iv,task_ref_id)
//      VALUES(?,?,'task_notification',?,?,?)`,
//     [group_id, req.user.id, encrypted, iv, null]
//   );

//   await conn.query(
//     'INSERT INTO workflow_summary (group_id,event_type,event_data,triggered_by) VALUES(?,?,?,?)',
//     [group_id, 'task_created', JSON.stringify({task_type: 'optimise', entries: subTaskIds.length}), req.user.id]
//   );

//   // Emit real-time message to group
//   const io = req.app.get('io');
//   if (io) {
//     io.to(`group_${group_id}`).emit('new_message', {
//       id: mRes.insertId,
//       group_id: Number(group_id),
//       sender_id: req.user.id,
//       sender_name: req.user.full_name,
//       sender_role: req.user.role,
//       message_type: 'task_notification',
//       content: chatContent,
//       task_ref: {task_type: 'optimise', task_title: taskLabel},
//       sent_at: new Date(),
//     });
//   }

//   return res.status(201).json({
//     task: null, // No parent task for optimise
//     subTasks: createdTasks
//   });
// }
// ✅ FIX: HANDLE OPTIMISE SEPARATELY (NO PARENT TASK)
if (task_type === 'optimise') {
  let subTaskIds = [];

  for (const entry of parsedOptimiseEntries) {
    console.log(`🔍 Backend optimise entry loop - entry:`, entry);
    console.log(`🔍 Backend optimise entry - fa:`, entry.fa);
    console.log(`🔍 Backend optimise entry - attachment:`, entry.attachment);
    console.log(`🔍 Backend optimise entry - attachment_name:`, entry.attachment_name);
    console.log(`🔍 Backend optimise entry - attachment_url:`, attachment_url);
    console.log(`🔍 Backend optimise entry - attachment_name from req.file:`, attachment_name);
    if (
      entry.pub_id || 
      entry.pid || 
      entry.fp || 
      entry.fa || 
      entry.f1 || 
      entry.f2 || 
      entry.optimise_scenario
    ) {
      console.log(`🔍 Backend inserting optimise entry with values:`, {
        group_id,
        campaign_id,
        task_type,
        assigned_to: entry.assigned_to,
        assigned_by: req.user.id,
        pub_id: entry.pub_id,
        pid: entry.pid,
        fp: entry.fp,
        fa: entry.fa,
        f1: entry.f1,
        f2: entry.f2,
        optimise_scenario: entry.optimise_scenario,
        attachment_url,
        attachment_name
      });
      const [subR] = await conn.query(
        `INSERT INTO tasks (
          group_id,
          campaign_id,
          task_type,
          assigned_to,
          assigned_by,
          pub_id,
          pid,
          link,
          fp,
          fa,
          f1,
          f2,
          optimise_scenario,
          attachment_url,
          attachment_name
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          group_id,
          campaign_id || null,
          task_type,
          entry.assigned_to || null,
          req.user.id,
          entry.pub_id || null,
          entry.pid || null,
          null,
          entry.fp ? entry.fp : null,
          entry.fa ? entry.fa : null,
          entry.f1 ? entry.f1 : null,
          entry.f2 ? entry.f2 : null,
          entry.optimise_scenario || null,

          // ✅ FIX: USE entry.attachment and entry.attachment_name (NOT req.file)
          entry.attachment ? `/uploads/${entry.attachment}` : null,
          entry.attachment_name || null
        ]
      );

      subTaskIds.push(subR.insertId);
    }
  }

  await conn.commit();

  const [createdTasks] = await conn.query(
    `SELECT * FROM tasks WHERE id IN (${subTaskIds.map(() => '?').join(',')})`,
    subTaskIds
  );

  // Post task-notification message in chat
  const taskLabel = '⚡ Optimise';
  const entryCount = parsedOptimiseEntries.filter(
    e => e.pub_id || e.pid || e.fp || e.fa || e.f1 || e.f2 || e.optimise_scenario
  ).length;

const assignees = [...new Set(parsedOptimiseEntries
  .filter(e => e.assigned_to && e.assigned_to !== 'null')
  .map(e => e.assigned_to)
)];
 let assigneeText = '';

if (assignees.length > 0) {
  const [users] = await conn.query(
    `SELECT id, full_name FROM users WHERE id IN (?)`,
    [assignees]
  );

  const names = users.map(u => u.full_name);

  assigneeText = names.length > 0 ? ` → ${names.join(', ')}` : '';
}
const chatContent = `📌 Task created: [${taskLabel}]${entryCount > 1 ? ` (${entryCount} entries)` : ''}\n👤 Created by: ${req.user.full_name}${assigneeText}`;
  const { encrypted, iv } = encrypt(chatContent);

  const [mRes] = await conn.query(
    `INSERT INTO messages (group_id,sender_id,message_type,encrypted_content,iv,task_ref_id)
     VALUES(?,?,'task_notification',?,?,?)`,
    [group_id, req.user.id, encrypted, iv, null]
  );

  await conn.query(
    'INSERT INTO workflow_summary (group_id,event_type,event_data,triggered_by) VALUES(?,?,?,?)',
    [group_id, 'task_created', JSON.stringify({ task_type: 'optimise', entries: subTaskIds.length }), req.user.id]
  );

  const io = req.app.get('io');
  if (io) {
    io.to(`group_${group_id}`).emit('new_message', {
      id: mRes.insertId,
      group_id: Number(group_id),
      sender_id: req.user.id,
      sender_name: req.user.full_name,
      sender_role: req.user.role,
      message_type: 'task_notification',
      content: chatContent,
      task_ref: { task_id: taskId, task_type: 'optimise', task_title: taskLabel },
      sent_at: new Date(),
    });
  }

  return res.status(201).json({
    task: null,
    subTasks: createdTasks
  });
}
    // Post task-notification message in chat
    const labels={initial_setup:'🚀 Initial Setup',share_link:'🔗 Share Link',
      pause_pid:'⏸️ Pause PID',raise_request:'📋 Raise Request',optimise:'⚡ Optimise'};
    const taskLabel=labels[task_type]||task_type;

    // Handle assignee names for single-entry tasks (raise_request, initial_setup)
    let assigneeText = '';
    let entryCount = 1;
    if (task_type === 'raise_request' || task_type === 'initial_setup') {
      if (assigned_to && assigned_to !== 'null') {
        const [users] = await conn.query(
          `SELECT id, full_name FROM users WHERE id = ?`,
          [assigned_to]
        );
        if (users.length > 0) {
          assigneeText = ` → ${users[0].full_name}`;
        }
      }
    } else {
      // Handle multi-entry tasks (optimise, share_link, pause_pid)
      let entries = [];
      if (task_type === 'share_link') entries = parsedEntries;
      if (task_type === 'pause_pid') entries = parsedPauseEntries;
      if (task_type === 'optimise') entries = parsedOptimiseEntries;
      
      const assignees = [...new Set(entries
        .filter(e => e.assigned_to && e.assigned_to !== 'null')
        .map(e => e.assigned_to)
      )];
      
      if (assignees.length > 0) {
        const [users] = await conn.query(
          `SELECT id, full_name FROM users WHERE id IN (?)`,
          [assignees]
        );
        const names = users.map(u => u.full_name);
        assigneeText = names.length > 0 ? ` → ${names.join(', ')}` : '';
      }
      
      // Set entry count for multi-entry tasks
      if (task_type === 'share_link') entryCount = parsedEntries.filter(e => e.pub_id || e.pid || e.link).length;
      if (task_type === 'pause_pid') entryCount = parsedPauseEntries.filter(e => e.pub_id || e.pid || e.pause_reason).length;
      if (task_type === 'optimise') entryCount = parsedOptimiseEntries.filter(e => e.pub_id || e.pid || e.fp || e.fa || e.f1 || e.f2 || e.optimise_scenario).length;
    }

    const chatContent=`📌 Task created: [${taskLabel}]${entryCount > 1 ? ` (${entryCount} entries)` : ''}\n👤 Created by: ${req.user.full_name}${assigneeText}`;
    const{encrypted,iv}=encrypt(chatContent);
    const[mRes]=await conn.query(
      `INSERT INTO messages (group_id,sender_id,message_type,encrypted_content,iv,task_ref_id)
       VALUES(?,?,'task_notification',?,?,?)`,
      [group_id,req.user.id,encrypted,iv,taskId]
    );

    await conn.query(
      'INSERT INTO workflow_summary (group_id,event_type,event_data,triggered_by) VALUES(?,?,?,?)',
      [group_id,'task_created',JSON.stringify({task_type,task_id:taskId,entries:subTaskIds.length}),req.user.id]
    );
    
    // Notify assignees
    const allAssignees = new Set();
    if (assigned_to) allAssignees.add(assigned_to);
    if (task_type === 'share_link') {
      parsedEntries.forEach(entry => {
        if (entry.assigned_to) allAssignees.add(entry.assigned_to);
      });
    }
    if (task_type === 'pause_pid') {
      parsedPauseEntries.forEach(entry => {
        if (entry.assigned_to) allAssignees.add(entry.assigned_to);
      });
    }
    if (task_type === 'optimise') {
      parsedOptimiseEntries.forEach(entry => {
        if (entry.assigned_to) allAssignees.add(entry.assigned_to);
      });
    }
    
    allAssignees.forEach(assigneeId => {
      if (assigneeId) {
        conn.query(
          'INSERT INTO notifications (user_id,group_id,task_id,type,title,body) VALUES(?,?,?,?,?,?)',
          [assigneeId,group_id,taskId,'task',`New Task: ${taskLabel}`,description||'']
        );
      }
    });
    
    await conn.commit();

    // Get main task
    const[[taskRow]]=await conn.query(`
      SELECT t.*,u1.full_name AS assigned_to_name,u2.full_name AS assigned_by_name
      FROM tasks t LEFT JOIN users u1 ON u1.id=t.assigned_to LEFT JOIN users u2 ON u2.id=t.assigned_by
      WHERE t.id=?`,[taskId]);

    // Get sub-tasks if any
    let subTasks = [];
    if (subTaskIds.length > 0) {
      const[subRows]=await conn.query(`
        SELECT t.*,u1.full_name AS assigned_to_name,u2.full_name AS assigned_by_name
        FROM tasks t LEFT JOIN users u1 ON u1.id=t.assigned_to LEFT JOIN users u2 ON u2.id=t.assigned_by
        WHERE t.id IN (${subTaskIds.map(() => '?').join(',')})`,subTaskIds);
      subTasks = subRows;
    }

    const io=req.app.get('io');
    if(io){
      io.to(`group_${group_id}`).emit('task_update',{action:'created',task:taskRow,subTasks});
      io.to(`group_${group_id}`).emit('new_message',{
        id:mRes.insertId,group_id:Number(group_id),
        sender_id:req.user.id,sender_name:req.user.full_name,sender_role:req.user.role,
        message_type:'task_notification',content:chatContent,
        task_ref:{task_id:taskId,task_title:taskLabel,task_type},
        sent_at:new Date(),
      });
      // notify assignees
      allAssignees.forEach(assigneeId => {
        if (assigneeId) {
          console.log('Emitting task_assigned to user:', assigneeId);
          console.log('Task data:', { task: taskRow, subTasks, assigned_by: req.user.full_name, group_id });
          
          io.to(`user_${assigneeId}`).emit('push_notification',{
            type:'task',title:`📋 New task: ${taskLabel}`,
            body:description||'You have a new task assigned',group_id,
          });
          // Send real-time task assignment event
          io.to(`user_${assigneeId}`).emit('task_assigned', {
            task: taskRow,
            subTasks: subTasks,
            assigned_by: req.user.full_name,
            message: `New task assigned to you by ${req.user.full_name}`,
            group_id
          });
          console.log('task_assigned event emitted successfully');
        }
      });
    }

    res.status(201).json({task:taskRow,subTasks});
  }catch(e){
    await conn.rollback();
    console.error('Create task error:',e);
    res.status(500).json({error:'Failed to create task'});
  }finally{conn.release();}
});

/* GET single task with permission check */
router.get('/:taskId', auth, async (req, res) => {
  try {
    const [[task]] = await db.query(`
      SELECT t.*, 
        u1.full_name AS assigned_to_name,
        u2.full_name AS assigned_by_name,
        c.campaign_name,
        parent.task_type AS parent_task_type
      FROM tasks t
      LEFT JOIN users u1 ON u1.id = t.assigned_to
      LEFT JOIN users u2 ON u2.id = t.assigned_by
      LEFT JOIN campaigns c ON c.id = t.campaign_id
      LEFT JOIN tasks parent ON parent.id = t.parent_task_id
      WHERE t.id = ?
    `, [req.params.taskId]);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Strict permission check: only assigned user or task creator can view details
    if (task.assigned_to !== req.user.id && task.assigned_by !== req.user.id) {
      return res.status(403).json({ error: 'Access Denied: Only assigned user can view task details' });
    }

    // Get sub-tasks if any
    let subTasks = [];
    if (task.parent_task_id === null) {
      const [subRows] = await db.query(`
        SELECT t.*, u1.full_name AS assigned_to_name, u2.full_name AS assigned_by_name
        FROM tasks t 
        LEFT JOIN users u1 ON u1.id = t.assigned_to 
        LEFT JOIN users u2 ON u2.id = t.assigned_by
        WHERE t.parent_task_id = ?
      `, [req.params.taskId]);
      subTasks = subRows;
    }

    res.json({ task: { ...task, subTasks } });
  } catch (e) {
    console.error('Get task error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* PATCH update status */
router.patch('/:taskId/status',auth,async(req,res)=>{
  const conn=await db.getConnection();
  try{
    await conn.beginTransaction();
    const{taskId}=req.params;const{status,comment}=req.body;
    const valid=['pending','accepted','rejected','completed'];
    if(!valid.includes(status))return res.status(400).json({error:'Invalid status'});
    
    // Get task and validate user permissions
    const[[task]]=await conn.query('SELECT * FROM tasks WHERE id=?',[taskId]);
    if(!task)return res.status(404).json({error:'Task not found'});
    
    // Only assigned user can update task status
    if(task.assigned_to !== req.user.id) {
      return res.status(403).json({error:'Access Denied: Only assigned user can update task status'});
    }
    
    await conn.query('UPDATE tasks SET status=?,updated_at=NOW() WHERE id=?',[status,taskId]);
    await conn.query('INSERT INTO task_responses (task_id,user_id,action,comment) VALUES(?,?,?,?)',[taskId,req.user.id,status,comment||null]);
    await conn.query('INSERT INTO workflow_summary (group_id,event_type,event_data,triggered_by) VALUES(?,?,?,?)',
      [task.group_id,'task_status_changed',JSON.stringify({task_id:taskId,status}),req.user.id]);
    await conn.commit();
    
    // Get updated task with full details
    const[[updatedTask]]=await conn.query(`
      SELECT t.*, 
        u1.full_name AS assigned_to_name,
        u2.full_name AS assigned_by_name
      FROM tasks t 
      LEFT JOIN users u1 ON u1.id=t.assigned_to 
      LEFT JOIN users u2 ON u2.id=t.assigned_by
      WHERE t.id=?`,[taskId]);
    
    // Get the latest response/comment
    const[[latestResponse]]=await conn.query(`
      SELECT tr.*, u.full_name AS user_name
      FROM task_responses tr 
      JOIN users u ON u.id=tr.user_id 
      WHERE tr.task_id=? 
      ORDER BY tr.responded_at DESC 
      LIMIT 1`,[taskId]);
    
    const io=req.app.get('io');
    if(io){
      io.to(`group_${task.group_id}`).emit('task_update',{
        action:'status_changed',
        task_id:Number(taskId),
        status,
        task: updatedTask,
        response: latestResponse,
        updated_by: req.user.full_name
      });
    }
    res.json({message:'Updated',status,task:updatedTask,response:latestResponse});
  }catch(e){await conn.rollback();res.status(500).json({error:'Server error'});}
  finally{conn.release();}
});

router.get('/:taskId/responses',auth,async(req,res)=>{
  const[r]=await db.query(
    'SELECT tr.*,u.full_name FROM task_responses tr JOIN users u ON u.id=tr.user_id WHERE tr.task_id=? ORDER BY tr.responded_at',
    [req.params.taskId]);
  res.json({responses:r});
});

router.post('/followup',auth,async(req,res)=>{
  const{group_id,task_id,message,scheduled_at}=req.body;
  const[r]=await db.query('INSERT INTO followups (group_id,task_id,created_by,message,scheduled_at) VALUES(?,?,?,?,?)',
    [group_id,task_id||null,req.user.id,message,scheduled_at||null]);
  res.status(201).json({followup_id:r.insertId});
});

router.get('/followups/group/:groupId',auth,async(req,res)=>{
  const[r]=await db.query(
    'SELECT f.*,u.full_name AS created_by_name FROM followups f JOIN users u ON u.id=f.created_by WHERE f.group_id=? ORDER BY f.created_at DESC',
    [req.params.groupId]);
  res.json({ followups: r });
});

// File download endpoint
router.get('/download/:filename', auth, async (req, res) => {
  try {
    const { filename } = req.params;
    const UPLOAD_DIR = req.app.get('UPLOAD_DIR');
    const filePath = path.join(UPLOAD_DIR, filename);

    // Security check - ensure file is within uploads directory
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(UPLOAD_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file info
    const stats = fs.statSync(filePath);

    // Set appropriate headers
    res.setHeader('Content-Type', getMimeType(filename));
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Force download for non-image/audio files
    const ext = path.extname(filename).toLowerCase();
    const inline = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp3', '.wav', '.ogg', '.webm', '.m4a'];
    if (!inline.includes(ext)) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    }

    // Send file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Helper function to get MIME type
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

module.exports = router;
