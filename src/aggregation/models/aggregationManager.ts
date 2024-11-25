import type { Logger } from '@map-colonies/js-logger';
import type { AggregationLayerMetadata } from '@map-colonies/mc-model-types';
import { inject, injectable } from 'tsyringe';
import { SelectQueryBuilder } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { SERVICES } from '../../common/constants';
import type { IConfig } from '../../common/interfaces';
import { CatalogClient } from '../../httpClient/catalogClient';
import { PolygonPart } from '../../polygonParts/DAL/polygonPart';
import { getEntitiesNames } from '../../polygonParts/DAL/utils';
import type { PolygonPartsPayload } from '../../polygonParts/models/interfaces';
import type { AggregationParams } from './interfaces';
import { aggregationMetadataSchema } from './validations';

@injectable()
export class AggregationManager {
  private readonly arraySeparator: string;
  private readonly maxDecimalDigits: number;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONNECTION_MANAGER) private readonly connectionManager: ConnectionManager,
    @inject(CatalogClient) private readonly catalogClient: CatalogClient
  ) {
    this.arraySeparator = this.config.get<string>('application.arraySeparator');
    this.maxDecimalDigits = this.config.get<number>('application.aggregation.maxDecimalDigits');
  }

  public async getAggregationLayerMetadata(aggregationParams: AggregationParams): Promise<AggregationLayerMetadata> {
    const logger = this.logger.child({ catalogId: aggregationParams.catalogId });
    logger.info({ msg: 'metadata aggregation request' });

    const findOptions = { id: aggregationParams.catalogId };
    const layerMetadatas = await this.catalogClient.find(findOptions);
    const aggregationQuery = this.buildAggregationQuery(layerMetadatas.metadata);

    try {
      const aggregationResult = await aggregationQuery.getRawOne<AggregationLayerMetadata>();
      const aggregationMetadataLayer = aggregationMetadataSchema.parse(aggregationResult);
      return aggregationMetadataLayer;
    } catch (error) {
      const errorMessage = `Could not aggregate polygon parts`;
      this.logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private buildAggregationQuery({
    productId,
    productType,
  }: Pick<PolygonPartsPayload, 'productId' | 'productType'>): SelectQueryBuilder<AggregationLayerMetadata> {
    const dataSource = this.connectionManager.getDataSource();
    const polygonPart = dataSource.getRepository(PolygonPart);

    const polygonPartTableName = getEntitiesNames({ productId, productType }).polygonParts.databaseObjectQualifiedName;
    polygonPart.metadata.tablePath = polygonPartTableName;

    const aggregationCTE = polygonPart
      .createQueryBuilder('polygon_part')
      .select('min("polygon_part".imaging_time_begin_utc)::timestamptz', 'imagingTimeBeginUTC')
      .addSelect('max("polygon_part".imaging_time_end_utc)::timestamptz', 'imagingTimeEndUTC')
      .addSelect('max("polygon_part".resolution_degree)::numeric', 'maxResolutionDeg')
      .addSelect('min("polygon_part".resolution_degree)::numeric', 'minResolutionDeg')
      .addSelect('max("polygon_part".resolution_meter)::numeric', 'maxResolutionMeter')
      .addSelect('min("polygon_part".resolution_meter)::numeric', 'minResolutionMeter')
      .addSelect('max("polygon_part".horizontal_accuracy_ce90)::real', 'maxHorizontalAccuracyCE90')
      .addSelect('min("polygon_part".horizontal_accuracy_ce90)::real', 'minHorizontalAccuracyCE90')
      .addSelect(`st_asgeojson(st_union("polygon_part".footprint), maxdecimaldigits => ${this.maxDecimalDigits}, options => 1)::json`, 'footprint')
      .addSelect((subQuery) => {
        return subQuery.select(`array_agg("sensors_sub_query".sensors_records)`).from((innerSubQuery) => {
          return innerSubQuery
            .select(`DISTINCT unnest(string_to_array("polygon_part".sensors, '${this.arraySeparator}'))`, 'sensors_records')
            .from(polygonPartTableName, 'polygon_part')
            .orderBy('sensors_records', 'ASC');
        }, 'sensors_sub_query');
      }, 'sensors');

    const aggregationQuery = polygonPart.manager
      .createQueryBuilder()
      .addCommonTableExpression(aggregationCTE, 'aggregationCTE')
      .select('*')
      .addSelect(`trim(both '[]' from "aggregationCTE".footprint ->> 'bbox')`, 'productBoundingBox')
      .from<AggregationLayerMetadata>('aggregationCTE', 'aggregationCTE');

    return aggregationQuery;
  }
}
