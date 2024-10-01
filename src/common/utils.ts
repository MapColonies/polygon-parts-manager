import { snakeCase } from 'change-case-all';

export const camelCaseToSnakeCase = (value: string): string => {
  return snakeCase(value);
};
