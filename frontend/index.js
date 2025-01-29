'use strict';

const { execSync, exec } = require('child_process');
const webpack = require('webpack');

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

  const config = { ...require('./webpack.config'), plugins: [] };
  if (apiUrl != null) {
    config.plugins = [
      new webpack.DefinePlugin({
        config__baseURL: `'${apiUrl}'`,
        config__isLambda: `${!!isLambda}`
      })
    ]
  }
  if (options?.setAuthorizationHeaderFrom) {
    config.plugins.push(new webpack.DefinePlugin({
      config__setAuthorizationHeaderFrom: `'${options.setAuthorizationHeaderFrom}'`
    }));
  }
  if (options?.apiKey) {
    config.plugins.push(new webpack.DefinePlugin({
      config__mothershipUrl: `'${options?._mothershipUrl}'` || '\'https://mongoose-js.netlify.app/.netlify/functions\''
    }));
  } else {
    config.plugins.push(new webpack.DefinePlugin({
      config__mothershipUrl: '\'\''
    }));
  }

  const { apiKey, ...workspaceData } = workspace || {};
  config.plugins.push(new webpack.DefinePlugin({
    config__workspace: JSON.stringify(workspaceData)
  }));
  const compiler = webpack(config);

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
    return new Promise((resolve, reject) => {
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
};
