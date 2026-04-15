// const express = require('express');
// const router  = express.Router();
// const multer  = require('multer');
// const path    = require('path');
// const fs      = require('fs');
// const db      = require('../utils/db');
// const { auth }            = require('../middleware/auth');
// const { encrypt, decrypt} = require('../utils/encryption');
// const { 
//   getMessageAccessFilter, 
//   getUserAssignmentInfo, 
//   getAvailableRecipients,
//   canUserMessageRecipient 
// } = require('../utils/messageAccess');

// // ── Multer: use UPLOAD_DIR set by server.js (absolute path) ──
// function getUploadDir(req){ return req.app.get('UPLOAD_DIR') || path.resolve('uploads'); }

// const storage = multer.diskStorage({
//   destination:(req,file,cb)=>cb(null,getUploadDir(req)),
//   filename:   (req,file,cb)=>cb(null,Date.now()+'-'+Math.random().toString(36).slice(2,9)+path.extname(file.originalname)),
// });
// const upload = multer({
//   storage,
//   limits:{ fileSize: parseInt(process.env.MAX_FILE_SIZE)||52428800 },
//   fileFilter:(req,file,cb)=>{
//     const ok=/jpeg|jpg|png|gif|webp|pdf|mp3|wav|ogg|webm|m4a|doc|docx|xls|xlsx|csv|txt|zip/;
//     ok.test(path.extname(file.originalname).slice(1).toLowerCase())?cb(null,true):cb(new Error('File type not allowed'));
//   },
// });

// // Returns absolute URL including protocol+host+port
// function absUrl(req, rel){
//   if(!rel)return null;
//   if(rel.startsWith('http'))return rel;
  
//   // Check if behind HTTPS proxy - multiple ways to detect HTTPS
//   const forwardedProto = req.get('x-forwarded-proto');
//   const forwardedSsl = req.get('x-forwarded-ssl');
//   const cloudflareVisitor = req.get('cf-visitor');
  
//   let protocol = req.protocol; // Default to request protocol
  
//   // Check various HTTPS indicators
//   if (forwardedProto === 'https') {
//     protocol = 'https';
//   } else if (forwardedSsl === 'on') {
//     protocol = 'https';
//   } else if (cloudflareVisitor && JSON.parse(cloudflareVisitor).scheme === 'https') {
//     protocol = 'https';
//   } else if (req.get('x-forwarded-host')) {
//     // If x-forwarded-host is present, assume HTTPS in production
//     protocol = 'https';
//   }
  
//   const host = req.get('x-forwarded-host') || req.get('host');
//   const url = `${protocol}://${host}${rel}`;
  
//   // Debug logging in production
//   if (process.env.NODE_ENV === 'production') {
//     console.log('absUrl debug:', {
//       originalProtocol: req.protocol,
//       forwardedProto,
//       forwardedSsl,
//       cloudflareVisitor,
//       finalProtocol: protocol,
//       host,
//       finalUrl: url
//     });
//   }
  
//   return url;
// }

// const checkMember=async(req,res,next)=>{
//   const[rows]=await db.query('SELECT id FROM group_members WHERE group_id=? AND user_id=?',[req.params.groupId,req.user.id]);
//   if(!rows.length&&req.user.role!=='admin')return res.status(403).json({error:'Not a member'});
//   next();
// };

// async function pushToMembers(io,groupId,senderId,msg,groupName){
//   try{
//     const[members]=await db.query('SELECT user_id FROM group_members WHERE group_id=? AND user_id!=?',[groupId,senderId]);
//     for(const m of members){
//       await db.query('INSERT INTO notifications (user_id,group_id,message_id,type,title,body) VALUES(?,?,?,?,?,?)',
//         [m.user_id,groupId,msg.id,'message',`💬 ${msg.sender_name}`,msg.content?.slice(0,100)||'Sent a file']).catch(()=>{});
//       if(io){
//         io.to(`user_${m.user_id}`).emit('push_notification',{
//           type:'message',
//           title:`💬 ${msg.sender_name}`,
//           body:msg.content?.slice(0,100)||'Sent a file',
//           group_id:groupId,
//           group_name:groupName,
//           message_id:msg.id,
//         });
//         const[[{count}]]=await db.query('SELECT COUNT(*) as count FROM notifications WHERE user_id=? AND is_read=FALSE',[m.user_id]).catch(()=>[[{count:0}]]);
//         io.to(`user_${m.user_id}`).emit('notification_count',{count});
//       }
//     }
//   }catch(e){console.error('Push err:',e.message);}
// }

// /* GET /api/messages/:groupId */
// router.get('/:groupId',auth,checkMember,async(req,res)=>{
//   try{
//     const{groupId}=req.params;
//     const page =Math.max(1,parseInt(req.query.page)||1);
//     const limit=Math.min(100,parseInt(req.query.limit)||50);
//     const[rows]=await db.query(`
//       SELECT m.id,m.group_id,m.message_type,m.encrypted_content,m.iv,
//              m.file_url,m.file_name,m.file_size,m.mime_type,
//              m.reply_to_id,m.is_deleted,m.sent_at,m.task_ref_id,
//              u.id AS sender_id,u.full_name AS sender_name,u.username,u.role AS sender_role,
//              rm.encrypted_content AS reply_encrypted,rm.iv AS reply_iv,
//              ru.full_name AS reply_sender_name,
//              t.title AS task_title,t.task_type AS task_type_ref
//       FROM messages m
//       JOIN users u ON u.id=m.sender_id
//       LEFT JOIN messages rm ON rm.id=m.reply_to_id
//       LEFT JOIN users ru ON ru.id=rm.sender_id
//       LEFT JOIN tasks t ON t.id=m.task_ref_id
//       WHERE m.group_id=?
//       ORDER BY m.sent_at DESC
//       LIMIT ? OFFSET ?
//     `,[groupId,limit,(page-1)*limit]);

//     // Get reactions for all messages
//     const messageIds = rows.map(m => m.id);
//     let reactions = [];
//     if (messageIds.length > 0) {
//       const [reactionRows] = await db.query(`
//         SELECT r.message_id, r.user_id, r.emoji, u.full_name AS user_name
//         FROM reactions r
//         JOIN users u ON u.id = r.user_id
//         WHERE r.message_id IN (${messageIds.map(() => '?').join(',')})
//         ORDER BY r.created_at ASC
//       `, messageIds);
//       reactions = reactionRows;
//     }

