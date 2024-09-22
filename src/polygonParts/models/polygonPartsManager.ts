import { InternalServerError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import type { PolygonPartsPayload } from '@map-colonies/mc-model-types';
import { inject, injectable } from 'tsyringe';
import type { EntityManager } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { SERVICES } from '../../common/constants';
import { ApplicationConfig, IConfig } from '../../common/interfaces';
import type { IngestionProperties } from './interfaces';

interface IngestionContext {
  entityManager: EntityManager;
  polygonPartsPayload: PolygonPartsPayload;
}

interface ErrorContext {
  error: unknown;
  errorMessage: string;
  id: string;
}

@injectable()
export class PolygonPartsManager {
  private readonly arraySeparator: ApplicationConfig['arraySeparator'];
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    private readonly connectionManager: ConnectionManager
  ) {
    this.arraySeparator = this.config.get<ApplicationConfig['arraySeparator']>('application.arraySeparator');
  }

  public async createPolygonParts(polygonPartsPayload: PolygonPartsPayload): Promise<void> {
    const { catalogId } = polygonPartsPayload;

    this.logger.info(`creating polygon parts for catalog record: ${catalogId}`);

    await this.connectionManager.getDataSource().transaction(async (entityManager) => {
      const ingestionContext: IngestionContext = {
        polygonPartsPayload,
        entityManager,
      };

      await this.createTables(ingestionContext);
      await this.insert(ingestionContext);
      await this.updatePolygonParts(ingestionContext);
    });
  }

  private async createTables(ingestionContext: IngestionContext): Promise<void> {
    const { entityManager, polygonPartsPayload } = ingestionContext;
    const { catalogId } = polygonPartsPayload;

    this.logger.debug(`creating polygon parts schema for catalog record: ${catalogId}`);

    const entityName = this.getEntityName(polygonPartsPayload);

    try {
      await entityManager.query(`CALL "polygon_parts".create_polygon_parts_tables('polygon_parts.${entityName}');`);
    } catch (error) {
      const errorMessage = 'Could not create polygon parts schema';
      throw new InternalServerError(this.enchanceErrorDetails({ error, errorMessage, id: catalogId }));
    }
  }

  private async insert(ingestionContext: IngestionContext): Promise<void> {
    const { entityManager, polygonPartsPayload } = ingestionContext;
    const { catalogId, partsData, ...props } = polygonPartsPayload;

    this.logger.debug(`inserting polygon parts data for catalog record: ${catalogId}`);

    // inserted props are ordered in the order of the columns of the entity, since the entity is not modeled directly by typeorm
    const insertEntities: IngestionProperties[] = partsData.map((partData) => {
      return {
        productId: props.productId,
        productType: props.productType,
        catalogId: catalogId,
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
        sensors: partData.sensors.join(this.arraySeparator),
        countries: partData.countries?.join(this.arraySeparator),
        cities: partData.cities?.join(this.arraySeparator),
        description: partData.description,
        geometry: partData.geometry,
      };
    });
    const entityName = this.getEntityName(polygonPartsPayload);

    try {
      if (insertEntities.length === 1) {
        // QueryBuilder API is used since insert() of a single record uses the object keys as fields
        // which is unsuitable since the keys have a mapping to column names
        await entityManager
          .createQueryBuilder()
          .insert()
          .into<IngestionProperties>(`polygon_parts.${entityName}_parts`, [
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
            'horizontal_accuracy_ce_90',
            'sensors',
            'countries',
            'cities',
            'description',
            'geometry',
          ])
          .values(insertEntities[0])
          .execute();
      } else {
        await entityManager.insert<IngestionProperties[]>(`polygon_parts.${entityName}_parts`, insertEntities);
      }
    } catch (error) {
      const errorMessage = 'Could not insert polygon parts data';
      throw new InternalServerError(this.enchanceErrorDetails({ error, errorMessage, id: catalogId }));
    }
  }

  private async updatePolygonParts(ingestionContext: IngestionContext): Promise<void> {
    const { entityManager, polygonPartsPayload } = ingestionContext;
    const { catalogId } = polygonPartsPayload;

    this.logger.debug(`updating polygon parts data for catalog record: ${catalogId}`);

    const entityName = this.getEntityName(polygonPartsPayload);

    try {
      await entityManager.query(
        `CALL "polygon_parts".update_polygon_parts('polygon_parts.${entityName}_parts'::regclass, 'polygon_parts.${entityName}'::regclass);`
      );
    } catch (error) {
      const errorMessage = 'Could not update polygon parts data';
      throw new InternalServerError(this.enchanceErrorDetails({ error, errorMessage, id: catalogId }));
    }
  }

  private getEntityName(polygonPartsPayload: PolygonPartsPayload): string {
    const { productId, productType } = polygonPartsPayload;
    return [productId, productType].join('_');
  }

  private enchanceErrorDetails({ error, errorMessage, id }: ErrorContext): string {
    return `${errorMessage}, for catalog record ${id}${error instanceof Error ? `, details: ${error.message}` : ''}`;
  }
}
