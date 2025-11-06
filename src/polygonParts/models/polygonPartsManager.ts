import { BadRequestError, ConflictError, InternalServerError, NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { AggregationFeature, CORE_VALIDATIONS, JobTypes } from '@map-colonies/raster-shared';
import { geometryCollection } from '@turf/helpers';
import { inject, injectable } from 'tsyringe';
import type { EntityManager, SelectQueryBuilder } from 'typeorm';
import _ from 'lodash';
import { ConnectionManager } from '../../common/connectionManager';
import { SERVICES } from '../../common/constants';
import { ValidationError } from '../../common/errors';
import type { ApplicationConfig, DbConfig, IConfig } from '../../common/interfaces';
import { Part } from '../DAL/part';
import { PolygonPart } from '../DAL/polygonPart';
import { payloadToInsertPartsData, payloadToInsertValidationsData, setRepositoryTablePath } from '../DAL/utils';
import { ValidateError, ValidatePolygonPartsRequestBody, ValidatePolygonPartsResponseBody } from '../controllers/interfaces';
import { ValidatePart } from '../DAL/validationPart';
import { FeatureValidationError } from '../../common/enums';
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
  AggregationLayerMetadataResponse,
  DatabaseObjectQualifiedName,
  EntitiesMetadata,
  EntityName,
  EntityNames,
  ExistsOptions,
  ExistsResponse,
  FilterQueryMetadata,
  FindPolygonPartsOptions,
  FindPolygonPartsQueryResponse,
  FindPolygonPartsResponse,
  FindQueryFilterOptions,
  FindQuerySelectOptions,
  IsValidDetailsResult,
  PolygonPartsPayload,
  PolygonPartsResponse,
} from './interfaces';

