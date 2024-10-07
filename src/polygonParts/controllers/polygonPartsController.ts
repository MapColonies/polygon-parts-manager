import type { PolygonPartsPayload } from '@map-colonies/mc-model-types';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { PolygonPartsManager } from '../models/polygonPartsManager';

type CreatePolygonPartsHandler = RequestHandler<undefined, string, PolygonPartsPayload>;

const HTTP_STATUS_CREATED_TEXT = httpStatus.getStatusText(httpStatus.CREATED);

@injectable()
export class PolygonPartsController {
  public constructor(@inject(PolygonPartsManager) private readonly polygonPartsManager: PolygonPartsManager) {}

  public createPolygonParts: CreatePolygonPartsHandler = async (req, res, next) => {
    try {
      await this.polygonPartsManager.createPolygonParts(req.body);
      return res.status(httpStatus.CREATED).send(HTTP_STATUS_CREATED_TEXT);
    } catch (error) {
      next(error);
    }
  };
}
