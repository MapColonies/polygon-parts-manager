import type { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { Transformer } from '../../common/middlewares/transformer';
import type { IsSwapQueryParams, PolygonPartsPayload } from '../models/interfaces';
import type { FindPolygonPartsParams, FindPolygonPartsQueryParams, FindPolygonPartsRequestBody } from './interfaces';

/**
 * Create polygon parts transformer handler
 */
type CreatePolygonPartsTransformerHandler = RequestHandler<undefined, undefined, PolygonPartsPayload, undefined>;

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
      this.logger.error({msg: error}, 'create polygon parts transformer failed');
      next(error);
    }
  };

  public readonly parseFindPolygonParts: FindPolygonPartsTransformerHandler = (req, res, next) => {
    try {
      const entitiesMetadata = this.transformer.parseEntitiesMetadata(req.params);
      res.locals = entitiesMetadata;
      if (typeof req.body === 'object' && Object.keys(req.body).length === 0) {
        req.body = undefined;
      }
      next();
    } catch (error) {
      this.logger.error({msg: error}, 'find polygon parts transformer failed');
      next(error);
    }
  };

  public readonly parseUpdatePolygonParts: UpdatePolygonPartsTransformerHandler = (req, res, next) => {
    try {
      const entitiesMetadata = this.transformer.parseEntitiesMetadata(req.body);
      res.locals = entitiesMetadata;
      next();
    } catch (error) {
      this.logger.error({msg: error}, 'update polygon parts transformer failed');
      next(error);
    }
  };
}
