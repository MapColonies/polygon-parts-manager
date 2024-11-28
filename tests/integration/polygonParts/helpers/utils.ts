import { validate, version } from 'uuid';
import { payloadToInsertPartsData } from '../../../../src/polygonParts/DAL/utils';
import { InsertPartData, PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NullableRecordValues<T extends Record<PropertyKey, any>> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? T[K] : Exclude<T[K] | null, undefined>;
};

export function toExpectedPostgresResponse(
  polygonPartsPayload: PolygonPartsPayload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): NullableRecordValues<Omit<InsertPartData, 'horizontalAccuracyCE90'> & { horizontalAccuracyCE90: any }>[] {
  const expectedPostgresResponse = payloadToInsertPartsData(polygonPartsPayload).map((record) => {
    const { cities = null, countries = null, description = null, sourceId = null, ...props } = record;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-magic-numbers
    return { cities, countries, description, sourceId, ...props, horizontalAccuracyCE90: expect.closeTo(record.horizontalAccuracyCE90, 2) };
  });

  return expectedPostgresResponse;
}

// TODO: extend jest instead => update matchers in tests
export function isValidUUIDv4(uuidV4: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  return validate(uuidV4) && version(uuidV4) === 4;
}
