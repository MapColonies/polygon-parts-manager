import { Application } from 'express';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { ServerBuilder } from './serverBuilder';
import { ConnectionManager } from './common/connectionManager';

async function getApp(registerOptions?: RegisterOptions): Promise<Application> {
  const container = registerExternalValues(registerOptions);
  const dbConnectionManager = container.resolve(ConnectionManager);
  await dbConnectionManager.init();
  const app = container.resolve(ServerBuilder).build();
  return app;
}

export { getApp };
