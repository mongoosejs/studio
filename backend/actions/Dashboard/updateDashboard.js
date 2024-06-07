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
    }
  }).compile('UpdateDashboardParams');
  
  module.exports = ({ db }) => async function updateDashboard(params) {
    const { dashboardId, code } = new UpdateDashboardParams(params);
  
    const Dashboard = db.models[`__Studio_Dashboard`];
 
    const doc = await Dashboard.
      findByIdAndUpdate(dashboardId, { code }, { sanitizeFilter: true, returnDocument: 'after', overwriteImmutable: true });
    
    return { doc };
  };