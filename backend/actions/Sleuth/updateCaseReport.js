'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const UpdateCaseReportParams = new Archetype({
  caseReportId: {
    $type: 'string',
    $required: true
  },
  // Full replacement array of documents for this case report
  documents: {
    $type: Array,
    $default: []
  },
  roles: {
    $type: ['string']
  }
}).compile('UpdateCaseReportParams');

module.exports = ({ db }) => async function updateCaseReport(params) {
  const { caseReportId, documents, roles } = new UpdateCaseReportParams(params);
  const Sleuth = db.model('__Studio_Sleuth');

  await authorize('Sleuth.updateCaseReport', roles);

  const docs = Array.isArray(documents)
    ? documents
        .filter(doc => doc && doc.document && doc.documentModel)
        .map(doc => ({
          document: doc.document,
          documentModel: doc.documentModel,
          ...(doc.notes ? { notes: doc.notes } : {})
        }))
    : [];

  const caseReport = await Sleuth.findByIdAndUpdate(
    caseReportId,
    { documents: docs },
    { new: true }
  ).lean();

  if (!caseReport) {
    throw new Error('Case report not found');
  }

  return { caseReport };
};
