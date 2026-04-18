'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');
const { defaultMothershipURL } = require('../../../constants');

const GetDashboardParams = new Archetype({
  dashboardId: {
    $type: mongoose.Types.ObjectId,
    $required: true
  },
  evaluate: {
    $type: 'boolean'
  },
  authorization: {
    $type: 'string'
  },
  $workspaceId: {
    $type: mongoose.Types.ObjectId
  },
  userId: {
    $type: mongoose.Types.ObjectId
  },
  roles: {
    $type: ['string']
  }
}).compile('GetDashboardParams');

module.exports = ({ studioConnection, options }) => async function getDashboard(params) {
  const { $workspaceId, authorization, userId, dashboardId, evaluate, roles } = new GetDashboardParams(params);
  const Dashboard = studioConnection.model('__Studio_Dashboard');
  const DashboardResult = studioConnection.model('__Studio_DashboardResult');
  const mothershipUrl = options?._mothershipUrl ?? defaultMothershipURL;

  await authorize('Dashboard.getDashboard', roles);

  const dashboard = await Dashboard.findOne({ _id: dashboardId });
  if (evaluate) {
    let result = null;
    const startExec = startDashboardEvaluate(DashboardResult, dashboardId, $workspaceId, userId);
    try {
      result = await dashboard.evaluate();
    } catch (error) {
      const { dashboardResult } = await startExec.then(({ dashboardResult }) => {
        if (!dashboardResult) {
          return {};
        }
        return completeDashboardEvaluate(
          DashboardResult,
          dashboardResult._id,
          null,
          { message: error.message },
          'failed'
        );
      });
      return { dashboard, dashboardResult, error: { message: error.message } };
    }

    try {
      const { dashboardResult } = await startExec.then(({ dashboardResult }) => {
        if (!dashboardResult) {
          return {};
        }
        return completeDashboardEvaluate(
          DashboardResult,
          dashboardResult._id,
          result,
          undefined,
          'completed'
        );
      });

      return { dashboard, dashboardResult, result };
    } catch (error) {
      return { dashboard, error: { message: error.message } };
    }
  } else {
    const { dashboardResults } = await getDashboardResults(
      DashboardResult,
      dashboardId,
      $workspaceId,
      authorization,
      mothershipUrl
    );
    return { dashboard, dashboardResults };
  }
};

async function completeDashboardEvaluate(DashboardResult, dashboardResultId, result, error, status) {
  const dashboardResult = await DashboardResult.findById(dashboardResultId).orFail();
  dashboardResult.finishedEvaluatingAt = new Date();
  dashboardResult.result = result;
  dashboardResult.error = error;
  dashboardResult.status = status;
  await dashboardResult.save();
  return { dashboardResult };
}

async function startDashboardEvaluate(DashboardResult, dashboardId, workspaceId, userId) {
  const dashboardResult = await DashboardResult.create({
    dashboardId,
    workspaceId,
    userId,
    startedEvaluatingAt: new Date(),
    status: 'in_progress'
  });

  return { dashboardResult };
}

async function getDashboardResults(DashboardResult, dashboardId, workspaceId, authorization, mothershipUrl) {
  const filter = { dashboardId };
  if (workspaceId != null) {
    filter.workspaceId = workspaceId;
  }

  const [localResultsRes, remoteResultsRes] = await Promise.allSettled([
    DashboardResult.find(filter).sort({ _id: -1 }).limit(10),
    getMothershipDashboardResults(dashboardId, workspaceId, authorization, mothershipUrl)
  ]);

  const localResults = localResultsRes.status === 'fulfilled' ? localResultsRes.value : [];
  const remoteResults = remoteResultsRes.status === 'fulfilled' ? remoteResultsRes.value : [];

  const dashboardResults = localResults.concat(remoteResults)
    .sort((a, b) => getSortTime(b) - getSortTime(a))
    .slice(0, 10);

  return { dashboardResults };
}

async function getMothershipDashboardResults(dashboardId, workspaceId, authorization, mothershipUrl) {
  if (!workspaceId) {
    return [];
  }

  const headers = { 'Content-Type': 'application/json' };
  if (authorization) {
    headers.Authorization = authorization;
  }

  const response = await fetch(`${mothershipUrl}/getDashboardResults`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dashboardId,
      workspaceId
    })
  });

  if (response.status < 200 || response.status >= 400) {
    let message = `getDashboardResults error: ${response.status}`;
    try {
      const data = await response.json();
      message = `getDashboardResults error: ${data.message}`;
    } catch {
      // Ignore parse errors and keep the generic status-based message.
    }
    throw new Error(message);
  }

  const data = await response.json();
  return Array.isArray(data.dashboardResults) ? data.dashboardResults : [];
}

function getSortTime(result) {
  const candidate = result?.finishedEvaluatingAt ?? result?.startedEvaluatingAt ?? result?.createdAt ?? result?._id;
  const time = new Date(candidate).getTime();
  return Number.isNaN(time) ? 0 : time;
}
