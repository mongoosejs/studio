'use strict';

// Role-based access control configuration
const roleAccess = {
  owner: ['root', 'model', 'document', 'dashboards', 'dashboard', 'team', 'chat'],
  admin: ['root', 'model', 'document', 'dashboards', 'dashboard', 'team', 'chat'],
  member: ['root', 'model', 'document', 'dashboards', 'dashboard', 'chat'],
  readonly: ['root', 'model', 'document', 'chat'],
  dashboards: ['dashboards', 'dashboard']
};

const allowedRoutesForLocalDev = ['document', 'root', 'chat'];

// Helper function to check if a role has access to a route
function hasAccess(roles, routeName) {
  // change to true for local development
  if (!roles) return allowedRoutesForLocalDev.includes(routeName);
  return roles.some(role => roleAccess[role]?.includes(routeName));
  
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
    },
    {
      path: '/chat',
      name: 'chat index',
      component: 'chat',
      meta: {
        authorized: true
      }
    },
    {
      path: '/chat/:threadId',
      name: 'chat',
      component: 'chat',
      meta: {
        authorized: true
      }
    }
  ],
  roleAccess,
  hasAccess
};
