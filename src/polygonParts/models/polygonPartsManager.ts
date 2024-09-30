import { ConflictError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import type { PolygonPartsPayload } from '@map-colonies/mc-model-types';
import { inject, injectable } from 'tsyringe';
import type { EntityManager } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { DEFAULT_SCHEMA, SERVICES } from '../../common/constants';
import { ApplicationConfig, DbConfig, IConfig } from '../../common/interfaces';
import { CamelToSnakeCase } from '../../common/types';
import type { IngestionProperties } from './interfaces';

interface IngestionContext {
  entityManager: EntityManager;
  logger: Logger;
  polygonPartsPayload: PolygonPartsPayload;
}

type DBSchema = DbConfig['schema'];

@injectable()
export class PolygonPartsManager {
  private readonly applicationConfig: ApplicationConfig;
  private readonly schema: NonNullable<DBSchema>;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    private readonly connectionManager: ConnectionManager
  ) {
    this.applicationConfig = this.config.get<ApplicationConfig>('application');
    this.schema = config.get<DBSchema>('db.schema') ?? DEFAULT_SCHEMA;
  }

  public async createPolygonParts(polygonPartsPayload: PolygonPartsPayload): Promise<void> {
    const { catalogId } = polygonPartsPayload;

    const logger = this.logger.child({ catalogId });
    logger.info(`creating polygon parts`);

    await this.connectionManager.getDataSource().transaction(async (entityManager) => {
      const ingestionContext: IngestionContext = {
        entityManager,
        logger,
        polygonPartsPayload,
      };

      await entityManager.query(`SET search_path TO ${this.schema},public`);
      await this.createTables(ingestionContext);
      await this.insert(ingestionContext);
      await this.updatePolygonParts(ingestionContext);
    });
  }

  private async createTables(ingestionContext: IngestionContext): Promise<void> {
    const { entityManager, logger, polygonPartsPayload } = ingestionContext;

    logger.debug(`creating polygon parts tables`);

    try {
      const createPolygonPartsProcedure = this.applicationConfig.createPolygonPartsTablesStoredProcedure;
      const entityName = this.getEntityName(polygonPartsPayload);
      const entityQualifiedName = this.getDatabaseObjectQualifiedName(entityName);
      const exists = await entityManager.exists(entityQualifiedName);
      if (exists) {
        throw new ConflictError(`table with the name '${entityQualifiedName}' already exists`);
      }
      await entityManager.query(`CALL ${createPolygonPartsProcedure}('${entityQualifiedName}');`);
    } catch (error) {
      const errorMessage = 'Could not create polygon parts tables';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async insert(ingestionContext: IngestionContext): Promise<void> {
    const { entityManager, logger, polygonPartsPayload } = ingestionContext;
    const { partsData, ...props } = polygonPartsPayload;

    logger.debug(`inserting polygon parts data`);

    // inserted props are ordered in the order of the columns of the entity, since the entity is not modeled directly by typeorm
    const insertEntities: IngestionProperties[] = partsData.map((partData) => {
      return {
        productId: props.productId,
        productType: props.productType,
        catalogId: props.catalogId,
        sourceId: partData.sourceId,
        sourceName: partData.sourceName,
        productVersion: props.productVersion,
        ingestionDateUTC: undefined,
        imagingTimeBeginUTC: partData.imagingTimeBeginUTC,
        imagingTimeEndUTC: partData.imagingTimeEndUTC,
        resolutionDegree: partData.resolutionDegree,
        resolutionMeter: partData.resolutionMeter,
        sourceResolutionMeter: partData.sourceResolutionMeter,
        horizontalAccuracyCE90: partData.horizontalAccuracyCE90,
        sensors: partData.sensors.join(this.applicationConfig.arraySeparator),
        countries: partData.countries?.join(this.applicationConfig.arraySeparator),
        cities: partData.cities?.join(this.applicationConfig.arraySeparator),
        description: partData.description,
        footprint: partData.footprint,
      };
    });
    const entityName = this.getEntityName(polygonPartsPayload);
    const entityQualifiedName = this.getDatabaseObjectQualifiedName(entityName);

    const columns: CamelToSnakeCase<keyof IngestionProperties>[] = [
      'product_id',
      'product_type',
      'catalog_id',
      'source_id',
      'source_name',
      'product_version',
      'ingestion_date_utc',
      'imaging_time_begin_utc',
      'imaging_time_end_utc',
      'resolution_degree',
      'resolution_meter',
      'source_resolution_meter',
      'horizontal_accuracy_ce90',
      'sensors',
      'countries',
      'cities',
      'description',
      'footprint',
    ];

    try {
      if (insertEntities.length === 1) {
        // QueryBuilder API is used since insert() of a single record uses the object keys as fields
        // which is unsuitable since the keys have a mapping to column names
        await entityManager
          .createQueryBuilder()
          .insert()
          .into<IngestionProperties>(`${entityQualifiedName}_parts`, columns)
          .values(insertEntities[0])
          .execute();
      } else {
        await entityManager.insert<IngestionProperties[]>(`${entityQualifiedName}_parts`, insertEntities);
      }
    } catch (error) {
      const errorMessage = 'Could not insert polygon parts data';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async updatePolygonParts(ingestionContext: IngestionContext): Promise<void> {
    const { entityManager, logger, polygonPartsPayload } = ingestionContext;

    logger.debug(`updating polygon parts data`);

    const updatePolygonPartsProcedure = this.applicationConfig.updatePolygonPartsTablesStoredProcedure;
    const entityName = this.getEntityName(polygonPartsPayload);
    const entityQualifiedName = this.getDatabaseObjectQualifiedName(entityName);

    try {
      await entityManager.query(`CALL ${updatePolygonPartsProcedure}('${entityQualifiedName}_parts'::regclass, '${entityQualifiedName}'::regclass);`);
    } catch (error) {
      const errorMessage = 'Could not update polygon parts data';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private getDatabaseObjectQualifiedName(value: string): string {
    return `${this.schema}.${value}`;
  }

  private getEntityName(polygonPartsPayload: PolygonPartsPayload): string {
    const { productId, productType } = polygonPartsPayload;
    return [productId, productType].join('_').toLowerCase();
  }
}
