import { BadRequestError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { polygonPartsEntityNameSchema, polygonPartsPayloadSchema } from '@map-colonies/raster-shared';
import type { RequestHandler } from 'express';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { ValidationError } from '../../common/errors';
import { Validator } from '../../middlewares/validator';
import type { AggregationLayerMetadataParams, AggregationLayerMetadataResponseBody } from '../../polygonParts/controllers/interfaces';
import {
  aggregationPolygonPartsRequestBodySchema,
  findPolygonPartsQueryParamsSchema,
  findPolygonPartsRequestBodySchema,
  intersectionRequestBodySchema,
  updatePolygonPartsQueryParamsSchema,
} from '../schemas';

/**
 * Create polygon parts validation handler
 */
type CreatePolygonPartsValidationHandler = RequestHandler<undefined, undefined, unknown, undefined>;

/**
 * Exists polygon parts validation handler
 */
type ExistsPolygonPartsValidationHandler = RequestHandler<undefined, undefined, unknown, undefined>;

/**
 * Find polygon parts validation handler
 */
type FindPolygonPartsValidationHandler = RequestHandler<unknown, undefined, unknown, unknown>;

/**
 * Intersection validation handler
 */
type IntersectionValidationHandler = RequestHandler<unknown, undefined, unknown, undefined>;

/**
 * Update polygon parts validation handler
 */
type UpdatePolygonPartsValidationHandler = RequestHandler<undefined, undefined, unknown, unknown>;

type AggregationLayerMetadataValidationHandler = RequestHandler<
  AggregationLayerMetadataParams,
  AggregationLayerMetadataResponseBody,
  unknown,
  undefined
>;

@singleton()
export class ValidationsController {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(Validator) private readonly validator: Validator
  ) {}

  public readonly validateCreatePolygonParts: CreatePolygonPartsValidationHandler = (req, _, next) => {
    try {
      this.validator.schemaParser({ schema: polygonPartsPayloadSchema, value: req.body, errorMessagePrefix: 'Invalid request body' });
      next();
    } catch (error) {
      this.logger.error({ msg: 'create polygon parts validation failed', err: error });
      if (error instanceof ValidationError) {
        throw new BadRequestError(error.message);
      }
      next(error);
    }
  };

  public readonly validateUpdatePolygonParts: UpdatePolygonPartsValidationHandler = (req, _, next) => {
    try {
      this.validator.schemaParser({ schema: polygonPartsPayloadSchema, value: req.body, errorMessagePrefix: 'Invalid request body' });
      this.validator.schemaParser({ schema: updatePolygonPartsQueryParamsSchema, value: req.query, errorMessagePrefix: 'Invalid query params' });
      next();
    } catch (error) {
      this.logger.error({ msg: 'update polygon parts validation failed', err: error });
      if (error instanceof ValidationError) {
        throw new BadRequestError(error.message);
      }
      next(error);
    }
  };

  public readonly validateExistsPolygonParts: ExistsPolygonPartsValidationHandler = (req, _, next) => {
    try {
      this.validator.schemaParser({
        schema: polygonPartsPayloadSchema.pick({ productId: true, productType: true }),
        value: req.body,
        errorMessagePrefix: 'Invalid request body',
      });
      next();
    } catch (error) {
      this.logger.error({ msg: 'exists polygon parts validation failed', err: error });
      if (error instanceof ValidationError) {
        throw new BadRequestError(error.message);
      }
      next(error);
    }
  };

  public readonly validateFindPolygonParts: FindPolygonPartsValidationHandler = async (req, _, next) => {
    try {
      this.validator.schemaParser({ schema: polygonPartsEntityNameSchema, value: req.params, errorMessagePrefix: 'Invalid request params' });
      this.validator.schemaParser({ schema: findPolygonPartsQueryParamsSchema, value: req.query, errorMessagePrefix: 'Invalid query params' });
      const requestBody = this.validator.schemaParser({
        schema: findPolygonPartsRequestBodySchema,
        value: req.body,
        errorMessagePrefix: 'Invalid request body',
      });
      if (requestBody.filter) {
        await this.validator.validateGeometries(requestBody.filter);
      }
      next();
    } catch (error) {
      this.logger.error({ msg: 'find polygon parts validation failed', err: error });
      if (error instanceof ValidationError) {
        return next(new BadRequestError(error.message));
      }
      next(error);
    }
  };

  public readonly validateAggregateLayerMetadata: AggregationLayerMetadataValidationHandler = async (req, _, next) => {
    try {
      this.validator.schemaParser({ schema: polygonPartsEntityNameSchema, value: req.params, errorMessagePrefix: 'Invalid request params' });
      const requestBody = this.validator.schemaParser({
        schema: aggregationPolygonPartsRequestBodySchema,
        value: req.body,
        errorMessagePrefix: 'Invalid request body',
      });
      if (requestBody.filter) {
        await this.validator.validateGeometries(requestBody.filter);
      }
      req.body = requestBody;
      next();
    } catch (error) {
      this.logger.error({ msg: 'aggregate layer metadata validation failed', err: error });
      if (error instanceof ValidationError) {
        return next(new BadRequestError(error.message));
      }
      next(error);
    }
  };

  public readonly validateIntersection: IntersectionValidationHandler = async (req, _, next) => {
    try {
      this.validator.schemaParser({ schema: polygonPartsEntityNameSchema, value: req.params, errorMessagePrefix: 'Invalid request params' });
      const requestBody = this.validator.schemaParser({
        schema: intersectionRequestBodySchema,
        value: req.body,
        errorMessagePrefix: 'Invalid request body',
      });
      await this.validator.validateGeometries(requestBody);
      next();
    } catch (error) {
      this.logger.error({ msg: 'intersection validation failed', err: error });
      if (error instanceof ValidationError) {
        return next(new BadRequestError(error.message));
      }
      next(error);
    }
  };
}
