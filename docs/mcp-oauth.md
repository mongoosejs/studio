# MCP OAuth

Mongoose Studio lets a user connect an MCP client, such as ChatGPT or Claude, to a Studio deployment using OAuth 2.1.
The client never receives MongoDB credentials, a connection string, or the workspace API key.
It receives a short-lived access token that only works against one Studio deployment and only does what the user approved.

## Who does what

The Studio deployment in your application is the OAuth *protected resource*.
The Mongoose Studio mothership is the OAuth *authorization server*.

Studio therefore never issues, stores, or validates MCP tokens by itself.
It publishes metadata that tells clients where the authorization server is, and it asks the authorization server to resolve each incoming token.

## The flow

1. The user adds the Studio MCP URL, for example `https://app.example.com/studio/mcp`, to ChatGPT or Claude.
2. The client calls the MCP endpoint with no token and gets a `401` with a `WWW-Authenticate: Bearer resource_metadata="..."` header.
3. The client fetches that protected resource metadata document from Studio, which names the authorization server and the resource identifier.
4. The client fetches the authorization server metadata, registers itself dynamically, and opens the Studio authorization page in a browser.
5. The user signs in to Mongoose Studio if necessary, reviews the access being delegated, adjusts it if they have a choice, and authorizes.
6. The authorization server redirects back to the client with a single-use authorization code.
7. The client exchanges the code plus its PKCE verifier for a short-lived access token and a refresh token.
8. On every MCP request, Studio asks the authorization server to resolve the access token, and runs the request under the policy it returns.

Authorization Code with PKCE (`S256`) is required, and there are no client secrets: MCP clients are public clients.
Access tokens live 15 minutes.
Refresh tokens live 30 days and rotate on every use, so a user does not have to reconnect the client regularly.

## Authorization grants

Approving the authorization page creates an `MCPOAuthGrant` on the mothership.
The grant records who delegated the access, the workspace and Studio deployment it applies to, which OAuth client it was issued to, and the capabilities that were approved:

```javascript
{
  userId,
  workspaceId,
  resource,       // canonical URL of the Studio MCP endpoint, the environment being accessed
  oauthClientId,
  oauthClientName,
  capabilities: {
    read: true,
    write: false,
    readPreference: 'secondary',
    maxTimeMS: 5000,
    collections: '*'
  },
  lastUsedAt,
  revokedAt
}
```

A Studio workspace is the organization and project unit, and `resource` identifies the individual deployment, so a grant is scoped to exactly one database environment.

Access tokens are opaque references to a grant, not copies of it.
Nothing about the policy is embedded in the token, which is what makes the following true:

- Revoking a grant, or revoking the client's refresh token, stops the client immediately.
- Editing a grant changes what the client may do on its next request, without issuing a new credential.
- Changing the user's workspace roles or the workspace MCP policy changes what the client may do, again on its next request.

## Effective authorization

The access delegated to an MCP client is the intersection of four things:

1. The workspace `mcpPolicy`.
2. The member's `mcpPolicy`.
3. The member's Studio roles.
4. The capabilities on the grant.

Every layer can only take access away.
A read-only user cannot delegate write access, a user capped at secondary reads cannot delegate primary reads, and a user capped at 5 seconds cannot delegate 30 seconds.
The authorization page only offers options that are valid reductions of what the user already has, and the server intersects the request again before storing it, so a tampered request cannot widen a grant.

Studio enforces the resolved policy per request:

- `write: false` downgrades the request's roles, so write actions are neither offered as MCP tools nor callable.
- `maxTimeMS` and `readPreference` travel as request params, set from the grant by trusted middleware, and every Studio action applies them to its MongoDB operations, including operations inside dashboard and document scripts.

The Studio action tree is built once, with one set of options, so these limits are per request rather than per mount.
They can only narrow what the host application already allows: `maxTimeMS` is capped by the `maxTimeMS` option when one is configured, and a read preference is resolved to whichever of the configured and requested values is more restrictive.
`maxTimeMS` and `readPreference` are also reserved MCP params, so they are not offered to MCP clients as tool inputs and a client cannot name them itself.

## Configuration

The Studio side needs a Pro API key and needs to know its own externally reachable URL, since the resource identifier is that URL.
Studio derives it from `X-Forwarded-Proto` and `X-Forwarded-Host`, or you can set it explicitly:

```javascript
app.use('/studio', await studio('/studio/api', mongoose, {
  apiKey: process.env.MONGOOSE_STUDIO_API_KEY,
  publicUrl: 'https://app.example.com/studio'
}));
```

Pass `mcp: false` to serve Studio without an MCP endpoint at all.
Neither the endpoint nor its protected resource metadata is then mounted, so there is nothing for an MCP client to discover.

Studio registers that URL with the authorization server the first time a client asks for its protected resource metadata, which is how an OAuth `resource` parameter is mapped back to a workspace.
That registration response also reports the authorization server's own issuer identifier, which Studio then advertises in `authorization_servers`.
So the issuer has one source of truth: the `MCP_OAUTH_ISSUER` the mothership runs with.
Set `authorizationServerUrl` to override it, which is worth doing when Studio reaches its mothership on a different URL than MCP clients do.

Browser based MCP clients, claude.ai among them, run discovery from the page rather than from a server.
Studio therefore serves the MCP endpoint and its metadata with CORS, and exposes `WWW-Authenticate` via `Access-Control-Expose-Headers`.
Without that last header a browser hides the challenge from the client, and the client cannot find the authorization server at all.
