'use strict';

const Archetype = require('archetype');
const vm = require('vm');

const DeleteDashboardParams = new Archetype({
  dashboardId: {
    $type: 'string',
    $required: true
  },
}).compile('DeleteDashboardParams');

module.exports = ({ db }) => async function deleteDashboard(params) {
  const { dashboardId } = new DeleteDashboardParams(params);
  const Dashboard = db.model('__Studio_Dashboard');

  const result = await Dashboard.deleteOne({ _id: dashboardId }).orFail();
  return { result };
};