// Role-based visibility control for task actions

// Check if a user role can view a specific action
export const canViewAction = (userRole, action) => {
  const visibilityRules = {
    // Share Link & Pause PID
    'share_link': ['adv_executive', 'advertiser', 'advertiser_manager', 'operations', 'admin'],
    'pause_pid': ['adv_executive', 'advertiser', 'advertiser_manager', 'operations', 'admin'],
    
    // Raise Request  
    'raise_request': ['pub_executive', 'publisher', 'publisher_manager', 'admin'],
    
    // Optimize (visible to all) - using British spelling to match TASK_TYPES
    'optimise': ['pub_executive', 'publisher', 'publisher_manager', 'adv_executive', 'advertiser', 'advertiser_manager', 'operations', 'admin']
  };
  
  const allowedRoles = visibilityRules[action] || [];
  return allowedRoles.includes(userRole);
};

// Get visible actions for a user role
export const getVisibleActions = (userRole) => {
  const allActions = ['share_link', 'pause_pid', 'raise_request', 'optimise'];
  return allActions.filter(action => canViewAction(userRole, action));
};
