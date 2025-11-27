import type { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { Transformer } from '../../common/middlewares/transformer';
import { UpsertDatasetParams } from './interfaces';

/**
 * Upsert datasets transformer handler
 */
type UpsertDatasetsTransformerHandler = RequestHandler<UpsertDatasetParams, undefined, undefined, undefined>;

@singleton()
export class TransformerController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(Transformer) private readonly transformer: Transformer) {}

  public readonly parseUpsertDatasets: UpsertDatasetsTransformerHandler = (req, res, next) => {
    try {
      const entitiesMetadata = this.transformer.parseEntitiesMetadata(req.params);
      res.locals = entitiesMetadata;
      next();
    } catch (error) {
      this.logger.error({ msg: 'upsert datasets transformer failed', error });
      next(error);
    }
  };
}
