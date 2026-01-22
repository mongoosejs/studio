'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const GetCaseReportParams = new Archetype({
  caseReportId: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('GetCaseReportParams');

module.exports = ({ db }) => async function getCaseReport(params) {
  const { caseReportId, roles } = new GetCaseReportParams(params);
  const CaseReport = db.model('__Studio_CaseReport');

  await authorize('CaseReport.getCaseReports', roles);

  const caseReport = await CaseReport.findById(caseReportId).lean();
  if (!caseReport) {
    throw new Error('Case report not found');
  }

  return { caseReport };
};
