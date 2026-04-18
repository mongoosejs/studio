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

module.exports = ({ studioConnection }) => async function deleteDashboard(params) {
  const { dashboardId, roles } = new DeleteDashboardParams(params);
  const Dashboard = studioConnection.model('__Studio_Dashboard');
  const DashboardResult = studioConnection.model('__Studio_DashboardResult');

  await authorize('Dashboard.deleteDashboard', roles);

  const result = await Dashboard.deleteOne({ _id: dashboardId }).orFail();
  await DashboardResult.deleteMany({ dashboardId });
  return { result };
};
