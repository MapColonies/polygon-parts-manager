import type { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import type { EntitiesMetadata, IsSwapQueryParams, PolygonPartsPayload, PolygonPartsResponse } from '../models/interfaces';
import { PolygonPartsManager } from '../models/polygonPartsManager';
import type {
  AggregatePolygonPartsRequestBody,
  AggregationLayerMetadataParams,
  AggregationLayerMetadataResponseBody,
  ExistsRequestBody,
  ExistsResponseBody,
  FindPolygonPartsParams,
  FindPolygonPartsQueryParams,
  FindPolygonPartsRequestBody,
  FindPolygonPartsResponseBody,
  ValidatePolygonPartsRequestBody,
  ValidatePolygonPartsResponseBody,
} from './interfaces';

/**
 * Create polygon parts handler
 */
type CreatePolygonPartsHandler = RequestHandler<undefined, PolygonPartsResponse, PolygonPartsPayload, undefined, EntitiesMetadata>;

/**
 * Exists polygon parts handler
 */
type ExistsPolygonPartsHandler = RequestHandler<undefined, ExistsResponseBody, ExistsRequestBody, undefined, EntitiesMetadata>;

/**
 * Find polygon parts handler
 */
type FindPolygonPartsHandler = RequestHandler<
  FindPolygonPartsParams,
  FindPolygonPartsResponseBody,
  FindPolygonPartsRequestBody,
  FindPolygonPartsQueryParams,
  EntitiesMetadata
>;

/**
 * Update polygon parts handler
 */
type UpdatePolygonPartsHandler = RequestHandler<undefined, PolygonPartsResponse, PolygonPartsPayload, IsSwapQueryParams, EntitiesMetadata>;

/**
 * Get aggregation layer metadata handler
 */
export type AggregationLayerMetadataHandler = RequestHandler<
  AggregationLayerMetadataParams,
  AggregationLayerMetadataResponseBody,
  AggregatePolygonPartsRequestBody,
  undefined,
  EntitiesMetadata
>;

export type ValidatePolygonPartsHandler = RequestHandler<
  undefined,
  ValidatePolygonPartsResponseBody,
  ValidatePolygonPartsRequestBody,
  undefined,
  EntitiesMetadata
>;

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

  public existsPolygonParts: ExistsPolygonPartsHandler = async (req, res, next) => {
    try {
      const response = await this.polygonPartsManager.existsPolygonParts({
        entitiesMetadata: res.locals,
        payload: req.body,
      });
      return res.status(httpStatus.OK).send(response);
    } catch (error) {
      next(error);
    }
  };

  public findPolygonParts: FindPolygonPartsHandler = async (req, res, next) => {
    try {
      const response = await this.polygonPartsManager.findPolygonParts({
        shouldClip: req.query.shouldClip,
        filter: req.body.filter,
        polygonPartsEntityName: res.locals.entitiesNames.polygonParts,
      });
      return res.status(httpStatus.OK).send(response);
    } catch (error) {
      next(error);
    }
  };

  public aggregateLayerMetadata: AggregationLayerMetadataHandler = async (req, res, next) => {
    try {
      const response = await this.polygonPartsManager.aggregateLayerMetadata({
        polygonPartsEntityName: res.locals.entitiesNames.polygonParts,
        filter: req.body.filter,
      });
      return res.status(httpStatus.OK).json(response);
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

  public validatePolygonParts: ValidatePolygonPartsHandler = async (req, res, next) => {
    try {
      const response = await this.polygonPartsManager.validatePolygonParts(req.body, res.locals);
      return res
        .status(
          response.parts.length === 0 && response.smallGeometriesCount === 0 && response.smallHolesCount === 0
            ? httpStatus.OK
            : httpStatus.UNPROCESSABLE_ENTITY
        )
        .send(response);
    } catch (error) {
      next(error);
    }
  };
}
