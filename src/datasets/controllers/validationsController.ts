import { BadRequestError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import type { RequestHandler } from 'express';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { ValidationError } from '../../common/errors';
import { entityNameSchema, schemaParser } from '../../common/schemas';

/**
 * Upsert datasets validation handler
 */
type UpsertDatasetsValidationHandler = RequestHandler<unknown, undefined, undefined, undefined>;

@singleton()
export class ValidationsController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public readonly validateUpsertDatasets: UpsertDatasetsValidationHandler = (req, _, next) => {
    try {
      schemaParser({ schema: entityNameSchema, value: req.params, errorMessagePrefix: 'Invalid request params' });
      next();
    } catch (error) {
      this.logger.error({ msg: 'upsert datasets validation failed', error });
      if (error instanceof ValidationError) {
        throw new BadRequestError(error.message);
      }
      next(error);
    }
  };
}
