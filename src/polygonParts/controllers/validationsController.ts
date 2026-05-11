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
  aggregationPolygonPartsRequestBodySchemaFactory,
  findPolygonPartsQueryParamsSchema,
  findPolygonPartsRequestBodySchemaFactory,
  intersectionRequestBodySchemaFactory,
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
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(Validator) private readonly validator: Validator) {}

  public readonly validateCreatePolygonParts: CreatePolygonPartsValidationHandler = (req, _, next) => {
    try {
      this.validator.schemaParser({ schema: polygonPartsPayloadSchema, value: req.body, errorMessagePrefix: 'Invalid request body' });
      next();
    } catch (error) {
      this.logger.error({ msg: 'create polygon parts validation failed', error });
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
      this.logger.error({ msg: 'update polygon parts validation failed', error });
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
      this.logger.error({ msg: 'exists polygon parts validation failed', error });
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
      await this.validator.asyncSchemaParser({
        schema: findPolygonPartsRequestBodySchemaFactory(this.validator),
        value: req.body,
        errorMessagePrefix: 'Invalid request body',
      });
      next();
    } catch (error) {
      this.logger.error({ msg: 'find polygon parts validation failed', error });
      if (error instanceof ValidationError) {
        return next(new BadRequestError(error.message));
      }
      next(error);
    }
  };

  public readonly validateAggregateLayerMetadata: AggregationLayerMetadataValidationHandler = async (req, _, next) => {
    try {
      this.validator.schemaParser({ schema: polygonPartsEntityNameSchema, value: req.params, errorMessagePrefix: 'Invalid request params' });
      const validReqBody = await this.validator.asyncSchemaParser({
        schema: aggregationPolygonPartsRequestBodySchemaFactory(this.validator),
        value: req.body,
        errorMessagePrefix: 'Invalid request body',
      });
      req.body = validReqBody;
      next();
    } catch (error) {
      this.logger.error({ msg: 'aggregate layer metadata validation failed', error });
      if (error instanceof ValidationError) {
        return next(new BadRequestError(error.message));
      }
      next(error);
    }
  };

  public readonly validateIntersection: IntersectionValidationHandler = async (req, _, next) => {
    try {
      this.validator.schemaParser({ schema: polygonPartsEntityNameSchema, value: req.params, errorMessagePrefix: 'Invalid request params' });
      await this.validator.asyncSchemaParser({
        schema: intersectionRequestBodySchemaFactory(this.validator),
        value: req.body,
        errorMessagePrefix: 'Invalid request body',
      });
      next();
    } catch (error) {
      this.logger.error({ msg: 'intersection validation failed', error });
      if (error instanceof ValidationError) {
        return next(new BadRequestError(error.message));
      }
      next(error);
    }
  };
}
