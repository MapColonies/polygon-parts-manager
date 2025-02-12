import { NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { aggregationMetadataSchema, type AggregationLayerMetadata, type PolygonPartsEntityName } from '@map-colonies/mc-model-types';
import { inject, injectable } from 'tsyringe';
import { EntityManager, SelectQueryBuilder } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { SERVICES } from '../../common/constants';
import type { ApplicationConfig, IConfig } from '../../common/interfaces';
import { PolygonPart } from '../../polygonParts/DAL/polygonPart';
import { getDatabaseObjectQualifiedName } from '../../polygonParts/DAL/utils';
import type { AggregationParams } from './interfaces';

@injectable()
export class AggregationManager {
  private readonly arraySeparator: ApplicationConfig['arraySeparator'];
  private readonly maxDecimalDigits: ApplicationConfig['aggregation']['maxDecimalDigits'];
  private readonly fixGeometry: ApplicationConfig['aggregation']['fixGeometry'];
  private readonly simplifyGeometry: ApplicationConfig['aggregation']['simplifyGeometry'];

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONNECTION_MANAGER) private readonly connectionManager: ConnectionManager
  ) {
    this.arraySeparator = this.config.get<ApplicationConfig['arraySeparator']>('application.arraySeparator');
    this.maxDecimalDigits = this.config.get<ApplicationConfig['aggregation']['maxDecimalDigits']>('application.aggregation.maxDecimalDigits');
    this.fixGeometry = this.config.get<ApplicationConfig['aggregation']['fixGeometry']>('application.aggregation.fixGeometry');
    this.simplifyGeometry = this.config.get<ApplicationConfig['aggregation']['simplifyGeometry']>('application.aggregation.simplifyGeometry');
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
          logger.error({ msg: errorMessage, error });
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

    const footprintUnionCTE = entityManager
      .createQueryBuilder()
      .select('st_union("polygon_part".footprint)', 'footprint_union')
      .from(polygonPartsEntityName, 'polygon_part');

    const footprintSmoothCTE = entityManager
      .createQueryBuilder()
      .select(
        this.fixGeometry.enabled
          ? `st_buffer(st_buffer("footprint_union".footprint_union, ${this.fixGeometry.bufferSizeDeg}, ${this.fixGeometry.bufferStyleParameters}), -${this.fixGeometry.bufferSizeDeg}, ${this.fixGeometry.bufferStyleParameters})`
          : `'POLYGON EMPTY'::geometry`,
        'footprint_buffer'
      )
      .addSelect('"footprint_union".footprint_union', 'footprint_union')
      .from('footprint_union', 'footprint_union');

    const footprintFixEmptyCTE = entityManager
      .createQueryBuilder()
      .select(
        `case when st_isempty("footprint_smooth".footprint_buffer) then "footprint_smooth".footprint_union else "footprint_smooth".footprint_buffer end`,
        'footprint'
      )
      .from('footprint_smooth', 'footprint_smooth');

    const footprintSimplifyCTE = entityManager
      .createQueryBuilder()
      .select(
        this.simplifyGeometry.enabled
          ? `st_union(st_simplifypreservetopology("footprint_fix_empty".footprint, ${this.simplifyGeometry.toleranceDeg}))`
          : '"footprint_fix_empty".footprint',
        'footprint'
      )
      .from('footprint_fix_empty', 'footprint_fix_empty');

    const footprintAggregationCTE = entityManager
      .createQueryBuilder()
      .select(
        `st_asgeojson(st_geometryn(st_collect("footprint_simplify".footprint), 1), maxdecimaldigits => ${this.maxDecimalDigits}, options => 1)::json`,
        'footprint'
      )
      .addSelect(
        `trim(both '[]' from (st_asgeojson(st_geometryn(st_collect("footprint_simplify".footprint), 1), maxdecimaldigits => ${this.maxDecimalDigits}, options => 1)::json ->> 'bbox'))`,
        'productBoundingBox'
      )
      .from('footprint_simplify', 'footprint_simplify');

    const metadataAggregationCTE = polygonPart
      .createQueryBuilder('polygon_part')
      .select('min("polygon_part".imaging_time_begin_utc)::timestamptz', 'imagingTimeBeginUTC')
      .addSelect('max("polygon_part".imaging_time_end_utc)::timestamptz', 'imagingTimeEndUTC')
      .addSelect('min("polygon_part".resolution_degree)::numeric', 'maxResolutionDeg') // maxResolutionDeg - refers to the best value (lower is better)
      .addSelect('max("polygon_part".resolution_degree)::numeric', 'minResolutionDeg') // minResolutionDeg - refers to the worst value (higher is worse)
      .addSelect('min("polygon_part".resolution_meter)::numeric', 'maxResolutionMeter') // maxResolutionMeter - refers to the best value (lower is better)
      .addSelect('max("polygon_part".resolution_meter)::numeric', 'minResolutionMeter') // minResolutionMeter - refers to the worst value (higher is worse)
      .addSelect('min("polygon_part".horizontal_accuracy_ce90)::numeric', 'maxHorizontalAccuracyCE90') // maxHorizontalAccuracyCE90 - refers to the best value (lower is better)
      .addSelect('max("polygon_part".horizontal_accuracy_ce90)::numeric', 'minHorizontalAccuracyCE90') // minHorizontalAccuracyCE90 - refers to the worst value (higher is worse)
      .addSelect((subQuery) => {
        return subQuery.select(`array_agg("sensors_sub_query".sensors_records)`).from((innerSubQuery) => {
          return innerSubQuery
            .select(`unnest(string_to_array("polygon_part".sensors, '${this.arraySeparator}'))`, 'sensors_records')
            .distinct(true)
            .from(polygonPartsEntityName, 'polygon_part')
            .orderBy('sensors_records', 'ASC');
        }, 'sensors_sub_query');
      }, 'sensors');

    const aggregationQueryBuilder = entityManager
      .createQueryBuilder()
      .addCommonTableExpression(footprintUnionCTE, 'footprint_union')
      .addCommonTableExpression(footprintSmoothCTE, 'footprint_smooth')
      .addCommonTableExpression(footprintFixEmptyCTE, 'footprint_fix_empty')
      .addCommonTableExpression(footprintSimplifyCTE, 'footprint_simplify')
      .addCommonTableExpression(footprintAggregationCTE, 'footprint_aggregation')
      .addCommonTableExpression(metadataAggregationCTE, 'metadata_aggregation')
      .select('metadata_aggregation.*')
      .addSelect('footprint_aggregation.*')
      .from('footprint_aggregation', 'footprint_aggregation')
      .addFrom<AggregationLayerMetadata>('metadata_aggregation', 'metadata_aggregation');

    return aggregationQueryBuilder;
  }
}
