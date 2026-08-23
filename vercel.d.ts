declare module '@mongoosejs/studio/vercel' {
  import { Connection, Mongoose } from 'mongoose';

  export interface VercelAPIRouteHandlerOptions {
    /** Mongoose Studio Pro API key. When set, requests must be authorized. */
    apiKey?: string;
    /** Separate connection for Studio's own collections (dashboards, chat threads). */
    studioConnection?: Connection;
    /** Watch the connection for changes and stream them to the Studio frontend. */
    changeStream?: boolean;
    /** Chat model name, e.g. 'gpt-4o-mini' */
    model?: string;
    openAIAPIKey?: string;
    anthropicAPIKey?: string;
    googleGeminiAPIKey?: string;
    [key: string]: any;
  }

  /**
   * Minimal request shape: satisfied by Next.js API routes (NextApiRequest),
   * Express, and other Node server frameworks with query/body parsing.
   */
  export interface VercelAPIRouteHandlerRequest {
    query?: Record<string, any>;
    body?: any;
    params?: Record<string, any>;
    headers: { authorization?: string | null; [key: string]: any };
  }

  /** Minimal response shape: satisfied by NextApiResponse and Express responses. */
  export interface VercelAPIRouteHandlerResponse {
    status(code: number): any;
    json(body: any): any;
    send(body: any): any;
  }

  /**
   * Creates a Mongoose Studio API handler for Next.js Pages Router API routes
   * (`pages/api/studio.js`) and other Vercel-style serverless functions.
   * Pass `null` to use the default Mongoose global.
   */
  export function vercelAPIRouteHandler(
    conn?: Connection | Mongoose | null,
    options?: VercelAPIRouteHandlerOptions
  ): (req: VercelAPIRouteHandlerRequest, res: VercelAPIRouteHandlerResponse) => Promise<any>;
}
