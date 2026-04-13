declare module '@mongoosejs/studio' {
  import { RequestHandler } from 'express';
  import mongoose from 'mongoose';

  const express: (
    path: string,
    connOrMongoose?: mongoose.Connection | mongoose.Mongoose,
    options?: { apiKey?: string }
  ) => RequestHandler;

  const studio: {
    express: typeof express;
  };

  export = studio;
}