type EntitiesMetadataWithoutValidations = Pick<EntitiesMetadata, 'entityIdentifier'> & {
  entitiesNames: Omit<EntitiesMetadata['entitiesNames'], 'validations'>;
};
interface CountQueryResponse {
  count: number;
  ids: string[];
}
interface ValidationCountSummary {
  count: number;
  parts: ValidateError[];
}

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
        const entitiesMetadataWithoutValidations: EntitiesMetadataWithoutValidations = {
          entityIdentifier: entitiesMetadata.entityIdentifier,
          entitiesNames: _.omit(entitiesMetadata.entitiesNames, 'validations'),
        };
        const baseIngestionContext = {
          entityManager,
          logger,
          entitiesMetadata: entitiesMetadataWithoutValidations,
        };

        await entityManager.query(`SET search_path TO ${this.schema},public`);
        const existingEntities = await this.checkExistingEntities(baseIngestionContext);
        if (existingEntities.length > 0) {
          throw new ConflictError(`Table(s) with the name '${existingEntities.join()}' already exist(s)`);
        }
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

  public async existsPolygonParts(options: ExistsOptions): Promise<ExistsResponse> {
    const { entitiesMetadata, payload } = options;
    this.logger.info({ msg: 'Checking polygon parts exists', payload });

    try {
      const polygonPartsEntityName = await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const entitiesMetadataWithoutValidations: EntitiesMetadataWithoutValidations = {
          entityIdentifier: entitiesMetadata.entityIdentifier,
          entitiesNames: _.omit(entitiesMetadata.entitiesNames, 'validations'),
        };
        const baseIngestionContext = {
          entityManager,
          logger: this.logger,
          entitiesMetadata: entitiesMetadataWithoutValidations,
        };

        await entityManager.query(`SET search_path TO ${this.schema},public`);
        const existingEntities = await this.checkExistingEntities(baseIngestionContext);
        if (existingEntities.length === 0) {
          throw new NotFoundError('Entities do not exist(s)');
        } else if (existingEntities.length !== Object.keys(entitiesMetadataWithoutValidations.entitiesNames).length) {
          throw new InternalServerError('Some entities are missing');
        }

        return entitiesMetadata.entityIdentifier;
      });

      return { polygonPartsEntityName };
    } catch (error) {
      const errorMessage = 'Cheking polygon parts exists transaction failed';
      this.logger.error({ msg: errorMessage, error });
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
        const entitiesMetadataWithoutValidations: EntitiesMetadataWithoutValidations = {
          entityIdentifier: entitiesMetadata.entityIdentifier,
          entitiesNames: _.omit(entitiesMetadata.entitiesNames, 'validations'),
        };
        const baseUpdateContext = {
          entityManager,
          logger,
          entitiesMetadata: entitiesMetadataWithoutValidations,
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

  public async aggregateLayerMetadata(options: AggregateLayerMetadataOptions): Promise<AggregationLayerMetadataResponse> {
    const { polygonPartsEntityName, filter } = options;

    const logger = this.logger.child({ polygonPartsEntityName });
    logger.info({ msg: 'Metadata aggregation request' });
    logger.debug({ msg: 'Metadata aggregation filter', filter });

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
        return {
          type: 'Feature',
          geometry: null,
          properties: null,
        };
      }

      return response.feature;
    } catch (error) {
      const errorMessage = 'Aggregation query transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  public async validatePolygonParts(
    validationsPayload: ValidatePolygonPartsRequestBody,
    entitiesMetadata: EntitiesMetadata
  ): Promise<ValidatePolygonPartsResponseBody> {
    const { catalogId } = validationsPayload;
    const logger = this.logger.child({ catalogId });
    logger.info({ msg: 'validatePolygonParts', catalogId });
    let mergedPartsErrors: ValidateError[] = [];

    try {
      const response = await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const baseValidationContext = {
          entityManager,
          logger,
          entitiesMetadata,
        };

        await entityManager.query(`SET search_path TO ${this.schema},public`);
        const validationsContext = { ...baseValidationContext, validationsPayload };
        await this.createValidationsTable(validationsContext);
        await this.insertToValidationsTable(validationsContext);
        const stInvalidParts = await this.isValidGeometries(validationsContext);
        const smallGeometriesSummary = await this.smallGeometriesCount(validationsContext);
        const smallHolesSummary = await this.smallHolesCount(validationsContext);

        const errorsSummary: ValidateError[][] = [
          stInvalidParts, // e.g. [{id, errors:['Validity']}...]
          smallGeometriesSummary.parts, // e.g. [{id, errors:['SMALL_GEOMETRY']}...]
          smallHolesSummary.parts, // e.g. [{id, errors:['SMALL_HOLE']}...]
        ];

        if (validationsPayload.jobType === JobTypes.Ingestion_Update) {
          const invalidResolutions = await this.validateResolutions(validationsContext);
          errorsSummary.push(invalidResolutions);
        }

        mergedPartsErrors = _(errorsSummary.flat())
          .groupBy('id')
          .map((group, id) => ({
            id,
            errors: _.uniq(group.flatMap((g) => g.errors)),
          }))
          .value();

        await this.updateFinishedValidationsRows(validationsContext);
        const transactionResponse: ValidatePolygonPartsResponseBody = {
          parts: mergedPartsErrors,
          smallGeometriesCount: smallGeometriesSummary.count,
          smallHolesCount: smallHolesSummary.count,
        };
        return transactionResponse;
      });
      return response;
    } catch (error) {
      const errorMessage = 'Validations query transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  public async deleteValidationPolygonParts(entitiesMetadata: EntitiesMetadata): Promise<void> {
    const { entityName: validationsEntityName } =
      entitiesMetadata.entitiesNames.validations;

    const logger = this.logger.child({ validationsEntityName });
    logger.info({ msg: 'deleting validations table', validationsEntityName });

    try {
      await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const baseValidationContext = {
          entityManager,
          logger,
          entitiesMetadata,
        };

        await entityManager.query(`SET search_path TO ${this.schema},public`);

        const entityExists = await this.connectionManager.entityExists(entityManager, validationsEntityName);
        if (!entityExists) {
          throw new NotFoundError(`Table with the name '${validationsEntityName}' doesn't exists`);
        }

        await this.deleteValidationsTable(baseValidationContext);
      });
    } catch (error) {
      const errorMessage = 'Validations query transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  //TODO: update params when api will be finalized- currenty just a placeholder
  /* 
  public async upsertPartsTable(
    validationsPayload: ValidatePolygonPartsRequestBody,
    isSuccessful: boolean,
    entitiesMetadata: EntitiesMetadata
  ): Promise<void> {
    const { catalogId } = validationsPayload;
    const logger = this.logger.child({ catalogId });
    logger.info({ msg: 'upsert Parts', catalogId });

    try {
      await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const baseValidationContext = {
          entityManager,
          logger,
          entitiesMetadata,
        };
        const validationsEntityName = entitiesMetadata.entitiesNames.validations.entityName;

        await entityManager.query(`SET search_path TO ${this.schema},public`);

        const entityExists = await this.connectionManager.entityExists(entityManager, validationsEntityName);
        if (!entityExists) {
          throw new NotFoundError(`Table with the name '${validationsEntityName}' doesn't exists`);
        }
        const upsertContext = { ...baseValidationContext, validationsPayload };

        //TODO: call here a function that creats parts table if not exists - using stored procedure
        //TODO: call here a function that upserts parts data into parts table -
        // create a stored procedure that inserts to the parts from the validations table
        // it seperates multiploygons and inserts other data as is to the new table from validations table
        //This 2 todos can be done in one stored procedure
        await this.deleteValidationsTable(upsertContext);
      });
    } catch (error) {
      const errorMessage = 'Validations query transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }
    */

  private async prepareAggregationFilterQuery(
    entityManager: EntityManager,
    polygonPartsEntityName: EntityNames,
    filter: FindPolygonPartsOptions<true>['filter']
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

  private async isValidGeometries(context: {
    entitiesMetadata: EntitiesMetadata;
    entityManager: EntityManager;
    logger: Logger;
  }): Promise<ValidateError[]> {
    const {
      entityManager,
      logger,
      entitiesMetadata: {
        entitiesNames: {
          validations: { databaseObjectQualifiedName: validationsEntityQualifiedName },
        },
      },
    } = context;
    logger.info({ msg: 'Calculating is valid geometries', validationsEntityQualifiedName });
    try {
      const rows = await entityManager
        .createQueryBuilder()
        .select('table.id', 'id') // alias as "id" so raw object has { id: ... }
        .from(validationsEntityQualifiedName, 'table')
        .where('validated = :validated', { validated: false })
        .andWhere('NOT ST_IsValid(footprint)')
        .getRawMany<{ id: string }>();

      const result: ValidateError[] = rows.map(({ id }) => ({
        id,
        errors: [FeatureValidationError.VALIDITY],
      }));

      return result;
    } catch (error) {
      const errorMessage = `Could not create polygon parts validation table: ${validationsEntityQualifiedName}`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async smallGeometriesCount(context: {
    entitiesMetadata: EntitiesMetadata;
    entityManager: EntityManager;
    logger: Logger;
  }): Promise<ValidationCountSummary> {
    const {
      entityManager,
      logger,
      entitiesMetadata: {
        entitiesNames: {
          validations: { databaseObjectQualifiedName: validationsEntityQualifiedName },
        },
      },
    } = context;
    logger.info({ msg: 'calculating small area geometries', validationsEntityQualifiedName });
    try {
      const [dbResponse] = await entityManager.query<CountQueryResponse[]>(
        `SELECT * FROM ${this.applicationConfig.validateSmallGeometriesFunction}($1, $2)`,
        [validationsEntityQualifiedName, this.applicationConfig.validation.areaThresholdSquareMeters]
      );

      const summary: ValidationCountSummary = {
        count: dbResponse.count,
        parts: dbResponse.ids.map((id) => ({
          id,
          errors: [FeatureValidationError.SMALL_GEOMETRY],
        })),
      };

      return summary;
    } catch (error) {
      const errorMessage = `Could not calculte small geometries: ${validationsEntityQualifiedName}`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async insertToValidationsTable(context: {
    entitiesMetadata: EntitiesMetadata;
    entityManager: EntityManager;
    logger: Logger;
    validationsPayload: ValidatePolygonPartsRequestBody;
  }): Promise<void> {
    const {
      entityManager,
      entitiesMetadata: {
        entitiesNames: {
          validations: { databaseObjectQualifiedName: validationsEntityQualifiedName },
        },
      },
      logger,
      validationsPayload,
    } = context;
    logger.debug({ msg: 'Inserting polygon parts data' });

    const insertValidationsPartData = payloadToInsertValidationsData(validationsPayload, this.applicationConfig.arraySeparator);

    try {
      const part = entityManager.getRepository(ValidatePart);
      setRepositoryTablePath(part, validationsEntityQualifiedName);
      await part.save(insertValidationsPartData, { chunk: this.applicationConfig.chunkSize });
    } catch (error) {
      const errorMessage = `Could not insert polygon parts data to table '${validationsEntityQualifiedName}'`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async createValidationsTable(context: { entitiesMetadata: EntitiesMetadata; entityManager: EntityManager; logger: Logger }): Promise<void> {
    const {
      entityManager,
      logger,
      entitiesMetadata: {
        entitiesNames: {
          validations: { databaseObjectQualifiedName: validationsEntityQualifiedName },
        },
      },
    } = context;
    logger.debug({ msg: 'Creating polygon parts validation' });

    try {
      await entityManager.query(
        `CALL ${this.applicationConfig.createPolygonPartsValidationsTablesStoredProcedure}('${validationsEntityQualifiedName}');`
      );
    } catch (error) {
      const errorMessage = `Could not create validation parts tables: '${validationsEntityQualifiedName}' `;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async smallHolesCount(context: {
    entitiesMetadata: EntitiesMetadata;
    entityManager: EntityManager;
    logger: Logger;
  }): Promise<ValidationCountSummary> {
    const {
      entityManager,
      logger,
      entitiesMetadata: {
        entitiesNames: {
          validations: { databaseObjectQualifiedName: validationsEntityQualifiedName },
        },
      },
    } = context;
    logger.info({ msg: 'calculating small holes', validationsEntityQualifiedName });
    try {
      const [dbResponse] = await entityManager.query<CountQueryResponse[]>(
        `SELECT * FROM ${this.applicationConfig.validateSmallHolesFunction}($1, $2)`,
        [validationsEntityQualifiedName, this.applicationConfig.validation.areaThresholdSquareMeters]
      );

      const summary: ValidationCountSummary = {
        count: dbResponse.count,
        parts: dbResponse.ids.map((id) => ({
          id,
          errors: [FeatureValidationError.SMALL_HOLES],
        })),
      };

      return summary;
    } catch (error) {
      const errorMessage = `Could not get summary of small holes in: ${validationsEntityQualifiedName}`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async updateFinishedValidationsRows(context: {
    entitiesMetadata: EntitiesMetadata;
    entityManager: EntityManager;
    logger: Logger;
  }): Promise<void> {
    const {
      entityManager,
      logger,
      entitiesMetadata: {
        entitiesNames: {
          validations: { databaseObjectQualifiedName: validationsEntityQualifiedName },
        },
      },
    } = context;
    logger.debug({ msg: 'Updating finished validation rows', validationsEntityQualifiedName });
    try {
      await entityManager
        .createQueryBuilder()
        .update(validationsEntityQualifiedName)
        .set({ validated: true })
        .where('validated = :validated', { validated: false })
        .execute();
    } catch (error) {
      const errorMessage = `Could not update validation table: ${validationsEntityQualifiedName}`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async validateResolutions(context: {
    entitiesMetadata: EntitiesMetadata;
    entityManager: EntityManager;
    logger: Logger;
  }): Promise<ValidateError[]> {
    const {
      entityManager,
      logger,
      entitiesMetadata: {
        entitiesNames: {
          validations: { databaseObjectQualifiedName: validationsEntityQualifiedName },
          polygonParts: { entityName: polygonPartsEntityName, databaseObjectQualifiedName: polygonPartsEntityQualifiedName },
        },
      },
    } = context;
    logger.info({ msg: 'validating resolutions', validationsEntityQualifiedName });
    try {
      const entityExists = await this.connectionManager.entityExists(entityManager, polygonPartsEntityName);
      if (!entityExists) {
        throw new NotFoundError(`Table with the name '${polygonPartsEntityQualifiedName}' doesn't exists`);
      }
      const rows = await entityManager
        .createQueryBuilder()
        .select(`${this.applicationConfig.validateResolutionsFunction}(:qualifiedValidationName, :qualifiedPolygonPartsName)`, 'id')
        .from('(SELECT 1)', 't')
        .setParameters({
          qualifiedValidationName: validationsEntityQualifiedName,
          qualifiedPolygonPartsName: polygonPartsEntityQualifiedName,
        })
        .getRawMany<{ id: string }>();

      const result: ValidateError[] = rows.map(({ id }) => ({
        id,
        errors: [FeatureValidationError.RESOLUTIONS],
      }));
      return result;
    } catch (error) {
      const errorMessage = `Could not get validate resolutions in: ${validationsEntityQualifiedName}`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async deleteValidationsTable(context: { entitiesMetadata: EntitiesMetadata; entityManager: EntityManager; logger: Logger }): Promise<void> {
    const {
      entityManager,
      logger,
      entitiesMetadata: {
        entitiesNames: {
          validations: { databaseObjectQualifiedName: validationsEntityQualifiedName },
        },
      },
    } = context;
    logger.debug({ msg: 'deleting validations table', validationsEntityQualifiedName });
    try {
      await entityManager.query(`DROP TABLE ${validationsEntityQualifiedName} CASCADE;`);

      logger.info({ msg: 'validations table dropped', validationsEntityQualifiedName });
    } catch (error) {
      const errorMessage = `Could not delete validation table: ${validationsEntityQualifiedName}`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
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

    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const precision = Math.pow(10, -maxDecimalDigits);
    const footprintUnionCTE = entityManager
      .createQueryBuilder()
      .select(`st_union(st_reduceprecision("polygon_part".footprint, ${precision}), ${precision})`, 'footprint_union')
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

  //TODO: refocator- merge this with getEntitiesNamesIfExists
  private async checkExistingEntities(context: {
    entityManager: EntityManager;
    logger: Logger;
    entitiesMetadata: EntitiesMetadataWithoutValidations;
  }): Promise<DatabaseObjectQualifiedName[]> {
    const { entityManager, logger, entitiesMetadata } = context;
    const { entitiesNames } = entitiesMetadata;
    logger.debug({ msg: 'Checking polygon parts entities existence', entitiesMetadata });

    const entitiesExist = await Promise.all<[DatabaseObjectQualifiedName, boolean]>(
      Object.values(entitiesNames).map(async ({ databaseObjectQualifiedName, entityName }) => {
        try {
          const entityExists = await this.connectionManager.entityExists(entityManager, entityName);
          return [databaseObjectQualifiedName, entityExists] satisfies [DatabaseObjectQualifiedName, boolean];
        } catch (error) {
          const errorMessage = `Could not verify polygon parts table name '${databaseObjectQualifiedName}' is available`;
          logger.error({ msg: errorMessage, error });
          throw error;
        }
      })
    );
    return entitiesExist.filter(([, exists]) => exists).map(([databaseObjectQualifiedName]) => databaseObjectQualifiedName);
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
    setRepositoryTablePath(polygonPart, polygonPartsEntityName.databaseObjectQualifiedName);

    const inputFilterGeometriesCTE = `select *
      from jsonb_to_recordset('${JSON.stringify(inputFilter)}'::jsonb -> 'features') as x(geometry jsonb, properties jsonb, id jsonb)`;

    const filterGeometriesCTE = entityManager
      .createQueryBuilder()
      .select('st_setsrid(st_geomfromgeojson(geometry), 4326)', 'filter_geometry')
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

  private async calculatePolygonParts(context: {
    entitiesMetadata: EntitiesMetadataWithoutValidations;
    entityManager: EntityManager;
    logger: Logger;
  }): Promise<void> {
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

  private async createTables(context: {
    entitiesMetadata: EntitiesMetadataWithoutValidations;
    entityManager: EntityManager;
    logger: Logger;
  }): Promise<void> {
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

  //TODO: refacotr: combine this with the checkExistingEntities
  private async getEntitiesNamesIfExists(context: {
    entityManager: EntityManager;
    logger: Logger;
    entitiesMetadata: EntitiesMetadataWithoutValidations;
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
    entitiesMetadata: EntitiesMetadataWithoutValidations;
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
      setRepositoryTablePath(part, partsEntityQualifiedName);
      await part.save(insertPartsData, { chunk: this.applicationConfig.chunkSize });
    } catch (error) {
      const errorMessage = `Could not insert polygon parts data to table '${partsEntityQualifiedName}'`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async truncateEntities(context: {
    entityManager: EntityManager;
    logger: Logger;
    entitiesMetadata: EntitiesMetadataWithoutValidations;
  }): Promise<void> {
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
        `select ${isValidDetailsResult.valid}, ${isValidDetailsResult.reason}, st_asgeojson(location) as ${isValidDetailsResult.location} from st_isvaliddetail(st_setsrid(st_geomfromgeojson($1), 4326))`,
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
