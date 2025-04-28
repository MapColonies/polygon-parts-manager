import { BadRequestError, ConflictError, InternalServerError, NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { AggregationFeature, CORE_VALIDATIONS } from '@map-colonies/raster-shared';
import { geometryCollection } from '@turf/helpers';
import { inject, injectable } from 'tsyringe';
import type { EntityManager, SelectQueryBuilder } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { SERVICES } from '../../common/constants';
import type { ApplicationConfig, DbConfig, IConfig } from '../../common/interfaces';
import { Part } from '../DAL/part';
import { PolygonPart } from '../DAL/polygonPart';
import { payloadToInsertPartsData } from '../DAL/utils';
import { ValidationError } from '../../common/errors';
import {
  findSelectOutputColumns,
  geometryColumn,
  idColumn,
  insertionOrderColumn,
  isValidDetailsResult,
  minResolutionDeg,
  requestFeatureId,
} from './constants';
import type {
  AggregateLayerMetadataOptions,
  EntitiesMetadata,
  EntityName,
  EntityNames,
  FilterQueryMetadata,
  FindPolygonPartsOptions,
  FindPolygonPartsQueryResponse,
  FindPolygonPartsResponse,
  GetAggregationLayerMetadataResponse,
  FindQueryFilterOptions,
  FindQuerySelectOptions,
  IsValidDetailsResult,
  PolygonPartsPayload,
  PolygonPartsResponse,
} from './interfaces';

@injectable()
export class PolygonPartsManager {
  private readonly applicationConfig: ApplicationConfig;
  private readonly schema: DbConfig['schema'];
  private readonly findMaxDecimalDigits: ApplicationConfig['entities']['polygonParts']['find']['maxDecimalDigits'];

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.CONNECTION_MANAGER) private readonly connectionManager: ConnectionManager
  ) {
    this.applicationConfig = this.config.get('application');
    this.schema = config.get('db.schema');
    this.findMaxDecimalDigits = this.config.get('application.entities.polygonParts.find.maxDecimalDigits');
  }

  public async createPolygonParts(polygonPartsPayload: PolygonPartsPayload, entitiesMetadata: EntitiesMetadata): Promise<PolygonPartsResponse> {
    const { catalogId } = polygonPartsPayload;
    const logger = this.logger.child({ catalogId });
    logger.info({ msg: 'Creating polygon parts' });

    try {
      const polygonPartsEntityName = await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const baseIngestionContext = {
          entityManager,
          logger,
          entitiesMetadata,
        };

        await entityManager.query(`SET search_path TO ${this.schema},public`);
        await this.verifyAvailableTableNames(baseIngestionContext);
        const ingestionContext = { ...baseIngestionContext, polygonPartsPayload };
        await this.createTables(ingestionContext);
        await this.insertParts(ingestionContext);
        await this.calculatePolygonParts(ingestionContext);

        return entitiesMetadata.entityIdentifier;
      });

      return { polygonPartsEntityName };
    } catch (error) {
      const errorMessage = 'Create polygon parts transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  public async findPolygonParts<ShouldClip extends boolean>({
    shouldClip,
    polygonPartsEntityName,
    filter,
  }: FindPolygonPartsOptions<ShouldClip>): Promise<FindPolygonPartsResponse<ShouldClip>> {
    const logger = this.logger.child({ polygonPartsEntityName: polygonPartsEntityName.entityName });
    logger.info({ msg: 'Finding polygon parts' });

    try {
      const response = await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const exists = await this.connectionManager.entityExists(entityManager, polygonPartsEntityName.entityName);
        if (!exists) {
          throw new NotFoundError(`Table with the name '${polygonPartsEntityName.entityName}' doesn't exists`);
        }

        await this.validateFeatureCollectionFilter({
          entityManager,
          filter,
        });

        const findPolygonPartsQuery = this.buildFindQuery<ShouldClip>({
          shouldClip,
          entityManager,
          polygonPartsEntityName,
          filter,
          selectOutputColumns: findSelectOutputColumns,
        });

        try {
          const polygonParts = await findPolygonPartsQuery.getRawOne<FindPolygonPartsQueryResponse<ShouldClip>>();
          return polygonParts;
        } catch (error) {
          const errorMessage = `Could not complete find '${polygonPartsEntityName.entityName}'`;
          logger.error({ msg: errorMessage, error });
          throw error;
        }
      });

      if (!response) {
        throw new InternalServerError('Could not generate response');
      }

      return response.geojson;
    } catch (error) {
      const errorMessage = 'Find polygon parts transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  public async updatePolygonParts(
    isSwap: boolean,
    polygonPartsPayload: PolygonPartsPayload,
    entitiesMetadata: EntitiesMetadata
  ): Promise<PolygonPartsResponse> {
    const { catalogId } = polygonPartsPayload;
    const logger = this.logger.child({ catalogId });
    logger.info({ msg: `Updating polygon parts` });

    try {
      const polygonPartsEntityName = await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const baseUpdateContext = {
          entityManager,
          logger,
          entitiesMetadata,
        };

        await entityManager.query(`SET search_path TO ${this.schema},public`);
        await this.getEntitiesNamesIfExists(baseUpdateContext);
        const updateContext = { ...baseUpdateContext, polygonPartsPayload };
        if (isSwap) {
          await this.truncateEntities(updateContext);
        }
        await this.insertParts(updateContext);
        await this.calculatePolygonParts(updateContext);

        return entitiesMetadata.entityIdentifier;
      });

      return { polygonPartsEntityName };
    } catch (error) {
      const errorMessage = 'Update polygon parts transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  public async getAggregationLayerMetadata(options: AggregateLayerMetadataOptions): Promise<GetAggregationLayerMetadataResponse> {
    const { polygonPartsEntityName, filter } = options;

    const logger = this.logger.child({ polygonPartsEntityName });
    logger.info({ msg: 'Metadata aggregation request' });

    try {
      const response = await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const exists = await this.connectionManager.entityExists(entityManager, polygonPartsEntityName.entityName);
        if (!exists) {
          throw new NotFoundError(`Table with the name '${polygonPartsEntityName.entityName}' doesn't exists`);
        }

        const { filterQueryMetadata, filteredPolygonPartsQuery } = await this.prepareAggregationFilterQuery(
          entityManager,
          polygonPartsEntityName,
          filter
        );

        const aggregationQueryToExecute = this.buildAggregationLayerMetadataQuery({
          entityManager,
          options,
          filterQueryMetadata,
          filteredPolygonPartsQuery,
        });

        try {
          const result = await aggregationQueryToExecute.getRawOne<{ feature: AggregationFeature }>();
          return result;
        } catch (error) {
          let errorMessage: string;
          if (error instanceof ValidationError) {
            errorMessage = 'Invalid aggregation metadata response';
          } else {
            errorMessage = 'Could not aggregate polygon parts';
          }
          logger.error({ msg: errorMessage, error });
          throw error;
        }
      });

      if (!response) {
        throw new InternalServerError('Could not generate aggregation response');
      }

      return response.feature;
    } catch (error) {
      const errorMessage = 'Aggregation query transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async prepareAggregationFilterQuery(
    entityManager: EntityManager,
    polygonPartsEntityName: EntityNames,
    filter: FindPolygonPartsOptions<true>['filter'] | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ filterQueryMetadata?: FilterQueryMetadata; filteredPolygonPartsQuery?: SelectQueryBuilder<any> }> {
    if (!filter) {
      return { filterQueryMetadata: undefined, filteredPolygonPartsQuery: undefined };
    }

    await this.validateFeatureCollectionFilter({ filter, entityManager });

    const filterQueryMetadata: FilterQueryMetadata = {
      filterQueryAlias: 'filtered_parts',
      filterRequestFeatureIds: 'request_feature_ids',
      selectOutputColumns: [
        'imaging_time_begin_utc',
        'imaging_time_end_utc',
        'resolution_degree',
        'resolution_meter',
        'horizontal_accuracy_ce90',
        'sensors',
      ],
    };

    const filteredPolygonPartsQuery = this.buildFilterQuery({
      entityManager,
      filter: { inputFilter: filter, ...filterQueryMetadata },
      shouldClip: true,
      polygonPartsEntityName,
    });

    return { filterQueryMetadata, filteredPolygonPartsQuery };
  }

  private buildAggregationLayerMetadataQuery(context: {
    entityManager: EntityManager;
    options: AggregateLayerMetadataOptions;
    filterQueryMetadata?: FilterQueryMetadata;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filteredPolygonPartsQuery: SelectQueryBuilder<any> | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): SelectQueryBuilder<any> {
    const { fixGeometry, maxDecimalDigits, simplifyGeometry } = this.applicationConfig.aggregation;
    const {
      entityManager,
      options: { polygonPartsEntityName },
      filterQueryMetadata,
      filteredPolygonPartsQuery,
    } = context;

    const baseTable = filterQueryMetadata?.filterQueryAlias ?? polygonPartsEntityName.databaseObjectQualifiedName;
    const queryBuilder = filteredPolygonPartsQuery ?? entityManager.createQueryBuilder();

    const footprintUnionCTE = entityManager
      .createQueryBuilder()
      .select('st_union("polygon_part".footprint)', 'footprint_union')
      .from(baseTable, 'polygon_part');

    const footprintSmoothCTE = entityManager
      .createQueryBuilder()
      .select(
        fixGeometry.enabled
          ? `st_buffer(st_buffer("footprint_union".footprint_union, ${fixGeometry.bufferSizeDeg}, ${fixGeometry.bufferStyleParameters}), -${fixGeometry.bufferSizeDeg}, ${fixGeometry.bufferStyleParameters})`
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
        simplifyGeometry.enabled
          ? `st_union(st_simplifypreservetopology("footprint_fix_empty".footprint, ${simplifyGeometry.toleranceDeg}))`
          : '"footprint_fix_empty".footprint',
        'footprint'
      )
      .from('footprint_fix_empty', 'footprint_fix_empty');

    const footprintAggregationCTE = entityManager
      .createQueryBuilder()
      .select(
        `st_asgeojson(st_geometryn(st_collect("footprint_simplify".footprint), 1), maxdecimaldigits => ${maxDecimalDigits}, options => 1)::json`,
        'geometry'
      )
      .addSelect(
        `trim(both '[]' from (st_asgeojson(st_geometryn(st_collect("footprint_simplify".footprint), 1), maxdecimaldigits => ${maxDecimalDigits}, options => 1)::json ->> 'bbox'))`,
        'bbox'
      )
      .addSelect(`st_isempty(st_geometryn(st_collect("footprint_simplify".footprint), 1))`, 'is_empty')
      .from('footprint_simplify', 'footprint_simplify');

    const metadataAggregationCTE = entityManager
      .createQueryBuilder()
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
          const query = innerSubQuery
            .select(`unnest(string_to_array("polygon_part".sensors, '${this.applicationConfig.arraySeparator}'))`, 'sensors_records')
            .distinct(true)
            .from(baseTable, 'polygon_part')
            .orderBy('sensors_records', 'ASC');
          return query;
        }, 'sensors_sub_query');
      }, 'sensors')
      .from(baseTable, 'polygon_part');

    const aggregationQueryBuilder = queryBuilder
      .addCommonTableExpression(footprintUnionCTE, 'footprint_union')
      .addCommonTableExpression(footprintSmoothCTE, 'footprint_smooth')
      .addCommonTableExpression(footprintFixEmptyCTE, 'footprint_fix_empty')
      .addCommonTableExpression(footprintSimplifyCTE, 'footprint_simplify')
      .addCommonTableExpression(footprintAggregationCTE, 'footprint_aggregation')
      .addCommonTableExpression(metadataAggregationCTE, 'metadata_aggregation')
      .select(
        `
        jsonb_build_object(
          'type', 'Feature',
          'geometry', footprint_aggregation.geometry,
          'properties', CASE 
            WHEN footprint_aggregation.is_empty OR footprint_aggregation.geometry IS NULL THEN NULL
            ELSE jsonb_build_object(
              'imagingTimeBeginUTC', metadata_aggregation."imagingTimeBeginUTC",
              'imagingTimeEndUTC', metadata_aggregation."imagingTimeEndUTC",
              'maxResolutionDeg', metadata_aggregation."maxResolutionDeg",
              'minResolutionDeg', metadata_aggregation."minResolutionDeg",
              'maxResolutionMeter', metadata_aggregation."maxResolutionMeter",
              'minResolutionMeter', metadata_aggregation."minResolutionMeter",
              'maxHorizontalAccuracyCE90', metadata_aggregation."maxHorizontalAccuracyCE90",
              'minHorizontalAccuracyCE90', metadata_aggregation."minHorizontalAccuracyCE90",
              'sensors', metadata_aggregation."sensors",
              'productBoundingBox', footprint_aggregation.bbox
            )
          END
        )`,
        'feature'
      )
      .from('footprint_aggregation', 'footprint_aggregation')
      .addFrom('metadata_aggregation', 'metadata_aggregation');

    return aggregationQueryBuilder;
  }

  private async verifyAvailableTableNames(context: {
    entityManager: EntityManager;
    logger: Logger;
    entitiesMetadata: EntitiesMetadata;
  }): Promise<void> {
    const { entityManager, logger, entitiesMetadata } = context;
    const { entitiesNames } = entitiesMetadata;
    logger.debug({ msg: 'Verifying polygon parts table names are available' });

    await Promise.all(
      Object.values<EntityNames>({ ...entitiesNames }).map(async ({ databaseObjectQualifiedName, entityName }) => {
        try {
          const exists = await this.connectionManager.entityExists(entityManager, entityName);
          if (exists) {
            throw new ConflictError(`Table with the name '${databaseObjectQualifiedName}' already exists`);
          }
        } catch (error) {
          const errorMessage = `Could not verify polygon parts table name '${databaseObjectQualifiedName}' is available`;
          logger.error({ msg: errorMessage, error });
          throw error;
        }
      })
    );
  }

  private buildFindQuery<ShouldClip extends boolean = boolean>(
    context: Pick<FindPolygonPartsOptions, 'polygonPartsEntityName' | 'shouldClip'> & {
      entityManager: EntityManager;
      filter: FindPolygonPartsOptions['filter'];
      selectOutputColumns: string[];
    }
  ): SelectQueryBuilder<FindPolygonPartsQueryResponse<ShouldClip>> {
    const { filter: inputFilter, selectOutputColumns } = context;
    const filterQuery = { filterQueryAlias: 'output_properties', filterRequestFeatureIds: 'request_feature_ids', selectOutputColumns };

    const findFilterQuery = this.buildFilterQuery({
      ...context,
      filter: { inputFilter, ...filterQuery },
    });

    const findSelectQuery = this.buildFindSelectQuery({
      geometryColumn,
      filter: { findFilterQuery, ...filterQuery },
      requestFeatureId,
    })
      .from<FindPolygonPartsQueryResponse<ShouldClip>>(filterQuery.filterQueryAlias, filterQuery.filterQueryAlias)
      .where(`st_geometrytype(${geometryColumn}) = :geometryType`, { geometryType: 'ST_Polygon' });

    return findSelectQuery;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildFindSelectQuery(context: FindQuerySelectOptions): SelectQueryBuilder<any> {
    const {
      filter: { filterQueryAlias, filterRequestFeatureIds, findFilterQuery },
      geometryColumn,
      requestFeatureId,
    } = context;
    const requestFeatureIds = ` || jsonb_strip_nulls(
      case
        when array_length(${filterRequestFeatureIds}, 1) is null then '{}'::jsonb
        when array_length(${filterRequestFeatureIds}, 1) = 1 then jsonb_build_object('${requestFeatureId}', ${filterRequestFeatureIds}[1])
        else jsonb_build_object('${requestFeatureId}', ${filterRequestFeatureIds})
      end
    )`;

    const findPolygonPartsSelect = findFilterQuery.select(
      `jsonb_build_object(
          'type', 'FeatureCollection',
          'features', coalesce(jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', st_asgeojson(${geometryColumn}, ${this.findMaxDecimalDigits})::jsonb,
              'properties', to_jsonb(${filterQueryAlias}) - '{${geometryColumn},${filterRequestFeatureIds}}'::text[] ${requestFeatureIds}
            )
          ), '[]')
        ) AS ${'geojson' satisfies keyof FindPolygonPartsQueryResponse}`
    );
    return findPolygonPartsSelect;
  }

  private buildFilterQuery<ShouldClip extends boolean = boolean>(
    context: FindQueryFilterOptions<ShouldClip>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): SelectQueryBuilder<any> {
    const {
      entityManager,
      filter: {
        filterQueryAlias,
        filterRequestFeatureIds,
        selectOutputColumns: findSelectOutputColumns,
        inputFilter = { type: 'FeatureCollection', features: [] },
      },
      polygonPartsEntityName,
      shouldClip,
    } = context;
    const polygonPart = entityManager.getRepository(PolygonPart);
    polygonPart.metadata.tablePath = polygonPartsEntityName.databaseObjectQualifiedName; // this approach may be unstable for other versions of typeorm - https://github.com/typeorm/typeorm/issues/4245#issuecomment-2134156283

    const inputFilterGeometriesCTE = `select *
      from jsonb_to_recordset('${JSON.stringify(inputFilter)}'::jsonb -> 'features') as x(geometry jsonb, properties jsonb, id jsonb)`;

    const filterGeometriesCTE = entityManager
      .createQueryBuilder()
      .select('st_geomfromgeojson(geometry)', 'filter_geometry')
      .addSelect('properties')
      .addSelect('id', 'filter_id')
      .from('input_filter_geometries', 'input_filter_geometries');

    const isEmptyFilterCTE = entityManager.createQueryBuilder().select('not exists (select 1 from filter_geometries)', 'is_empty_filter').fromDummy();

    const intersectedPolygonPartsCTE = polygonPart
      .createQueryBuilder('polygon_part')
      .select(idColumn, 'polygon_part_id')
      .addSelect(
        `${
          shouldClip
            ? `case when not ( select is_empty_filter from is_empty_filter ) then st_intersection(${geometryColumn}, filter_geometry) else ${geometryColumn} end`
            : geometryColumn
        }`,
        geometryColumn
      )
      .addSelect('filter_id')
      .leftJoin(
        'filter_geometries',
        'filter_geometries',
        `st_relate(${geometryColumn}, filter_geometry, 'T********') and filter_geometry && ${geometryColumn}` // st_relate uses DE-9IM pattern of 'T********', to model interior interesection between two geometries
      )
      .where('filter_geometry is not null')
      .andWhere(`resolution_degree <= coalesce((properties ->> '${minResolutionDeg}')::numeric, ${CORE_VALIDATIONS.resolutionDeg.max})`)
      .orWhere('(select is_empty_filter from is_empty_filter)');

    const filteredPolygonPartsCTE = entityManager
      .createQueryBuilder()
      .select('polygon_part_id')
      .addSelect(`(st_dump(${geometryColumn})).geom`, geometryColumn)
      .addSelect(`array_remove(array_agg(filter_id), NULL)`, 'filter_ids')
      .from('intersected_polygon_parts', 'intersected_polygon_parts')
      .groupBy('polygon_part_id')
      .addGroupBy(geometryColumn);

    const outputPropertiesCTE = polygonPart
      .createQueryBuilder('polygon_part')
      .select(`filtered_polygon_parts.${geometryColumn}`, geometryColumn)
      .addSelect(findSelectOutputColumns)
      .addSelect('filter_ids', filterRequestFeatureIds)
      .orderBy(insertionOrderColumn)
      .innerJoin('filtered_polygon_parts', 'filtered_polygon_parts', 'id = polygon_part_id');

    const filterPolygonPartsQuery = entityManager
      .createQueryBuilder()
      .addCommonTableExpression(inputFilterGeometriesCTE, 'input_filter_geometries')
      .addCommonTableExpression(filterGeometriesCTE, 'filter_geometries')
      .addCommonTableExpression(isEmptyFilterCTE, 'is_empty_filter')
      .addCommonTableExpression(intersectedPolygonPartsCTE, 'intersected_polygon_parts')
      .addCommonTableExpression(filteredPolygonPartsCTE, 'filtered_polygon_parts')
      .addCommonTableExpression(outputPropertiesCTE, filterQueryAlias);

    return filterPolygonPartsQuery;
  }

  private async calculatePolygonParts(context: { entitiesMetadata: EntitiesMetadata; entityManager: EntityManager; logger: Logger }): Promise<void> {
    const { entityManager, logger, entitiesMetadata } = context;
    const {
      entitiesNames: {
        parts: { databaseObjectQualifiedName: partsEntityQualifiedName },
        polygonParts: { databaseObjectQualifiedName: polygonPartsEntityQualifiedName },
      },
    } = entitiesMetadata;
    logger.debug({ msg: 'Updating polygon parts data' });

    try {
      await entityManager.query(
        `CALL ${this.applicationConfig.updatePolygonPartsTablesStoredProcedure}('${partsEntityQualifiedName}'::regclass, '${polygonPartsEntityQualifiedName}'::regclass, ${this.applicationConfig.entities.polygonParts.minAreaSquareDeg});`
      );
    } catch (error) {
      const errorMessage = `Could not update polygon parts data in tables: '${partsEntityQualifiedName}', '${polygonPartsEntityQualifiedName}'`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async createTables(context: { entitiesMetadata: EntitiesMetadata; entityManager: EntityManager; logger: Logger }): Promise<void> {
    const {
      entityManager,
      logger,
      entitiesMetadata: {
        entitiesNames: {
          parts: { databaseObjectQualifiedName: partsEntityQualifiedName },
          polygonParts: { databaseObjectQualifiedName: polygonPartsEntityQualifiedName },
        },
      },
    } = context;
    logger.debug({ msg: 'Creating polygon parts tables' });

    try {
      await entityManager.query(
        `CALL ${this.applicationConfig.createPolygonPartsTablesStoredProcedure}('${partsEntityQualifiedName}', '${polygonPartsEntityQualifiedName}');`
      );
    } catch (error) {
      const errorMessage = `Could not create polygon parts tables: '${partsEntityQualifiedName}', '${polygonPartsEntityQualifiedName}'`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async getEntitiesNamesIfExists(context: {
    entityManager: EntityManager;
    logger: Logger;
    entitiesMetadata: EntitiesMetadata;
  }): Promise<void> {
    const { entityManager, logger, entitiesMetadata } = context;
    const { entitiesNames } = entitiesMetadata;
    logger.debug({ msg: `Verifying entities exists` });

    await Promise.all(
      Object.values<EntityNames>({ ...entitiesNames }).map(async ({ databaseObjectQualifiedName, entityName }) => {
        try {
          const exists = await this.connectionManager.entityExists(entityManager, entityName);
          if (!exists) {
            throw new NotFoundError(`Table with the name '${databaseObjectQualifiedName}' doesn't exists`);
          }
        } catch (error) {
          const errorMessage = `Could not verify polygon parts table name '${databaseObjectQualifiedName}' is available`;
          logger.error({ msg: errorMessage, error });
          throw error;
        }
      })
    );
  }

  private async insertParts(context: {
    entitiesMetadata: EntitiesMetadata;
    entityManager: EntityManager;
    logger: Logger;
    polygonPartsPayload: PolygonPartsPayload;
  }): Promise<void> {
    const {
      entityManager,
      entitiesMetadata: {
        entitiesNames: {
          parts: { databaseObjectQualifiedName: partsEntityQualifiedName },
        },
      },
      logger,
      polygonPartsPayload,
    } = context;
    logger.debug({ msg: 'Inserting polygon parts data' });

    const insertPartsData = payloadToInsertPartsData(polygonPartsPayload, this.applicationConfig.arraySeparator);

    try {
      const part = entityManager.getRepository(Part);
      part.metadata.tablePath = partsEntityQualifiedName; // this approach may be unstable for other versions of typeorm - https://github.com/typeorm/typeorm/issues/4245#issuecomment-2134156283
      await part.save(insertPartsData, { chunk: this.applicationConfig.chunkSize });
    } catch (error) {
      const errorMessage = `Could not insert polygon parts data to table '${partsEntityQualifiedName}'`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async truncateEntities(context: { entityManager: EntityManager; logger: Logger; entitiesMetadata: EntitiesMetadata }): Promise<void> {
    const { entityManager, logger, entitiesMetadata } = context;
    const { entitiesNames } = entitiesMetadata;
    logger.debug({ msg: `Truncating entities` });

    await Promise.all(
      Object.values<EntityNames>({ ...entitiesNames }).map(async ({ databaseObjectQualifiedName, entityName }) => {
        try {
          await this.truncateEntity(entityManager, entityName);
        } catch (error) {
          const errorMessage = `Could not truncate table '${databaseObjectQualifiedName}' `;
          logger.error({ msg: errorMessage, error });
          throw error;
        }
      })
    );
  }

  private async truncateEntity(entityManager: EntityManager, entityName: EntityName): Promise<void> {
    await entityManager.query(`TRUNCATE ${entityName} RESTART IDENTITY CASCADE;`);
  }

  private async validateFeatureCollectionFilter(context: { entityManager: EntityManager; filter: FindPolygonPartsOptions['filter'] }): Promise<void> {
    // TODO: move function to a validation middleware
    const { entityManager, filter } = context;

    if (!filter) {
      return;
    }

    const filterGeometries = filter.features.map((feature) => feature.geometry);
    const geometriesCollection = geometryCollection(filterGeometries).geometry;
    const isValidFilterGeometry = (
      await entityManager.query<IsValidDetailsResult[]>(
        `select ${isValidDetailsResult.valid}, ${isValidDetailsResult.reason}, st_asgeojson(location) as ${isValidDetailsResult.location} from st_isvaliddetail(st_geomfromgeojson($1))`,
        [JSON.stringify(geometriesCollection)]
      )
    )[0];

    if (!isValidFilterGeometry.valid) {
      throw new BadRequestError(
        `Invalid geometry filter: ${isValidFilterGeometry.reason}. ${
          isValidFilterGeometry.location ? `Location: ${JSON.stringify(isValidFilterGeometry.location)}` : ''
        }`
      );
    }
  }
}
