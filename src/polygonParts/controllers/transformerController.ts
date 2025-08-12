import type { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { Transformer } from '../../common/middlewares/transformer';
import type { IsSwapQueryParams, PolygonPartsPayload } from '../models/interfaces';
import type { ExistsRequestBody, FindPolygonPartsParams, FindPolygonPartsQueryParams, FindPolygonPartsRequestBody } from './interfaces';
import type { AggregationLayerMetadataHandler } from './polygonPartsController';

/**
 * Create polygon parts transformer handler
 */
type CreatePolygonPartsTransformerHandler = RequestHandler<undefined, undefined, PolygonPartsPayload, undefined>;

/**
 * Exists polygon parts transformer handler
 */
type ExistsPolygonPartsTransformerHandler = RequestHandler<undefined, undefined, ExistsRequestBody, undefined>;

/**
 * Find polygon parts transformer handler
 */
type FindPolygonPartsTransformerHandler = RequestHandler<
  FindPolygonPartsParams,
  undefined,
  FindPolygonPartsRequestBody | Record<PropertyKey, never>,
  FindPolygonPartsQueryParams
>;

/**
 * Update polygon parts transformer handler
 */
type UpdatePolygonPartsTransformerHandler = RequestHandler<undefined, undefined, PolygonPartsPayload, IsSwapQueryParams>;

@singleton()
export class TransformerController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(Transformer) private readonly transformer: Transformer) {}

  public readonly parseCreatePolygonParts: CreatePolygonPartsTransformerHandler = (req, res, next) => {
    try {
      const entitiesMetadata = this.transformer.parseEntitiesMetadata(req.body);
      res.locals = entitiesMetadata;
      next();
    } catch (error) {
      this.logger.error({ msg: 'create polygon parts transformer failed', error });
      next(error);
    }
  };

  public readonly parseExistsPolygonParts: ExistsPolygonPartsTransformerHandler = (req, res, next) => {
    try {
      const entitiesMetadata = this.transformer.parseEntitiesMetadata(req.body);
      res.locals = entitiesMetadata;
      next();
    } catch (error) {
      this.logger.error({ msg: 'exists polygon parts transformer failed', error });
      next(error);
    }
  };

  public readonly parseFindPolygonParts: FindPolygonPartsTransformerHandler = (req, res, next) => {
    try {
      const entitiesMetadata = this.transformer.parseEntitiesMetadata(req.params);
      res.locals = entitiesMetadata;
      next();
    } catch (error) {
      this.logger.error({ msg: 'find polygon parts transformer failed', error });
      next(error);
    }
  };

  public readonly parseUpdatePolygonParts: UpdatePolygonPartsTransformerHandler = (req, res, next) => {
    try {
      const entitiesMetadata = this.transformer.parseEntitiesMetadata(req.body);
      res.locals = entitiesMetadata;
      next();
    } catch (error) {
      this.logger.error({ msg: 'update polygon parts transformer failed', error });
      next(error);
    }
  };

  public readonly parseAggregateLayerMetadata: AggregationLayerMetadataHandler = (req, res, next) => {
    try {
      const entitiesMetadata = this.transformer.parseEntitiesMetadata(req.params);
      res.locals = entitiesMetadata;
      next();
    } catch (error) {
      next(error);
    }
  };
}
