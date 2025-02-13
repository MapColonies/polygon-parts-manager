import { inject, singleton } from 'tsyringe';
import { Transformer } from '../../common/middlewares/transformer';
import type { CreatePolygonPartsHandler, FindPolygonPartsHandler, UpdatePolygonPartsHandler } from './interfaces';

@singleton()
export class TransformerController {
  public constructor(@inject(Transformer) private readonly transformer: Transformer) {}

  public readonly parseCreatePolygonParts: CreatePolygonPartsHandler = (req, res, next) => {
    try {
      const entitiesMetadata = this.transformer.parseEntitiesMetadata(req.body);
      res.locals = entitiesMetadata;
      next();
    } catch (error) {
      next(error);
    }
  };

  public readonly parseUpdatePolygonParts: UpdatePolygonPartsHandler = (req, res, next) => {
    try {
      const entitiesMetadata = this.transformer.parseEntitiesMetadata(req.body);
      res.locals = entitiesMetadata;
      next();
    } catch (error) {
      next(error);
    }
  };

  public readonly parseFindPolygonParts: FindPolygonPartsHandler = (req, res, next) => {
    try {
      const entitiesMetadata = this.transformer.parseEntitiesMetadata(req.params);
      res.locals = entitiesMetadata;
      next();
    } catch (error) {
      next(error);
    }
  };
}
