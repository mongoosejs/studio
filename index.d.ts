declare module '@mongoosejs/studio' {
  import { RequestHandler } from 'express';
  import { Connection, Mongoose } from 'mongoose';

  const express: (
    path?: string,
    connOrMongoose?: Connection | Mongoose,
    options?: {
      apiKey?: string;
      bindIp?: string | string[] | null;
      maxTimeMS?: number;
      /** Serve the MCP endpoint at `<mount>/mcp`. Defaults to true. */
      mcp?: boolean;
      readPreference?: 'primary' | 'secondaryPreferred' | 'secondary';
      /** Public base URL Mongoose Studio is mounted on. Required when MCP and apiKey are enabled. */
      publicUrl?: string;
    }
  ) => Promise<RequestHandler>;

  const studio: {
    express: typeof express;
  };

  export = studio;
}
