import { Logger } from '@map-colonies/js-logger';
import { VALIDATIONS } from '@map-colonies/mc-model-types';
import { HttpClient, type IHttpRetryConfig } from '@map-colonies/mc-utils';
import { IConfig } from 'config';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';
import { SERVICES } from '../common/constants';
import { FindError } from '../common/errors';
import type { FindOptions, FindResponse } from '../common/interfaces';
import { PRODUCT_TYPES } from '../polygonParts/models/constants';

const layerMetadatasSchema = z
  .array(
    z.object(
      {
        metadata: z.object({
          productId: z.string().regex(new RegExp(VALIDATIONS.productId.pattern), {
            message: 'Catalog layer response for the requested id is missing a product id value',
          }),
          productType: z.enum(PRODUCT_TYPES, { message: 'Catalog layer response for the requested id is missing a product type value' }),
        }),
      },
      { message: 'Catalog layer response for the requested id is missing a metadata property' }
    )
  )
  .length(1, { message: 'Could not find a catalog layer for the requested id' });

@injectable()
export class CatalogClient extends HttpClient {
  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) protected readonly logger: Logger) {
    const serviceName = 'RasterCatalogManager';
    const baseUrl = config.get<string>('servicesUrl.catalogManager');
    const httpRetryConfig = config.get<IHttpRetryConfig>('httpRetry');
    const disableHttpClientLogs = config.get<boolean>('disableHttpClientLogs');
    super(logger, baseUrl, serviceName, httpRetryConfig, disableHttpClientLogs);
  }

  public async find(findOptions: FindOptions): Promise<z.infer<typeof layerMetadatasSchema>[number]> {
    try {
      const url = '/records/find';
      const response = await this.post<FindResponse>(url, findOptions);
      const layerMetadatas = layerMetadatasSchema.parse(response);
      return layerMetadatas[0];
    } catch (err) {
      if (err instanceof Error) {
        throw new FindError(findOptions, err);
      }
      throw err;
    }
  }
}
