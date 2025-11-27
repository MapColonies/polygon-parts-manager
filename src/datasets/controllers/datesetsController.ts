/* eslint-disable @typescript-eslint/no-magic-numbers */
import type { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { EntitiesMetadata } from '../../polygonParts/models/interfaces';
import { DatasetsManager } from '../models/datasetsManager';
import { UpsertDatasetParams, UpsertDatasetResponseBody } from './interfaces';

/**
 * Upsert datasets handler
 */
type UpsertDatasetHandler = RequestHandler<UpsertDatasetParams, UpsertDatasetResponseBody, undefined, undefined, EntitiesMetadata>;

type UpsertDatasetHandlerRequest = Parameters<UpsertDatasetHandler>[0];

@injectable()
export class DatasetesController {
  public constructor(@inject(DatasetsManager) private readonly datasetsManager: DatasetsManager) {}

  public updatePolygonParts: UpsertDatasetHandler = async (req, res, next) => {
    try {
      const response = await this.datasetsManager.upsertDataset(res.locals);
      let statusCode: number;

      switch (response.entityAction) {
        case 'created': {
          statusCode = httpStatus.CREATED;
          res.location(this.concatPathsWithHost(req, response.relativeEntityURI));
          break;
        }
        case 'modified': {
          statusCode = httpStatus.NO_CONTENT;
          break;
        }
      }
      // TODO: handle 201 or 204 response
      // TODO: concern over @mc-utils http client handling of 204 response without body
      return res.status(statusCode).send();
    } catch (error) {
      // TODO: handle errors
      next(error);
    }
  };

  private concatPathsWithHost(req: UpsertDatasetHandlerRequest, path: string): string {
    const BASE_URL = `${req.protocol}://${req.hostname}`;
    const baseUrl = new URL(req.baseUrl, BASE_URL);
    const fullUrl = new URL(path, baseUrl.href);
    return fullUrl.pathname;
  }
}
