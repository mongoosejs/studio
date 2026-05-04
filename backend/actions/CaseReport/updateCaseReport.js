'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const callLLM = require('../../integrations/callLLM');
const buildDocumentDataForAISummary = require('./buildDocumentDataForAISummary');

const UpdateCaseReportParams = new Archetype({
  caseReportId: {
    $type: 'string',
    $required: true
  },
  // Full replacement array of documents for this case report (omit to leave documents unchanged)
  documents: {
    $type: Array
  },
  summary: {
    $type: 'string'
  },
  status: {
    $type: 'string'
  },
  roles: {
    $type: ['string']
  },
  skipAISummary: {
    $type: 'boolean',
    $default: false
  }
}).compile('UpdateCaseReportParams');

module.exports = ({ db, options }) => async function updateCaseReport(params) {
  const documentsInRequest = params != null && Object.prototype.hasOwnProperty.call(params, 'documents');
  const paramsForCompile = documentsInRequest ? params : (() => {
    const copy = { ...params };
    delete copy.documents;
    return copy;
  })();
  const { caseReportId: rawCaseReportId, documents, summary, status, roles, skipAISummary } = new UpdateCaseReportParams(paramsForCompile);
  const CaseReport = db.model('__Studio_CaseReport');

  await authorize('CaseReport.updateCaseReport', roles);

  const caseReportId = rawCaseReportId != null && typeof rawCaseReportId === 'object' && typeof rawCaseReportId.toString === 'function'
    ? rawCaseReportId.toString()
    : String(rawCaseReportId ?? '');
  if (!caseReportId) {
    throw new Error('Case report ID is required');
  }

  const docs = documentsInRequest && Array.isArray(documents)
    ? documents
      .filter(doc => doc && doc.documentId != null && doc.documentModel)
      .map(doc => {
        // Schema expects documentId as String; normalize to string
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

  const updateData = {};
  if (documentsInRequest) {
    updateData.documents = docs;
  }
  let aiSummary = null;
  
  // If status is explicitly provided, use it
  if (status !== undefined) {
    updateData.status = status;
  }
  
  if (summary !== undefined) {
    updateData.summary = summary;
    // If summary is provided and status wasn't explicitly set, set to resolved
    if (status === undefined) {
      updateData.status = 'resolved';
    }

    // Generate AI summary if summary is provided (unless deferred to generateCaseReportAISummary)
    if (summary && summary.trim().length > 0 && !skipAISummary) {
      try {
        let contextDocEntries = docs;
        if (!documentsInRequest || contextDocEntries.length === 0) {
          const existingForContext = await CaseReport.findById(caseReportId).lean();
          contextDocEntries = Array.isArray(existingForContext && existingForContext.documents)
            ? existingForContext.documents
            : [];
        }
        const documentData = await buildDocumentDataForAISummary(db, contextDocEntries);

        // Build prompt for AI summary
        const documentsContext = documentData.map(doc => {
          return `Model: ${doc.model}\nDocument ID: ${doc.documentId}\n${doc.notes ? `Notes: ${doc.notes}\n` : ''}Data: ${JSON.stringify(doc.data, null, 2)}`;
        }).join('\n\n---\n\n');

        const systemPrompt = 'You are a technical writing assistant that improves case report summaries. Your task is to enhance the user\'s summary by incorporating specific details from the document data and investigation notes. Write in clear, professional markdown format. Use the document data to illustrate and support the points made in the summary.';

        const userPrompt = `Improve and enhance the following case report summary using the document data and investigation notes provided below. Make it more detailed, professional, and well-structured. Use specific examples from the document data to illustrate key points. Format the response as markdown.\n\nUser's Summary:\n${summary}\n\nDocument Data and Investigation Notes:\n${documentsContext}`;

        const llmResponse = await callLLM(
          [{
            role: 'user',
            content: [{
              type: 'text',
              text: userPrompt
            }]
          }],
          systemPrompt,
          options
        );

        aiSummary = llmResponse.text;
        updateData.AISummary = aiSummary;
      } catch (err) {
        console.error('Error generating AI summary:', err);
        // Continue without AI summary if generation fails
      }
    }
  }

  const caseReport = await CaseReport.findByIdAndUpdate(
    caseReportId,
    updateData,
    { new: true }
  ).lean();

  if (!caseReport) {
    throw new Error('Case report not found');
  }

  return { caseReport, aiSummary };
};
