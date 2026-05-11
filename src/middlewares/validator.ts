import { geometryCollection } from '@turf/helpers';
import type { FeatureCollection, Geometry, GeometryCollection } from 'geojson';
import { inject, singleton } from 'tsyringe';
import { z, type RefinementCtx, type ZodType, type ZodTypeDef } from 'zod';
import type { ConnectionManager } from '../common/connectionManager';
import { SERVICES } from '../common/constants';
import type { IConfig } from '../common/interfaces';
import type { IdenticalKeyValuePairs } from '../common/types';
import { ValidationError } from '../common/errors';

type IsValidDetailsResult = { valid: true; reason: null; location: null } | { valid: false; reason: string; location: Geometry | null };

const isValidDetailsResult: IdenticalKeyValuePairs<IsValidDetailsResult> = {
  valid: 'valid',
  reason: 'reason',
  location: 'location',
};

@singleton()
export class Validator {
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.CONNECTION_MANAGER) private readonly connectionManager: ConnectionManager
  ) {}

  public readonly asyncSchemaParser = async <Ouput, Def extends ZodTypeDef = ZodTypeDef, Input = Ouput>(options: {
    schema: ZodType<Ouput, Def, Input>;
    value: unknown;
    errorMessagePrefix?: string;
  }): Promise<Ouput> => {
    const { schema, value, errorMessagePrefix } = options;
    try {
      const response = await schema.parseAsync(value);
      return response;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError({ issues: error.issues, errorMessagePrefix });
      }
      throw error;
    }
  };

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

  public readonly validateGeometriesSuperRefine = async (
    featureCollection: FeatureCollection<Exclude<Geometry, GeometryCollection>>,
    ctx: RefinementCtx
  ): Promise<void> => {
    try {
      const isValidFilterGeometry = await this.validateGeometries({ geometries: featureCollection.features.map((feature) => feature.geometry) });
      if (!isValidFilterGeometry.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid geometry filter: ${isValidFilterGeometry.reason}. ${
            isValidFilterGeometry.location ? `Location: ${JSON.stringify(isValidFilterGeometry.location)}` : ''
          }`,
          fatal: true,
        });

        return z.NEVER;
      }
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid geometry filter:`,
        fatal: true,
      });
    }
  };

  private readonly validateGeometries = async ({
    geometries,
  }: {
    geometries: Exclude<Geometry, GeometryCollection>[];
  }): Promise<IsValidDetailsResult> => {
    const geometriesCollection = geometryCollection(geometries).geometry;
    const areValidGeometries = (
      await this.connectionManager
        .getDataSource()
        .query<IsValidDetailsResult[]>(
          `select ${isValidDetailsResult.valid}, ${isValidDetailsResult.reason}, st_asgeojson(location) as ${isValidDetailsResult.location} from st_isvaliddetail(st_setsrid(st_geomfromgeojson($1), 4326))`,
          [JSON.stringify(geometriesCollection)]
        )
    )[0];
    return areValidGeometries;
  };
}
