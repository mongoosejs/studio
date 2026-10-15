'use strict';

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const { defaultMothershipURL } = require('../constants');
const mothership = require('../backend/integrations/mothership');
const vercelMCPConfig = require('../backend/vercel/mcpConfig');
const webpackConfig = require('./webpack.config');
const util = require('util');

module.exports = async function frontend(apiUrl, isLambda, options, workspace) {
  const mothershipUrl = options?._mothershipUrl || defaultMothershipURL;

  if (workspace == null && options?.apiKey) {
    ({ workspace } = await fetch(`${mothershipUrl}/getWorkspace`, {
      method: 'POST',
      body: JSON.stringify({ apiKey: options.apiKey }),
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json'
      }
    })
      .then(response => {
        if (response.status < 200 || response.status >= 400) {
          return response.json().then(data => {
            throw new Error(`Mongoose Studio API Key Error ${response.status}: ${util.inspect(data)}`);
          });
        }
        return response;
      })
      .then(res => res.json()));
  }

  const { apiKey, ...workspaceData } = workspace || {};
  const workspaceBaseUrl = workspace?.baseUrl?.replace(/\/+$/, '');
  const publicBaseUrl = options?.publicUrl?.replace(/\/+$/, '') || workspaceBaseUrl;
  const mcpPath = options?._mcpPath || (isLambda && options?.mcp === true ? '/api/studio-mcp' : null);
  const mcpEnabled = options?.mcp ?? !options?.apiKey;
  const config = {
    baseURL: apiUrl,
    isLambda,
    mcp: mcpEnabled,
    mcpUrl: mcpEnabled
      ? mcpPath
        ? publicBaseUrl ? new URL(mcpPath, `${publicBaseUrl}/`).toString() : mcpPath
        : publicBaseUrl ? `${publicBaseUrl}/mcp` : null
      : null,
    mothershipUrl: apiKey ? mothershipUrl : null,
    workspace: workspaceData
  };

  if (isLambda) {
    const configPath = path.join(__dirname, './public/config.js');
    fs.writeFileSync(configPath, `window.MONGOOSE_STUDIO_CONFIG = ${JSON.stringify(config, null, 2)};`);

    // The caller copies frontend/public after this promise resolves. Put the
    // protected resource document there so the same copy includes it.
    const metadataPath = path.join(__dirname, 'public/.well-known/oauth-protected-resource');
    if (options?.apiKey && options?.mcp === true) {
      fs.rmSync(metadataPath, { force: true });
      const mcpConfig = vercelMCPConfig({ ...options, _mcpPath: '/api/studio-mcp' });
      await mothership.Workspace.registerMCPResource({ apiKey: options.apiKey, resource: mcpConfig.resource }, options);
      fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
      fs.writeFileSync(metadataPath, JSON.stringify(mcpConfig.metadata, null, 2));
    } else {
      fs.rmSync(metadataPath, { force: true });
    }
  }

  if (options && options.__watch) {
    const compiler = webpack(webpackConfig);
    compiler.watch({}, (err) => {
      if (err) {
        process.nextTick(() => { throw new Error('Error compiling bundle: ' + err.stack); });
      }
      console.log('[MONGOOSE STUDIO] Webpack compiled successfully');
    });

    const childProcess = exec('npm run tailwind:watch');
    childProcess.stdout.on('data', data => console.log('[TAILWIND]', data));
    childProcess.stderr.on('data', data => console.log('[TAILWIND]', data));
  } else if (options && options.__build) {
    const compiler = webpack(webpackConfig);
    await new Promise((resolve, reject) => {
      compiler.run((err) => {
        if (err) {
          reject(err);
          process.nextTick(() => { throw new Error('Error compiling bundle: ' + err.stack); });
        }
        resolve();
        console.log('[MONGOOSE STUDIO] Webpack compiled successfully');
      });
    });
  }

  return { config };
};
