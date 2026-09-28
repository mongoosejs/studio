'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const operationOptions = require('../../helpers/operationOptions');

const GetDashboardParams = new Archetype({
  roles: {
    $type: ['string']
  },
  maxTimeMS: {
    $type: 'number'
  }
}).compile('GetDashboardParams');

module.exports = ({ studioConnection, options }) => async function getDashboards(params) {
  const Dashboard = studioConnection.model('__Studio_Dashboard');
  const { roles } = new GetDashboardParams(params);

  await authorize('Dashboard.getDashboards', roles);

  const dashboards = await Dashboard
    .find()
    .setOptions(operationOptions(options, params))
    .sort({ isPinned: -1, createdAt: -1, _id: -1 });

  return { dashboards };
};

module.exports.paramsType = GetDashboardParams;
module.exports.tags = ['readOnly'];