//     const messages=rows.reverse().map(msg=>({
//       id:msg.id,
//       group_id:Number(msg.group_id),
//       message_type:msg.message_type,
//       content:msg.is_deleted?'This message was deleted':decrypt(msg.encrypted_content,msg.iv),
//       // ✅ absolute URL so frontend uses it verbatim
//       file_url:absUrl(req,msg.file_url),
//       file_name:msg.file_name,
//       file_size:msg.file_size,
//       mime_type:msg.mime_type,
//       reply_to_id:msg.reply_to_id,
//       reply_content:msg.reply_encrypted?decrypt(msg.reply_encrypted,msg.reply_iv):null,
//       reply_sender_name:msg.reply_sender_name,
//       is_deleted:msg.is_deleted,
//       sent_at:msg.sent_at,
//       sender_id:msg.sender_id,
//       sender_name:msg.sender_name,
//       username:msg.username,
//       sender_role:msg.sender_role,
//       task_ref:msg.task_ref_id?{task_id:msg.task_ref_id,task_title:msg.task_title,task_type:msg.task_type_ref}:null,
//       reactions: reactions.filter(r => r.message_id === msg.id).map(r => ({
//         emoji: r.emoji,
//         user_id: r.user_id,
//         user_name: r.user_name
//       }))
//     }));

//     rows.forEach(m=>db.query('INSERT IGNORE INTO message_status (message_id,user_id,status) VALUES(?,?,?)',[m.id,req.user.id,'seen']).catch(()=>{}));
//     res.json({messages,page,hasMore:rows.length===limit});
//   }catch(e){console.error(e);res.status(500).json({error:'Failed to load messages'});}
// });

// /* POST send text or forwarded message */
// router.post('/:groupId',auth,checkMember,async(req,res)=>{
//   try{
//     const{groupId}=req.params;
//     const{
//       content,
//       reply_to_id,
//       message_type='text',
//       file_url,
//       file_name,
//       file_size,
//       mime_type,
//       recipient_id, // 🔒 REQUIRED: Primary recipient
//       secondary_recipient_id // 🔧 OPTIONAL: Secondary recipient (manager)
//     }=req.body;
    
//     // 🔒 CORE RULE: User must select a recipient
//     if (!recipient_id) {
//       return res.status(400).json({ 
//         error: 'Recipient is required. Please select a user to send this message to.' 
//       });
//     }
    
//     // 🔍 Get CRM database connection
//     const crmDb = db.crmPool;
//     if (!crmDb) {
//       return res.status(500).json({ error: 'CRM database not available' });
//     }
    
//     // 🔍 Validate recipient exists and is in same group
//     const [recipientCheck] = await db.query(`
//       SELECT gm.user_id, u.full_name 
//       FROM group_members gm 
//       JOIN users u ON u.id = gm.user_id
//       WHERE gm.group_id = ? AND gm.user_id = ?
//     `, [groupId, recipient_id]);
    
//     if (recipientCheck.length === 0) {
//       return res.status(400).json({ 
//         error: 'Selected recipient is not a member of this group.' 
//       });
//     }
    
//     // 🔍 Validate secondary recipient if provided
//     let secondaryRecipientInfo = null;
//     if (secondary_recipient_id) {
//       const [secondaryCheck] = await db.query(`
//         SELECT gm.user_id, u.full_name 
//         FROM group_members gm 
//         JOIN users u ON u.id = gm.user_id
//         WHERE gm.group_id = ? AND gm.user_id = ?
//       `, [groupId, secondary_recipient_id]);
      
//       if (secondaryCheck.length === 0) {
//         return res.status(400).json({ 
//           error: 'Secondary recipient is not a member of this group.' 
//         });
//       }
      
//       secondaryRecipientInfo = secondaryCheck[0];
//     }
    
//     // 🎯 Build recipient names for message content
//     const primaryRecipientName = recipientCheck[0].full_name;
//     let recipientNames = primaryRecipientName;
    
//     if (secondaryRecipientInfo) {
//       recipientNames += ` & ${secondaryRecipientInfo.full_name}`;
//     }
    
//     // 📝 Modify content to include recipient names
//     const modifiedContent = `📤 To ${recipientNames}: ${content}`;
    
//     // 🚀 SEND SINGLE MESSAGE (no duplicates)
//     if(!content?.trim())return res.status(400).json({error:'Content required'});
    
//     const{encrypted,iv}=encrypt(modifiedContent);
//     const[r]=await db.query(
//       'INSERT INTO messages (group_id,sender_id,recipient_id,secondary_recipient_id,message_type,encrypted_content,iv,reply_to_id) VALUES(?,?,?,?,?,?,?,?)',
//       [groupId,req.user.id,recipient_id,secondary_recipient_id||null,message_type,encrypted,iv,reply_to_id||null]
//     );
    
//     const[[grp]]=await db.query('SELECT group_name FROM chat_groups WHERE id=?',[groupId]).catch(()=>[[{}]]);
    
//     // Fetch reply data if this is a reply
//     let replyData = null;
//     if(reply_to_id) {
//       const[[replyMsg]] = await db.query(`
//         SELECT m.encrypted_content, m.iv, u.full_name as sender_name
//         FROM messages m
//         JOIN users u ON u.id = m.sender_id
//         WHERE m.id = ? AND m.is_deleted = false
//       `, [reply_to_id]);
      
//       if(replyMsg) {
//         replyData = {
//           reply_content: decrypt(replyMsg.encrypted_content, replyMsg.iv),
//           reply_sender_name: replyMsg.sender_name
//         };
//       }
//     }
    
//     // 🎯 Create single message object
//     const message={
//       id:r.insertId,group_id:Number(groupId),
//       sender_id:req.user.id,sender_name:req.user.full_name,
//       recipient_id: Number(recipient_id),
//       secondary_recipient_id: secondary_recipient_id ? Number(secondary_recipient_id) : null,
//       username:req.user.username,sender_role:req.user.role,
//       message_type,content:modifiedContent,reply_to_id:reply_to_id||null,
//       ...replyData,
//       is_deleted:false,sent_at:new Date(),
//     };
    
