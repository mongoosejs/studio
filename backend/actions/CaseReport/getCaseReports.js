'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const GetCaseReportsParams = new Archetype({
  roles: {
    $type: ['string']
  }
}).compile('GetCaseReportsParams');

module.exports = ({ db }) => async function getCaseReports(params) {
  const { roles } = new GetCaseReportsParams(params);
  const CaseReport = db.model('__Studio_CaseReport');

  await authorize('CaseReport.getCaseReports', roles);

  const caseReports = await CaseReport.find({}).sort({ createdAt: -1 }).lean();

  return { caseReports };
};
