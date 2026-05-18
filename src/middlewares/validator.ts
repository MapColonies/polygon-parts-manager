import { BadRequestError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { geometryCollection } from '@turf/helpers';
import type { FeatureCollection, Geometry, GeometryCollection } from 'geojson';
import { inject, singleton } from 'tsyringe';
import { z, type ZodType, type ZodTypeDef } from 'zod';
import type { ConnectionManager } from '../common/connectionManager';
import { SERVICES } from '../common/constants';
import { ValidationError } from '../common/errors';
import type { IdenticalKeyValuePairs } from '../common/types';

type IsValidDetailsResult = { valid: true; reason: null; location: null } | { valid: false; reason: string; location: Geometry | null };

const isValidDetailsResult: IdenticalKeyValuePairs<IsValidDetailsResult> = {
  valid: 'valid',
  reason: 'reason',
  location: 'location',
};

@singleton()
export class Validator {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONNECTION_MANAGER) private readonly connectionManager: ConnectionManager
  ) {}

  public readonly schemaParser = <Ouput, Def extends ZodTypeDef = ZodTypeDef, Input = Ouput>(options: {
    schema: ZodType<Ouput, Def, Input>;
    value: unknown;
    errorMessagePrefix?: string;
  }): Ouput => {
    const { schema, value, errorMessagePrefix } = options;
    try {
      return schema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError({ issues: error.issues, errorMessagePrefix });
      }
      throw error;
    }
  };

  public readonly validateGeometries = async (featureCollection: FeatureCollection<Exclude<Geometry, GeometryCollection>>): Promise<void> => {
    try {
      const geometries = featureCollection.features.map((feature) => feature.geometry);
      const geometriesCollection = geometryCollection(geometries).geometry;
      const areValidGeometries = (
        await this.connectionManager
          .getDataSource()
          .query<IsValidDetailsResult[]>(
            `select ${isValidDetailsResult.valid}, ${isValidDetailsResult.reason}, st_asgeojson(location) as ${isValidDetailsResult.location} from st_isvaliddetail(st_setsrid(st_geomfromgeojson($1), 4326))`,
            [JSON.stringify(geometriesCollection)]
          )
      )[0];

      if (!areValidGeometries.valid) {
        throw new BadRequestError(
          `Invalid geometry filter: ${areValidGeometries.reason}. ${
            areValidGeometries.location ? `Location: ${JSON.stringify(areValidGeometries.location)}` : ''
          }`
        );
      }
    } catch (error) {
      this.logger.error({ msg: 'geometries validity query failed', error });
      throw error;
    }
  };
}