//     // 🚀 Emit single message to all group members
//     const io=req.app.get('io');
//     if(io)io.to(`group_${groupId}`).emit('new_message',message);
//     await pushToMembers(io,groupId,req.user.id,message,grp?.group_name||'');
//     res.status(201).json({message});
//   }catch(e){console.error(e);res.status(500).json({error:'Failed to send'});}
// });

// /* GET available recipients for group */
// router.get('/:groupId/recipients', auth, checkMember, async (req, res) => {
//   try {
//     const { groupId } = req.params;
//     const crmDb = db.crmPool;
    
//     if (!crmDb) {
//       return res.status(500).json({ error: 'CRM database not available' });
//     }
    
//     // Get available recipients based on hierarchy
//     const recipients = await getAvailableRecipients(crmDb, db, groupId, req.user.id);
    
//     res.json({ recipients });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to get recipients' });
//   }
// });

// /* GET assignment info for a specific recipient */
// router.get('/:groupId/assignment/:recipientId', auth, checkMember, async (req, res) => {
//   try {
//     const { groupId, recipientId } = req.params;
//     const crmDb = db.crmPool;
    
//     if (!crmDb) {
//       return res.status(500).json({ error: 'CRM database not available' });
//     }
    
//     // Get assignment info for the recipient
//     const assignmentInfo = await getUserAssignmentInfo(crmDb, db, req.user.id, recipientId);
    
//     res.json(assignmentInfo);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to get assignment info' });
//   }
// });

// /* POST upload file */
// router.post('/:groupId/upload',auth,checkMember,upload.single('file'),async(req,res)=>{
//   try{
//     const{groupId}=req.params;
//     const file=req.file;
//     if(!file)return res.status(400).json({error:'No file uploaded'});
    
//     // Enhanced file type detection
//     const relPath=`/uploads/${file.filename}`;
//     let msgType='file';
//     let fileIcon='📄';
    
//     if(file.mimetype.startsWith('image/')){
//       msgType='image';
//       fileIcon='🖼️';
//     }
//     else if(file.mimetype.startsWith('audio/')){
//       msgType='audio';
//       fileIcon='🎵';
//     }
//     else if(file.mimetype.startsWith('video/')){
//       msgType='video';
//       fileIcon='🎬';
//     }
//     else if(file.mimetype.includes('pdf')){
//       fileIcon='📕';
//     }
//     else if(file.mimetype.includes('word') || file.mimetype.includes('document')){
//       fileIcon='📝';
//     }
//     else if(file.mimetype.includes('sheet') || file.mimetype.includes('excel')){
//       fileIcon='📊';
//     }
//     else if(file.mimetype.includes('zip') || file.mimetype.includes('compressed')){
//       fileIcon='🗜️';
//     }
//     else if(file.mimetype.includes('presentation') || file.mimetype.includes('powerpoint')){
//       fileIcon='📽️';
//     }
//     else if(file.mimetype.includes('text')){
//       fileIcon='📄';
//     }
    
//     // Use caption from request or fallback to filename
//     const caption = req.body.caption || file.originalname;
//     const{encrypted,iv}=encrypt(caption);
    
//     const[r]=await db.query(
//       'INSERT INTO messages (group_id,sender_id,message_type,encrypted_content,iv,file_url,file_name,file_size,mime_type) VALUES(?,?,?,?,?,?,?,?,?)',
//       [groupId,req.user.id,msgType,encrypted,iv,relPath,file.originalname,file.size,file.mimetype]
//     );
    
//     const[[grp]]=await db.query('SELECT group_name FROM chat_groups WHERE id=?',[groupId]).catch(()=>[[{}]]);
//     const message={
//       id:r.insertId,group_id:Number(groupId),
//       sender_id:req.user.id,sender_name:req.user.full_name,
//       username:req.user.username,sender_role:req.user.role,
//       message_type:msgType,
//       content:caption,
//       file_url:absUrl(req,relPath),   // ✅ absolute
//       file_name:file.originalname,file_size:file.size,mime_type:file.mimetype,
//       file_icon:fileIcon, // Add file icon for better UI
//       sent_at:new Date(),
//     };
    
//     const io=req.app.get('io');
//     if(io)io.to(`group_${groupId}`).emit('new_message',message);
//     await pushToMembers(io,groupId,req.user.id,message,grp?.group_name||'');
    
    
//     res.status(201).json({message});
//   }catch(e){
//     console.error('❌ File upload error:', e);
//     res.status(500).json({error:'Failed to upload file: ' + e.message});
//   }
// });

// /* DELETE message */
// router.delete('/:groupId/:messageId',auth,async(req,res)=>{
//   const[rows]=await db.query('SELECT id FROM messages WHERE id=? AND sender_id=?',[req.params.messageId,req.user.id]);
//   if(!rows.length)return res.status(403).json({error:'Cannot delete'});
//   await db.query('UPDATE messages SET is_deleted=TRUE WHERE id=?',[req.params.messageId]);
  
//   // Emit real-time message deletion to all group members
//   const io = req.app.get('io');
//   if(io){
//     io.to(`group_${req.params.groupId}`).emit('message_deleted', {
//       message_id: parseInt(req.params.messageId),
//       group_id: parseInt(req.params.groupId),
//       deleted_by: req.user.id,
//       deleted_by_name: req.user.full_name
//     });
//   }else{
//     console.log('Socket.io not available');
//   }
  
//   res.json({message:'Deleted'});
// });

// /* POST add reaction */
// router.post('/:groupId/:messageId/reaction',auth,checkMember,async(req,res)=>{
//   try{
//     const{groupId,messageId}=req.params;
//     const{emoji}=req.body;
//     if(!emoji)return res.status(400).json({error:'Emoji required'});
    
//     // Check if user already reacted
//     const[existing]=await db.query('SELECT id FROM reactions WHERE message_id=? AND user_id=?',[messageId,req.user.id]);
    
//     if(existing.length){
//       // Update existing reaction
//       await db.query('UPDATE reactions SET emoji=? WHERE message_id=? AND user_id=?',[emoji,messageId,req.user.id]);
//     }else{
//       // Add new reaction
//       await db.query('INSERT INTO reactions (message_id,user_id,emoji) VALUES(?,?,?)',[messageId,req.user.id,emoji]);
//     }
    
