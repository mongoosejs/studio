'use strict';

const VALIDATION_TIMEOUT_MS = 1000;

module.exports = async function validateDocumentWithTimeout(doc) {
  const documentId = doc._id?.toString() || null;
  try {
    await Promise.race([
      doc.validate(),
      new Promise((resolve, reject) => setTimeout(() => reject(new Error('Validation timed out')), VALIDATION_TIMEOUT_MS))
    ]);
    return { valid: true, documentId, error: null, errors: null };
  } catch (err) {
    return {
      valid: false,
      documentId,
      error: err?.message || String(err),
      errors: formatValidationErrors(err)
    };
  }
};

function formatValidationErrors(err) {
  if (err?.name !== 'ValidationError' || err.errors == null) {
    return null;
  }

  const errors = {};
  for (const [path, pathError] of Object.entries(err.errors)) {
    errors[path] = {
      message: pathError?.message || String(pathError),
      name: pathError?.name || null,
      kind: pathError?.kind || null,
      path: pathError?.path || path,
      value: pathError?.value
    };
  }
  return errors;
}
