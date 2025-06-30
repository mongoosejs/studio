'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const DeleteDashboardParams = new Archetype({
  dashboardId: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('DeleteDashboardParams');

module.exports = ({ db }) => async function deleteDashboard(params) {
  const { dashboardId, roles } = new DeleteDashboardParams(params);
  const Dashboard = db.model('__Studio_Dashboard');

  await authorize('Dashboard.deleteDashboard', roles);

  const result = await Dashboard.deleteOne({ _id: dashboardId }).orFail();
  return { result };
};
