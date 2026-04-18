'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');

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

module.exports = ({ studioConnection }) => async function getDashboard(params) {
  const { $workspaceId, userId, dashboardId, evaluate, roles } = new GetDashboardParams(params);
  const Dashboard = studioConnection.model('__Studio_Dashboard');
  const DashboardResult = studioConnection.model('__Studio_DashboardResult');

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
    const { dashboardResults } = await getDashboardResults(DashboardResult, dashboardId, $workspaceId);
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

async function getDashboardResults(DashboardResult, dashboardId, workspaceId) {
  const filter = { dashboardId };
  if (workspaceId != null) {
    filter.workspaceId = workspaceId;
  }

  const dashboardResults = await DashboardResult.find(filter).sort({ _id: -1 }).limit(10);
  return { dashboardResults };
}
