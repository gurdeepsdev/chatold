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
        c.campaign_name
      FROM tasks t
      LEFT JOIN users u1 ON u1.id=t.assigned_to
      LEFT JOIN users u2 ON u2.id=t.assigned_by
      LEFT JOIN campaigns c ON c.id=t.campaign_id
      WHERE t.group_id=?
      ORDER BY CASE t.status WHEN 'pending' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END,t.created_at DESC
    `,[req.params.groupId]);
    res.json({tasks});
  }catch(e){res.status(500).json({error:'Server error'});}
});

/* POST create task */
router.post('/',auth,upload.single('attachment'),async(req,res)=>{
  const conn=await db.getConnection();
  try{
    await conn.beginTransaction();
    const b=req.body;
    const{group_id,campaign_id,task_type,title,description,assigned_to,
          pub_id,pid,link,pause_reason,request_type,request_details,
          fp,f1,f2,optimise_scenario,due_date}=b;

    if(!group_id||!task_type||!title)
      return res.status(400).json({error:'group_id, task_type, title required'});

    const attachment_url=req.file?`/uploads/${req.file.filename}`:null;
    const attachment_name=req.file?req.file.originalname:null;

    const[r]=await conn.query(
      `INSERT INTO tasks (group_id,campaign_id,task_type,title,description,
         assigned_to,assigned_by,pub_id,pid,link,pause_reason,
         request_type,request_details,fp,f1,f2,optimise_scenario,
         attachment_url,attachment_name,due_date)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [group_id,campaign_id||null,task_type,title,description||null,
       assigned_to||null,req.user.id,pub_id||null,pid||null,link||null,
       pause_reason||null,request_type||null,request_details||null,
       fp||null,f1||null,f2||null,optimise_scenario||null,
       attachment_url,attachment_name,due_date||null]
    );
    const taskId=r.insertId;

    // Post task-notification message in chat
    const labels={initial_setup:'🚀 Initial Setup',share_link:'🔗 Share Link',
      pause_pid:'⏸️ Pause PID',raise_request:'📋 Raise Request',optimise:'⚡ Optimise'};
    const chatContent=`📌 Task created: "${title}" [${labels[task_type]||task_type}]`;
    const{encrypted,iv}=encrypt(chatContent);
    const[mRes]=await conn.query(
      `INSERT INTO messages (group_id,sender_id,message_type,encrypted_content,iv,task_ref_id)
       VALUES(?,?,'task_notification',?,?,?)`,
      [group_id,req.user.id,encrypted,iv,taskId]
    );

    await conn.query(
      'INSERT INTO workflow_summary (group_id,event_type,event_data,triggered_by) VALUES(?,?,?,?)',
      [group_id,'task_created',JSON.stringify({task_type,title,task_id:taskId}),req.user.id]
    );
    if(assigned_to){
      await conn.query(
        'INSERT INTO notifications (user_id,group_id,task_id,type,title,body) VALUES(?,?,?,?,?,?)',
        [assigned_to,group_id,taskId,'task',`New Task: ${title}`,description||'']
      );
    }
    await conn.commit();

    const[[taskRow]]=await conn.query(`
      SELECT t.*,u1.full_name AS assigned_to_name,u2.full_name AS assigned_by_name
      FROM tasks t LEFT JOIN users u1 ON u1.id=t.assigned_to LEFT JOIN users u2 ON u2.id=t.assigned_by
      WHERE t.id=?`,[taskId]);

    const io=req.app.get('io');
    if(io){
      io.to(`group_${group_id}`).emit('task_update',{action:'created',task:taskRow});
      io.to(`group_${group_id}`).emit('new_message',{
        id:mRes.insertId,group_id:Number(group_id),
        sender_id:req.user.id,sender_name:req.user.full_name,sender_role:req.user.role,
        message_type:'task_notification',content:chatContent,
        task_ref:{task_id:taskId,task_title:title,task_type},
        sent_at:new Date(),
      });
      // notify assignee
      if(assigned_to){
        io.to(`user_${assigned_to}`).emit('push_notification',{
          type:'task',title:`📋 New task: ${title}`,
          body:description||'You have a new task assigned',group_id,
        });
      }
    }

    res.status(201).json({task:taskRow});
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
    'SELECT f.*,u.full_name AS created_by_name,t.title AS task_title FROM followups f JOIN users u ON u.id=f.created_by LEFT JOIN tasks t ON t.id=f.task_id WHERE f.group_id=? ORDER BY f.created_at DESC',
    [req.params.groupId]);
  res.json({followups:r});
});

module.exports=router;
