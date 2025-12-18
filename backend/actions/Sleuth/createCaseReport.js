'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CreateCaseReportParams = new Archetype({
  name: {
    $type: 'string',
    $required: true
  },
  // Array of documents associated with this case report
  documents: {
    $type: Array,
    $default: []
  },
  roles: {
    $type: ['string']
  }
}).compile('CreateCaseReportParams');

module.exports = ({ db }) => async function createCaseReport(params) {
  const { name, documents, roles } = new CreateCaseReportParams(params);
  const Sleuth = db.model('__Studio_Sleuth');

  await authorize('Sleuth.createCaseReport', roles);

  const normalizedName = name.trim();

  // Count existing case reports with this base name or suffixed with (x)
  const base = escapeRegExp(normalizedName);
  const namePattern = new RegExp(`^${base}( \\(\\d+\\))?$`);
  const existingCount = await Sleuth.countDocuments({ name: { $regex: namePattern } });

  const finalName = existingCount > 0 ? `${normalizedName} (${existingCount})` : normalizedName;

  const docs = Array.isArray(documents) ?
    documents.
      filter(doc => doc && doc.document && doc.documentModel).
      map(doc => ({
        document: doc.document,
        documentModel: doc.documentModel,
        // notes is optional, include only if present
        ...(doc.notes ? { notes: doc.notes } : {})
      })) :
    [];

  const caseReport = await Sleuth.create({
    name: finalName,
    documents: docs
  });

  return { caseReport };
};
