import { BadRequestError, ConflictError, InternalServerError, NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { CORE_VALIDATIONS, type RoiProperties } from '@map-colonies/raster-shared';
import { geometryCollection } from '@turf/helpers';
import type { Feature, Geometry, MultiPolygon, Polygon } from 'geojson';
import { inject, injectable } from 'tsyringe';
import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { SERVICES } from '../../common/constants';
import type { ApplicationConfig, DbConfig, IConfig } from '../../common/interfaces';
import type { PickPropertiesOfType } from '../../common/types';
import { Part } from '../DAL/part';
import { PolygonPart } from '../DAL/polygonPart';
import { getMappedColumnName, payloadToInsertPartsData } from '../DAL/utils';
import { FIND_OUTPUT_PROPERTIES } from './constants';
import type {
  EntitiesMetadata,
  EntityName,
  EntityNames,
  FindPolygonPartsOptions,
  FindPolygonPartsResponse,
  PolygonPartRecord,
  PolygonPartsPayload,
  PolygonPartsResponse,
} from './interfaces';

interface FindPolygonPartsQueryResponse<ShouldClip extends boolean = boolean> {
  readonly geojson: FindPolygonPartsResponse<ShouldClip>;
}

const geometryColumn = getMappedColumnName('footprint' satisfies PickPropertiesOfType<PolygonPartRecord, Geometry>);
const idColumn = getMappedColumnName('id' satisfies keyof Pick<PolygonPartRecord, 'id'>);
const insertionOrderColumn = getMappedColumnName('insertionOrder' satisfies keyof Pick<PolygonPartRecord, 'insertionOrder'>);
const minResolutionDeg = 'minResolutionDeg' satisfies keyof Pick<RoiProperties, 'minResolutionDeg'>;
const requestFeatureId = 'requestFeatureId' satisfies keyof Pick<FindPolygonPartsResponse['features'][number]['properties'], 'requestFeatureId'>;

export const findSelectOutputColumns = Object.entries(FIND_OUTPUT_PROPERTIES)
  .filter(([, value]) => value)
  .map(([key, value]) => `${typeof value === 'boolean' ? `"${getMappedColumnName(key)}"` : value(getMappedColumnName(key))} as "${key}"`);

@injectable()
export class PolygonPartsManager {
  private readonly applicationConfig: ApplicationConfig;
  private readonly schema: DbConfig['schema'];

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.CONNECTION_MANAGER) private readonly connectionManager: ConnectionManager
  ) {
    this.applicationConfig = this.config.get<ApplicationConfig>('application');
    this.schema = config.get<DbConfig['schema']>('db.schema');
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

        const featuresWithGeometry = filter.features
          .filter<Feature<Polygon | MultiPolygon>>((feature): feature is Feature<Polygon | MultiPolygon> => !!feature.geometry)
          .map((feature) => feature.geometry);

        if (featuresWithGeometry.length > 0) {
          const geometriesCollection = geometryCollection(featuresWithGeometry).geometry;
          const isValidFilterGeometry = (
            await entityManager.query<
              ({ valid: true; reason: null; location: null } | { valid: false; reason: string; location: Geometry | null })[]
            >('select valid, reason, st_asgeojson(location) as location from st_isvaliddetail(st_geomfromgeojson($1))', [
              JSON.stringify(geometriesCollection),
            ])
          )[0];
          if (!isValidFilterGeometry.valid) {
            throw new BadRequestError(
              `Invalid geometry filter: ${isValidFilterGeometry.reason}. ${
                isValidFilterGeometry.location ? `Location: ${JSON.stringify(isValidFilterGeometry.location)}` : ''
              }`
            );
          }
        }

        const findPolygonPartsQuery = this.buildFindPolygonPartsQuery<ShouldClip>({
          shouldClip,
          entityManager,
          polygonPartsEntityName,
          filter,
          findSelectOutputColumns,
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

  private buildFindPolygonPartsQuery<ShouldClip extends boolean = boolean>(
    context: Pick<FindPolygonPartsOptions, 'polygonPartsEntityName' | 'shouldClip'> & {
      entityManager: EntityManager;
      filter: FindPolygonPartsOptions['filter'];
      findSelectOutputColumns: string[];
    }
  ): SelectQueryBuilder<FindPolygonPartsQueryResponse<ShouldClip>> {
    const { entityManager, filter, findSelectOutputColumns } = context;
    const hasAnyGeometries = filter.features.some((feature) => feature.geometry);
    const filterQuery = { filterQueryAlias: 'output_properties', filterRequestFeatureIds: 'request_feature_ids', findSelectOutputColumns };

    const featureCollectionSelect = this.buildFindFeatureCollectionSelect({
      entityManager,
      filterQuery,
      geometryColumn,
      hasAnyGeometries,
      requestFeatureId,
    })
      .from<FindPolygonPartsQueryResponse<ShouldClip>>(filterQuery.filterQueryAlias, filterQuery.filterQueryAlias)
      .where(`st_geometrytype(${geometryColumn}) = :geometryType`, { geometryType: 'ST_Polygon' });

    const findPolygonPartsQuery = this.buildPolygonPartsQueryWithFilter({
      ...context,
      filterQuery,
      select: featureCollectionSelect,
    });
    return findPolygonPartsQuery;
  }

  private buildFindFeatureCollectionSelect(context: {
    entityManager: EntityManager;
    filterQuery: { filterQueryAlias: string; filterRequestFeatureIds: string };
    geometryColumn: string;
    hasAnyGeometries: boolean;
    requestFeatureId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): SelectQueryBuilder<any> {
    const {
      entityManager,
      filterQuery: { filterQueryAlias, filterRequestFeatureIds },
      geometryColumn,
      hasAnyGeometries,
      requestFeatureId,
    } = context;
    const requestFeatureIds = hasAnyGeometries
      ? ` || jsonb_strip_nulls(
      case
        when array_length(${filterRequestFeatureIds}, 1) is null then '{}'::jsonb
        when array_length(${filterRequestFeatureIds}, 1) = 1 then jsonb_build_object('${requestFeatureId}', ${filterRequestFeatureIds}[1])
        else jsonb_build_object('${requestFeatureId}', ${filterRequestFeatureIds})
      end
    )`
      : '';

    const findPolygonPartsSelect = entityManager.createQueryBuilder().select(
      `jsonb_build_object(
          'type', 'FeatureCollection',
          'features', coalesce(jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', st_asgeojson(${geometryColumn}, 15)::jsonb,
              'properties', to_jsonb(${filterQueryAlias}) - '{${geometryColumn},${filterRequestFeatureIds}}'::text[] ${requestFeatureIds}
            )
          ), '[]')
        ) AS ${'geojson' satisfies keyof FindPolygonPartsQueryResponse}`
    );
    return findPolygonPartsSelect;
  }

  private buildPolygonPartsQueryWithFilter<T extends ObjectLiteral, ShouldClip extends boolean = boolean>(
    context: FindPolygonPartsOptions<ShouldClip> & {
      entityManager: EntityManager;
      select: SelectQueryBuilder<T>;
      filterQuery: { filterQueryAlias: string; filterRequestFeatureIds: string; findSelectOutputColumns: string[] };
    }
  ): SelectQueryBuilder<T> {
    const {
      entityManager,
      filter,
      filterQuery: { filterQueryAlias, filterRequestFeatureIds, findSelectOutputColumns },
      polygonPartsEntityName,
      select,
      shouldClip,
    } = context;
    const hasAnyGeometries = filter.features.some((feature) => feature.geometry);
    const canClip = hasAnyGeometries && shouldClip;

    const polygonPart = entityManager.getRepository(PolygonPart);
    polygonPart.metadata.tablePath = polygonPartsEntityName.databaseObjectQualifiedName; // this approach may be unstable for other versions of typeorm - https://github.com/typeorm/typeorm/issues/4245#issuecomment-2134156283

    const filterExtractGeometriesCTE = entityManager
      .createQueryBuilder()
      .select(`jsonb_array_elements('${JSON.stringify(filter)}'::jsonb -> 'features')`, 'filter_feature')
      .addSelect(`jsonb_array_elements('${JSON.stringify(filter)}'::jsonb -> 'features') ->> 'geometry'`, 'filter_geometry')
      .fromDummy();

    const filterNonNullGeometriesCTE = entityManager
      .createQueryBuilder()
      .select(['filter_feature', 'st_geomfromgeojson(filter_geometry) as filter_geometry'])
      .from('filter_extract_geometries', 'filter_extract_geometries')
      .where('filter_geometry is not null');

    const filterNonNullGeometriesCounterCTE = entityManager
      .createQueryBuilder()
      .select('count(1)', 'count')
      .from('filter_non_null_geometries', 'filter_non_null_geometries');

    const filterNullGeometriesCTE = `select filter_extract_geometries.filter_feature, st_makeenvelope(-180, -90, 180, 90, 4326) as filter_geometry
      from filter_extract_geometries, filter_non_null_geometries_counter
      where filter_extract_geometries.filter_geometry is null
      and filter_non_null_geometries_counter.count = 0
      union all
      select '{"type": "Feature", "geometry": null, "properties": null}'::jsonb, st_makeenvelope(-180, -90, 180, 90, 4326)
      where not exists (
        select 1 from filter_extract_geometries
	    )`;

    const filterGeometriesCTE = `select filter_feature, filter_geometry from filter_non_null_geometries
        union all
        select filter_feature, filter_geometry from filter_null_geometries`;

    const intersectionsCTE = polygonPart
      .createQueryBuilder('polygon_part')
      .select([
        `polygon_part.${idColumn} as polygon_part_id`,
        `${canClip ? `(st_dump(st_intersection(${geometryColumn}, filter_geometry))).geom` : geometryColumn} as ${geometryColumn}`,
        'filter_feature',
      ])
      .innerJoin(
        'filter_geometries',
        'filter_geometries',
        `st_relate(${geometryColumn}, filter_geometry, 'T********') and filter_geometry && ${geometryColumn}`
      )
      .where('filter_feature is not null')
      .andWhere(
        `resolution_degree <= coalesce((filter_feature -> 'properties' ->> '${minResolutionDeg}')::numeric, ${CORE_VALIDATIONS.resolutionDeg.max})`
      );

    const filteredPolygonPartsCTE = entityManager
      .createQueryBuilder()
      .select('polygon_part_id', 'polygon_part_id')
      .addSelect(geometryColumn, geometryColumn)
      .addSelect(`array_remove(array_agg(filter_feature -> 'id'), NULL)`, 'filter_feature_ids')
      .from('intersections', 'intersections')
      .groupBy('polygon_part_id')
      .addGroupBy(geometryColumn);

    const outputPropertiesCTE = polygonPart
      .createQueryBuilder('polygon_part')
      .select(`filtered_polygon_parts.${geometryColumn}`, geometryColumn)
      .addSelect(findSelectOutputColumns)
      .addSelect('filter_feature_ids', filterRequestFeatureIds)
      .orderBy(insertionOrderColumn)
      .innerJoin('filtered_polygon_parts', 'filtered_polygon_parts', 'id = polygon_part_id');

    const filterPolygonPartsQuery = select
      .addCommonTableExpression(filterExtractGeometriesCTE, 'filter_extract_geometries')
      .addCommonTableExpression(filterNonNullGeometriesCTE, 'filter_non_null_geometries')
      .addCommonTableExpression(filterNonNullGeometriesCounterCTE, 'filter_non_null_geometries_counter')
      .addCommonTableExpression(filterNullGeometriesCTE, 'filter_null_geometries')
      .addCommonTableExpression(filterGeometriesCTE, 'filter_geometries')
      .addCommonTableExpression(intersectionsCTE, 'intersections')
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
}
