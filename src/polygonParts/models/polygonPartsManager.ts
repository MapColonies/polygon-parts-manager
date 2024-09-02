import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { PolygonPartsMetadata } from './interfaces';

@injectable()
export class PolygonPartsManager {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public createPolygonParts(polygonPartsMetadata: PolygonPartsMetadata): void {
    const { catalogId } = polygonPartsMetadata;

    this.logger.info({ msg: `creating polygon parts for catalog record: ${catalogId}` });

    this.createSchema(catalogId);
    this.insertData(polygonPartsMetadata);
    this.calculatePolygonParts(catalogId);
    this.updateSummary(catalogId);
  }

  private createSchema(catalogId: PolygonPartsMetadata['catalogId']): void {
    // TODO
  }

  private insertData(polygonPartsMetadata: PolygonPartsMetadata): void {
    // TODO
  }

  private calculatePolygonParts(catalogId: PolygonPartsMetadata['catalogId']): void {
    // TODO
  }

  private updateSummary(catalogId: PolygonPartsMetadata['catalogId']): void {
    // TODO
  }
}
