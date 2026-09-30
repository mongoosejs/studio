# Mongoose Studio

An AI-Powered Data Workspace for MongoDB: Turn your MongoDB data into dashboards, maps, and interactive workflows - powered by your Mongoose models.

![NPM Version](https://img.shields.io/npm/v/@mongoosejs/studio)

## Getting Started

Mongoose Studio is meant to run as a [sidecar](https://learn.microsoft.com/en-us/azure/architecture/patterns/sidecar) to your Node.js application, using the same Mongoose connection config.
If your app runs on `acme.app`, Mongoose Studio will be on `acme.app/studio` or whichever path you prefer.
For local dev, if your app runs on `localhost:3000`, Mongoose Studio will be on `localhost:3000/studio`.

By default, Mongoose Studio does **not** provide any authentication or authorization.
You can use Mongoose Studio for free for local development, but we recommend [Mongoose Studio Pro](https://studio.mongoosejs.io/#pricing) for when you want to go into production.
When you omit an API key, Mongoose Studio only accepts localhost connections by default.

First, `npm install @mongoosejs/studio`.

### Express

Mongoose Studio can be mounted as Express middleware as follows.

```javascript
const mongoose = require('mongoose');
const studio = require('@mongoosejs/studio/express');

// Mount Mongoose Studio on '/studio'
// If your models are registered on a different connection, pass in the connection instead of `mongoose`
app.use('/studio', await studio('/studio/api', mongoose));
````

If you have a Mongoose Studio Pro API key, you can set it as follows:

```javascript
const opts = process.env.MONGOOSE_STUDIO_API_KEY ? { apiKey: process.env.MONGOOSE_STUDIO_API_KEY } : {};
// Optionally specify which ChatGPT model to use for chat messages
opts.model = 'gpt-4o-mini';
// Provide your own OpenAI, Anthropic, or Google Gemini API key to run chat completions locally
opts.openAIAPIKey = process.env.OPENAI_API_KEY;
opts.anthropicAPIKey = process.env.ANTHROPIC_API_KEY;
opts.googleGeminiAPIKey = process.env.GOOGLE_GEMINI_API_KEY;
// Apply a maximum execution time to all read operations, including reads in scripts.
// MongoDB does not support maxTimeMS for inserts and index operations.
// This is also a ceiling: a request may ask for a lower limit, never a higher one.
opts.maxTimeMS = 10000;

// Mount Mongoose Studio on '/studio'
app.use('/studio', await studio('/studio/api', mongoose, opts));
```

Without an API key, you can allow access from additional IP addresses with `bindIp`, similar to MongoDB's `bindIp` option. `bindIp` may be a comma-separated string or an array of exact IP addresses. Set `bindIp` to `null` to allow unauthenticated connections from anywhere.

```javascript
app.use('/studio', await studio('/studio/api', mongoose, {
  bindIp: '127.0.0.1,192.168.0.10'
}));
```

The Express integration also exposes a Streamable HTTP MCP endpoint at `/studio/mcp`.
Set `mcp: false` to turn it off, along with the OAuth protected resource metadata that advertises it.
It provides authorized Dashboard and Model actions, plus `Script.createScript`, as MCP tools.
With a Pro API key, pass the logged-in Studio access token in the `Authorization` header (either directly or as a bearer token); tools receive that user's roles and permissions.
Without workspace authentication, the MCP endpoint uses the same localhost and `bindIp` restrictions as the rest of Studio.

#### Connecting ChatGPT or Claude with OAuth

With a Pro API key, `/studio/mcp` is also an OAuth 2.1 protected resource, so MCP clients such as ChatGPT and Claude can connect to it directly.
Point the client at your `/studio/mcp` URL and it will discover the Mongoose Studio authorization server, walk the user through signing in and approving access, and receive a short-lived access token.
Users review and revoke these connections from their Mongoose Studio account page, and the access an AI client gets can never exceed the access the user who approved it already has.

Studio advertises itself to MCP clients using its externally reachable URL.
Set `publicUrl` when Studio sits behind a proxy that does not send `X-Forwarded-Proto` and `X-Forwarded-Host`:

```javascript
opts.publicUrl = 'https://app.example.com/studio';
```

Studio finds the authorization server through the mothership it is already configured to use, so this needs no configuration against the hosted mothership.
When running your own mothership on a URL that differs from the one Studio calls it on, for example behind a tunnel during development, name its issuer explicitly:

```javascript
opts.authorizationServerUrl = 'https://mothership.example.com';
```

See `docs/mcp-oauth.md` for how the flow and the delegated access policy work.

### Next.js

First, add `withMongooseStudio` to your `next.config.js` file:

```javascript
import withMongooseStudio from '@mongoosejs/studio/next';

// Mount Mongoose Studio frontend on /studio
export default withMongooseStudio({
  // Your Next.js config here
  reactStrictMode: true,
});
```

Then, add `pages/api/studio.js` to your Next.js project to host the Mongoose Studio API:

```javascript
// Make sure to import the database connection
import db from '../../src/db';
import studio from '@mongoosejs/studio/backend/next';

const handler = studio(
  db, // Mongoose connection or Mongoose global. Or null to use `import mongoose`.
  {
    apiKey: process.env.MONGOOSE_STUDIO_API_KEY, // optional
    connection: db, // Optional: Connection or Mongoose global. If omitted, will use `import mongoose`
    connectToDB: async () => { /* connection logic here */ }, // Optional: if you need to call a function to connect to the database put it here
  }
);

export default handler;
```

### Nest.js

Add `MongooseStudioModule` to your app module as follows.
Use `getConnectionToken()` so Mongoose Studio uses the same connection that `MongooseModule.forRoot()` creates.

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongooseStudioModule } from '@mongoosejs/studio/nest';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI),
    MongooseStudioModule.forRoot({
      connectionToken: getConnectionToken(),
      apiKey: process.env.MONGOOSE_STUDIO_API_KEY // optional
    })
  ]
})
export class AppModule {}
```

With this setup, Mongoose Studio is available at `/studio`.
If you mount Mongoose Studio on a different path, update the `path` option as follows.

```typescript
MongooseStudioModule.forRoot({
  path: '/__studio', // Serve on `/__studio` rather than `/studio`
  connectionToken: getConnectionToken()
})
```

### Netlify

[Here is a full example of how to add Mongoose Studio to a Netlify repo](https://github.com/mongoosejs/studio.mongoosejs.io/commit/8b02ea367c8a1b7b4bcab290708f57d58f08210b).

1) Copy the Mongoose Studio frontend into `public/studio` automatically in `npm run build`.

```javascript
const { execSync } = require('child_process');

// Sign up for Mongoose Studio Pro to get an API key, or omit `apiKey` for local dev.
const opts = {
  apiKey: process.env.MONGOOSE_STUDIO_API_KEY,
  // Optionally specify which ChatGPT model to use for chat messages
  model: 'gpt-4o-mini',
  // Provide your own OpenAI, Anthropic, or Google Gemini API key to run chat completions locally
  openAIAPIKey: process.env.OPENAI_API_KEY,
  anthropicAPIKey: process.env.ANTHROPIC_API_KEY,
  googleGeminiAPIKey: process.env.GOOGLE_GEMINI_API_KEY
};
console.log('Creating Mongoose studio', opts);
require('@mongoosejs/studio/frontend')(`/.netlify/functions/studio`, true, opts).then(() => {
  execSync(`
  mkdir -p ./public/imdb
  cp -r ./node_modules/@mongoosejs/studio/frontend/public/* ./public/imdb/
  `);
});
```

2) Create a `/studio` Netlify function in `netlify/functions/studio.js`, or wherever your Netlify functions directory is. The function path should match the `/.netlify/functions/studio` parameter in the build script above.

```javascript
const mongoose = require('mongoose');

const handler = require('@mongoosejs/studio/backend/netlify')({
  apiKey: process.env.MONGOOSE_STUDIO_API_KEY,
  model: 'gpt-4o-mini',
  openAIAPIKey: process.env.OPENAI_API_KEY,
  anthropicAPIKey: process.env.ANTHROPIC_API_KEY,
  googleGeminiAPIKey: process.env.GOOGLE_GEMINI_API_KEY
}).handler;

let conn = null;

module.exports = {
  handler: async function studioHandler(params) {
    if (conn == null) {
      conn = await mongoose.connect(process.env.MONGODB_CONNECTION_STRING, { serverSelectionTimeoutMS: 3000 });
    }

    return handler.apply(null, arguments);
  }
};
```

3) Redeploy and you're live!

Try [our IMDB demo](https://studio.mongoosejs.io/imdb/#/) for an example of Mongoose Studio running on Netlify, or check out the [studio.mongoosejs.io GitHub repo](https://github.com/mongoosejs/studio.mongoosejs.io) for the full source code.
