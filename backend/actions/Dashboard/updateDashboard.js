'use strict';

const Archetype = require('archetype');

const UpdateDashboardParams = new Archetype({
  dashboardId: {
    $type: 'string',
    $required: true
  },
  code: {
    $type: 'string',
    $required: true
  },
  title: {
    $type: 'string'
  },
  description: {
    $type: 'string'
  }
}).compile('UpdateDashboardParams');

module.exports = ({ db }) => async function updateDashboard(params) {
  const { dashboardId, code, title, description } = new UpdateDashboardParams(params);

  const Dashboard = db.models[`__Studio_Dashboard`];

  const updateObj = { code };
  
  if (title) {
    updateObj.title = title;
  }

  if (description) {
    updateObj.description = description;
  }

  const doc = await Dashboard.
    findByIdAndUpdate(dashboardId, updateObj, { sanitizeFilter: true, returnDocument: 'after', overwriteImmutable: true });
  
  let result = null;
  try {
    result = await doc.evaluate();
  } catch (error) {
    return { doc, error: { message: error.message } };
  }

  return { doc, result };
};