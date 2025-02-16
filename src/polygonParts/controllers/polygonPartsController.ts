import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { PolygonPartsManager } from '../models/polygonPartsManager';
import type { CreatePolygonPartsHandler, FindPolygonPartsHandler, UpdatePolygonPartsHandler } from './interfaces';

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

  public findPolygonParts: FindPolygonPartsHandler = async (req, res, next) => {
    try {
      const response = await this.polygonPartsManager.findPolygonParts({
        shouldClip: req.query.shouldClip,
        footprint: req.body.footprint,
        polygonPartsEntityName: res.locals.entitiesNames.polygonParts,
      });
      return res.status(httpStatus.OK).send(response);
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
