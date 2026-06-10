import { jsLogger, type Logger } from '@map-colonies/js-logger';
import { getOtelMixin } from '@map-colonies/tracing-utils';
import { trace } from '@opentelemetry/api';
import { Registry } from 'prom-client';
import type { DependencyContainer } from 'tsyringe/dist/typings/types';
import { getConfig } from './common/config';
import { ConnectionManager } from './common/connectionManager';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { DataSourceLogger } from './common/dataSourceLogger';
import { registerDependencies, type InjectionObject, type Providers } from './common/dependencyRegistration';
import type { DbConfig, IConfig } from './common/interfaces';
import { getTracing } from './common/tracing';
import { POLYGON_PARTS_ROUTER_SYMBOL, polygonPartsRouterFactory } from './polygonParts/routes/polygonPartsRouter';
import { HISTORY_ROUTER_SYMBOL, historyRouterFactory } from './polygonParts/routes/historyRouter';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const configInstance = getConfig();

  const loggerConfig = configInstance.get('telemetry.logger');
  const logger = await jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });

  const tracer = trace.getTracer(SERVICE_NAME);
  const metricsRegistry = new Registry();
  configInstance.initializeMetrics(metricsRegistry);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: configInstance } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METRICS, provider: { useValue: metricsRegistry } },
    {
      token: DataSourceLogger,
      provider: {
        useFactory: (dependencyContainer: DependencyContainer): DataSourceLogger => {
          const config = dependencyContainer.resolve<IConfig>(SERVICES.CONFIG);
          const logger = dependencyContainer.resolve<Logger>(SERVICES.LOGGER);
          const loggerOptions = config.get<DbConfig['logging']>('db.logging') ?? true;
          return new DataSourceLogger(logger, loggerOptions);
        },
      },
    },
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
      token: POLYGON_PARTS_ROUTER_SYMBOL,
      provider: { useFactory: polygonPartsRouterFactory },
    },
    {
      token: HISTORY_ROUTER_SYMBOL,
      provider: { useFactory: historyRouterFactory },
    },
    {
      token: 'onSignal',
      provider: {
        useFactory: (dependencyContainer: DependencyContainer): (() => Promise<unknown>) => {
          const connectionManager = dependencyContainer.resolve<ConnectionManager>(SERVICES.CONNECTION_MANAGER);
          return async () => {
            return Promise.all([getTracing().stop(), connectionManager.destroy()]);
          };
        },
      },
    },
  ];
  const registeredDependencies = await registerDependencies(dependencies, options?.override, options?.useChild);
  return registeredDependencies;
};
