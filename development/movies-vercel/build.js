'use strict';

require('../../frontend')(`/api/studio`, true, opts)
  .then(() => {
    execSync(
      `
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
