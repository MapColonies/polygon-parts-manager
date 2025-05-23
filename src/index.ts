/* eslint-disable import/first */
// this import must be called before the first import of tsyringe
import 'reflect-metadata';
import { createServer } from 'http';
import { createTerminus } from '@godaddy/terminus';
import { Logger } from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import config from 'config';
import { DEFAULT_SERVER_PORT, SERVICES } from './common/constants';

import { getApp } from './app';

const port: number = config.get<number>('server.port') || DEFAULT_SERVER_PORT;

const stubHealthcheck = async (): Promise<void> => Promise.resolve();
getApp()
  .then((app) => {
    const logger = container.resolve<Logger>(SERVICES.LOGGER);
    const onSignal = container.resolve<() => Promise<unknown>>('onSignal');
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const server = createTerminus(createServer(app), { healthChecks: { '/liveness': stubHealthcheck }, onSignal });

    server.listen(port, () => {
      logger.info(`app started on port ${port}`);
    });
  })
  .catch((error) => {
    console.error(error);
    throw error;
  });
