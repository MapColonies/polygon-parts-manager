import { NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { aggregationMetadataSchema, type AggregationLayerMetadata, type PolygonPartsEntityName } from '@map-colonies/mc-model-types';
import { inject, injectable } from 'tsyringe';
import { EntityManager, SelectQueryBuilder } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { DEFAULT_SCHEMA, SERVICES } from '../../common/constants';
import type { ApplicationConfig, IConfig } from '../../common/interfaces';
import { PolygonPart } from '../../polygonParts/DAL/polygonPart';
import { getDatabaseObjectQualifiedName } from '../../polygonParts/DAL/utils';
import type { DBSchema } from '../../polygonParts/models/interfaces';
import type { AggregationParams } from './interfaces';

@injectable()
export class AggregationManager {
  private readonly arraySeparator: string;
  private readonly maxDecimalDigits: number;
  private readonly schema: NonNullable<DBSchema>;
  private readonly fixGeometry: ApplicationConfig['aggregation']['fixGeometry'];

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONNECTION_MANAGER) private readonly connectionManager: ConnectionManager
  ) {
    this.arraySeparator = this.config.get<ApplicationConfig['arraySeparator']>('application.arraySeparator');
    this.maxDecimalDigits = this.config.get<ApplicationConfig['aggregation']['maxDecimalDigits']>('application.aggregation.maxDecimalDigits');
    this.fixGeometry = this.config.get<ApplicationConfig['aggregation']['fixGeometry']>('application.aggregation.fixGeometry');
    this.schema = config.get<DBSchema>('db.schema') ?? DEFAULT_SCHEMA;
  }

  public async getAggregationLayerMetadata(aggregationParams: AggregationParams): Promise<AggregationLayerMetadata> {
    const { polygonPartsEntityName } = aggregationParams;
    const logger = this.logger.child({ polygonPartsEntityName: polygonPartsEntityName });
    logger.info({ msg: 'Metadata aggregation request' });

    try {
      const response = await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const exists = await this.connectionManager.entityExists(entityManager, polygonPartsEntityName);
        if (!exists) {
          throw new NotFoundError(`Table with the name '${polygonPartsEntityName}' doesn't exists`);
        }
        const aggregationQuery = this.buildAggregationQuery(entityManager, getDatabaseObjectQualifiedName(polygonPartsEntityName));

        try {
          const aggregationResult = await aggregationQuery.getRawOne<AggregationLayerMetadata>();
          const aggregationMetadataLayer = aggregationMetadataSchema.parse(aggregationResult);
          return aggregationMetadataLayer;
        } catch (error) {
          const errorMessage = `Could not aggregate polygon parts`;
          this.logger.error({ msg: errorMessage, error });
          throw error;
        }
      });

      return response;
    } catch (error) {
      const errorMessage = 'Aggregation query transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private buildAggregationQuery(
    entityManager: EntityManager,
    polygonPartsEntityName: PolygonPartsEntityName['polygonPartsEntityName']
  ): SelectQueryBuilder<AggregationLayerMetadata> {
    const polygonPart = entityManager.getRepository(PolygonPart);
    polygonPart.metadata.tablePath = polygonPartsEntityName; // this approach may be unstable for other versions of typeorm - https://github.com/typeorm/typeorm/issues/4245#issuecomment-2134156283

    const footprintUnionQuery = 'st_union("polygon_part".footprint)';
    const footprintUnionCTE = entityManager
      .createQueryBuilder()
      .select(
        this.fixGeometry.enabled
          ? `st_buffer(st_buffer(${footprintUnionQuery}, ${this.fixGeometry.bufferSize}), -${this.fixGeometry.bufferSize})`
          : footprintUnionQuery,
        'footprint_union'
      )
      .from(polygonPartsEntityName, 'polygon_part');

    const aggregationQueryBuilder = polygonPart
      .createQueryBuilder('polygon_part')
      .addCommonTableExpression(footprintUnionCTE, 'footprintUnionCTE')
      .select('min("polygon_part".imaging_time_begin_utc)::timestamptz', 'imagingTimeBeginUTC')
      .addSelect('max("polygon_part".imaging_time_end_utc)::timestamptz', 'imagingTimeEndUTC')
      .addSelect('min("polygon_part".resolution_degree)::numeric', 'maxResolutionDeg') // maxResolutionDeg - refers to the best value (lower is better)
      .addSelect('max("polygon_part".resolution_degree)::numeric', 'minResolutionDeg') // minResolutionDeg - refers to the worst value (higher is worse)
      .addSelect('min("polygon_part".resolution_meter)::numeric', 'maxResolutionMeter') // maxResolutionMeter - refers to the best value (lower is better)
      .addSelect('max("polygon_part".resolution_meter)::numeric', 'minResolutionMeter') // minResolutionMeter - refers to the worst value (higher is worse)
      .addSelect('min("polygon_part".horizontal_accuracy_ce90)::numeric', 'maxHorizontalAccuracyCE90') // maxHorizontalAccuracyCE90 - refers to the best value (lower is better)
      .addSelect('max("polygon_part".horizontal_accuracy_ce90)::numeric', 'minHorizontalAccuracyCE90') // minHorizontalAccuracyCE90 - refers to the worst value (higher is worse)
      .addSelect(
        `st_asgeojson(st_geometryn(st_collect("footprintUnionCTE".footprint_union), 1), maxdecimaldigits => ${this.maxDecimalDigits}, options => 1)::json`,
        'footprint'
      )
      .addSelect((subQuery) => {
        return subQuery.select(`array_agg("sensors_sub_query".sensors_records)`).from((innerSubQuery) => {
          return innerSubQuery
            .select(`unnest(string_to_array("polygon_part".sensors, '${this.arraySeparator}'))`, 'sensors_records')
            .distinct(true)
            .from(polygonPartsEntityName, 'polygon_part')
            .orderBy('sensors_records', 'ASC');
        }, 'sensors_sub_query');
      }, 'sensors')
      .addSelect(
        `trim(both '[]' from (st_asgeojson(st_geometryn(st_collect("footprintUnionCTE".footprint_union), 1), maxdecimaldigits => ${this.maxDecimalDigits}, options => 1)::json ->> 'bbox'))`,
        'productBoundingBox'
      )
      .addFrom<AggregationLayerMetadata>('footprintUnionCTE', 'footprintUnionCTE');

    return aggregationQueryBuilder;
  }
}
