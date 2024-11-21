import { InternalServerError, NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SelectQueryBuilder } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { SERVICES } from '../../common/constants';
import { CatalogClient } from '../../httpClient/catalogClient';
import { PolygonPart } from '../../polygonParts/DAL/polygonPart';
import { getEntitiesNames, isPolygonType } from '../../polygonParts/DAL/utils';
import { PolygonPartsPayload } from '../../polygonParts/models/interfaces';
import type { AggregationMetadata, AggregationParams } from './interfaces';

@injectable()
export class AggregationManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONNECTION_MANAGER) private readonly connectionManager: ConnectionManager,
    @inject(CatalogClient) private readonly catalogClient: CatalogClient
  ) {}
  public async getAggregationMetadata(aggregationParams: AggregationParams): Promise<AggregationMetadata> {
    const logger = this.logger.child({ catalogId: aggregationParams.catalogId });
    logger.info({ msg: 'metadata aggregation request' });

    const findOptions = { id: aggregationParams.catalogId };
    const layerMetadatas = await this.catalogClient.find(findOptions);
    const layerMetadata = layerMetadatas.at(0);

    if (layerMetadata === undefined) {
      throw new NotFoundError('Could not find a catalog layer for the requested id');
    }

    if (layerMetadata.metadata?.productId === undefined) {
      throw new InternalServerError('Catalog layer for the requested id is missing a product id value');
    }

    if (layerMetadata.metadata.productType === undefined) {
      throw new InternalServerError('Catalog layer for the requested id is missing a product type value');
    }

    const { productId, productType } = layerMetadata.metadata;
    if (!isPolygonType(productType)) {
      throw new Error('Unsupported aggregation product type');
    }

    const aggregationQuery = this.buildAggregationQuery({ productId, productType });

    try {
      const aggregation = await aggregationQuery.getRawOne<AggregationMetadata>();

      if (aggregation === undefined) {
        throw new InternalServerError('Could not calculate aggregation');
      }

      return aggregation;
    } catch (error) {
      const errorMessage = `Could not aggregate polygon parts`;
      this.logger.error({ msg: errorMessage, error });
      throw new InternalServerError(errorMessage);
    }
  }

  private buildAggregationQuery({ productId, productType }: Pick<PolygonPartsPayload, 'productId' | 'productType'>): SelectQueryBuilder<PolygonPart> {
    const dataSource = this.connectionManager.getDataSource();
    const polygonPart = dataSource.getRepository(PolygonPart);

    const polygonPartTableName = getEntitiesNames({ productId, productType }).polygonParts.databaseObjectQualifiedName;
    polygonPart.metadata.tablePath = polygonPartTableName;

    return polygonPart
      .createQueryBuilder()
      .select('min("polygon_part".imaging_time_begin_utc)::timestamptz', 'imagingTimeBeginUTC')
      .addSelect('max("polygon_part".imaging_time_end_utc)::timestamptz', 'imagingTimeEndUTC')
      .addSelect('max("polygon_part".resolution_degree)::numeric', 'maxResolutionDeg')
      .addSelect('min("polygon_part".resolution_degree)::numeric', 'minResolutionDeg')
      .addSelect('max("polygon_part".resolution_meter)::numeric', 'maxResolutionMeter')
      .addSelect('min("polygon_part".resolution_meter)::numeric', 'minResolutionMeter')
      .addSelect('max("polygon_part".horizontal_accuracy_ce90)::real', 'maxHorizontalAccuracyCE90')
      .addSelect('min("polygon_part".horizontal_accuracy_ce90)::real', 'minHorizontalAccuracyCE90')
      .addSelect((subQuery) => {
        return subQuery.select(`string_agg("sensors_sub_query".sensors_records, ', ')::text`).from((innerSubQuery) => {
          return innerSubQuery
            .select(`DISTINCT unnest(string_to_array("polygon_part".sensors, ','))`, 'sensors_records')
            .from(polygonPartTableName, 'polygon_part')
            .orderBy('sensors_records', 'ASC');
        }, 'sensors_sub_query');
      }, 'sensors')
      .addSelect('ST_AsGeoJSON(ST_Union("polygon_part".footprint))::json', 'footprint')
      .from(polygonPartTableName, 'polygon_part');
  }
}
