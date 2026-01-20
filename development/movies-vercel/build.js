'use strict';

const { execSync } = require('child_process');

const opts = {
  __build: true,
  apiKey: process.env.MONGOOSE_STUDIO_API_KEY
};

require('../../frontend')(`/api/studio`, true, opts)
  .then(() => {
    execSync(
      `
      echo "Building Mongoose Studio frontend..."
      pwd
      npm run tailwind
      mkdir -p ./public
      cp -r ./../../frontend/public/* ./public/
      `
    );
    console.log('Built Mongoose Studio frontend', process.cwd());
  })
  .catch(err => {
    console.error('Failed to build Mongoose Studio frontend', err);
    process.exit(1);
  });
