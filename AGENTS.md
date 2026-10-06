# Repository guidance

The project's name is Mongoose Studio. Do not refer to the project as "Studio" - the repository is named "studio" to maintain parity between the npm package name `@mongoosejs/studio` and the GitHub repository `mongoosejs/studio`.

The Mongoose connection passed to Mongoose Studio is owned by the host application.
Do not change connection-level settings, options, configuration, models, middleware, plugins, collection objects, or methods on the application connection to implement Studio behavior.
Apply Mongoose-Studio-specific behavior to individual operations whenever possible.
When isolation requires a derived connection, copy any Mongoose state that `useDb()` shares with its source before changing the derived connection.
Sandbox wrappers must remain confined to sandbox-owned models and collections.

# Frontend Guidelines

Conceptually, the frontend's job is to render the data and provide a user interface for accessing API calls.
The frontend should minimize transformations and renaming of data provided by the backend: default to displaying the raw data as-is.

## API Client

`src/client/api.js` exposes one wrapper function per backend action; every wrapper POSTs to `${baseUrl}/<endpoint>` and resolves with the response payload directly (`res.data`), not the axios response. The endpoint list lives in `src/endpoints.js`, which `build.js` generates from the files in `backend/actions/` — do not edit it by hand. Flat action files become flat wrappers like `api.addToCart`, while capitalized `Model/action.js` directories become namespaced wrappers like `api.quote.createQuote`, so adding an action file automatically makes its wrapper available on the next build.

## Vue User Input

Prefer explicit DOM event handlers such as `@change`, `@input`, and `@update:modelValue` over `watch` for reacting to user input. Use `watch` only when the behavior is truly derived from state changes that do not have a single clear DOM event source.

## Vue Templates

Prefer safe property access directly in HTML over computed properties or methods for simple display values. For example, use `{{ user?.name ?? '-' }}` instead of creating a `userName` computed property. Keep display behavior local unless the logic is reused or too complex to read inline.

Prefer using mustache interpolation (`{{ expr }}`) over `v-text` for rendering text values in Vue templates.

## Component API Ownership

Components that present an async action must own the API request for that action. Do not emit an event to a parent solely so the parent can make the HTTP request. Emit events after the component finishes the request when the parent needs to close a modal, refresh a list, or update surrounding state.

## Async Buttons

For a button that triggers an async action, use the `<async-button>` component instead of tracking a `saveStatus`/`loading` flag by hand. It manages the in-progress state, disables itself while running, and shows a spinner. Do not add a component-level status property, a `try/finally` to reset it, or `.finally()` on the API call just to toggle a button label.

```html
<!-- ❌ Incorrect: hand-rolled status + disabled + label swap -->
<button :disabled="saveStatus === 'saving'" @click="save">
  <span v-if="saveStatus === 'saving'">Saving...</span>
  <span v-else>Save</span>
</button>

<!-- ✅ Correct -->
<async-button @click="save">Save</async-button>
```

The click handler is just an `async` method that does the work; let errors propagate to the global handler. Keep any real `:disabled` condition (e.g. invalid input) — `async-button` ORs it with its own in-progress state.

## Avoid trivial helpers

Minimize scattered helpers on the frontend - functions and computed properties carry real cognitive overhead and need to earn their existence.
Optimize for locality and terseness over abstraction.

For example, instead of:

```
computed: {
  displayName() {
    return `${user.firstName} ${user.lastName}`;
  }
}
```

and:

<div>{{ displayName }}</div>

Write:

<div>{{ user.firstName }} {{ user.lastName }}</div>

No single-expression helper functions or computed properties unless there's heavy repetition (25+ instances).
