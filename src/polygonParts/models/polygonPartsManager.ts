import { InternalServerError } from '@map-colonies/error-types';
import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import type { EntityManager } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { SERVICES } from '../../common/constants';
import type { PolygonPartsIngestionPayload, PolygonPartsPayload } from './interfaces';

type ResourceId = PolygonPartsPayload['catalogId'];

@injectable()
export class PolygonPartsManager {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, private readonly connectionManager: ConnectionManager) {}

  public async createPolygonParts(polygonPartsPayload: PolygonPartsPayload): Promise<void> {
    const { catalogId } = polygonPartsPayload;
    const resourceId = catalogId.replaceAll('-', '_');

    this.logger.info(`creating polygon parts for catalog record: ${catalogId}`);

    await this.connectionManager.getDataSource().transaction(async (entityManager) => {
      await this.createSchema(entityManager, resourceId);
      await this.insert(entityManager, resourceId, polygonPartsPayload);
      await this.updatePolygonParts(entityManager, resourceId);
      await this.updateSummary(entityManager, resourceId);
    });
  }

  private async createSchema(entityManager: EntityManager, resourceId: ResourceId): Promise<void> {
    try {
      await entityManager.query(`CALL "polygon_parts".create_polygon_parts_schema('polygon_parts.${resourceId}');`);
    } catch (error) {
      this.errorMessageHandler(`Could not create polygon parts schema`, error);
      throw new InternalServerError(`Could not create polygon parts schema`);
    }
  }

  private async insert(entityManager: EntityManager, resourceId: ResourceId, polygonPartsPayload: PolygonPartsPayload): Promise<void> {
    const { polygonPartsMetadata, ...props } = polygonPartsPayload;
    // inserted props are ordered in the order of the columns of the entity, since the entity is not modeled directly by typeorm
    const insertEntities: PolygonPartsIngestionPayload[] = polygonPartsMetadata.map((polygonPartMetadata) => {
      return {
        productId: props.productId,
        productType: props.productType,
        catalogId: props.catalogId,
        sourceId: polygonPartMetadata.sourceId,
        sourceName: polygonPartMetadata.sourceName,
        productVersion: props.productVersion,
        ingestionDateUTC: undefined,
        imagingTimeBeginUTC: polygonPartMetadata.imagingTimeBeginUTC,
        imagingTimeEndUTC: polygonPartMetadata.imagingTimeEndUTC,
        resolutionDegree: polygonPartMetadata.resolutionDegree,
        resolutionMeter: polygonPartMetadata.resolutionMeter,
        sourceResolutionMeter: polygonPartMetadata.sourceResolutionMeter,
        horizontalAccuracyCE90: polygonPartMetadata.horizontalAccuracyCE90,
        sensors: polygonPartMetadata.sensors,
        countries: polygonPartMetadata.countries,
        cities: polygonPartMetadata.cities,
        description: polygonPartMetadata.description,
        geometry: polygonPartMetadata.geometry,
      };
    });

    try {
      await entityManager.insert<PolygonPartsIngestionPayload>(`polygon_parts.${resourceId}_parts`, insertEntities);
    } catch (error) {
      this.errorMessageHandler(`Could not insert polygon parts data`, error);
      throw new InternalServerError(`Could not insert polygon parts data`);
    }
  }

  private async updatePolygonParts(entityManager: EntityManager, resourceId: ResourceId): Promise<void> {
    try {
      await entityManager.query(
        `CALL "polygon_parts".update_polygon_parts('polygon_parts.${resourceId}_parts'::regclass, 'polygon_parts.${resourceId}'::regclass);`
      );
    } catch (error) {
      this.errorMessageHandler(`Could not update polygon parts data`, error);
      throw new InternalServerError(`Could not update polygon parts data`);
    }
  }

  private async updateSummary(entityManager: EntityManager, resourceId: ResourceId): Promise<void> {
    // TODO
  }

  private errorMessageHandler(message: string, error: unknown): void {
    this.logger.error(`${message} for catalog record: ${error instanceof Error ? `, reason: ${error.message}` : ''}`);
  }
}
