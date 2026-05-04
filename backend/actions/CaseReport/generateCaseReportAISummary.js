'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const callLLM = require('../../integrations/callLLM');
const buildDocumentDataForAISummary = require('./buildDocumentDataForAISummary');

const GenerateCaseReportAISummaryParams = new Archetype({
  caseReportId: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('GenerateCaseReportAISummaryParams');

module.exports = ({ db, options }) => async function generateCaseReportAISummary(params) {
  const { caseReportId: rawCaseReportId, roles } = new GenerateCaseReportAISummaryParams(params);
  const CaseReport = db.model('__Studio_CaseReport');

  await authorize('CaseReport.generateCaseReportAISummary', roles);

  const caseReportId = rawCaseReportId != null && typeof rawCaseReportId === 'object' && typeof rawCaseReportId.toString === 'function'
    ? rawCaseReportId.toString()
    : String(rawCaseReportId ?? '');
  if (!caseReportId) {
    throw new Error('Case report ID is required');
  }

  const existing = await CaseReport.findById(caseReportId).lean();
  if (!existing) {
    throw new Error('Case report not found');
  }

  const summary = typeof existing.summary === 'string' ? existing.summary : '';
  if (!summary.trim()) {
    throw new Error('Add a case summary before generating an AI summary.');
  }

  const documents = Array.isArray(existing.documents) ? existing.documents : [];
  const documentData = await buildDocumentDataForAISummary(db, documents);

  const documentsContext = documentData.map(doc => {
    return `Model: ${doc.model}\nDocument ID: ${doc.documentId}\n${doc.notes ? `Notes: ${doc.notes}\n` : ''}Data: ${JSON.stringify(doc.data, null, 2)}`;
  }).join('\n\n---\n\n');

  const systemPrompt = 'You are a technical writing assistant that improves case report summaries. Your task is to enhance the user\'s summary by incorporating specific details from the document data and investigation notes. Write in clear, professional markdown format. Use the document data to illustrate and support the points made in the summary.';

  const userPrompt = `Improve and enhance the following case report summary using the document data and investigation notes provided below. Make it more detailed, professional, and well-structured. Use specific examples from the document data to illustrate key points. Format the response as markdown.\n\nUser's Summary:\n${summary}\n\nDocument Data and Investigation Notes:\n${documentsContext}`;

  let aiSummary = null;
  try {
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
  } catch (err) {
    console.error('Error generating AI summary:', err);
    throw new Error(err && err.message ? err.message : 'Error generating AI summary');
  }

  const caseReport = await CaseReport.findByIdAndUpdate(
    caseReportId,
    { AISummary: aiSummary },
    { new: true }
  ).lean();

  if (!caseReport) {
    throw new Error('Case report not found');
  }

  return { caseReport, aiSummary };
};
