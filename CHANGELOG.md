# Changelog

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
