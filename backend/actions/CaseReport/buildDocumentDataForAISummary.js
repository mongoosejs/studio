'use strict';

/**
 * Load full documents from the app DB for each case-report document entry (for AI prompts).
 * @param {import('mongoose').Connection} db
 * @param {Array<{ documentId?: unknown, document?: unknown, documentModel: string, notes?: string }>} docEntries
 */
module.exports = async function buildDocumentDataForAISummary(db, docEntries) {
  const documentData = [];
  if (!Array.isArray(docEntries)) {
    return documentData;
  }
  for (const docEntry of docEntries) {
    if (!docEntry || !docEntry.documentModel) {
      continue;
    }
    const rawId = docEntry.documentId != null ? docEntry.documentId : docEntry.document;
    if (rawId == null || rawId === '') {
      continue;
    }
    let documentId = rawId;
    if (documentId != null && typeof documentId === 'object' && typeof documentId.toString === 'function') {
      documentId = documentId.toString();
    } else {
      documentId = String(documentId);
    }
    try {
      const Model = db.models[docEntry.documentModel];
      if (!Model) {
        continue;
      }
      const doc = await Model.findById(documentId).setOptions({ sanitizeFilter: true }).lean();
      if (doc) {
        documentData.push({
          model: docEntry.documentModel,
          documentId: documentId.toString(),
          data: doc,
          notes: docEntry.notes || ''
        });
      }
    } catch (err) {
      console.error(`Error fetching document ${documentId} from model ${docEntry.documentModel}:`, err);
    }
  }
  return documentData;
};
