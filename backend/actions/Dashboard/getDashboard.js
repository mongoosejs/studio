'use strict';

const Archetype = require('archetype');
const vm = require('vm');
const authorize = require('../../authorize');

const GetDashboardParams = new Archetype({
  dashboardId: {
    $type: 'string',
    $required: true
  },
  evaluate: {
    $type: 'boolean'
  },
  authorization: {
    $type: 'string'
  },
  $workspaceId: {
    $type: 'string'
  },
  roles: {
    $type: ['string']
  }
}).compile('GetDashboardParams');

module.exports = ({ db }) => async function getDashboard(params) {
  const { $workspaceId, authorization, dashboardId, evaluate, roles } = new GetDashboardParams(params);
  const Dashboard = db.model('__Studio_Dashboard');

  await authorize('Dashboard.getDashboard', roles);

  const dashboard = await Dashboard.findOne({ _id: dashboardId });
  if (evaluate) {
    let result = null;
    const startExec = startDashboardExec(dashboardId, $workspaceId, authorization);
    try {
      result = await dashboard.evaluate();
    } catch (error) {
      return { dashboard, error: { message: error.message } };
    }

    await startExec.then(({ dashboardResult }) => {
      if (!dashboardResult) {
        return;
      }
      return completeDashboardEvaluate(dashboardResult._id, $workspaceId, authorization, result);
    });

    return { dashboard, result };
  }

  return { dashboard };
};

async function completeDashboardEvaluate(dashboardResultId, workspaceId, authorization, result) {
  if (!workspaceId) {
    return {};
  }
  const headers = { 'Content-Type': 'application/json' };
  if (authorization) {
    headers.Authorization = authorization;
  }
  const response = await fetch('http://localhost:7777/.netlify/functions/completeDashboardEvaluate', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dashboardResultId,
      workspaceId,
      finishedEvaluatingAt: new Date(),
      result
    })
  }).then(response => {
    if (response.status < 200 || response.status >= 400) {
      return response.json().then(data => {
        throw new Error(`completeDashboardEvaluate error: ${data.message}`);
      });
    }
    return response;
  });

  return await response.json();
}

async function startDashboardExec(dashboardId, workspaceId, authorization) {
  if (!workspaceId) {
    return {};
  }
  const headers = { 'Content-Type': 'application/json' };
  if (authorization) {
    headers.Authorization = authorization;
  }
  const response = await fetch('http://localhost:7777/.netlify/functions/startDashboardExec', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dashboardId,
      workspaceId,
      startedEvaluatingAt: new Date()
    })
  }).then(response => {
    if (response.status < 200 || response.status >= 400) {
      return response.json().then(data => {
        throw new Error(`startDashboardExec error: ${data.message}`);
      });
    }
    return response;
  });

  return await response.json();
}
