# Changelog

## 0.8.0

### New indexes modal

The indexes modal now shows each index's spec and properties, like Unique and TTL, in an expandable table.
It also lists indexes defined in your Mongoose schema but missing from MongoDB, and lets owners and admins create them with one click.
Dropping an index now requires typing the index name to confirm.

### Breaking: drop support for Mongoose 7 and Mongoose 8 before 8.10

The indexes modal relies on the `indexOptionsToCreate` option for `diffIndexes()`, which was added in Mongoose 8.10.0.
Mongoose Studio now requires Mongoose 8.10 or later, or Mongoose 9.

## 0.7.1

* fix: Remove createChatMessage and streamChatMessage from MCP, MCP should not be using LLM chat

## 0.7.0

### MCP support for Next.js and Vercel

Mongoose Studio's MCP endpoint now works on Next.js and standalone Vercel Functions, not only Express.
MCP uses the same defaults as Express: it is enabled by default without an `apiKey`, and with an `apiKey` it requires `mcp: true` and `publicUrl` and uses OAuth.

For Next.js, rename `pages/api/studio.js` to the optional catch-all route `pages/api/studio/[[...studioRoute]].js`.
The same `vercelAPIRouteHandler()` handles Studio actions at `/api/studio`, MCP at `/api/studio/mcp`, and OAuth metadata at `/api/studio/.well-known/oauth-protected-resource`.
`withMongooseStudio()` now accepts a second `options` argument with `mcp`, `apiKey`, and `publicUrl`, and adds rewrites so MCP clients connect to `/studio/mcp`:

```javascript
// next.config.js
export default withMongooseStudio({ reactStrictMode: true }, {
  mcp: true,
  publicUrl: process.env.MONGOOSE_STUDIO_PUBLIC_URL
});

// pages/api/studio/[[...studioRoute]].js
export default vercelAPIRouteHandler(db, {
  apiKey: process.env.MONGOOSE_STUDIO_API_KEY,
  mcp: true,
  publicUrl: process.env.MONGOOSE_STUDIO_PUBLIC_URL
});
```

For standalone Vercel Functions, keep `api/studio.js` for Studio actions and add `api/studio-mcp.js` using the new `vercelMCPRouteHandler()`:

```javascript
// api/studio-mcp.js
const { vercelMCPRouteHandler } = require('@mongoosejs/studio/vercel');

module.exports = vercelMCPRouteHandler(mongoose, {
  apiKey: process.env.MONGOOSE_STUDIO_API_KEY,
  publicUrl: process.env.MONGOOSE_STUDIO_PUBLIC_URL
});
```

With an `apiKey` and `mcp: true`, building the frontend with `frontend()` now writes the OAuth protected resource metadata to `frontend/public/.well-known/oauth-protected-resource` and registers `/api/studio-mcp` with the authorization server.
Copy the frontend only after the `frontend()` promise resolves, and make sure the copy includes hidden directories such as `.well-known`.
See the README for the full Vercel setup.

### Breaking: Vercel and Next.js handlers without an API key are limited to localhost

`vercelAPIRouteHandler()` now applies the same `bindIp` restriction as the Express integration.
Without an `apiKey`, Studio API actions and MCP requests are only accepted from localhost by default, and other clients get a 403.
On Vercel, the client IP comes from the `x-vercel-forwarded-for` header, so a deployed handler without an `apiKey` rejects every request unless you configure `bindIp`.

Set `bindIp` to an IP address or an array of IP addresses to allow specific clients, or set `bindIp: null` to restore the previous behavior of accepting requests from any IP:

```javascript
const handler = vercelAPIRouteHandler(db, {
  bindIp: null
});
```

Handlers configured with an `apiKey` are unaffected.

## 0.6.1

### Safer MCP defaults with API keys

MCP now defaults to disabled when Mongoose Studio is configured with an `apiKey`. Existing API-key integrations therefore continue to start without requiring additional MCP configuration.

To enable OAuth-protected MCP, set `mcp: true` and provide `publicUrl` with the publicly reachable base URL where Mongoose Studio is mounted:

```javascript
app.use('/studio', await studio('/studio/api', mongoose, {
  apiKey: process.env.MONGOOSE_STUDIO_API_KEY,
  mcp: true,
  publicUrl: 'https://myproduct.app/studio'
}));
```

Mongoose Studio only requires `publicUrl` when both `apiKey` and `mcp: true` are set. Without an API key, MCP remains enabled by default and protected by `bindIp`.

## 0.6.0

### MCP support

Mongoose Studio now serves an MCP endpoint at `<mount>/mcp` using the same access controls as the rest of Mongoose Studio.

- MCP is enabled by default. Without an API key, access is protected by `bindIp`, so only clients running on the same machine can connect by default.
- Set `mcp: false` to disable the MCP endpoint and its OAuth discovery metadata.
- With an `apiKey`, MCP uses OAuth and requires `publicUrl` containing the publicly reachable base URL where Mongoose Studio is mounted, such as `https://myproduct.app/studio`.

```javascript
app.use('/studio', await studio('/studio/api', mongoose, {
  apiKey: process.env.MONGOOSE_STUDIO_API_KEY,
  publicUrl: 'https://myproduct.app/studio'
}));
```

Mongoose Studio throws an error during setup when MCP is enabled with an `apiKey` but `publicUrl` is missing.
