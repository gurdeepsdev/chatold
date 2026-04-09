import React, { useState } from 'react';
import { format } from 'date-fns';
import { TASK_TYPES } from './TasksPanel';

export default function TaskDetailsModal({ task, onClose, currentUser, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [taskDetails, setTaskDetails] = useState(null);
  const [response, setResponse] = useState('');
  const [responding, setResponding] = useState(false);

  // File download utility function
  const getFileDownloadUrl = (attachmentUrl) => {
    if (!attachmentUrl) return '#';
    
    console.log('getFileDownloadUrl - attachmentUrl:', attachmentUrl);
    
    // If it's already a full URL, return as-is
    if (attachmentUrl.startsWith('http')) {
      return attachmentUrl;
    }
    
    // If it's already a relative path starting with /uploads/, use direct URL
    if (attachmentUrl.startsWith('/uploads/')) {
      const fullUrl = `${process.env.REACT_APP_API_URL}${attachmentUrl}`;
      console.log('getFileDownloadUrl - fullUrl:', fullUrl);
      return fullUrl;
    }
    
    // For backward compatibility with old format (just filename)
    const fileName = attachmentUrl.split('/').pop();
    const encodedFileName = encodeURIComponent(fileName);
    const fullUrl = `${process.env.REACT_APP_API_URL}/uploads/${encodedFileName}`;
    console.log('getFileDownloadUrl - extracted fileName:', fileName);
    console.log('getFileDownloadUrl - fullUrl:', fullUrl);
    return fullUrl;
  };

  // Simple file download function - direct URL like chat
  const handleFileDownload = async (attachmentUrl, attachmentName) => {
    try {
      const downloadUrl = getFileDownloadUrl(attachmentUrl);
      if (downloadUrl === '#') return;

      console.log('Downloading file from:', downloadUrl);
      
      // Create download link for direct URL (like chat system)
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = attachmentName || 'attachment';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('File download initiated');
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  if (!task) return null;
  console.log('TaskDetailsModal - Full task data:', task);
  console.log('TaskDetailsModal - subTasks:', task.subTasks);
  console.log('TaskDetailsModal - task keys:', Object.keys(task));
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        padding: '24px',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '4px',
            borderRadius: '4px'
          }}
        >
          ✕
        </button>

        {/* Loading State */}
        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: 'var(--text-muted)',
            fontSize: '14px'
          }}>
            Loading task details...
          </div>
        ) : (
          <>
            {/* Task Header */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '24px' }}>
                  {TASK_TYPES[task.task_type]?.icon || '📋'}
                </span>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                    {TASK_TYPES[task.task_type]?.label || task.task_type}
                  </h3>
                  <div style={{ 
                    fontSize: '12px', 
                    color: 'var(--text-secondary)', 
                    marginTop: '4px' 
                  }}>
                    Created: {format(new Date(task.created_at), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div style={{ display: 'inline-block' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  background: task.status === 'pending' ? '#f59e0b20' :
                             task.status === 'accepted' ? '#4f7dff20' :
                             task.status === 'completed' ? '#22c55e20' : '#ef444420',
                  color: task.status === 'pending' ? '#f59e0b' :
                          task.status === 'accepted' ? '#4f7dff' :
                          task.status === 'completed' ? '#22c55e' : '#ef4444',
                  border: `1px solid ${
                    task.status === 'pending' ? '#f59e0b' :
                    task.status === 'accepted' ? '#4f7dff' :
                    task.status === 'completed' ? '#22c55e' : '#ef4444'
                  }`
                }}>
                  {task.status}
                </span>
              </div>
            </div>

            {/* Task Description */}
            {task.description && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
                  Description
                </h4>
                <p style={{ 
                  margin: 0, 
                  fontSize: '13px', 
                  lineHeight: 1.5, 
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-secondary)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)'
                }}>
                  {task.description}
                </p>
              </div>
            )}

            {/* Sub-tasks */}
            {task.subTasks && task.subTasks.length > 0 ? (
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
                  Task Details ({task.subTasks.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {task.subTasks.map((subTask, index) => (
                    <div key={subTask.id} style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '12px'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>
                        Entry #{index + 1}
                      </div>
                      
                      {/* Show sub-task details based on task type */}
                      {task.task_type === 'share_link' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
                          <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PubID</div>
                            <div style={{ color: 'var(--text-primary)' }}>{subTask.pub_id || '-'}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PID</div>
                            <div style={{ color: 'var(--text-primary)' }}>{subTask.pid || '-'}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>GEO</div>
                            <div style={{ color: 'var(--text-primary)' }}>{subTask.geo || '-'}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Link</div>
                            <div style={{ 
                              color: 'var(--text-primary)', 
                              wordBreak: 'break-all',
                              maxWidth: '200px'
                            }}>
                              {subTask.link ? (
                                <a href={subTask.link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                                  {subTask.link}
                                </a>
                              ) : '-'}
                            </div>
                          </div>
                        </div>
                      )}

                      {task.task_type === 'optimise' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', fontSize: '12px' }}>
                          {subTask.pub_id && (
                            <div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PubID</div>
                              <div style={{ color: 'var(--text-primary)' }}>{subTask.pub_id}</div>
                            </div>
                          )}
                          {subTask.pid && (
                            <div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PID</div>
                              <div style={{ color: 'var(--text-primary)' }}>{subTask.pid}</div>
                            </div>
                          )}
                          {subTask.fp && (
                            <div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>FP</div>
                              <div style={{ color: 'var(--text-primary)' }}>{subTask.fp}</div>
                            </div>
                          )}
                          {subTask.f1 && (
                            <div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>F1</div>
                              <div style={{ color: 'var(--text-primary)' }}>{subTask.f1}</div>
                            </div>
                          )}
                          {subTask.f2 && (
                            <div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>F2</div>
                              <div style={{ color: 'var(--text-primary)' }}>{subTask.f2}</div>
                            </div>
                          )}
                          {subTask.optimise_scenario && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Scenario</div>
                              <div style={{ color: 'var(--text-primary)' }}>{subTask.optimise_scenario}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {task.task_type === 'pause_pid' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
                          <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PubID</div>
                            <div style={{ color: 'var(--text-primary)' }}>{subTask.pub_id || '-'}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PID</div>
                            <div style={{ color: 'var(--text-primary)' }}>{subTask.pid || '-'}</div>
                          </div>
                           <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>GEO</div>
                            <div style={{ color: 'var(--text-primary)' }}>{subTask.geo || '-'}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Reason</div>
                            <div style={{ color: 'var(--text-primary)' }}>{subTask.pause_reason || '-'}</div>
                          </div>
                        </div>
                      )}

                      {task.task_type === 'raise_request' && (
                        <div style={{ fontSize: '12px' }}>
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Request Type</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, textTransform: 'uppercase' }}>
                              {subTask.request_type || '-'}
                            </div>
                          </div>
                          {subTask.request_details && (
                            <div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Details</div>
                              <div style={{ color: 'var(--text-primary)' }}>{subTask.request_details}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Attachments for this sub-task */}
                      {subTask.attachment_url && (
                        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>Attachment</div>
                          <button
                            onClick={() => handleFileDownload(subTask.attachment_url, subTask.attachment_name)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: 'var(--accent)',
                              fontSize: '11px',
                              marginTop: '4px',
                              textDecoration: 'none',
                              background: 'var(--bg-primary)',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              cursor: 'pointer'
                            }}
                          >
                            <span>Download</span>
                            <span> {subTask.attachment_name || 'File'} </span>
                            <span>...</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Fallback: Show task-specific fields when subTasks are not available */
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
                  Task Details
                </h4>
                <div style={{ 
                  background: 'var(--bg-secondary)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '8px', 
                  padding: '12px'
                }}>
                  {/* Display task-specific fields */}
                  {task.task_type === 'share_link' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PubID</div>
                        <div style={{ color: 'var(--text-primary)' }}>{task.pub_id || '-'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PID</div>
                        <div style={{ color: 'var(--text-primary)' }}>{task.pid || '-'}</div>
                      </div>
                       <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>GEO</div>
                            <div style={{ color: 'var(--text-primary)' }}>{task.geo || '-'}</div>
                          </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Link</div>
                        <div style={{ 
                          color: 'var(--text-primary)', 
                          wordBreak: 'break-all',
                          maxWidth: '200px'
                        }}>
                          {task.link ? (
                            <a href={task.link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                              {task.link}
                            </a>
                          ) : '-'}
                        </div>
                      </div>
                         
                      {task.note && (
                        <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Note</div>
                          <div style={{ color: 'var(--text-primary)' }}>{task.note}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {task.task_type === 'optimise' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', fontSize: '12px' }}>
                      {task.pub_id && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PubID</div>
                          <div style={{ color: 'var(--text-primary)' }}>{task.pub_id}</div>
                        </div>
                      )}
                      {task.pid && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PID</div>
                          <div style={{ color: 'var(--text-primary)' }}>{task.pid}</div>
                        </div>
                      )}
                      {task.fp && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>FP</div>
                          <div style={{ color: 'var(--text-primary)' }}>{task.fp}</div>
                        </div>
                      )}
                      {task.fa && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>FA</div>
                          <div style={{ color: 'var(--text-primary)' }}>{task.fa}</div>
                        </div>
                      )}
                      {task.f1 && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>F1</div>
                          <div style={{ color: 'var(--text-primary)' }}>{task.f1}</div>
                        </div>
                      )}
                      {task.f2 && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>F2</div>
                          <div style={{ color: 'var(--text-primary)' }}>{task.f2}</div>
                        </div>
                      )}
                      {task.optimise_scenario && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Scenario</div>
                          <div style={{ color: 'var(--text-primary)' }}>{task.optimise_scenario}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {task.task_type === 'pause_pid' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PubID</div>
                        <div style={{ color: 'var(--text-primary)' }}>{task.pub_id || '-'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>PID</div>
                        <div style={{ color: 'var(--text-primary)' }}>{task.pid || '-'}</div>
                      </div>
                       <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>GEO</div>
                            <div style={{ color: 'var(--text-primary)' }}>{task.geo || '-'}</div>
                          </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Reason</div>
                        <div style={{ color: 'var(--text-primary)' }}>{task.pause_reason || '-'}</div>
                      </div>
                    </div>
                  )}

                  {task.task_type === 'raise_request' && (
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Request Type</div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500, textTransform: 'uppercase' }}>
                          {task.request_type || '-'}
                        </div>
                      </div>
                      {task.request_details && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Details</div>
                          <div style={{ color: 'var(--text-primary)' }}>{task.request_details}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Attachment for the main task */}
                  {task.attachment_url && (
                    <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>Attachment</div>
                      <button
                        onClick={() => handleFileDownload(task.attachment_url, task.attachment_name)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--accent)',
                          fontSize: '11px',
                          marginTop: '4px',
                          textDecoration: 'none',
                          background: 'var(--bg-primary)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          cursor: 'pointer'
                        }}
                      >
                        <span>Download</span>
                        <span> {task.attachment_name || 'File'} </span>
                        <span>...</span>
                      </button>
                    </div>
                  )}

                  {/* If no task-specific fields are found */}
                  {(!task.pub_id && !task.pid && !task.link && !task.pause_reason && !task.request_type && !task.optimise_scenario && !task.fp && !task.fa && !task.f1 && !task.f2 && !task.note) && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                      No specific task details available for this task type.
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
