'use strict';

/**
 * Call mothership API endpoint
 * @param {string} endpoint - The endpoint path (e.g., '/notifySlack', '/getWorkspace')
 * @param {Object} params - Request parameters
 * @param {Object} options - Options containing mothershipUrl and apiKey
 * @returns {Promise} Response data
 */
module.exports = async function callMothership(endpoint, params = {}, options = {}) {
  const mothershipUrl = options?._mothershipUrl || 'https://mongoose-js.netlify.app/.netlify/functions';
  const url = `${mothershipUrl}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json'
  };

  if (options?.apiKey) {
    headers['Authorization'] = `Bearer ${options.apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(params)
  });

  if (response.status < 200 || response.status >= 400) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Mongoose Studio Mothership API Error ${response.status}: ${require('util').inspect(data)}`);
  }

  return response.json();
};
