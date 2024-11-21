import { Logger } from '@map-colonies/js-logger';
import { HttpClient, IHttpRetryConfig } from '@map-colonies/mc-utils';
import { IConfig } from 'config';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../common/constants';
import { FindError } from '../common/errors';
import { FindOptions, FindResponse } from '../common/interfaces';

@injectable()
export class CatalogClient extends HttpClient {
  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) protected readonly logger: Logger) {
    const serviceName = 'RasterCatalogManager';
    const baseUrl = config.get<string>('servicesUrl.catalogManager');
    const httpRetryConfig = config.get<IHttpRetryConfig>('httpRetry');
    const disableHttpClientLogs = config.get<boolean>('disableHttpClientLogs');
    super(logger, baseUrl, serviceName, httpRetryConfig, disableHttpClientLogs);
  }

  public async find(findOptions: FindOptions): Promise<FindResponse> {
    try {
      const url = '/records/find';
      const response = await this.post<FindResponse>(url, findOptions);
      return response;
    } catch (err) {
      if (err instanceof Error) {
        throw new FindError(findOptions, err);
      }
      throw err;
    }
  }
}
