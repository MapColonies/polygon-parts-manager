import { getConfig, initConfig } from '../../src/common/config';
import type { IConfig } from '../../src/common/interfaces';

/**
 * Initializes the config in offline mode for tests. Must be awaited (in a
 * `beforeAll`) before resolving the app or reading domain config.
 */
export const initConfigForTests = async (): Promise<void> => {
  await initConfig(true);
};

/**
 * Returns the initialized config instance typed as the domain {@link IConfig},
 * so tests can read service-specific keys (e.g. `db`, `application`) that live
 * outside the boilerplate schema.
 */
export const getConfigForTests = (): IConfig => getConfig() as unknown as IConfig;
