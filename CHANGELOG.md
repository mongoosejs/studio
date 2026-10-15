# Changelog

## 0.7.0

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
