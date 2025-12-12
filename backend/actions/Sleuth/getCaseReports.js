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
  const Sleuth = db.model('__Studio_Sleuth');

  await authorize('Sleuth.getCaseReports', roles);

  const caseReports = await Sleuth.find({}).sort({ createdAt: -1 }).lean();

  return { caseReports };
};
