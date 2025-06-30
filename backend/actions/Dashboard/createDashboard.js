'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const CreateDashboardParams = new Archetype({
  title: {
    $type: 'string',
    $required: true
  },
  code: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('CreateDashboardParams');

module.exports = ({ db }) => async function createDashboard(params) {
  const { title, code, roles } = new CreateDashboardParams(params);
  const Dashboard = db.model('__Studio_Dashboard');

  await authorize('Dashboard.createDashboard', roles);

  const dashboard = await Dashboard.create({ title, code });

  return { dashboard };
};
