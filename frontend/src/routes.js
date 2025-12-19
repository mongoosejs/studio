'use strict';

// Role-based access control configuration
const roleAccess = {
  owner: ['root', 'model', 'document', 'dashboards', 'dashboard', 'team', 'chat', 'mongoose-sleuth', 'case-reports'],
  admin: ['root', 'model', 'document', 'dashboards', 'dashboard', 'team', 'chat', 'mongoose-sleuth', 'case-reports'],
  member: ['root', 'model', 'document', 'dashboards', 'dashboard', 'chat', 'mongoose-sleuth', 'case-reports'],
  readonly: ['root', 'model', 'document', 'chat', 'mongoose-sleuth', 'case-reports'],
  dashboards: ['dashboards', 'dashboard']
};

const allowedRoutesForLocalDev = ['document', 'root', 'chat', 'mongoose-sleuth', 'case-reports'];

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
      path: '/mongoose-sleuth',
      name: 'mongoose-sleuth',
      component: 'mongoose-sleuth',
      meta: {
        authorized: true
      }
    },
    {
      path: '/case-reports',
      name: 'case-reports',
      component: 'case-reports',
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
