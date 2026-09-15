# Repository guidance

The Mongoose connection passed to Studio is owned by the host application.
Do not change connection-level settings, options, configuration, models, middleware, plugins, collection objects, or methods on the application connection to implement Studio behavior.
Apply Studio-specific behavior to individual operations whenever possible.
When isolation requires a derived connection, copy any Mongoose state that `useDb()` shares with its source before changing the derived connection.
Sandbox wrappers must remain confined to sandbox-owned models and collections.
