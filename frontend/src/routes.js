'use strict';

// Role-based access control configuration
const roleAccess = {
  admin: ['root', 'model', 'document', 'dashboards', 'dashboard', 'team'],
  member: ['root', 'model', 'document', 'dashboards', 'dashboard'],
  readonly: ['root', 'model', 'document'],
  dashboard: ['dashboards', 'dashboard'],
  dashboards: ['dashboards', 'dashboard']
};

// Helper function to check if a role has access to a route
function hasAccess(roles, routeName) {
  // change to true for local development
  if (!roles) return false;
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
        authorized: true
      }
    },
    {
      path: '/model/:model/document/:documentId',
      name: 'document',
      component: 'document',
      meta: {
        authorized: true
      }
    },
    {
      path: '/dashboards',
      name: 'dashboards',
      component: 'dashboards',
      meta: {
        authorized: true
      }
    },
    {
      path: '/dashboard/:dashboardId',
      name: 'dashboard',
      component: 'dashboard',
      meta: {
        authorized: true
      }
    },
    {
      path: '/team',
      name: 'team',
      component: 'team',
      meta: {
        authorized: true
      }
    }
  ],
  roleAccess,
  hasAccess
};
