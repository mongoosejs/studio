'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

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
}).compile('DocumentsParams');

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
  const docs = Array.isArray(documents)
    ? documents
      .filter(doc => doc && doc.documentId != null && doc.documentModel)
      .map(doc => {
        let documentId = doc.documentId;
        if (documentId != null && typeof documentId === 'object' && typeof documentId.toString === 'function') {
          documentId = documentId.toString();
        } else if (documentId != null) {
          documentId = String(documentId);
        }
        return {
          documentId,
          documentModel: doc.documentModel,
          ...(doc.highlightedFields ? { highlightedFields: doc.highlightedFields } : {}),
          ...(doc.notes ? { notes: doc.notes } : {})
        };
      })
    : [];
  console.log('document created');
  let created = null;
  try {
    created = await CaseReport.create({
      name: finalName,
      documents: docs
    });
  } catch (err) {
    console.log('mongoose error', err);
  }
  console.log('creating the document', created);

  const caseReport = await CaseReport.findById(created._id).lean();
  if (!caseReport) {
    throw new Error('Case report created but could not be read back');
  }

  console.log('document queried');

  console.log('document is lean');
  return { caseReport };
};
