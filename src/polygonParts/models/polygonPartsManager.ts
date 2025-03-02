import { BadRequestError, ConflictError, InternalServerError, NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { featureCollection } from '@turf/helpers';
import { union } from '@turf/union';
import type { Feature, Geometry, MultiPolygon, Polygon } from 'geojson';
import { inject, injectable } from 'tsyringe';
import type { EntityManager, SelectQueryBuilder } from 'typeorm';
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

interface FindPolygonPartsQueryResponse {
  readonly geojson: FindPolygonPartsResponse;
}

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

  public async findPolygonParts({ shouldClip, polygonPartsEntityName, filter }: FindPolygonPartsOptions): Promise<FindPolygonPartsResponse> {
    const logger = this.logger.child({ polygonPartsEntityName: polygonPartsEntityName.entityName });
    logger.info({ msg: 'Finding polygon parts' });

    try {
      const response = await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const exists = await this.connectionManager.entityExists(entityManager, polygonPartsEntityName.entityName);
        if (!exists) {
          throw new NotFoundError(`Table with the name '${polygonPartsEntityName.entityName}' doesn't exists`);
        }

        const filterGeometry = filter.features.filter<Feature<Polygon | MultiPolygon>>(
          (feature): feature is Feature<Polygon | MultiPolygon> => !!feature.geometry
        );
        const unionFeature = filterGeometry.length > 1 ? union(featureCollection(filterGeometry)) : filterGeometry[0];

        if (unionFeature) {
          const isValidFootprint = (
            await entityManager.query<{ isValid: boolean }[]>('select st_isvalid(st_geomfromgeojson($1)) as "isValid"', [
              JSON.stringify(unionFeature.geometry),
            ])
          )[0];
          if (!isValidFootprint.isValid) {
            throw new BadRequestError(`Invalid request body parameter 'footprint' - invalid geometry`);
          }
        }

        const findPolygonPartsQuery = this.buildFindPolygonPartsQuery({
          shouldClip,
          entityManager,
          polygonPartsEntityName,
          filter: unionFeature,
        });

        try {
          const polygonParts = await findPolygonPartsQuery.getRawOne<FindPolygonPartsQueryResponse>();
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

  private buildFindPolygonPartsQuery(
    context: Pick<FindPolygonPartsOptions, 'polygonPartsEntityName' | 'shouldClip'> & { filter: Feature<Polygon | MultiPolygon> | null } & {
      entityManager: EntityManager;
    }
  ): SelectQueryBuilder<FindPolygonPartsQueryResponse> {
    const { shouldClip, polygonPartsEntityName, filter, entityManager } = context;
    const canClip = !!filter?.geometry && shouldClip;
    const geometryColumn = getMappedColumnName('footprint' satisfies PickPropertiesOfType<PolygonPartRecord, Geometry>);

    const polygonPart = entityManager.getRepository(PolygonPart);
    polygonPart.metadata.tablePath = polygonPartsEntityName.databaseObjectQualifiedName; // this approach may be unstable for other versions of typeorm - https://github.com/typeorm/typeorm/issues/4245#issuecomment-2134156283

    const clipCTE = polygonPart
      .createQueryBuilder()
      .select(canClip ? `(st_dump(st_intersection(${geometryColumn}, st_geomfromgeojson(:clipFootprint)))).geom` : geometryColumn, geometryColumn)
      .addSelect(findSelectOutputColumns);

    const findPolygonPartsQuery = entityManager
      .createQueryBuilder()
      .select(
        `jsonb_build_object(
          'type', 'FeatureCollection',
          'features', coalesce(jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', st_asgeojson(${geometryColumn}, 15)::jsonb,
              'properties', to_jsonb(clip) - '${geometryColumn}'
            )
          ), '[]')
        ) AS ${'geojson' satisfies keyof FindPolygonPartsQueryResponse}`
      )
      .addCommonTableExpression(
        filter?.geometry
          ? clipCTE
              .where(`st_relate(${geometryColumn}, st_geomfromgeojson(:clipFootprint), 'T********')`)
              .andWhere(`st_geomfromgeojson(:clipFootprint) && ${geometryColumn}`, { clipFootprint: JSON.stringify(filter.geometry) })
          : clipCTE,
        'clip'
      )
      .from<FindPolygonPartsQueryResponse>('clip', 'clip')
      .where(`st_geometrytype(${geometryColumn}) = :geometryType`, { geometryType: 'ST_Polygon' });
    return findPolygonPartsQuery;
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
