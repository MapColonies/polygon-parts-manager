import { NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import type { EntityManager } from 'typeorm';
import { SERVICES } from '../../common/constants';
import type { ApplicationConfig, DbConfig, IConfig } from '../../common/interfaces';
import { deleteValidationsTable } from '../../common/utils';
import type { MoveValidationsToHistoryOptions, MoveValidationsToHistoryInTransactionOptions } from '../../polygonParts/models/interfaces';
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

  public async moveValidationsToHistory(options: MoveValidationsToHistoryOptions): Promise<void> {
    const { entitiesMetadata } = options;

    this.logger.info({ msg: 'starting transaction to move validations to history table' });

    try {
      await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        await this.moveValidationsToHistoryInTransaction({
          entitiesMetadata,
          entityManager,
        });
      });
    } catch (error) {
      const errorMessage = 'Move validations to history table transaction failed';
      this.logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  public async moveValidationsToHistoryInTransaction(options: MoveValidationsToHistoryInTransactionOptions): Promise<void> {
    const { entitiesMetadata, entityManager } = options;
    const { entityName: validationsEntityName, databaseObjectQualifiedName: validationsEntityQualifiedName } =
      entitiesMetadata.entitiesNames.validations;

    const { entityName: historyEntityName, databaseObjectQualifiedName: historyTableQualifiedName } = entitiesMetadata.entitiesNames.history;

    const logger = this.logger.child({ validationsEntityName, historyEntityName });
    logger.info({ msg: 'moving validations to history table within existing transaction' });

    try {
      await this.executeMoveToHistory({
        entityManager,
        validationsEntityName,
        validationsEntityQualifiedName,
        historyEntityName,
        historyTableQualifiedName,
        logger,
      });
    } catch (error) {
      const errorMessage = 'Move validations to history table within transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async executeMoveToHistory(params: {
    entityManager: EntityManager;
    validationsEntityName: string;
    validationsEntityQualifiedName: string;
    historyEntityName: string;
    historyTableQualifiedName: string;
    logger: Logger;
  }): Promise<void> {
    const { entityManager, validationsEntityName, validationsEntityQualifiedName, historyEntityName, historyTableQualifiedName, logger } = params;

    await entityManager.query(`SET search_path TO ${this.schema},public`);

    const validationEntityExists = await this.connectionManager.entityExists(entityManager, validationsEntityName);
    if (!validationEntityExists) {
      throw new NotFoundError(`Table with the name '${validationsEntityName}' doesn't exists`);
    }

    const historyEntityExists = await this.connectionManager.entityExists(entityManager, historyEntityName);

    if (!historyEntityExists) {
      const historyTemplateQualifiedName = `${this.schema}.history`;
      logger.debug({
        msg: 'creating history table from history template',
        historyTableQualifiedName,
        historyTemplateQualifiedName,
      });
      await entityManager.query(
        `CREATE TABLE ${historyTableQualifiedName} (LIKE ${historyTemplateQualifiedName} INCLUDING ALL) INHERITS (${historyTemplateQualifiedName});`
      );
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
            footprint,
            product_type
          FROM (
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
              product_type,
              insertion_order,
              (dump).path[1] as geom_index,
              (dump).geom as footprint
            FROM (
              SELECT *, st_dump(footprint) as dump
              FROM ${validationsEntityQualifiedName}
            ) as dumped
          ) as dumped_geometries
          ORDER BY insertion_order, geom_index;
        `);

    await deleteValidationsTable(entityManager, this.schema, validationsEntityName, validationsEntityQualifiedName, logger);

    logger.info({ msg: 'validations moved to history and temporary table dropped', validationsEntityQualifiedName, historyTableQualifiedName });
  }
}
