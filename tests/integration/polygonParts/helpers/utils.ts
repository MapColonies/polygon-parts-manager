import config from 'config';
import { validate, version } from 'uuid';
import type { ApplicationConfig } from '../../../../src/common/interfaces';
import type { NullableRecordValues } from '../../../../src/common/types';
import { payloadToInsertPartsData } from '../../../../src/polygonParts/DAL/utils';
import type { InsertPartData, PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';

const applicationConfig = config.get<ApplicationConfig>('application');

export function toExpectedPostgresResponse(polygonPartsPayload: PolygonPartsPayload): NullableRecordValues<InsertPartData>[] {
  const expectedPostgresResponse = payloadToInsertPartsData(polygonPartsPayload, applicationConfig.arraySeparator).map((record) => {
    const { cities = null, countries = null, description = null, sourceId = null, ...props } = record;
    return { cities, countries, description, sourceId, ...props };
  });

  return expectedPostgresResponse;
}

// TODO: extend jest instead => update matchers in tests
export function isValidUUIDv4(uuidV4: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  return validate(uuidV4) && version(uuidV4) === 4;
}