//     // Get updated reactions for this message
//     const[reactions]=await db.query(`
//       SELECT r.emoji, r.user_id, u.full_name AS user_name
//       FROM reactions r
//       JOIN users u ON u.id = r.user_id
//       WHERE r.message_id=?
//       ORDER BY r.created_at ASC
//     `,[messageId]);
    
//     // Emit reaction update to all group members
//     const io=req.app.get('io');
//     if(io){
//       const eventData={
//         group_id: parseInt(groupId),
//         message_id: parseInt(messageId),
//         reactions: reactions.map(r => ({
//           emoji: r.emoji,
//           user_id: r.user_id,
//           user_name: r.user_name
//         }))
//       };
//       io.to(`group_${groupId}`).emit('reaction_update', eventData);
//     }else{
//       console.log('Socket.io not available');
//     }
    
//     res.json({reactions: reactions.map(r => ({
//       emoji: r.emoji,
//       user_id: r.user_id,
//       user_name: r.user_name
//     }))});
//   }catch(e){console.error(e);res.status(500).json({error:'Failed to add reaction'});}
// });

// /* DELETE remove reaction */
// router.delete('/:groupId/:messageId/reaction',auth,checkMember,async(req,res)=>{
//   try{
//     const{groupId,messageId}=req.params;
    
//     await db.query('DELETE FROM reactions WHERE message_id=? AND user_id=?',[messageId,req.user.id]);
    
//     // Get updated reactions for this message
//     const[reactions]=await db.query(`
//       SELECT r.emoji, r.user_id, u.full_name AS user_name
//       FROM reactions r
//       JOIN users u ON u.id = r.user_id
//       WHERE r.message_id=?
//       ORDER BY r.created_at ASC
//     `,[messageId]);
    
//     // Emit reaction update to all group members
//     const io=req.app.get('io');
//     if(io){
//       const eventData={
//         group_id: parseInt(groupId),
//         message_id: parseInt(messageId),
//         reactions: reactions.map(r => ({
//           emoji: r.emoji,
//           user_id: r.user_id,
//           user_name: r.user_name
//         }))
//       };
//       io.to(`group_${groupId}`).emit('reaction_update', eventData);
//     }else{
//       console.log('Socket.io not available');
//     }
    
//     res.json({reactions: reactions.map(r => ({
//       emoji: r.emoji,
//       user_id: r.user_id,
//       user_name: r.user_name
//     }))});
//   }catch(e){console.error(e);res.status(500).json({error:'Failed to remove reaction'});}
// });

// /* GET unread message counts per group */
// router.get('/unread-counts', auth, async (req, res) => {
//   try {
//     const userId = req.user.id;

//     // Get all groups the user is a member of
//     const [groups] = await db.query(`
//       SELECT DISTINCT g.id 
//       FROM chat_groups g
//       JOIN group_members gm ON g.id = gm.group_id
//       WHERE gm.user_id = ?
//     `, [userId]);
    
//     if (groups.length === 0) {
//       return res.json({ unreadCounts: {} });
//     }
    
//     const groupIds = groups.map(g => g.id);
    
//     // Get unread message counts for each group
//     const [unreadCounts] = await db.query(`
//       SELECT 
//         m.group_id,
//         COUNT(*) as unread_count
//       FROM messages m
//       LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = ? AND ms.status = 'seen'
//       WHERE m.group_id IN (${groupIds.map(() => '?').join(',')})
//       AND m.sender_id != ?
//       AND ms.message_id IS NULL
//       AND (m.recipient_id = ? OR m.secondary_recipient_id = ?)
//       GROUP BY m.group_id
//     `, [userId, ...groupIds, userId, userId, userId]);
    
    
//     // Debug first group if available
//     if (unreadCounts.length > 0) {
//       const firstUnread = unreadCounts[0];
      
//       // Check all unread messages for this group
//       const [allUnread] = await db.query(`
//         SELECT 
//           m.id,
//           m.recipient_id,
//           m.secondary_recipient_id,
//           m.sender_id,
//           u_recipient.full_name as recipient_name,
//           u_secondary.full_name as secondary_name,
//           u_sender.full_name as sender_name
//         FROM messages m
//         LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = ? AND ms.status = 'seen'
//         LEFT JOIN users u_recipient ON u_recipient.id = m.recipient_id
//         LEFT JOIN users u_secondary ON u_secondary.id = m.secondary_recipient_id
//         LEFT JOIN users u_sender ON u_sender.id = m.sender_id
//         WHERE m.group_id = ?
//         AND m.sender_id != ?
//         AND ms.message_id IS NULL
//         ORDER BY m.sent_at DESC
//         LIMIT 5
//       `, [userId, firstUnread.group_id, userId]);
      
//       allUnread.forEach(m => {
//         const isUserRecipient = m.recipient_id === userId || m.secondary_recipient_id === userId;
//       });
//     }
    
//     // Convert to object with group_id as key
//     const countsMap = {};
//     unreadCounts.forEach(row => {
//       countsMap[row.group_id] = row.unread_count;
//     });
    
//     res.json({ unreadCounts: countsMap });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to get unread counts' });
//   }
// });

// module.exports=router;
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../utils/db');
const { auth }            = require('../middleware/auth');
const { encrypt, decrypt} = require('../utils/encryption');
const { formatISTForMySQL, getISTTimestamp } = require('../utils/timezone');
const { 
  getMessageAccessFilter, 
  getUserAssignmentInfo, 
  getAvailableRecipients,
  canUserMessageRecipient 
} = require('../utils/messageAccess');

// ── Multer: use UPLOAD_DIR set by server.js (absolute path) ──
function getUploadDir(req){ return req.app.get('UPLOAD_DIR') || path.resolve('uploads'); }

const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,getUploadDir(req)),
  filename:   (req,file,cb)=>cb(null,Date.now()+'-'+Math.random().toString(36).slice(2,9)+path.extname(file.originalname)),
});
const upload = multer({
  storage,
  limits:{ fileSize: parseInt(process.env.MAX_FILE_SIZE)||52428800 },
  fileFilter:(req,file,cb)=>{
    const ok=/jpeg|jpg|png|gif|webp|pdf|mp3|wav|ogg|webm|m4a|doc|docx|xls|xlsx|csv|txt|zip/;
    ok.test(path.extname(file.originalname).slice(1).toLowerCase())?cb(null,true):cb(new Error('File type not allowed'));
  },
});

