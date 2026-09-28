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
      readPreference?: 'primary' | 'secondaryPreferred' | 'secondary';
      /** Public base URL Studio is mounted on, used as the MCP OAuth resource identifier. */
      publicUrl?: string;
      /** Issuer URL of the MCP OAuth authorization server. Defaults to the Mongoose Studio mothership. */
      authorizationServerUrl?: string;
    }
  ) => Promise<RequestHandler>;

  const studio: {
    express: typeof express;
  };

  export = studio;
}
