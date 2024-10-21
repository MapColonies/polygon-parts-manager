import jsLogger, { type LoggerOptions } from '@map-colonies/js-logger';
import { Metrics, getOtelMixin } from '@map-colonies/telemetry';
import { metrics as OtelMetrics, trace } from '@opentelemetry/api';
import config from 'config';
import { container, instanceCachingFactory } from 'tsyringe';
import { type DependencyContainer } from 'tsyringe/dist/typings/types';
import { ConnectionManager } from './common/connectionManager';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { tracing } from './common/tracing';
import { POLYGON_PARTS_ROUTER_SYMBOL, polygonPartsRouterFactory } from './polygonParts/routes/polygonPartsRouter';

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
        useFactory: instanceCachingFactory((dependencyContainer) => {
          const connectionManager = dependencyContainer.resolve(ConnectionManager);
          return connectionManager;
        }),
      },
      dependencyRegistration: async (): Promise<void> => {
        const connectionManager = container.resolve(ConnectionManager);
        await connectionManager.init();
        container.register(SERVICES.CONNECTION_MANAGER, { useValue: connectionManager });
      },
    },
    {
      token: POLYGON_PARTS_ROUTER_SYMBOL,
      provider: { useFactory: polygonPartsRouterFactory },
    },
    {
      token: 'onSignal',
      provider: {
        useFactory: (): (() => Promise<unknown>) => {
          const connectionManager = container.resolve<ConnectionManager>(ConnectionManager);
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
