'use strict';

const { Inject, Module, RequestMethod } = require('@nestjs/common');
const mongoose = require('mongoose');
const createExpressRouter = require('./express');

const MONGOOSE_STUDIO_OPTIONS = Symbol('MONGOOSE_STUDIO_OPTIONS');
const MONGOOSE_STUDIO_CONNECTION = Symbol('MONGOOSE_STUDIO_CONNECTION');
const MONGOOSE_STUDIO_EXPRESS_ROUTER = Symbol('MONGOOSE_STUDIO_EXPRESS_ROUTER');

class MongooseStudioModule {
  constructor(options, expressRouter) {
    this.options = options || {};
    this.expressRouter = expressRouter;
  }

  configure(consumer) {
    const mountPath = this.options.path || '/studio';

    consumer
      .apply((req, res, next) => {
        if (!isMountedStudioRequest(req, mountPath)) {
          return next();
        }

        const originalUrl = req.url;
        req.url = req.url.slice(normalizeExpressMountPath(mountPath).length) || '/';
        return this.expressRouter(req, res, err => {
          req.url = originalUrl;
          next(err);
        });
      })
      .forRoutes({
        path: '*path',
        method: RequestMethod.ALL
      });
  }

  static forRoot(options) {
    options = options || {};
    const providers = [
      { provide: MONGOOSE_STUDIO_OPTIONS, useValue: options },
      createExpressRouterProvider()
    ];

    if (options.connectionToken) {
      providers.push({ provide: MONGOOSE_STUDIO_CONNECTION, useExisting: options.connectionToken });
    } else if (options.connection) {
      providers.push({ provide: MONGOOSE_STUDIO_CONNECTION, useValue: options.connection });
    } else {
      providers.push({ provide: MONGOOSE_STUDIO_CONNECTION, useValue: mongoose });
    }

    return {
      module: MongooseStudioModule,
      providers,
      exports: providers
    };
  }

  static forRootAsync(options) {
    options = options || {};
    const providers = [
      {
        provide: MONGOOSE_STUDIO_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || []
      },
      createExpressRouterProvider()
    ];

    if (options.connectionToken) {
      providers.push({ provide: MONGOOSE_STUDIO_CONNECTION, useExisting: options.connectionToken });
    } else {
      providers.push({ provide: MONGOOSE_STUDIO_CONNECTION, useValue: mongoose });
    }

    return {
      module: MongooseStudioModule,
      imports: options.imports || [],
      providers,
      exports: providers
    };
  }
}

function createExpressRouterProvider() {
  return {
    provide: MONGOOSE_STUDIO_EXPRESS_ROUTER,
    useFactory: async(options, connection) => {
      options = options || {};
      const mountPath = options.path || '/studio';
      const apiPath = options.apiPath || `${mountPath}/api`;
      const studioOptions = { ...options };
      delete studioOptions.path;
      delete studioOptions.apiPath;
      delete studioOptions.connection;
      delete studioOptions.connectionToken;

      return createExpressRouter(apiPath, options.connection || connection || mongoose, studioOptions);
    },
    inject: [MONGOOSE_STUDIO_OPTIONS, MONGOOSE_STUDIO_CONNECTION]
  };
}

function isMountedStudioRequest(req, mountPath) {
  const normalizedMountPath = normalizeExpressMountPath(mountPath);
  return req.url === normalizedMountPath || req.url.startsWith(`${normalizedMountPath}/`);
}

function normalizeExpressMountPath(path) {
  path = `/${path.replace(/^\/+/, '').replace(/\/+$/, '')}`;
  return path === '/' ? '' : path;
}

Inject(MONGOOSE_STUDIO_OPTIONS)(MongooseStudioModule, undefined, 0);
Inject(MONGOOSE_STUDIO_EXPRESS_ROUTER)(MongooseStudioModule, undefined, 1);
Module({})(MongooseStudioModule);

module.exports = {
  MONGOOSE_STUDIO_CONNECTION,
  MONGOOSE_STUDIO_EXPRESS_ROUTER,
  MONGOOSE_STUDIO_OPTIONS,
  MongooseStudioModule
};
