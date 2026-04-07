# 📧 Message System with User Assignment - Complete Implementation

## 🎯 Overview

This implementation provides a robust message system with mandatory recipient selection and hierarchical user assignment support. The system ensures that users cannot send messages without selecting a specific recipient and provides optional secondary recipient routing based on manager-subordinate relationships.

## 🔒 Core Rules

### ❌ Mandatory Recipient Selection
- **Users cannot send messages without selecting a recipient**
- Recipient selection is required for all message types (text, files, replies)
- System validates recipient permissions before sending

### ✅ User Assignment Flow
1. **Direct Messaging Required**: Sender must write message + select specific recipient
2. **Hierarchy-Based Assignment**: System checks manager-subordinate relationships
3. **Optional Secondary Routing**: If recipient is assigned to manager, show secondary option

## 🏗️ Architecture

### Backend Components

#### 1. **messageAccess.js** - User Assignment Logic
```javascript
// Core functions:
- getMessageAccessFilter() // Get user's message access based on role
- getUserAssignmentInfo() // Check if user has manager assignment
- getAvailableRecipients() // Get users current user can message
- canUserMessageRecipient() // Validate messaging permissions
```

#### 2. **messages.js** - Updated API Endpoints
```javascript
// Updated endpoints:
POST /:groupId                // Send message (requires recipient_id)
GET /:groupId/recipients      // Get available recipients
GET /:groupId/assignment/:id  // Get assignment info for recipient
```

#### 3. **Database Schema Updates**
```sql
-- New fields in messages table:
recipient_id INT NULL           // Primary recipient (required)
secondary_recipient_id INT NULL // Secondary recipient (optional)
```

### Frontend Components

#### 1. **MessageSender.jsx** - Message Composition UI
- Mandatory recipient selection dropdown
- Dynamic secondary recipient option
- Real-time assignment info loading
- Form validation and error handling

#### 2. **API Integration**
```javascript
// New API methods:
messagesAPI.getRecipients(groupId)
messagesAPI.getAssignmentInfo(groupId, recipientId)
```

## 🔄 User Flow Scenarios

### ✅ Case 1: User NOT assigned to anyone
**Example**: Monika has no manager

👉 **Flow**:
1. User selects Monika from recipient dropdown
2. System shows "Direct message to recipient" status
3. User sends message directly to Monika ✅

### ✅ Case 2: User IS assigned to manager
**Example**: Monika → assigned to Atique

👉 **Flow**:
1. User selects Monika from recipient dropdown
2. System detects assignment and shows secondary option:
   - "Also notify via: Atique (Manager)" (optional)
3. User can:
   - Send only to Monika ✅
   - Send to Monika + Atique ✅

## 🔐 Permission Matrix

| User Role | Can Message | Secondary Recipients | Notes |
|------------|-------------|---------------------|--------|
| **admin** | Anyone | N/A | Full access to all users |
| **advertiser_manager** | Sub-admins, same role | N/A | Can message assigned sub-admins |
| **publisher_manager** | Sub-admins, same role | N/A | Can message assigned sub-admins |
| **advertiser** | Managers, same role | Managers | Can message assigned managers |
| **publisher** | Managers, same role | Managers | Can message assigned managers |

## 📊 Database Relationships

### manager_subadmins Table
```sql
CREATE TABLE manager_subadmins (
  manager_id INT,      -- Manager user ID
  sub_admin_id INT,    -- Subordinate user ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Messages Table (Updated)
```sql
CREATE TABLE messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT,
  sender_id INT,
  recipient_id INT,              -- 🆕 Primary recipient (required)
  secondary_recipient_id INT,    -- 🆕 Secondary recipient (optional)
  message_type ENUM('text','file','image','audio'),
  encrypted_content TEXT,
  iv VARCHAR(32),
  file_url VARCHAR(500),
  file_name VARCHAR(255),
  file_size INT,
  mime_type VARCHAR(100),
  reply_to_id INT,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 🎨 UI Components

### MessageSender Component Features
- **📧 Recipient Selection**: Required dropdown with available users
- **🔗 Secondary Option**: Dynamic manager routing option
- **✍️ Message Input**: Rich text area with validation
- **📊 Status Indicators**: Direct vs. assigned messaging status
- **🔄 Real-time Updates**: Live assignment info loading

### CSS Styling
- Modern, responsive design
- Dark mode support
- Smooth animations
- Accessibility features
- Mobile-optimized layout

## 🔧 API Endpoints

### Send Message
```http
POST /api/messages/:groupId
Content-Type: application/json

{
  "content": "Hello!",
  "recipient_id": 123,                    // Required
  "secondary_recipient_id": 456,         // Optional
  "reply_to_id": 789                     // Optional
}
```

### Get Recipients
```http
GET /api/messages/:groupId/recipients

Response:
{
  "recipients": [
    {
      "user_id": 123,
      "full_name": "John Doe",
      "role": "advertiser",
      "crm_role": "advertiser"
    }
  ]
}
```

### Get Assignment Info
```http
GET /api/messages/:groupId/assignment/:recipientId

Response:
{
  "isAssigned": true,
  "secondaryUsers": [
    {
      "id": 456,
      "full_name": "Jane Manager",
      "role": "advertiser_manager"
    }
  ]
}
```

## 🚀 Implementation Steps

### 1. Database Migration
```bash
# Run the migration script
mysql -u username -p database_name < backend/migrations/add_message_recipients.sql
```

### 2. Backend Setup
- ✅ messageAccess.js utility created
- ✅ messages.js endpoints updated
- ✅ API integration complete

### 3. Frontend Integration
- ✅ MessageSender component created
- ✅ API methods added
- ✅ CSS styling complete

### 4. Testing Checklist
- [ ] Recipient selection validation
- [ ] Assignment detection
- [ ] Secondary recipient option
- [ ] Permission validation
- [ ] Error handling
- [ ] Real-time updates
- [ ] Mobile responsiveness

## 🔍 Error Handling

### Common Errors
1. **Recipient Required**: `400 - Recipient is required`
2. **Permission Denied**: `403 - You do not have permission to send messages to this user`
3. **Invalid Secondary**: `400 - Invalid secondary recipient. Must be the manager of the primary recipient`
4. **CRM Unavailable**: `500 - CRM database not available`

### Frontend Validation
- Required field validation
- Real-time permission checking
- User-friendly error messages
- Loading states and feedback

## 📱 Mobile Considerations

- Responsive design for all screen sizes
- Touch-friendly interface elements
- Optimized dropdown selects
- Proper keyboard handling
- Accessible form controls

## 🔒 Security Features

- JWT authentication required
- Role-based access control
- SQL injection prevention
- Input validation and sanitization
- Permission-based message routing

## 🎯 Future Enhancements

1. **Message Templates**: Pre-defined message templates
2. **Bulk Messaging**: Send to multiple recipients
3. **Message Scheduling**: Schedule messages for later
4. **Read Receipts**: Track message read status
5. **Message Search**: Advanced search capabilities
6. **File Sharing**: Enhanced file sharing with preview

## 📞 Support

For issues or questions regarding the message system implementation:
1. Check browser console for JavaScript errors
2. Verify database migration completed successfully
3. Ensure CRM database connection is working
4. Validate user roles and assignments in CRM
5. Check API responses in network tab

---

**🎉 Implementation Complete!** 

The message system now supports mandatory recipient selection with hierarchical user assignment, providing a robust and user-friendly communication platform.
