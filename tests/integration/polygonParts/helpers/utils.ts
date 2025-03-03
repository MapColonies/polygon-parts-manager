import { validate, version } from 'uuid';
import { payloadToInsertPartsData } from '../../../../src/polygonParts/DAL/utils';
import type { InsertPartData, PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';
import type { NullableRecordValues } from './types';

export function toExpectedPostgresResponse(polygonPartsPayload: PolygonPartsPayload): NullableRecordValues<InsertPartData>[] {
  const expectedPostgresResponse = payloadToInsertPartsData(polygonPartsPayload).map((record) => {
    const { cities = null, countries = null, description = null, sourceId = null, ...props } = record;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-magic-numbers
    return { cities, countries, description, sourceId, ...props };
  });

  return expectedPostgresResponse;
}

// TODO: extend jest instead => update matchers in tests
export function isValidUUIDv4(uuidV4: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  return validate(uuidV4) && version(uuidV4) === 4;
}
