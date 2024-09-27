declare module '@mongoosejs/studio' {
  import { RequestHandler } from 'express';

  const express: (path: string) => RequestHandler;

  const studio: {
    express: typeof express;
  };

  export = studio;
}
