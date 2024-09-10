import { NotFoundError, InternalServerError } from '@map-colonies/error-types';

export class EntityNotFound extends NotFoundError {
  public constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, EntityNotFound.prototype);
  }
}

export class DBConnectionError extends InternalServerError {
  public constructor() {
    super('Internal Server Error');
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}
