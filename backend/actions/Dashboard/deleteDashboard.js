'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const operationOptions = require('../../helpers/operationOptions');

const DeleteDashboardParams = new Archetype({
  dashboardId: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  },
  maxTimeMS: {
    $type: 'number'
  }
}).compile('DeleteDashboardParams');

module.exports = ({ studioConnection, options }) => async function deleteDashboard(params) {
  const { dashboardId, roles } = new DeleteDashboardParams(params);
  const Dashboard = studioConnection.model('__Studio_Dashboard');
  const DashboardResult = studioConnection.model('__Studio_DashboardResult');

  await authorize('Dashboard.deleteDashboard', roles);

  const result = await Dashboard.deleteOne({ _id: dashboardId }).
    setOptions(operationOptions(options, params)).
    orFail();
  await DashboardResult.deleteMany({ dashboardId }).
    setOptions(operationOptions(options, params));
  return { result };
};

module.exports.paramsType = DeleteDashboardParams;
module.exports.tags = ['destructive'];
