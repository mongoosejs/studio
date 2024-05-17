'use strict';


module.exports = ({ db }) => async function getDashboards() {
  const Dashboard = db.model('__Studio_Dashboard');

  const dashboards = await Dashboard.find();

  return { dashboards }
};