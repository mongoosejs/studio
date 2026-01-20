'use strict';

const { execSync } = require('child_process');

require('../../frontend')(`/api/studio`, true, {})
  .then(() => {
    execSync(
      `
      echo "Building Mongoose Studio frontend..."
      pwd
      mkdir -p ./public
      cp -r ./../../frontend/public/* ./public/
      `
    );
    console.log('Built Mongoose Studio frontend');
  })
  .catch(err => {
    console.error('Failed to build Mongoose Studio frontend', err);
    process.exit(1);
  });
