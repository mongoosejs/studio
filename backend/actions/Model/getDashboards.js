'use strict';


module.exports = ({ db }) => async function getDashboards() {

  const Model = db.models['Dashboard'];
  if (Model == null) {
    throw new Error(`Model ${`Dashboard`} not found`);
  }
  const dashboards = await Model.find();

  return { dashboards }
};