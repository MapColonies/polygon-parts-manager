import jsLogger, { type LoggerOptions } from '@map-colonies/js-logger';
import { Metrics, getOtelMixin } from '@map-colonies/telemetry';
import { metrics as OtelMetrics, trace } from '@opentelemetry/api';
import config from 'config';
import type { DependencyContainer } from 'tsyringe/dist/typings/types';
import { ConnectionManager } from './common/connectionManager';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { registerDependencies, type InjectionObject, type Providers } from './common/dependencyRegistration';
import { tracing } from './common/tracing';
import { POLYGON_PARTS_ROUTER_SYMBOL, polygonPartsRouterFactory } from './polygonParts/routes/polygonPartsRouter';
import { AGGREGATION_ROUTER_SYMBOL, aggregationRouterFactory } from './aggregation/routes/aggregationRouter';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });

  const metrics = new Metrics();
  metrics.start();

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METER, provider: { useValue: OtelMetrics.getMeterProvider().getMeter(SERVICE_NAME) } },
    {
      token: SERVICES.CONNECTION_MANAGER,
      provider: {
        useAsync: async (dependencyContainer: DependencyContainer): Promise<Providers<ConnectionManager>> => {
          const connectionManager = dependencyContainer.resolve(ConnectionManager);
          await connectionManager.init();
          return { useValue: connectionManager };
        },
      },
    },
    {
      token: AGGREGATION_ROUTER_SYMBOL,
      provider: { useFactory: aggregationRouterFactory },
    },
    {
      token: POLYGON_PARTS_ROUTER_SYMBOL,
      provider: { useFactory: polygonPartsRouterFactory },
    },
    {
      token: 'onSignal',
      provider: {
        useFactory: (dependencyContainer: DependencyContainer): (() => Promise<unknown>) => {
          const connectionManager = dependencyContainer.resolve<ConnectionManager>(SERVICES.CONNECTION_MANAGER);
          return async () => {
            return Promise.all([tracing.stop(), metrics.stop(), connectionManager.destroy()]);
          };
        },
      },
    },
  ];
  const registeredDependencies = await registerDependencies(dependencies, options?.override, options?.useChild);
  return registeredDependencies;
};
