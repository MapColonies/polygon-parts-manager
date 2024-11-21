import { InternalServerError } from '@map-colonies/error-types';
import httpStatusCodes from 'http-status-codes';
import { FindOptions } from './interfaces';

export class DBConnectionError extends InternalServerError {
  public constructor(message?: string) {
    super(message ?? httpStatusCodes.getStatusText(httpStatusCodes.INTERNAL_SERVER_ERROR));
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

export class FindError extends Error {
  public constructor(request: FindOptions, err: Error) {
    super(`Failed to find metadata for request ${JSON.stringify(request)}  client: ${err.message}`);
    this.name = FindError.name;
    this.stack = err.stack;
  }
}
