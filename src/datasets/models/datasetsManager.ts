import { NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { EntityManager } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { SERVICES } from '../../common/constants';
import type { ApplicationConfig, DbConfig, IConfig } from '../../common/interfaces';
import { setRepositoryTablePath } from '../../polygonParts/DAL/utils';
import { ValidationPart } from '../../polygonParts/DAL/validationPart';
import { EntitiesMetadata } from '../../polygonParts/models/interfaces';
import { UpsertDatasetResponse } from './interfaces';

@injectable()
export class DatasetsManager {
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

  public async upsertDataset(entitiesMetadata: EntitiesMetadata): Promise<UpsertDatasetResponse> {
    const { entityIdentifier } = entitiesMetadata;
    const logger = this.logger.child({ entityIdentifier });
    logger.info({ msg: `Upsert datasets` });

    try {
      const response = await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const { entityName: datasetsEntityName } = entitiesMetadata.entitiesNames.datasets;
        const { entityName: validationsEntityName } = entitiesMetadata.entitiesNames.validations;

        await entityManager.query(`SET search_path TO ${this.schema},public`);
        const validationsEntityExists = await this.connectionManager.entityExists(entityManager, validationsEntityName);
        if (!validationsEntityExists) {
          throw new NotFoundError(`Table with the name '${validationsEntityName}' doesn't exists`);
        }
        const entityExists = await this.connectionManager.entityExists(entityManager, datasetsEntityName);
        // TODO: copy data between tables

        const copyContext = {
          entityManager,
          logger,
          entitiesMetadata,
        };
        await this.copy(copyContext);

        // TODO: delete validation entity

        return entityExists
          ? { entityAction: 'modified' as const }
          : { entityAction: 'created' as const, relativeEntityURI: `/datasets/${datasetsEntityName}` };
      });
      return response;
    } catch (error) {
      const errorMessage = 'Upsert datasets transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async copy(context: { entitiesMetadata: EntitiesMetadata; entityManager: EntityManager; logger: Logger }): Promise<void> {
    const chunkSize = 1_000_000; // TODO: extract from a config, make it optional
    const {
      entityManager,
      entitiesMetadata: {
        entitiesNames: {
          validations: { databaseObjectQualifiedName: validationsEntityQualifiedName },
          datasets: { databaseObjectQualifiedName: datasetsEntityQualifiedName },
        },
      },
      logger,
    } = context;
    logger.debug({ msg: `Copying data from validation ${validationsEntityQualifiedName} into ${datasetsEntityQualifiedName}` });

    try {
      const validations = entityManager.getRepository(ValidationPart);
      setRepositoryTablePath(validations, validationsEntityQualifiedName);
      const validationsCount = await validations.count();

      for (let numFeatures = 0; numFeatures < validationsCount; numFeatures += chunkSize) {
        // TODO: create Datasets repo, then datasetes.query(...)
        await entityManager.query(`insert into $1 select * from $2`, [datasetsEntityQualifiedName, validationsEntityQualifiedName]);
      }
    } catch (error) {
      const errorMessage = `Could not copy data to table '${datasetsEntityQualifiedName}'`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }
}
