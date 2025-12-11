'use strict';

const fs = require('fs');
const frontend = require('./frontend');
const path = require('path');

module.exports = withMongooseStudio;

/**
 * Copies Mongoose Studio frontend assets and injects rewrites.
 *
 * @param {object} nextConfig - Existing Next.js config
 * @param {object} [options]
 * @param {string} [options.studioPath="/studio"] - Public base path for Studio frontend
 */
function withMongooseStudio(nextConfig = {}) {
  const studioPath = normalizeBasePath(nextConfig.studioPath || '/studio');

  try {
    copyStudioFrontend(studioPath);
    frontend('/api/studio', true)
      .then(() => console.log(`✅ Mongoose Studio: copied frontend+config to public${studioPath}`))
      .catch(err => console.error(`❌ Mongoose Studio: failed to copy frontend`, err));
  } catch (err) {
    console.error('❌ Mongoose Studio: failed to copy frontend', err);
  }

  return {
    ...nextConfig,

    async redirects() {
      const userRedirects =
      typeof nextConfig.redirects === 'function'
        ? await nextConfig.redirects()
        : nextConfig.redirects || [];

      // Permanent redirect ensures browser URL is updated
      const studioRedirect = {
        source: studioPath,
        destination: `${studioPath}/index.html`,
        permanent: true,
      };

      return [...userRedirects, studioRedirect];
    }
  };
}

/** Ensures path starts with "/" but not ends with "/" */
function normalizeBasePath(p) {
  let res = p.startsWith('/') ? p : '/' + p;
  return res.endsWith('/') ? res.slice(0, -1) : res;
}

/** Copies all built frontend assets into /public/{studioPath} */
function copyStudioFrontend(studioPath) {
  const src = path.join(
    path.dirname(require.resolve('@mongoosejs/studio/package.json')),
    'frontend',
    'public'
  );
  const dest = path.join(process.cwd(), 'public', studioPath.replace(/^\//, ''));

  if (!fs.existsSync(src)) {
    throw new Error(`Frontend build not found at ${src}`);
  }

  fs.mkdirSync(dest, { recursive: true });

  // Node 16.7+ has fs.cpSync
  if (fs.cpSync) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    copyRecursiveSync(src, dest);
  }
}

function copyRecursiveSync(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
