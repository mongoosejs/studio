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
  const Sleuth = db.model('__Studio_Sleuth');

  await authorize('Sleuth.getCaseReports', roles);

  const caseReport = await Sleuth.findById(caseReportId).lean();
  if (!caseReport) {
    throw new Error('Case report not found');
  }

  return { caseReport };
};
