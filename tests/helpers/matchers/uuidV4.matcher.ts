import { expect } from '@jest/globals';
import type { ExpectationResult, MatcherContext } from 'expect';
import { validate, version } from 'uuid';

function toBeUuidV4(this: MatcherContext, received: unknown): ExpectationResult {
  const matcherName = 'toBeUuidV4';
  const options = {
    isNot: this.isNot,
    promise: this.promise,
  };
  const { matcherHint, printReceived, printWithType, RECEIVED_COLOR, matcherErrorMessage } = this.utils;

  if (typeof received !== 'string') {
    throw new TypeError(
      matcherErrorMessage(
        matcherHint(`.${matcherName}`, 'string', 'expected'),
        `${RECEIVED_COLOR('received')} value must be a string`,
        printWithType('Received', received, printReceived)
      )
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  const pass = validate(received) && version(received) === 4;

  return {
    pass,
    message: (): string => {
      return `${matcherHint(matcherName, 'received', '', options)}
        expected value to ${pass ? 'not' : ''} be a valid UUID v4 received:
        ${printReceived(received)}`;
    },
  };
}

expect.extend({
  toBeUuidV4,
});
