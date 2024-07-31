'use strict';

const Archetype = require('archetype');
const vm = require('vm');

const GetDashboardParams = new Archetype({
  dashboardId: {
    $type: 'string',
    $required: true
  },
  evaluate: {
    $type: 'boolean'
  }
}).compile('GetDashboardParams');

module.exports = ({ db }) => async function getDashboard(params) {
  const { dashboardId, evaluate } = new GetDashboardParams(params);
  const Dashboard = db.model('__Studio_Dashboard');

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