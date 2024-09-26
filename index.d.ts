declare module '@mongoosejs/studio' {
  import { RequestHandler } from 'express';

  const express: (path: string) => RequestHandler;

  export express;
}
