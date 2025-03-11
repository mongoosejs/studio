'use strict';

module.exports = [
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
];
