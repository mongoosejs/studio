'use strict';

function getValueByPath(object, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), object);
}

function renderTemplate(template, doc) {
  if (!template) {
    return '';
  }
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_match, path) => {
    const value = getValueByPath(doc, path.trim());
    return value === null ? '—' : String(value);
  });
}

async function notifySlack({ mothershipUrl, payload }) {
  const response = await fetch(`${mothershipUrl}/notifySlack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack notify failed (${response.status}): ${text}`);
  }

  return response.json().catch(() => ({}));
}

module.exports = {
  getValueByPath,
  renderTemplate,
  notifySlack
};
