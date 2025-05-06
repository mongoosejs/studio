'use strict';

// Role-based access control configuration
const roleAccess = {
  owner: ['root', 'model', 'document', 'dashboards', 'dashboard', 'team'],
  admin: ['root', 'model', 'document', 'dashboards', 'dashboard', 'team'],
  member: ['root', 'model', 'document', 'dashboards', 'dashboard'],
  readonly: ['root', 'model', 'document'],
  dashboards: ['dashboards', 'dashboard']
};

// Helper function to check if a role has access to a route
function hasAccess(roles, routeName) {
  // If no roles are provided, deny access
  if (!roles || !Array.isArray(roles)) return false;
  
  // Check if any of the user's roles grant access to this route
  return roles.some(role => {
    // If the role doesn't exist in roleAccess, deny access
    if (!roleAccess[role]) return false;
    // Check if the role has access to this route
    return roleAccess[role].includes(routeName);
  });
}

module.exports = {
  routes: [
    {
      path: '/',
      name: 'root',
      component: 'models',
      meta: {
        authorized: true
      }
    },
    {
      path: '/model/:model',
      name: 'model',
      component: 'models',
      meta: {
        authorized: false
      }
    },
    {
      path: '/model/:model/document/:documentId',
      name: 'document',
      component: 'document',
      meta: {
        authorized: false
      }
    },
    {
      path: '/dashboards',
      name: 'dashboards',
      component: 'dashboards',
      meta: {
        authorized: false
      }
    },
    {
      path: '/dashboard/:dashboardId',
      name: 'dashboard',
      component: 'dashboard',
      meta: {
        authorized: false
      }
    },
    {
      path: '/team',
      name: 'team',
      component: 'team',
      meta: {
        authorized: false
      }
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: 'tasks',
      meta: {
        authorized: true
      }
    }
  ],
  roleAccess,
  hasAccess
};
