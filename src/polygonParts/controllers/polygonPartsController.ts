import { Logger } from '@map-colonies/js-logger';
import { BoundCounter, Meter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { PolygonPartsMetadata } from '../models/interfaces';
import { PolygonPartsManager } from '../models/polygonPartsManager';

type CreatePolygonPartsHandler = RequestHandler<undefined, string, PolygonPartsMetadata>;

const HTTP_STATUS_CREATED_TEXT = httpStatus.getStatusText(httpStatus.CREATED);

@injectable()
export class PolygonPartsController {
  private readonly createdPolygonPartsCounter: BoundCounter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.METER) private readonly meter: Meter,
    @inject(PolygonPartsManager) private readonly polygonPartsManager: PolygonPartsManager
  ) {
    this.createdPolygonPartsCounter = meter.createCounter('created_resource');
  }

  public createPolygonParts: CreatePolygonPartsHandler = (req, res) => {
    this.polygonPartsManager.createPolygonParts(req.body);
    this.createdPolygonPartsCounter.add(1);
    return res.status(httpStatus.CREATED).send(HTTP_STATUS_CREATED_TEXT);
  };
}
