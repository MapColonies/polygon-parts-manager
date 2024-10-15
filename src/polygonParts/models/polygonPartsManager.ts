import { ConflictError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { ConnectionManager } from '../../common/connectionManager';
import { DEFAULT_SCHEMA, SERVICES } from '../../common/constants';
import type { ApplicationConfig, IConfig } from '../../common/interfaces';
import { camelCaseToSnakeCase } from '../../common/utils';
import type {
  BaseIngestionContext,
  DBSchema,
  EntityName,
  EntityNames,
  IngestionContext,
  IngestionProperties,
  PolygonPartsPayload,
} from './interfaces';

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
      const baseIngestionContext: BaseIngestionContext = {
        entityManager,
        logger,
        polygonPartsPayload,
      };

      await entityManager.query(`SET search_path TO ${this.schema},public`);
      const entityNames = await this.verifyAvailableTableNames(baseIngestionContext);
      const ingestionContext = { ...baseIngestionContext, entityNames };
      await this.createTables(ingestionContext);
      await this.insert(ingestionContext);
      await this.updatePolygonParts(ingestionContext);
    });
  }

  private async verifyAvailableTableNames(ingestionContext: BaseIngestionContext): Promise<EntityNames> {
    const { entityManager, logger, polygonPartsPayload } = ingestionContext;
    const entityNames = this.getEntitiesNames(polygonPartsPayload);

    logger.debug(`verifying polygon parts table names are available`);

    await Promise.all(
      Object.values<EntityName>({ ...entityNames }).map(async ({ databaseObjectQualifiedName, entityName }) => {
        try {
          const exists = await entityManager
            .createQueryBuilder()
            .select()
            .from('information_schema.tables', 'information_schema.tables')
            .where(`table_schema = '${this.schema}'`)
            .andWhere(`table_name = '${entityName}'`)
            .getExists();
          if (exists) {
            throw new ConflictError(`table with the name '${databaseObjectQualifiedName}' already exists`);
          }
        } catch (error) {
          const errorMessage = `Could not verify polygon parts table name '${databaseObjectQualifiedName}' is available`;
          logger.error({ msg: errorMessage, error });
          throw error;
        }
      })
    );

    return entityNames;
  }

  private async createTables(ingestionContext: IngestionContext): Promise<void> {
    const {
      entityManager,
      logger,
      entityNames: {
        parts: { databaseObjectQualifiedName: partsEntityQualifiedName },
        polygonParts: { databaseObjectQualifiedName: polygonPartsEntityQualifiedName },
      },
    } = ingestionContext;

    logger.debug(`creating polygon parts tables`);

    try {
      const createPolygonPartsProcedure = this.applicationConfig.createPolygonPartsTablesStoredProcedure;
      await entityManager.query(`CALL ${createPolygonPartsProcedure}('${partsEntityQualifiedName}', '${polygonPartsEntityQualifiedName}');`);
    } catch (error) {
      const errorMessage = `Could not create polygon parts tables: '${partsEntityQualifiedName}', '${polygonPartsEntityQualifiedName}'`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async insert(ingestionContext: IngestionContext): Promise<void> {
    const {
      entityManager,
      entityNames: {
        parts: { databaseObjectQualifiedName: partsEntityQualifiedName },
      },
      logger,
      polygonPartsPayload,
    } = ingestionContext;
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

    try {
      if (insertEntities.length === 1) {
        // QueryBuilder API is used since insert() of a single record uses the object keys as fields
        // which is unsuitable since the keys have a mapping to column names
        const columns = Object.keys(insertEntities[0]).map((key) => camelCaseToSnakeCase(key));
        await entityManager
          .createQueryBuilder()
          .insert()
          .into<IngestionProperties>(`${partsEntityQualifiedName}`, columns)
          .values(insertEntities[0])
          .execute();
      } else {
        await entityManager.insert<IngestionProperties[]>(`${partsEntityQualifiedName}`, insertEntities);
      }
    } catch (error) {
      const errorMessage = `Could not insert polygon parts data to table '${partsEntityQualifiedName}'`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async updatePolygonParts(ingestionContext: IngestionContext): Promise<void> {
    const {
      entityManager,
      logger,
      entityNames: {
        parts: { databaseObjectQualifiedName: partsEntityQualifiedName },
        polygonParts: { databaseObjectQualifiedName: polygonPartsEntityQualifiedName },
      },
    } = ingestionContext;

    logger.debug(`updating polygon parts data`);

    const updatePolygonPartsProcedure = this.applicationConfig.updatePolygonPartsTablesStoredProcedure;

    try {
      await entityManager.query(
        `CALL ${updatePolygonPartsProcedure}('${partsEntityQualifiedName}'::regclass, '${polygonPartsEntityQualifiedName}'::regclass);`
      );
    } catch (error) {
      const errorMessage = `Could not update polygon parts data in tables: '${partsEntityQualifiedName}', '${polygonPartsEntityQualifiedName}'`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private getDatabaseObjectQualifiedName(value: string): string {
    return `${this.schema}.${value}`;
  }

  private getEntitiesNames(polygonPartsPayload: PolygonPartsPayload): EntityNames {
    const { productId, productType } = polygonPartsPayload;
    const baseName = [productId, productType].join('_').toLowerCase();
    const partsEntityName = `${this.applicationConfig.entities.parts.namePrefix}${baseName}${this.applicationConfig.entities.parts.nameSuffix}`;
    const polygonPartsEntityName = `${this.applicationConfig.entities.polygonParts.namePrefix}${baseName}${this.applicationConfig.entities.polygonParts.nameSuffix}`;

    return {
      parts: { entityName: partsEntityName, databaseObjectQualifiedName: this.getDatabaseObjectQualifiedName(partsEntityName) },
      polygonParts: { entityName: polygonPartsEntityName, databaseObjectQualifiedName: this.getDatabaseObjectQualifiedName(polygonPartsEntityName) },
    };
  }
}