// Returns absolute URL including protocol+host+port
function absUrl(req, rel){
  if(!rel)return null;
  if(rel.startsWith('http'))return rel;
  
  // Check if behind HTTPS proxy - multiple ways to detect HTTPS
  const forwardedProto = req.get('x-forwarded-proto');
  const forwardedSsl = req.get('x-forwarded-ssl');
  const cloudflareVisitor = req.get('cf-visitor');
  
  let protocol = req.protocol; // Default to request protocol
  
  // Check various HTTPS indicators
  if (forwardedProto === 'https') {
    protocol = 'https';
  } else if (forwardedSsl === 'on') {
    protocol = 'https';
  } else if (cloudflareVisitor && JSON.parse(cloudflareVisitor).scheme === 'https') {
    protocol = 'https';
  } else if (req.get('x-forwarded-host')) {
    // If x-forwarded-host is present, assume HTTPS in production
    protocol = 'https';
  }
  
  const host = req.get('x-forwarded-host') || req.get('host');
  const url = `${protocol}://${host}${rel}`;
  
  // Debug logging in production
  if (process.env.NODE_ENV === 'production') {
    console.log('absUrl debug:', {
      originalProtocol: req.protocol,
      forwardedProto,
      forwardedSsl,
      cloudflareVisitor,
      finalProtocol: protocol,
      host,
      finalUrl: url
    });
  }
  
  return url;
}

const checkMember=async(req,res,next)=>{
  const[rows]=await db.query('SELECT id FROM group_members WHERE group_id=? AND user_id=?',[req.params.groupId,req.user.id]);
  if(!rows.length&&req.user.role!=='admin')return res.status(403).json({error:'Not a member'});
  next();
};

async function pushToMembers(io,groupId,senderId,msg,groupName){
  try{
    // Get recipients based on To/CC fields, not all group members
    const recipients = [];
    
    // Add primary recipient (To field)
    if(msg.recipient_id && msg.recipient_id !== senderId){
      recipients.push(msg.recipient_id);
    }
    
    // Add secondary recipient (CC field)
    if(msg.secondary_recipient_id && msg.secondary_recipient_id !== senderId){
      recipients.push(msg.secondary_recipient_id);
    }
    
    // If no specific recipients, fall back to all group members (backward compatibility)
    if(recipients.length === 0){
      const[members]=await db.query('SELECT user_id FROM group_members WHERE group_id=? AND user_id!=?',[groupId,senderId]);
      recipients.push(...members.map(m => m.user_id));
    }
    
    // Remove duplicates and send notifications
    const uniqueRecipients = [...new Set(recipients)];
    
    for(const recipientId of uniqueRecipients){
      await db.query('INSERT INTO notifications (user_id,group_id,message_id,type,title,body) VALUES(?,?,?,?,?,?)',
        [recipientId,groupId,msg.id,'message',`Message from ${msg.sender_name}`,msg.content?.slice(0,100)||'Sent a file']).catch(()=>{});
      if(io){
        io.to(`user_${recipientId}`).emit('push_notification',{
          type:'message',
          title:`Message from ${msg.sender_name}`,
          body:msg.content?.slice(0,100)||'Sent a file',
          group_id:groupId,
          group_name:groupName,
          message_id:msg.id,
        });
        const[[{count}]]=await db.query('SELECT COUNT(*) as count FROM notifications WHERE user_id=? AND is_read=FALSE',[recipientId]).catch(()=>[[{count:0}]]);
        io.to(`user_${recipientId}`).emit('notification_count',{count});
      }
    }
  }catch(e){console.error('Push err:',e.message);}
}

/* GET unread message counts per group — MUST be before /:groupId to avoid route conflict */
// router.get('/unread-counts', auth, async (req, res) => {
//   try {
//     const userId = req.user.id;

//     // Get all groups the user is a member of
//     const [groups] = await db.query(`
//       SELECT DISTINCT g.id 
//       FROM chat_groups g
//       JOIN group_members gm ON g.id = gm.group_id
//       WHERE gm.user_id = ?
//     `, [userId]);

//     if (groups.length === 0) {
//       return res.json({ unreadCounts: {} });
//     }

//     const groupIds = groups.map(g => g.id);

//     // Get unread message counts for each group
// const [unreadCounts] = await db.query(`
//   SELECT 
//     m.group_id,
//     COUNT(*) as unread_count
//   FROM messages m
//   WHERE m.group_id IN (${groupIds.map(() => '?').join(',')})
//   AND (
//     m.recipient_id = ?
//     OR m.secondary_recipient_id = ?
//   )
//   AND m.sender_id != ?
//   AND NOT EXISTS (
//     SELECT 1 
//     FROM message_status ms
//     WHERE ms.message_id = m.id
//     AND ms.user_id = ?
//     AND ms.status = 'seen'
//   )
//   GROUP BY m.group_id
// `, [...groupIds, userId, userId, userId, userId]);
//     // Convert to object with group_id as key
//     const countsMap = {};
//     unreadCounts.forEach(row => {
//       countsMap[row.group_id] = row.unread_count;
//     });

//     res.json({ unreadCounts: countsMap });
//   } catch (error) {
//     console.error('Failed to get unread counts:', error);
//     res.status(500).json({ error: 'Failed to get unread counts' });
//   }
// });
// router.get('/unread-counts', auth, async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const DEBUG = true; // 🔥 toggle this when needed

//     if (DEBUG) {
//       console.log("========== UNREAD COUNT API START ==========");
//       console.log("USER ID:", userId);
//     }

//     // Prevent caching (VERY IMPORTANT)
//     res.set('Cache-Control', 'no-store');

//     // Step 1: Get user groups
//     const [groups] = await db.query(`
//       SELECT gm.group_id AS id
//       FROM group_members gm
//       WHERE gm.user_id = ?
//     `, [userId]);

//     if (!groups.length) {
//       if (DEBUG) console.log("No groups found");
//       return res.json({ unreadCounts: {} });
//     }

//     const groupIds = groups.map(g => g.id);

//     if (DEBUG) console.log("GROUP IDS:", groupIds);

//     // Step 2: Main unread count query (optimized)
//     const placeholders = groupIds.map(() => '?').join(',');

