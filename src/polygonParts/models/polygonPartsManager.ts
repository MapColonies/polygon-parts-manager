import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { PolygonPartsPayload } from './interfaces';

@injectable()
export class PolygonPartsManager {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public createPolygonParts(polygonPartsPayload: PolygonPartsPayload): void {
    const { catalogId } = polygonPartsPayload;

    this.logger.info({ msg: `creating polygon parts for catalog record: ${catalogId}` });

    this.createSchema(catalogId);
    this.insertData(polygonPartsPayload);
    this.calculatePolygonParts(catalogId);
    this.updateSummary(catalogId);
  }

  private createSchema(catalogId: PolygonPartsPayload['catalogId']): void {
    // TODO
  }

  private insertData(polygonPartsPayload: PolygonPartsPayload): void {
    // TODO
  }

  private calculatePolygonParts(catalogId: PolygonPartsPayload['catalogId']): void {
    // TODO
  }

  private updateSummary(catalogId: PolygonPartsPayload['catalogId']): void {
    // TODO
  }
}
