'use strict';

const Archetype = require('archetype');
const vm = require('vm');
const authorize = require('../../authorize');

const GetDashboardParams = new Archetype({
  dashboardId: {
    $type: 'string',
    $required: true
  },
  evaluate: {
    $type: 'boolean'
  },
  roles: {
    $type: ['string']
  }
}).compile('GetDashboardParams');

module.exports = ({ db }) => async function getDashboard(params) {
  const { dashboardId, evaluate, roles } = new GetDashboardParams(params);
  const Dashboard = db.model('__Studio_Dashboard');

  await authorize('Dashboard.getDashboard', roles);

  const dashboard = await Dashboard.findOne({ _id: dashboardId });
  if (evaluate) {
    let result = null;
    try {
      result = await dashboard.evaluate();
    } catch (error) {
      return { dashboard, error: { message: error.message } };
    }

    return { dashboard, result };
  }

  return { dashboard };
};
