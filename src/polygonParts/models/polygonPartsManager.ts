import { BadRequestError, ConflictError, InternalServerError, NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { CORE_VALIDATIONS, type RoiProperties } from '@map-colonies/raster-shared';
import { geometryCollection } from '@turf/helpers';
import type { Geometry } from 'geojson';
import { inject, injectable } from 'tsyringe';
import type { EntityManager, SelectQueryBuilder } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { SERVICES } from '../../common/constants';
import type { ApplicationConfig, DbConfig, IConfig } from '../../common/interfaces';
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

type IsValidDetailsResult = { valid: true; reason: null; location: null } | { valid: false; reason: string; location: Geometry | null };
interface FindPolygonPartsQueryResponse<ShouldClip extends boolean = boolean> {
  readonly geojson: FindPolygonPartsResponse<ShouldClip>;
}
type FindQueryFilterOptions<ShouldClip extends boolean = boolean> = Omit<FindPolygonPartsOptions, 'filter'> & {
  entityManager: EntityManager;
  filter: {
    inputFilter: FindPolygonPartsOptions<ShouldClip>['filter'];
    filterQueryAlias: string;
    filterRequestFeatureIds: string;
    findSelectOutputColumns: string[];
  };
};
interface FindQuerySelectOptions {
  geometryColumn: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: { findFilterQuery: SelectQueryBuilder<any>; filterQueryAlias: string; filterRequestFeatureIds: string };
  requestFeatureId: string;
}

const geometryColumn = getMappedColumnName('footprint' satisfies keyof Pick<PolygonPartRecord, 'footprint'>);
const idColumn = getMappedColumnName('id' satisfies keyof Pick<PolygonPartRecord, 'id'>);
const insertionOrderColumn = getMappedColumnName('insertionOrder' satisfies keyof Pick<PolygonPartRecord, 'insertionOrder'>);
const isValidDetailsResult = {
  valid: 'valid' satisfies keyof Pick<IsValidDetailsResult, 'valid'>,
  reason: 'reason' satisfies keyof Pick<IsValidDetailsResult, 'reason'>,
  location: 'location' satisfies keyof Pick<IsValidDetailsResult, 'location'>,
};
const minResolutionDeg = 'minResolutionDeg' satisfies keyof Pick<RoiProperties, 'minResolutionDeg'>;
const requestFeatureId = 'requestFeatureId' satisfies keyof Pick<FindPolygonPartsResponse['features'][number]['properties'], 'requestFeatureId'>;

export const findSelectOutputColumns = Object.entries(FIND_OUTPUT_PROPERTIES)
  .filter(([, value]) => value)
  .map(([key, value]) => `${typeof value === 'boolean' ? `"${getMappedColumnName(key)}"` : value(getMappedColumnName(key))} as "${key}"`);

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

  private buildFindQuery<ShouldClip extends boolean = boolean>(
    context: Pick<FindPolygonPartsOptions, 'polygonPartsEntityName' | 'shouldClip'> & {
      entityManager: EntityManager;
      filter: FindPolygonPartsOptions['filter'];
      findSelectOutputColumns: string[];
    }
  ): SelectQueryBuilder<FindPolygonPartsQueryResponse<ShouldClip>> {
    const { filter: inputFilter, findSelectOutputColumns } = context;
    const filterQuery = { filterQueryAlias: 'output_properties', filterRequestFeatureIds: 'request_feature_ids', findSelectOutputColumns };

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
      filter: { filterQueryAlias, filterRequestFeatureIds, findSelectOutputColumns, inputFilter = { type: 'FeatureCollection', features: [] } },
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

    const isEmptyFilterCTE = entityManager
      .createQueryBuilder()
      .select('not exists (select 1 from filter_geometries)', 'is_empty_filter')
      .fromDummy();

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
    // TODO: move function to validation middleware
    const { entityManager, filter } = context;

    if (filter && filter.features.length > 0) {
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
}
