import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { IsSwapQueryParams, PolygonPartsPayload } from '../models/interfaces';
import { PolygonPartsManager } from '../models/polygonPartsManager';

type CreatePolygonPartsHandler = RequestHandler<undefined, string, PolygonPartsPayload>;
type UpdatePolygonPartsHandler = RequestHandler<undefined, string, PolygonPartsPayload, IsSwapQueryParams>;

const HTTP_STATUS_CREATED_TEXT = httpStatus.getStatusText(httpStatus.CREATED);
const HTTP_STATUS_OK_TEXT = httpStatus.getStatusText(httpStatus.OK);

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

  public updatePolygonParts: UpdatePolygonPartsHandler = async (req, res, next) => {
    try {
      const isSwap = req.query.isSwap;
      await this.polygonPartsManager.updatePolygonParts(isSwap, req.body);
      return res.status(httpStatus.OK).send(HTTP_STATUS_OK_TEXT);
    } catch (error) {
      next(error);
    }
  };
}
