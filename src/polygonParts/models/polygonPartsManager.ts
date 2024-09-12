import { InternalServerError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import type { PolygonPartsPayload } from '@map-colonies/mc-model-types';
import { inject, injectable } from 'tsyringe';
import type { EntityManager } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { SERVICES } from '../../common/constants';
import type { PolygonPartsIngestionPayload } from './interfaces';

interface Context {
  catalogId: PolygonPartsPayload['catalogId'];
  entityManager: EntityManager;
  resourceId: PolygonPartsPayload['catalogId'];
}

interface ErrorContext {
  error: unknown;
  errorMessage: string;
  id: string;
}

@injectable()
export class PolygonPartsManager {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, private readonly connectionManager: ConnectionManager) {}

  public async createPolygonParts(polygonPartsPayload: PolygonPartsPayload): Promise<void> {
    const { catalogId } = polygonPartsPayload;
    const resourceId = catalogId.replaceAll('-', '_');

    this.logger.info(`creating polygon parts for catalog record: ${catalogId}`);

    await this.connectionManager.getDataSource().transaction(async (entityManager) => {
      const context: Context = {
        catalogId,
        entityManager,
        resourceId,
      };

      await this.createSchema(context);
      await this.insert(context, polygonPartsPayload);
      await this.updatePolygonParts(context);
      await this.updateSummary(context);
    });
  }

  private async createSchema({ catalogId, entityManager, resourceId }: Context): Promise<void> {
    this.logger.debug(`creating polygon parts schema for catalog record: ${catalogId}`);
    try {
      await entityManager.query(`CALL "polygon_parts".create_polygon_parts_schema('polygon_parts.${resourceId}');`);
    } catch (error) {
      const errorMessage = 'Could not create polygon parts schema';
      throw new InternalServerError(this.enchanceErrorDetails({ error, errorMessage, id: catalogId }));
    }
  }

  private async insert({ catalogId, entityManager, resourceId }: Context, polygonPartsPayload: PolygonPartsPayload): Promise<void> {
    this.logger.debug(`inserting polygon parts data for catalog record: ${catalogId}`);
    const { partsData, ...props } = polygonPartsPayload;
    // inserted props are ordered in the order of the columns of the entity, since the entity is not modeled directly by typeorm
    const insertEntities: PolygonPartsIngestionPayload[] = partsData.map((partData) => {
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
        sensors: partData.sensors,
        countries: partData.countries,
        cities: partData.cities,
        description: partData.description,
        geometry: partData.geometry,
      };
    });

    try {
      await entityManager.insert<PolygonPartsIngestionPayload>(`polygon_parts.${resourceId}_parts`, insertEntities);
    } catch (error) {
      const errorMessage = 'Could not insert polygon parts data';
      throw new InternalServerError(this.enchanceErrorDetails({ error, errorMessage, id: catalogId }));
    }
  }

  private async updatePolygonParts({ catalogId, entityManager, resourceId }: Context): Promise<void> {
    this.logger.debug(`updating polygon parts data for catalog record: ${catalogId}`);
    try {
      await entityManager.query(
        `CALL "polygon_parts".update_polygon_parts('polygon_parts.${resourceId}_parts'::regclass, 'polygon_parts.${resourceId}'::regclass);`
      );
    } catch (error) {
      const errorMessage = 'Could not update polygon parts data';
      throw new InternalServerError(this.enchanceErrorDetails({ error, errorMessage, id: catalogId }));
    }
  }

  private async updateSummary({ catalogId, entityManager, resourceId }: Context): Promise<void> {
    // TODO
  }

  // private enchanceErrorProcessDetails(message: string, id: string): string {
  //   return `${message}, for catalog record ${id}`;
  // }

  private enchanceErrorDetails({ error, errorMessage, id }: ErrorContext): string {
    return `${errorMessage}, for catalog record ${id}${error instanceof Error ? `, details: ${error.message}` : ''}`;
  }
}
