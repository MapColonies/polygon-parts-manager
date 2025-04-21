import { InternalServerError } from '@map-colonies/error-types';
import httpStatusCodes from 'http-status-codes';
import { ZodError, ZodIssue } from 'zod';
import { fromZodError } from 'zod-validation-error';

export class DBConnectionError extends InternalServerError {
  public constructor(message?: string) {
    super(message ?? httpStatusCodes.getStatusText(httpStatusCodes.INTERNAL_SERVER_ERROR));
  }
}

export class ValidationError extends ZodError {
  private readonly errorMessagePrefix: string | undefined;

  public constructor(options: { issues: ZodIssue[]; readonly errorMessagePrefix?: string }) {
    super(options.issues);
    this.errorMessagePrefix = options.errorMessagePrefix;
  }

  public get message(): string {
    return `${this.errorMessagePrefix !== undefined ? `${this.errorMessagePrefix}: ` : ''}${
      fromZodError(this, { includePath: false, prefix: null }).message
    }`;
  }
}
