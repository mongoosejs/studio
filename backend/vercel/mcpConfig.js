'use strict';

const { defaultMothershipURL } = require('../../constants');

module.exports = function vercelMCPConfig(options) {
  if (!options.publicUrl) {
    throw new Error('Mongoose Studio requires publicUrl when Vercel MCP is enabled with an API key');
  }
  const baseUrl = new URL(options.publicUrl);
  baseUrl.search = '';
  baseUrl.hash = '';
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, '')}/`;
  const resource = new URL(options._mcpPath || 'mcp', baseUrl).toString();
  const metadataUrl = new URL('.well-known/oauth-protected-resource', baseUrl).toString();
  const mothershipUrl = options._mothershipUrl || defaultMothershipURL;

  return {
    resource,
    metadataUrl,
    metadata: {
      resource,
      authorization_servers: [new URL(mothershipUrl).origin],
      scopes_supported: ['mcp'],
      bearer_methods_supported: ['header'],
      resource_documentation: 'https://mongoosestudio.app/docs/'
    }
  };
};
