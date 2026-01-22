'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const DocumentsParams = new Archetype({
  documentId: {
    $type: 'string',
    $required: true
  },
  documentModel: {
    $type: 'string'
  },
  highlights: {
    $type: ['string']
  },
  notes: {
    $type: 'string'
  }
}).compile('DocumentsParams')

const CreateCaseReportParams = new Archetype({
  name: {
    $type: 'string',
    $required: true
  },
  // Array of documents associated with this case report
  documents: {
    $type: [DocumentsParams]
  },
  roles: {
    $type: ['string']
  }
}).compile('CreateCaseReportParams');

module.exports = ({ db }) => async function createCaseReport(params) {
  const { name, documents, roles } = new CreateCaseReportParams(params);
  const CaseReport = db.model('__Studio_CaseReport');

  await authorize('CaseReport.createCaseReport', roles);

  const normalizedName = name.trim();

  // Count existing case reports with this base name or suffixed with (x)
  const base = escapeRegExp(normalizedName);
  const namePattern = new RegExp(`^${base}( \\(\\d+\\))?$`);
  const existingCount = await CaseReport.countDocuments({ name: { $regex: namePattern } });

  const finalName = existingCount > 0 ? `${normalizedName} (${existingCount})` : normalizedName;
  const docs = Array.isArray(documents) ?
    documents.
      filter(doc => doc && doc.documentId && doc.documentModel).
      map(doc => {
        return {
          documentId: doc.documentId,
          documentModel: doc.documentModel,
          ...(doc.highlightedFields ? { highlightedFields: doc.highlightedFields } : {}),
          // notes is optional, include only if present
          ...(doc.notes ? { notes: doc.notes } : {})
        };
      }) :
    [];

  const caseReport = await CaseReport.create({
    name: finalName,
    documents: docs
  });

  return { caseReport };
};