//     const query = `
//       SELECT 
//         m.group_id,
//         COUNT(*) AS unread_count
//       FROM messages m
//       WHERE m.group_id IN (${placeholders})
//       AND (
//         m.recipient_id = ?
//         OR m.secondary_recipient_id = ?
//       )
//       AND m.sender_id != ?
//       AND NOT EXISTS (
//         SELECT 1 
//         FROM message_status ms
//         WHERE ms.message_id = m.id
//         AND ms.user_id = ?
//         AND ms.status = 'seen'
//       )
//       GROUP BY m.group_id
//     `;

//     const params = [...groupIds, userId, userId, userId, userId];

//     if (DEBUG) {
//       console.log("QUERY:", query);
//       console.log("PARAMS:", params);
//     }

//     const [rows] = await db.query(query, params);

//     if (DEBUG) console.log("RAW RESULT:", rows);

//     // Step 3: Convert to map
//     const unreadCounts = {};
//     rows.forEach(row => {
//       unreadCounts[row.group_id] = row.unread_count;
//     });

//     if (DEBUG) {
//       console.log("FINAL MAP:", unreadCounts);
//       console.log("========== END ==========");
//     }

//     return res.json({ unreadCounts });

//   } catch (error) {
//     console.error('❌ Failed to get unread counts:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to get unread counts'
//     });
//   }
// });

router.get('/unread-counts', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const DEBUG = false;

    // if (DEBUG) {
    //   console.log("========== UNREAD COUNT API START ==========");
    //   console.log("USER ID:", userId);
    // }

    // 🔥 Prevent caching
    res.set('Cache-Control', 'no-store');

    // Step 1: Get user groups
    const [groups] = await db.query(`
      SELECT gm.group_id AS id
      FROM group_members gm
      WHERE gm.user_id = ?
    `, [userId]);

    if (!groups.length) {
      if (DEBUG) console.log("No groups found");
      return res.json({ unreadCounts: {} });
    }

    const groupIds = groups.map(g => g.id);
    const placeholders = groupIds.map(() => '?').join(',');

    // if (DEBUG) console.log("GROUP IDS:", groupIds);

    // 🚀 UPDATED QUERY
    const query = `
      SELECT 
        m.group_id,
        COUNT(*) AS unread_count
      FROM messages m
      WHERE m.group_id IN (${placeholders})

      -- ✅ NEW LOGIC
      AND (
        m.message_type = 'task_notification'
        OR m.recipient_id = ?
        OR m.secondary_recipient_id = ?
      )

      AND m.sender_id != ?

      AND NOT EXISTS (
        SELECT 1 
        FROM message_status ms
        WHERE ms.message_id = m.id
        AND ms.user_id = ?
        AND ms.status = 'seen'
      )

      GROUP BY m.group_id
    `;

    const params = [...groupIds, userId, userId, userId, userId];

    if (DEBUG) {
      console.log("QUERY:", query);
      console.log("PARAMS:", params);
    }

    const [rows] = await db.query(query, params);

    // if (DEBUG) console.log("RAW RESULT:", rows);

    // Step 3: Convert to map
    const unreadCounts = {};
    rows.forEach(row => {
      unreadCounts[row.group_id] = row.unread_count;
    });

    // if (DEBUG) {
    //   console.log("FINAL MAP:", unreadCounts);
    //   console.log("========== END ==========");
    // }

    return res.json({ unreadCounts });

  } catch (error) {
    console.error('❌ Failed to get unread counts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get unread counts'
    });
  }
});

/* GET /api/messages/:groupId */
router.get('/:groupId',auth,checkMember,async(req,res)=>{
  try{
    const{groupId}=req.params;
    const page =Math.max(1,parseInt(req.query.page)||1);
    const limit=Math.min(100,parseInt(req.query.limit)||50);
    const[rows]=await db.query(`
      SELECT m.id,m.group_id,m.message_type,m.encrypted_content,m.iv,
             m.file_url,m.file_name,m.file_size,m.mime_type,
             m.reply_to_id,m.is_deleted,m.sent_at,m.task_ref_id,
             u.id AS sender_id,u.full_name AS sender_name,u.username,u.role AS sender_role,
             rm.encrypted_content AS reply_encrypted,rm.iv AS reply_iv,
             ru.full_name AS reply_sender_name,
             t.title AS task_title,t.task_type AS task_type_ref
      FROM messages m
      JOIN users u ON u.id=m.sender_id
      LEFT JOIN messages rm ON rm.id=m.reply_to_id
      LEFT JOIN users ru ON ru.id=rm.sender_id
      LEFT JOIN tasks t ON t.id=m.task_ref_id
      WHERE m.group_id=?
      ORDER BY m.sent_at DESC
      LIMIT ? OFFSET ?
    `,[groupId,limit,(page-1)*limit]);

    // Get reactions for all messages
    const messageIds = rows.map(m => m.id);
    let reactions = [];
    if (messageIds.length > 0) {
      const [reactionRows] = await db.query(`
        SELECT r.message_id, r.user_id, r.emoji, u.full_name AS user_name
        FROM reactions r
        JOIN users u ON u.id = r.user_id
        WHERE r.message_id IN (${messageIds.map(() => '?').join(',')})
        ORDER BY r.created_at ASC
      `, messageIds);
      reactions = reactionRows;
    }

    const messages=rows.reverse().map(msg=>({
      id:msg.id,
      group_id:Number(msg.group_id),
      message_type:msg.message_type,
      content:msg.is_deleted?'This message was deleted':decrypt(msg.encrypted_content,msg.iv),
      // ✅ absolute URL so frontend uses it verbatim
      file_url:absUrl(req,msg.file_url),
      file_name:msg.file_name,
      file_size:msg.file_size,
      mime_type:msg.mime_type,
      reply_to_id:msg.reply_to_id,
      reply_content:msg.reply_encrypted?decrypt(msg.reply_encrypted,msg.reply_iv):null,
      reply_sender_name:msg.reply_sender_name,
      is_deleted:msg.is_deleted,
      sent_at:msg.sent_at,
      sender_id:msg.sender_id,
      sender_name:msg.sender_name,
      username:msg.username,
      sender_role:msg.sender_role,
      task_ref:msg.task_ref_id?{task_id:msg.task_ref_id,task_title:msg.task_title,task_type:msg.task_type_ref}:null,
      reactions: reactions.filter(r => r.message_id === msg.id).map(r => ({
        emoji: r.emoji,
        user_id: r.user_id,
        user_name: r.user_name
      }))
    }));

    rows.forEach(m=>db.query('INSERT IGNORE INTO message_status (message_id,user_id,status) VALUES(?,?,?)',[m.id,req.user.id,'seen']).catch(()=>{}));
    res.json({messages,page,hasMore:rows.length===limit});
  }catch(e){console.error(e);res.status(500).json({error:'Failed to load messages'});}
});

