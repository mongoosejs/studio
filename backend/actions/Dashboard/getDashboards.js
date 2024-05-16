'use strict';


module.exports = ({ db }) => async function getDashboards() {

  const { Dashboard } = db.models;

  const dashboards = await Dashboard.find();

  return { dashboards }
};