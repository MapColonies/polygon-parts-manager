import type { Logger } from '@map-colonies/js-logger';
import { AbstractLogger, type LoggerOptions, type LogLevel, type LogMessage } from 'typeorm';

export class DataSourceLogger extends AbstractLogger {
  public constructor(private readonly logger: Logger, private readonly loggerOptions: LoggerOptions) {
    super(loggerOptions);
  }

  protected writeLog(level: LogLevel, message: string | number | LogMessage | (string | number | LogMessage)[]): void {
    const messages = this.prepareLogMessages(message, { highlightSql: false });

    for (const message of messages) {
      const { message: msg, ...ormMsgDetails } = message;
      switch (message.type ?? level) {
        case 'log':
        case 'schema':
        case 'schema-build':
        case 'migration':
          this.logger.debug({ ormMsgDetails, msg });
          break;
        case 'info':
        case 'query':
          this.logger.info({ ormMsgDetails, msg });
          break;
        case 'warn':
        case 'query-slow':
          this.logger.warn({ ormMsgDetails, msg });
          break;
        case 'error':
        case 'query-error':
          this.logger.error({ ormMsgDetails, msg });
          break;
      }
    }
  }
}
