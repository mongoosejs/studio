'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

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
  },
  roles: {
    $type: ['string']
  }
}).compile('UpdateDashboardParams');

module.exports = ({ db }) => async function updateDashboard(params) {
  const { dashboardId, code, title, description, roles, evaluate } = new UpdateDashboardParams(params);

  const Dashboard = db.models['__Studio_Dashboard'];

  await authorize('Dashboard.updateDashboard', roles);

  const updateObj = { code };

  if (title) {
    updateObj.title = title;
  }

  if (description) {
    updateObj.description = description;
  }

  const doc = await Dashboard.
    findByIdAndUpdate(dashboardId, updateObj, { sanitizeFilter: true, returnDocument: 'after', overwriteImmutable: true });

  return { doc };
};
