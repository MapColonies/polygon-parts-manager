import { InternalServerError } from '@map-colonies/error-types';

export class DBConnectionError extends InternalServerError {
  public constructor() {
    super('Internal Server Error');
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}
