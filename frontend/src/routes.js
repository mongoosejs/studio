'use strict';

module.exports = [
  {
    path: '/',
    name: 'root',
    component: 'models'
  },
  {
    path: '/model/:model',
    name: 'model',
    component: 'models'
  },
  {
    path: '/model/:model/document/:documentId',
    name: 'document',
    component: 'document'
  },
  {
    path: '/dashboards',
    name: 'dashboards',
    component: 'dashboards'
  },
  {
    path: '/dashboard/:dashboardId',
    name: 'dashboard',
    component: 'dashboard'
  }
];