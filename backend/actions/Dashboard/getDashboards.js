'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const GetDashboardParams = new Archetype({
  roles: {
    $type: ['string']
  }
}).compile('GetDashboardParams');

module.exports = ({ db }) => async function getDashboards(params) {
  const Dashboard = db.model('__Studio_Dashboard');
  const { roles } = new GetDashboardParams(params);

  await authorize('Dashboard.getDashboards', roles);

  const dashboards = await Dashboard.find();

  return { dashboards }
};
