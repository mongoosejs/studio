# Mongoose Studio

A sleek, powerful MongoDB UI with built-in dashboarding and auth, seamlessly integrated with your Express, Vercel, or Netlify app.

![NPM Version](https://img.shields.io/npm/v/@mongoosejs/studio)

## Getting Started

Mongoose Studio is meant to run as a [sidecar](https://learn.microsoft.com/en-us/azure/architecture/patterns/sidecar) to your Node.js application, using the same Mongoose connection config.
If your app runs on `acme.app`, Studio will be on `acme.app/studio` or whichever path you prefer.
For local dev, if your app runs on `localhost:3000`, Studio will be on `localhost:3000/studio`.

By default, Mongoose Studio does **not** provide any authentication or authorization.
You can use Mongoose Studio for free for local development, but we recommend [Mongoose Studio Pro](https://studio.mongoosejs.io/#pricing) for when you want to go into production.

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

// Mount Mongoose Studio on '/studio'
app.use('/studio', await studio('/studio/api', mongoose, opts));
```

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
