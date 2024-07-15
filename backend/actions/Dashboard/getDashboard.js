'use strict';
const Archetype = require('archetype');

const GetDashboardParams = new Archetype({
  dashboardId: {
    $type: 'string',
    $required: true
  }
}).compile('GetDashboardParams');

module.exports = ({ db }) => async function getDashboard(params) {
  const { dashboardId } = new GetDashboardParams(params);
  const Dashboard = db.model('__Studio_Dashboard');

  const dashboard = await Dashboard.findOne({ _id: dashboardId });

  return { dashboard }
};