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
    const startExec = startDashboardEvaluate(dashboardId, $workspaceId, authorization);
    // Avoid unhandled promise rejection since we handle the promise later.
    startExec.catch(() => {});
    try {
      result = await dashboard.evaluate();
    } catch (error) {
      return { dashboard, error: { message: error.message } };
    }

    const { dashboardResult } = await startExec.then(({ dashboardResult }) => {
      if (!dashboardResult) {
        return;
      }
      return completeDashboardEvaluate(dashboardResult._id, $workspaceId, authorization, result);
    });

    return { dashboard, dashboardResult };
  } else {
    const { dashboardResults } = await getDashboardResults(dashboardId, $workspaceId, authorization);
    return { dashboard, dashboardResults };
  }
};

async function completeDashboardEvaluate(dashboardResultId, workspaceId, authorization, result) {
  if (!workspaceId) {
    return {};
  }
  const headers = { 'Content-Type': 'application/json' };
  if (authorization) {
    headers.Authorization = authorization;
  }
  const response = await fetch('https://mongoose-js.netlify.app/.netlify/functions/completeDashboardEvaluate', {
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

async function startDashboardEvaluate(dashboardId, workspaceId, authorization) {
  if (!workspaceId) {
    return {};
  }
  const headers = { 'Content-Type': 'application/json' };
  if (authorization) {
    headers.Authorization = authorization;
  }
  const response = await fetch('https://mongoose-js.netlify.app/.netlify/functions/startDashboardEvaluate', {
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
        throw new Error(`startDashboardEvaluate error: ${data.message}`);
      });
    }
    return response;
  });

  return await response.json();
}

async function getDashboardResults(dashboardId, workspaceId, authorization) {
  if (!workspaceId) {
    return {};
  }
  const headers = { 'Content-Type': 'application/json' };
  if (authorization) {
    headers.Authorization = authorization;
  }
  const response = await fetch('https://mongoose-js.netlify.app/.netlify/functions/getDashboardResults', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dashboardId,
      workspaceId
    })
  }).then(response => {
    if (response.status < 200 || response.status >= 400) {
      return response.json().then(data => {
        throw new Error(`getDashboardResults error: ${data.message}`);
      });
    }
    return response;
  });

  return await response.json();
}
