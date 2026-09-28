'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');

const archetypeToZodSchema = require('./util/archetypeToZodSchema');
const authorize = require('./authorize');
const packageJson = require('../package.json');

// Params that only trusted middleware may set. `maxTimeMS` and `readPreference`
// are the limits from the caller's authorization, so an MCP client must not be
// able to name them.
const reservedParams = new Set([
  '$workspaceId',
  'authorization',
  'initiatedBy',
  'initiatedById',
  'maxTimeMS',
  'readPreference',
  'roles',
  'userId'
]);

const nodeEnv = process.env.NODE_ENV;

module.exports = function mcp(backend) {
  return async function mongooseStudioMCP(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed' },
        id: null
      });
    }

    const server = createServer(backend, req._internals || {}, req);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: err.message },
          id: null
        });
      }
    } finally {
      await transport.close().catch(() => {});
      await server.close().catch(() => {});
    }
  };
};

function createServer(backend, requestContext, req) {
  const server = new McpServer({
    name: 'mongoose-studio' + (nodeEnv ? ` (-${nodeEnv})` : ''),
    version: packageJson.version
  });

  for (const namespace of ['Dashboard', 'Model']) {
    for (const [action, actionFn] of Object.entries(backend[namespace])) {
      const actionName = `${namespace}.${action}`;
      if (!isAuthorized(actionName, requestContext.roles)) {
        continue;
      }
      const tags = actionFn.tags || [];
      const inputSchema = archetypeToZodSchema(actionFn.paramsType);
      const internalParams = Object.fromEntries(
        Object.keys(inputSchema.shape).filter(key => reservedParams.has(key)).map(key => [key, true])
      );
      server.registerTool(actionName, {
        description: `Run the Mongoose Studio ${actionName} action`,
        inputSchema: inputSchema.omit(internalParams),
        annotations: {
          readOnlyHint: tags.includes('readOnly'),
          destructiveHint: tags.includes('destructive'),
          idempotentHint: tags.includes('readOnly')
        }
      }, async(args, extra) => {
        const params = Object.fromEntries(
          Object.entries(args || {}).filter(([key]) => !reservedParams.has(key))
        );
        Object.assign(params, requestContext);

        try {
          let result = actionFn(params, req, { setHeader: () => {} });
          if (result != null && typeof result[Symbol.asyncIterator] === 'function') {
            const chunks = [];
            const iterator = result[Symbol.asyncIterator]();
            const abort = () => iterator.return?.();
            extra.signal.addEventListener('abort', abort);
            try {
              for await (const chunk of { [Symbol.asyncIterator]: () => iterator }) {
                chunks.push(chunk);
              }
            } finally {
              extra.signal.removeEventListener('abort', abort);
            }
            result = chunks;
          } else {
            result = await result;
          }

          return { content: [{ type: 'text', text: stringifyResult(result) }] };
        } catch (err) {
          return {
            isError: true,
            content: [{ type: 'text', text: err?.message || 'Mongoose Studio action failed' }]
          };
        }
      });
    }
  }

  return server;
}

// Only advertise the tools this request is actually allowed to call, so a
// read-only user or a read-only OAuth grant does not see write tools at all.
function isAuthorized(actionName, roles) {
  try {
    authorize(actionName, roles);
    return true;
  } catch (err) {
    return false;
  }
}

function stringifyResult(result) {
  if (typeof result === 'string') {
    return result;
  }
  return JSON.stringify(result ?? null, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2);
}
