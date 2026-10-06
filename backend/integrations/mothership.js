'use strict';

const { defaultMothershipURL } = require('../../constants');

async function post(path, params, options) {
  const mothershipUrl = options?._mothershipUrl || defaultMothershipURL;
  const mcpOAuthUrl = `${new URL(mothershipUrl).origin}/mcp-oauth`;
  const response = await fetch(`${mcpOAuthUrl}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || `Mothership request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

exports.MCPOAuthToken = {
  introspectMCPAccessToken: (params, options) => post('MCPOAuthToken/introspectMCPAccessToken', params, options)
};

exports.Workspace = {
  registerMCPResource: (params, options) => post('Workspace/registerMCPResource', params, options)
};
