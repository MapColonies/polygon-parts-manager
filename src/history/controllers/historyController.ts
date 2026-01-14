import type { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import type { EntitiesMetadata } from '../../polygonParts/models/interfaces';
import type { ValidationEntityQuery } from '../../polygonParts/controllers/interfaces';
import { HistoryManager } from '../models/historyManager';

export type HistoryPolygonPartsEntityHandler = RequestHandler<undefined, undefined, undefined, ValidationEntityQuery, EntitiesMetadata>;

@injectable()
export class HistoryController {
  public constructor(@inject(HistoryManager) private readonly historyManager: HistoryManager) {}

  public moveValidationsToHistory: HistoryPolygonPartsEntityHandler = async (req, res, next) => {
    try {
      await this.historyManager.moveValidationsToHistory(res.locals);
      return res.status(httpStatus.NO_CONTENT).json();
    } catch (error) {
      next(error);
    }
  };
}
