declare module '@mongoosejs/studio/nest' {
  import { DynamicModule, MiddlewareConsumer, NestModule } from '@nestjs/common';
  import { Connection, Mongoose } from 'mongoose';

  export interface MongooseStudioModuleOptions {
    path?: string;
    apiPath?: string;
    connection?: Connection | Mongoose;
    connectionToken?: string | symbol | Function;
    apiKey?: string;
    bindIp?: string | string[] | null;
    [key: string]: any;
  }

  export interface MongooseStudioModuleAsyncOptions {
    imports?: any[];
    inject?: any[];
    connectionToken?: string | symbol | Function;
    useFactory: (...args: any[]) => Promise<MongooseStudioModuleOptions> | MongooseStudioModuleOptions;
  }

  export class MongooseStudioModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void;
    static forRoot(options?: MongooseStudioModuleOptions): DynamicModule;
    static forRootAsync(options: MongooseStudioModuleAsyncOptions): DynamicModule;
  }
}
