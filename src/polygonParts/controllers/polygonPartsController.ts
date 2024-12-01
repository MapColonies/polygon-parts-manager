import type { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import type {
  EntityNames,
  IsSwapQueryParams,
  PolygonPartsPayload,
  PolygonPartsResponse
} from '../models/interfaces';
import { PolygonPartsManager } from '../models/polygonPartsManager';

export type CreatePolygonPartsHandler = RequestHandler<undefined, PolygonPartsResponse, PolygonPartsPayload, undefined, EntityNames>;
export type UpdatePolygonPartsHandler = RequestHandler<undefined, PolygonPartsResponse, PolygonPartsPayload, IsSwapQueryParams, EntityNames>;

@injectable()
export class PolygonPartsController {
  public constructor(@inject(PolygonPartsManager) private readonly polygonPartsManager: PolygonPartsManager) {}

  public createPolygonParts: CreatePolygonPartsHandler = async (req, res, next) => {
    try {
      const response = await this.polygonPartsManager.createPolygonParts(req.body, res.locals);
      return res.status(httpStatus.CREATED).send(response);
    } catch (error) {
      next(error);
    }
  };

  public updatePolygonParts: UpdatePolygonPartsHandler = async (req, res, next) => {
    try {
      const isSwap = req.query.isSwap;
      const response = await this.polygonPartsManager.updatePolygonParts(isSwap, req.body, res.locals);
      return res.status(httpStatus.OK).send(response);
    } catch (error) {
      next(error);
    }
  };
}
