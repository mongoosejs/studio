'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const opts = {
  __build: true,
  apiKey: process.env.MONGOOSE_STUDIO_API_KEY,
  mcp: true,
  publicUrl: process.env.MONGOOSE_STUDIO_PUBLIC_URL,
  googleGeminiAPIKey: process.env.GOOGLE_GEMINI_API_KEY
};

require('../../frontend')('/api/studio', true, opts)
  .then(async() => {
    execSync('npm run tailwind', { cwd: path.join(__dirname, '../..'), stdio: 'inherit' });
    const publicDir = path.join(__dirname, 'public', 'studio');
    fs.cpSync(path.join(__dirname, '../../frontend/public'), publicDir, { recursive: true });
    console.log('Built Mongoose Studio frontend', publicDir);
  })
  .catch(err => {
    console.error('Failed to build Mongoose Studio frontend', err);
    process.exit(1);
  });
