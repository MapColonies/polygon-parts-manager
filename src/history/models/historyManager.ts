import { NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import type { ApplicationConfig, DbConfig, IConfig } from '../../common/interfaces';
import { deleteValidationsTable } from '../../common/utils';
import type { EntitiesMetadata } from '../../polygonParts/models/interfaces';
import { ConnectionManager } from '../../common/connectionManager';

@injectable()
export class HistoryManager {
  private readonly applicationConfig: ApplicationConfig;
  private readonly schema: DbConfig['schema'];

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.CONNECTION_MANAGER) private readonly connectionManager: ConnectionManager
  ) {
    this.applicationConfig = this.config.get('application');
    this.schema = config.get('db.schema');
  }

  public async moveValidationsToHistory(entitiesMetadata: EntitiesMetadata): Promise<void> {
    const { entityName: validationsEntityName, databaseObjectQualifiedName: validationsEntityQualifiedName } =
      entitiesMetadata.entitiesNames.validations;

    const historyEntityName = entitiesMetadata.entitiesNames.history.entityName;
    const historyTableQualifiedName = `${this.schema}.${historyEntityName}`;

    const logger = this.logger.child({ validationsEntityName, historyEntityName });
    logger.info({ msg: 'moving validations to history table', validationsEntityQualifiedName, historyEntityName });

    try {
      await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        await entityManager.query(`SET search_path TO ${this.schema},public`);

        const entityExists = await this.connectionManager.entityExists(entityManager, validationsEntityName);
        if (!entityExists) {
          throw new NotFoundError(`Table with the name '${validationsEntityName}' doesn't exists`);
        }

        // Check if history table exists
        const historyTableExists = await this.connectionManager.entityExists(entityManager, historyEntityName);

        if (!historyTableExists) {
          // Create history table based on history template
          const historyTemplateQualifiedName = `${this.schema}.history`;
          logger.debug({
            msg: 'creating history table from history template',
            historyTableQualifiedName,
            historyTemplateQualifiedName,
          });
          await entityManager.query(`CREATE TABLE ${historyTableQualifiedName} (LIKE ${historyTemplateQualifiedName} INCLUDING ALL);`);
        }

        // Insert data into history table, splitting MultiPolygons into Polygons
        logger.debug({ msg: 'inserting validation data into history table', historyTableQualifiedName });
        await entityManager.query(`
          INSERT INTO ${historyTableQualifiedName} (
            product_id,
            catalog_id,
            source_id,
            source_name,
            product_version,
            ingestion_date_utc,
            imaging_time_begin_utc,
            imaging_time_end_utc,
            resolution_degree,
            resolution_meter,
            source_resolution_meter,
            horizontal_accuracy_ce90,
            sensors,
            countries,
            cities,
            description,
            footprint,
            product_type
          )
          SELECT 
            product_id,
            catalog_id,
            source_id,
            source_name,
            product_version,
            ingestion_date_utc,
            imaging_time_begin_utc,
            imaging_time_end_utc,
            resolution_degree,
            resolution_meter,
            source_resolution_meter,
            horizontal_accuracy_ce90,
            sensors,
            countries,
            cities,
            description,
            geom as footprint,
            product_type
          FROM (
            SELECT 
              *,
              (st_dump(footprint)).path[1] as geom_index,
              (st_dump(footprint)).geom as geom
            FROM ${validationsEntityQualifiedName}
          ) as dumped_geometries
          ORDER BY insertion_order, geom_index;
        `);

        // Delete the temporary validation table
        await deleteValidationsTable(entityManager, this.schema, validationsEntityName, validationsEntityQualifiedName, logger);

        logger.info({ msg: 'validations moved to history and temporary table dropped', validationsEntityQualifiedName, historyTableQualifiedName });
      });
    } catch (error) {
      const errorMessage = 'Move validations to history table transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }
}
