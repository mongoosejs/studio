'use strict';

const authorize = require('../../authorize');

module.exports = ({ db }) => async function getDashboards(roles) {
  const Dashboard = db.model('__Studio_Dashboard');

  await authorize('Dashboard.getDashboards', roles);

  const dashboards = await Dashboard.find();

  return { dashboards }
};
