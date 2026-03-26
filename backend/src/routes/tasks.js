const express = require('express');
const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const db      = require('../utils/db');
const { auth }             = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');

// Multer for task attachments — same UPLOAD_DIR as messages
const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,req.app.get('UPLOAD_DIR')||path.resolve('uploads')),
  filename:   (req,file,cb)=>cb(null,Date.now()+'-'+Math.random().toString(36).slice(2,9)+path.extname(file.originalname)),
});
const upload=multer({storage,limits:{fileSize:52428800}});

/* GET tasks for group */
router.get('/group/:groupId',auth,async(req,res)=>{
  try{
    const[tasks]=await db.query(`
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
      ORDER BY CASE t.status WHEN 'pending' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END,t.created_at DESC
    `,[req.params.groupId]);
    
    // Get sub-tasks for each main task
    const tasksWithSubs = await Promise.all(tasks.map(async (task) => {
      if (task.parent_task_id === null) {
        const[subTasks]=await db.query(`
          SELECT t.*,
            u1.full_name AS assigned_to_name,
            u2.full_name AS assigned_by_name
          FROM tasks t
          LEFT JOIN users u1 ON u1.id=t.assigned_to
          LEFT JOIN users u2 ON u2.id=t.assigned_by
          WHERE t.parent_task_id=?
          ORDER BY t.created_at DESC
        `,[task.id]);
        return { ...task, subTasks };
      }
      return task;
    }));
    
    // Filter out sub-tasks from main list (they're included as subTasks)
    const mainTasks = tasksWithSubs.filter(task => task.parent_task_id === null);
    
    res.json({tasks: mainTasks});
  }catch(e){res.status(500).json({error:'Server error'});}
});

/* POST create task */
router.post('/',auth,upload.single('attachment'),async(req,res)=>{
  const conn=await db.getConnection();
  try{
    await conn.beginTransaction();
    const b=req.body;
    const{group_id,campaign_id,task_type,description,assigned_to,
          pub_id,pid,link,pause_reason,request_type,request_details,
          fp,f1,f2,optimise_scenario,due_date,entries,pause_entries}=b;

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

    // Create main task
    const[r]=await conn.query(
      `INSERT INTO tasks (group_id,campaign_id,task_type,title,description,
         assigned_to,assigned_by,pub_id,pid,link,pause_reason,
         request_type,request_details,fp,f1,f2,optimise_scenario,
         attachment_url,attachment_name,due_date)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [group_id,campaign_id||null,task_type,null,description||null,
       assigned_to||null,req.user.id,pub_id||null,pid||null,link||null,
       pause_reason||null,request_type||null,request_details||null,
       fp||null,f1||null,f2||null,optimise_scenario||null,
       attachment_url,attachment_name,due_date||null]
    );
    const taskId=r.insertId;

    // Create sub-tasks for each entry (for share_link tasks)
    let subTaskIds = [];
    if (task_type === 'share_link' && parsedEntries.length > 0) {
      for (const entry of parsedEntries) {
        if (entry.pub_id || entry.pid || entry.link) {
          const[subR]=await conn.query(
            `INSERT INTO tasks (group_id,campaign_id,task_type,title,description,
               assigned_to,assigned_by,pub_id,pid,link,parent_task_id)
             VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
            [group_id,campaign_id||null,task_type,entry.note||null,null,
             entry.assigned_to||null,req.user.id,entry.pub_id||null,entry.pid||null,
             entry.link||null,taskId]
          );
          subTaskIds.push(subR.insertId);
        }
      }
    }

    // Create sub-tasks for each pause entry (for pause_pid tasks)
    if (task_type === 'pause_pid' && parsedPauseEntries.length > 0) {
      for (const entry of parsedPauseEntries) {
        if (entry.pub_id || entry.pid || entry.pause_reason) {
          const[subR]=await conn.query(
            `INSERT INTO tasks (group_id,campaign_id,task_type,title,description,
               assigned_to,assigned_by,pub_id,pid,link,pause_reason,parent_task_id)
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
            [group_id,campaign_id||null,task_type,null,null,
             entry.assigned_to||null,req.user.id,entry.pub_id||null,entry.pid||null,
             null,entry.pause_reason||null,taskId]
          );
          subTaskIds.push(subR.insertId);
        }
      }
    }

    // Post task-notification message in chat
    const labels={initial_setup:'🚀 Initial Setup',share_link:'🔗 Share Link',
      pause_pid:'⏸️ Pause PID',raise_request:'📋 Raise Request',optimise:'⚡ Optimise'};
    const taskLabel=labels[task_type]||task_type;
    let entryCount = 1;
    if (task_type === 'share_link') entryCount = parsedEntries.filter(e => e.pub_id || e.pid || e.link).length;
    if (task_type === 'pause_pid') entryCount = parsedPauseEntries.filter(e => e.pub_id || e.pid || e.pause_reason).length;
    const chatContent=`📌 Task created: [${taskLabel}]${entryCount > 1 ? ` (${entryCount} entries)` : ''}`;
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
          io.to(`user_${assigneeId}`).emit('push_notification',{
            type:'task',title:`📋 New task: ${taskLabel}`,
            body:description||'You have a new task assigned',group_id,
          });
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

/* PATCH update status */
router.patch('/:taskId/status',auth,async(req,res)=>{
  const conn=await db.getConnection();
  try{
    await conn.beginTransaction();
    const{taskId}=req.params;const{status,comment}=req.body;
    const valid=['pending','accepted','rejected','completed'];
    if(!valid.includes(status))return res.status(400).json({error:'Invalid status'});
    await conn.query('UPDATE tasks SET status=?,updated_at=NOW() WHERE id=?',[status,taskId]);
    await conn.query('INSERT INTO task_responses (task_id,user_id,action,comment) VALUES(?,?,?,?)',[taskId,req.user.id,status,comment||null]);
    const[[task]]=await conn.query('SELECT * FROM tasks WHERE id=?',[taskId]);
    await conn.query('INSERT INTO workflow_summary (group_id,event_type,event_data,triggered_by) VALUES(?,?,?,?)',
      [task.group_id,'task_status_changed',JSON.stringify({task_id:taskId,status}),req.user.id]);
    await conn.commit();
    const io=req.app.get('io');
    if(io)io.to(`group_${task.group_id}`).emit('task_update',{action:'status_changed',task_id:Number(taskId),status});
    res.json({message:'Updated',status});
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
  res.json({followups:r});
});

module.exports=router;
