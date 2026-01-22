'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const callLLM = require('../../integrations/callLLM');

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
  summary: {
    $type: 'string'
  },
  status: {
    $type: 'string'
  },
  roles: {
    $type: ['string']
  }
}).compile('UpdateCaseReportParams');

module.exports = ({ db, options }) => async function updateCaseReport(params) {
  const { caseReportId, documents, summary, status, roles } = new UpdateCaseReportParams(params);
  const CaseReport = db.model('__Studio_CaseReport');

  await authorize('CaseReport.updateCaseReport', roles);

  const docs = Array.isArray(documents)
    ? documents
      .filter(doc => doc && doc.document && doc.documentModel)
      .map(doc => ({
        document: doc.document,
        documentModel: doc.documentModel,
        ...(doc.notes ? { notes: doc.notes } : {})
      }))
    : [];

  const updateData = { documents: docs };
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

    // Generate AI summary if summary is provided
    if (summary && summary.trim().length > 0) {
      try {
        // Fetch all documents with their data for context
        const documentData = [];
        for (const docEntry of docs) {
          if (!docEntry.document || !docEntry.documentModel) {
            continue;
          }
          try {
            const Model = db.models[docEntry.documentModel];
            if (Model) {
              const doc = await Model.findById(docEntry.document).setOptions({ sanitizeFilter: true }).lean();
              if (doc) {
                documentData.push({
                  model: docEntry.documentModel,
                  documentId: docEntry.document.toString(),
                  data: doc,
                  notes: docEntry.notes || ''
                });
              }
            }
          } catch (err) {
            console.error(`Error fetching document ${docEntry.document} from model ${docEntry.documentModel}:`, err);
            // Continue with other documents even if one fails
          }
        }

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
