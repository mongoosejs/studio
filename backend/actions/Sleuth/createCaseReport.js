'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const CreateCaseReportParams = new Archetype({
  name: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('CreateCaseReportParams');

module.exports = ({ db }) => async function createCaseReport(params) {
  const { name, roles } = new CreateCaseReportParams(params);
  const Sleuth = db.model('__Studio_Sleuth');

  await authorize('Sleuth.createCaseReport', roles);

  const caseReport = await Sleuth.create({ name });

  return { caseReport };
};
