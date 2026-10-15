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
 * @param {string} [options.apiKey] - Mongoose Studio Pro API key, only used to pick the `mcp` default
 * @param {boolean} [options.mcp] - Whether to show MCP in the frontend. Defaults to true without an API key, false with one.
 * @param {string} [options.publicUrl] - Externally reachable Studio URL
 */
function withMongooseStudio(nextConfig = {}, options = {}) {
  const studioPath = normalizeBasePath(nextConfig.studioPath || '/studio');

  try {
    // With only frontend options, frontend() writes config.js before its first
    // await. Copy that config together with the other static assets. Don't
    // pass apiKey through, because that makes frontend() fetch the workspace first.
    const frontendPromise = frontend('/api/studio', true, {
      mcp: options.mcp ?? !options.apiKey,
      publicUrl: options.publicUrl,
      _mcpPath: 'mcp'
    });
    copyStudioFrontend(studioPath);
    frontendPromise
      .then(() => console.log(`✅ Mongoose Studio: copied frontend+config to public${studioPath}`))
      .catch(err => console.error(`❌ Mongoose Studio: failed to copy frontend`, err));
  } catch (err) {
    console.error('❌ Mongoose Studio: failed to copy frontend', err);
  }

  return {
    ...nextConfig,

    async rewrites() {
      const userRewrites = typeof nextConfig.rewrites === 'function'
        ? await nextConfig.rewrites()
        : nextConfig.rewrites || [];
      const studioRewrites = [
        { source: `${studioPath}/mcp`, destination: '/api/studio/mcp' },
        {
          source: `${studioPath}/\\.well-known/oauth-protected-resource`,
          destination: '/api/studio/.well-known/oauth-protected-resource'
        }
      ];
      if (Array.isArray(userRewrites)) {
        return { beforeFiles: studioRewrites, afterFiles: userRewrites, fallback: [] };
      }
      return {
        beforeFiles: [...studioRewrites, ...(userRewrites.beforeFiles || [])],
        afterFiles: userRewrites.afterFiles || [],
        fallback: userRewrites.fallback || []
      };
    },

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
  const src = path.join(__dirname, 'frontend', 'public');
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
