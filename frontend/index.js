'use strict';

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const webpackConfig = require('./webpack.config');

module.exports = async function frontend(apiUrl, isLambda, options, workspace) {
  const mothershipUrl = options?._mothershipUrl || 'https://mongoose-js.netlify.app/.netlify/functions';

  if (workspace == null && options?.apiKey) {
    ({ workspace } = await fetch(`${mothershipUrl}/getWorkspace`, {
      method: 'POST',
      body: JSON.stringify({ apiKey: options.apiKey }),
      headers: {
        'Authorization': `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json'
      }
    })
      .then(response => {
        if (response.status < 200 || response.status >= 400) {
          return response.json().then(data => {
            throw new Error(`Mongoose Studio API Key Error ${response.status}: ${require('util').inspect(data)}`);
          });
        }
        return response;
      })
      .then(res => res.json()));
  }

  const { apiKey, ...workspaceData } = workspace || {};
  const config = {
    baseURL: apiUrl,
    isLambda,
    mothershipUrl: mothershipUrl ?? '',
    workspace: workspaceData
  };

  if (isLambda) {
    const configPath = path.join(__dirname, './public/config.js');
    fs.writeFileSync(configPath, `window.MONGOOSE_STUDIO_CONFIG = ${JSON.stringify(config, null, 2)};`);
  }

  const compiler = webpack(webpackConfig);

  if (options && options.watch) {
    compiler.watch({}, (err) => {
      if (err) {
        process.nextTick(() => { throw new Error('Error compiling bundle: ' + err.stack); });
      }
      console.log('Webpack compiled successfully');
    });

    const childProcess = exec('npm run tailwind:watch');
    childProcess.stdout.on('data', data => console.log('[TAILWIND]', data));
    childProcess.stderr.on('data', data => console.log('[TAILWIND]', data));
  } else {
    await new Promise((resolve, reject) => {
      compiler.run((err) => {
        if (err) {
          reject(err);
          process.nextTick(() => { throw new Error('Error compiling bundle: ' + err.stack); });
        }
        resolve();
        console.log('Webpack compiled successfully');
      });
    });
  }

  return { config };
};