/* POST send text or forwarded message */
router.post('/:groupId',auth,checkMember,async(req,res)=>{
  try{
    const{groupId}=req.params;
    const{
      content,
      reply_to_id,
      message_type='text',
      file_url,
      file_name,
      file_size,
      mime_type,
      recipient_id, // 🔒 REQUIRED: Primary recipient
      secondary_recipient_id // 🔧 OPTIONAL: Secondary recipient (manager)
    }=req.body;
    
    // 🔒 CORE RULE: User must select a recipient
    if (!recipient_id) {
      return res.status(400).json({ 
        error: 'Recipient is required. Please select a user to send this message to.' 
      });
    }
    
    // 🔍 Get CRM database connection
    const crmDb = db.crmPool;
    if (!crmDb) {
      return res.status(500).json({ error: 'CRM database not available' });
    }
    
    // 🔍 Validate recipient exists and is in same group
    const [recipientCheck] = await db.query(`
      SELECT gm.user_id, u.full_name 
      FROM group_members gm 
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ? AND gm.user_id = ?
    `, [groupId, recipient_id]);
    
    if (recipientCheck.length === 0) {
      return res.status(400).json({ 
        error: 'Selected recipient is not a member of this group.' 
      });
    }
    
    // 🔍 Validate secondary recipient if provided
    let secondaryRecipientInfo = null;
    if (secondary_recipient_id) {
      const [secondaryCheck] = await db.query(`
        SELECT gm.user_id, u.full_name 
        FROM group_members gm 
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ? AND gm.user_id = ?
      `, [groupId, secondary_recipient_id]);
      
      if (secondaryCheck.length === 0) {
        return res.status(400).json({ 
          error: 'Secondary recipient is not a member of this group.' 
        });
      }
      
      secondaryRecipientInfo = secondaryCheck[0];
    }
    
    // 🎯 Build recipient names for message content
    const primaryRecipientName = recipientCheck[0].full_name;
    let recipientNames = primaryRecipientName;
    
    if (secondaryRecipientInfo) {
      recipientNames += ` & ${secondaryRecipientInfo.full_name}`;
    }
    
    // 📝 Modify content to include recipient names
    const modifiedContent = `📤 To ${recipientNames}: ${content}`;
    
    // 🚀 SEND SINGLE MESSAGE (no duplicates)
    if(!content?.trim())return res.status(400).json({error:'Content required'});
    
    const{encrypted,iv}=encrypt(modifiedContent);
    const[r]=await db.query(
      'INSERT INTO messages (group_id,sender_id,recipient_id,secondary_recipient_id,message_type,encrypted_content,iv,reply_to_id) VALUES(?,?,?,?,?,?,?,?)',
      [groupId,req.user.id,recipient_id,secondary_recipient_id||null,message_type,encrypted,iv,reply_to_id||null]
    );
    
    const[[grp]]=await db.query('SELECT group_name FROM chat_groups WHERE id=?',[groupId]).catch(()=>[[{}]]);
    
    // Fetch reply data if this is a reply
    let replyData = null;
    if(reply_to_id) {
      const[[replyMsg]] = await db.query(`
        SELECT m.encrypted_content, m.iv, u.full_name as sender_name
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.id = ? AND m.is_deleted = false
      `, [reply_to_id]);
      
      if(replyMsg) {
        replyData = {
          reply_content: decrypt(replyMsg.encrypted_content, replyMsg.iv),
          reply_sender_name: replyMsg.sender_name
        };
      }
    }
    
    // 🎯 Create single message object
    const message={
      id:r.insertId,group_id:Number(groupId),
      sender_id:req.user.id,sender_name:req.user.full_name,
      recipient_id: Number(recipient_id),
      secondary_recipient_id: secondary_recipient_id ? Number(secondary_recipient_id) : null,
      username:req.user.username,sender_role:req.user.role,
      message_type,content:modifiedContent,reply_to_id:reply_to_id||null,
      ...replyData,
      is_deleted:false,sent_at:formatISTForMySQL(),
    };
    
    // 🚀 Emit single message to all group members
    const io=req.app.get('io');
    if(io)io.to(`group_${groupId}`).emit('new_message',message);
    await pushToMembers(io,groupId,req.user.id,message,grp?.group_name||'');
    res.status(201).json({message});
  }catch(e){console.error(e);res.status(500).json({error:'Failed to send'});}
});

/* GET available recipients for group */
router.get('/:groupId/recipients', auth, checkMember, async (req, res) => {
  try {
    const { groupId } = req.params;
    const crmDb = db.crmPool;
    
    if (!crmDb) {
      return res.status(500).json({ error: 'CRM database not available' });
    }
    
    // Get available recipients based on hierarchy
    const recipients = await getAvailableRecipients(crmDb, db, groupId, req.user.id);
    
    res.json({ recipients });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get recipients' });
  }
});

