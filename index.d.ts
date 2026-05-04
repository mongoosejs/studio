declare module '@mongoosejs/studio' {
  import { RequestHandler } from 'express';
  import { Connection, Mongoose } from 'mongoose';

  const express: (
    path: string,
    connOrMongoose?: Connection | Mongoose,
    options?: { apiKey?: string; bindIp?: string | string[] | null }
  ) => RequestHandler;

  const studio: {
    express: typeof express;
  };

  export = studio;
}
