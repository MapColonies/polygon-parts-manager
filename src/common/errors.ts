import { InternalServerError } from '@map-colonies/error-types';
import httpStatusCodes from 'http-status-codes';

export class DBConnectionError extends InternalServerError {
  public constructor(message?: string) {
    super(message ?? httpStatusCodes.getStatusText(httpStatusCodes.INTERNAL_SERVER_ERROR));
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}
