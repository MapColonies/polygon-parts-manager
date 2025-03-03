import { inject, singleton } from 'tsyringe';
import { Transformer } from '../../common/middlewares/transformer';
import type { GetAggregationLayerMetadataHandler } from './aggregationController';

@singleton()
export class TransformerController {
  public constructor(@inject(Transformer) private readonly transformer: Transformer) {}

  public readonly parseGetAggregationLayerMetadata: GetAggregationLayerMetadataHandler = (req, res, next) => {
    try {
      const entitiesMetadata = this.transformer.parseEntitiesMetadata(req.params);
      res.locals = entitiesMetadata;
      next();
    } catch (error) {
      next(error);
    }
  };
}
