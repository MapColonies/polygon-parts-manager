import { polygonPartsEntityNameSchema } from '@map-colonies/raster-shared';
import { ZodError, ZodType, ZodTypeDef, z } from 'zod';
import { ValidationError } from './errors';

export const schemaParser = <Ouput, Def extends ZodTypeDef = ZodTypeDef, Input = Ouput>(options: {
  schema: ZodType<Ouput, Def, Input>;
  value: unknown;
  errorMessagePrefix?: string;
}): Ouput => {
  const { schema, value, errorMessagePrefix } = options;
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError({ issues: error.issues, errorMessagePrefix });
    }
    throw error;
  }
};

export const entityNameSchema = z.object({ id: polygonPartsEntityNameSchema.shape.polygonPartsEntityName }); // TODO: refactor polygonPartsEntityNameSchema in raster-shared