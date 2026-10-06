'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const operationOptions = require('../../helpers/operationOptions');

const UpdateDashboardParams = new Archetype({
  dashboardId: {
    $type: 'string',
    $required: true
  },
  code: {
    $type: 'string'
  },
  title: {
    $type: 'string'
  },
  description: {
    $type: 'string'
  },
  isPinned: {
    $type: 'boolean'
  },
  roles: {
    $type: ['string']
  },
  maxTimeMS: {
    $type: 'number'
  }
}).compile('UpdateDashboardParams');

module.exports = ({ studioConnection, options }) => async function updateDashboard(params) {
  const { dashboardId, code, title, description, isPinned, roles, evaluate } = new UpdateDashboardParams(params);

  const Dashboard = studioConnection.models['__Studio_Dashboard'];

  await authorize('Dashboard.updateDashboard', roles);

  const updateObj = {};

  if (code != null) {
    updateObj.code = code;
  }

  if (title != null) {
    updateObj.title = title;
  }

  if (description != null) {
    updateObj.description = description;
  }

  if (isPinned != null) {
    updateObj.isPinned = isPinned;
  }

  const doc = await Dashboard.findByIdAndUpdate(
    dashboardId,
    updateObj,
    { sanitizeFilter: true, returnDocument: 'after' }
  ).setOptions(operationOptions(options, params));

  return { doc };
};

module.exports.paramsType = UpdateDashboardParams;
module.exports.tags = [];
