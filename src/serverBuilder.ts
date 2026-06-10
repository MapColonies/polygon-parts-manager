import express, { Router } from 'express';
import bodyParser from 'body-parser';
import { getErrorHandlerMiddleware } from '@map-colonies/error-express-handler';
import { httpLogger } from '@map-colonies/express-access-log-middleware';
import type { Logger } from '@map-colonies/js-logger';
import { type OpenapiRouterConfig, OpenapiViewerRouter } from '@map-colonies/openapi-express-viewer';
import { collectMetricsExpressMiddleware } from '@map-colonies/prometheus';
import compression from 'compression';
import { middleware as OpenApiMiddleware } from 'express-openapi-validator';
import { Registry } from 'prom-client';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from './common/constants';
import type { IConfig } from './common/interfaces';
import { POLYGON_PARTS_ROUTER_SYMBOL } from './polygonParts/routes/polygonPartsRouter';
import { HISTORY_ROUTER_SYMBOL } from './polygonParts/routes/historyRouter';

@injectable()
export class ServerBuilder {
  private readonly serverInstance: express.Application;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.METRICS) private readonly metricsRegistry: Registry,
    @inject(POLYGON_PARTS_ROUTER_SYMBOL) private readonly polygonPartsRouter: Router,
    @inject(HISTORY_ROUTER_SYMBOL) private readonly historyRouter: Router
  ) {
    this.serverInstance = express();
  }

  public build(): express.Application {
    this.registerPreRoutesMiddleware();
    this.buildRoutes();
    this.registerPostRoutesMiddleware();

    return this.serverInstance;
  }

  private buildDocsRoutes(): void {
    const openapiRouter = new OpenapiViewerRouter({
      ...this.config.get<OpenapiRouterConfig>('openapiConfig'),
      filePathOrSpec: this.config.get<string>('openapiConfig.filePath'),
    });
    openapiRouter.setup();
    this.serverInstance.use(this.config.get<string>('openapiConfig.basePath'), openapiRouter.getRouter());
  }

  private buildRoutes(): void {
    this.serverInstance.use('/polygonParts', this.polygonPartsRouter);
    this.serverInstance.use('/', this.historyRouter);
    this.buildDocsRoutes();
  }

  private registerPreRoutesMiddleware(): void {
    this.serverInstance.use(collectMetricsExpressMiddleware({ registry: this.metricsRegistry }));
    this.serverInstance.use(httpLogger({ logger: this.logger, ignorePaths: ['/metrics'] }));

    if (this.config.get<boolean>('server.response.compression.enabled')) {
      this.serverInstance.use(compression(this.config.get<compression.CompressionFilter>('server.response.compression.options')));
    }

    this.serverInstance.use(bodyParser.json(this.config.get('server.request.payload')));

    const ignorePathRegex = new RegExp(`^${this.config.get<string>('openapiConfig.basePath')}/.*`, 'i');
    const apiSpecPath = this.config.get<string>('openapiConfig.filePath');
    this.serverInstance.use(OpenApiMiddleware({ apiSpec: apiSpecPath, validateRequests: true, ignorePaths: ignorePathRegex }));
  }

  private registerPostRoutesMiddleware(): void {
    this.serverInstance.use(getErrorHandlerMiddleware());
  }
}