/* GET assignment info for a specific recipient */
router.get('/:groupId/assignment/:recipientId', auth, checkMember, async (req, res) => {
  try {
    const { groupId, recipientId } = req.params;
    const crmDb = db.crmPool;
    
    if (!crmDb) {
      return res.status(500).json({ error: 'CRM database not available' });
    }
    
    // Get assignment info for the recipient
    const assignmentInfo = await getUserAssignmentInfo(crmDb, db, req.user.id, recipientId);
    
    res.json(assignmentInfo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get assignment info' });
  }
});

/* POST upload file */
router.post('/:groupId/upload',auth,checkMember,upload.single('file'),async(req,res)=>{
  try{
    const{groupId}=req.params;
    const file=req.file;
    if(!file)return res.status(400).json({error:'No file uploaded'});
    
    // Enhanced file type detection
    const relPath=`/uploads/${file.filename}`;
    let msgType='file';
    let fileIcon='📄';
    
    if(file.mimetype.startsWith('image/')){
      msgType='image';
      fileIcon='🖼️';
    }
    else if(file.mimetype.startsWith('audio/')){
      msgType='audio';
      fileIcon='🎵';
    }
    else if(file.mimetype.startsWith('video/')){
      msgType='video';
      fileIcon='🎬';
    }
    else if(file.mimetype.includes('pdf')){
      fileIcon='📕';
    }
    else if(file.mimetype.includes('word') || file.mimetype.includes('document')){
      fileIcon='📝';
    }
    else if(file.mimetype.includes('sheet') || file.mimetype.includes('excel')){
      fileIcon='📊';
    }
    else if(file.mimetype.includes('zip') || file.mimetype.includes('compressed')){
      fileIcon='🗜️';
    }
    else if(file.mimetype.includes('presentation') || file.mimetype.includes('powerpoint')){
      fileIcon='📽️';
    }
    else if(file.mimetype.includes('text')){
      fileIcon='📄';
    }
    
    // Use caption from request or fallback to filename
    const caption = req.body.caption || file.originalname;
    const{encrypted,iv}=encrypt(caption);
    
    const[r]=await db.query(
      'INSERT INTO messages (group_id,sender_id,message_type,encrypted_content,iv,file_url,file_name,file_size,mime_type) VALUES(?,?,?,?,?,?,?,?,?)',
      [groupId,req.user.id,msgType,encrypted,iv,relPath,file.originalname,file.size,file.mimetype]
    );
    
    const[[grp]]=await db.query('SELECT group_name FROM chat_groups WHERE id=?',[groupId]).catch(()=>[[{}]]);
    const message={
      id:r.insertId,group_id:Number(groupId),
      sender_id:req.user.id,sender_name:req.user.full_name,
      username:req.user.username,sender_role:req.user.role,
      message_type:msgType,
      content:caption,
      file_url:absUrl(req,relPath),   // absolute
      file_name:file.originalname,file_size:file.size,mime_type:file.mimetype,
      file_icon:fileIcon, // Add file icon for better UI
      sent_at:formatISTForMySQL(),
    };
    
    const io=req.app.get('io');
    if(io)io.to(`group_${groupId}`).emit('new_message',message);
    await pushToMembers(io,groupId,req.user.id,message,grp?.group_name||'');
    
    
    res.status(201).json({message});
  }catch(e){
    console.error('❌ File upload error:', e);
    res.status(500).json({error:'Failed to upload file: ' + e.message});
  }
});

/* DELETE message */
router.delete('/:groupId/:messageId',auth,async(req,res)=>{
  const[rows]=await db.query('SELECT id FROM messages WHERE id=? AND sender_id=?',[req.params.messageId,req.user.id]);
  if(!rows.length)return res.status(403).json({error:'Cannot delete'});
  await db.query('UPDATE messages SET is_deleted=TRUE WHERE id=?',[req.params.messageId]);
  
  // Emit real-time message deletion to all group members
  const io = req.app.get('io');
  if(io){
    io.to(`group_${req.params.groupId}`).emit('message_deleted', {
      message_id: parseInt(req.params.messageId),
      group_id: parseInt(req.params.groupId),
      deleted_by: req.user.id,
      deleted_by_name: req.user.full_name
    });
  }else{
    console.log('Socket.io not available');
  }
  
  res.json({message:'Deleted'});
});

/* POST add reaction */
router.post('/:groupId/:messageId/reaction',auth,checkMember,async(req,res)=>{
  try{
    const{groupId,messageId}=req.params;
    const{emoji}=req.body;
    if(!emoji)return res.status(400).json({error:'Emoji required'});
    
    // Check if user already reacted
    const[existing]=await db.query('SELECT id FROM reactions WHERE message_id=? AND user_id=?',[messageId,req.user.id]);
    
    if(existing.length){
      // Update existing reaction
      await db.query('UPDATE reactions SET emoji=? WHERE message_id=? AND user_id=?',[emoji,messageId,req.user.id]);
    }else{
      // Add new reaction
      await db.query('INSERT INTO reactions (message_id,user_id,emoji) VALUES(?,?,?)',[messageId,req.user.id,emoji]);
    }
    
    // Get updated reactions for this message
    const[reactions]=await db.query(`
      SELECT r.emoji, r.user_id, u.full_name AS user_name
      FROM reactions r
      JOIN users u ON u.id = r.user_id
      WHERE r.message_id=?
      ORDER BY r.created_at ASC
    `,[messageId]);
    
    // Emit reaction update to all group members
    const io=req.app.get('io');
    if(io){
      const eventData={
        group_id: parseInt(groupId),
        message_id: parseInt(messageId),
        reactions: reactions.map(r => ({
          emoji: r.emoji,
          user_id: r.user_id,
          user_name: r.user_name
        }))
      };
      io.to(`group_${groupId}`).emit('reaction_update', eventData);
    }else{
      console.log('Socket.io not available');
    }
    
    res.json({reactions: reactions.map(r => ({
      emoji: r.emoji,
      user_id: r.user_id,
      user_name: r.user_name
    }))});
  }catch(e){console.error(e);res.status(500).json({error:'Failed to add reaction'});}
});

/* DELETE remove reaction */
router.delete('/:groupId/:messageId/reaction',auth,checkMember,async(req,res)=>{
  try{
    const{groupId,messageId}=req.params;
    
    await db.query('DELETE FROM reactions WHERE message_id=? AND user_id=?',[messageId,req.user.id]);
    
    // Get updated reactions for this message
    const[reactions]=await db.query(`
      SELECT r.emoji, r.user_id, u.full_name AS user_name
      FROM reactions r
      JOIN users u ON u.id = r.user_id
      WHERE r.message_id=?
      ORDER BY r.created_at ASC
    `,[messageId]);
    
    // Emit reaction update to all group members
    const io=req.app.get('io');
    if(io){
      const eventData={
        group_id: parseInt(groupId),
        message_id: parseInt(messageId),
        reactions: reactions.map(r => ({
          emoji: r.emoji,
          user_id: r.user_id,
          user_name: r.user_name
        }))
      };
      io.to(`group_${groupId}`).emit('reaction_update', eventData);
    }else{
      console.log('Socket.io not available');
    }
    
    res.json({reactions: reactions.map(r => ({
      emoji: r.emoji,
      user_id: r.user_id,
      user_name: r.user_name
    }))});
  }catch(e){console.error(e);res.status(500).json({error:'Failed to remove reaction'});}
});

module.exports=router;
