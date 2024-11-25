import { VALIDATIONS, type AggregationLayerMetadata } from '@map-colonies/mc-model-types';
import type { MultiPolygon, Polygon } from 'geojson';
import { z, type ZodType } from 'zod';

export const aggregationMetadataSchema: ZodType<AggregationLayerMetadata> = z.object(
  {
    footprint: z.custom<Polygon | MultiPolygon>(),
    imagingTimeBeginUTC: z.coerce.date({ message: 'Aggregation of imaging time begin UTC should be a datetime' }),
    imagingTimeEndUTC: z.coerce.date({ message: 'Aggregation of imaging time end UTC should be a datetime' }),
    maxHorizontalAccuracyCE90: z
      .number({ message: 'Aggregation of max horizontal accuracy CE90 should be a number' })
      .min(VALIDATIONS.horizontalAccuracyCE90.min, {
        message: `Aggregation of max horizontal accuracy CE90 should not be less than ${VALIDATIONS.horizontalAccuracyCE90.min}`,
      })
      .max(VALIDATIONS.horizontalAccuracyCE90.max, {
        message: `Aggregation of max horizontal accuracy CE90 should not be larger than ${VALIDATIONS.horizontalAccuracyCE90.max}`,
      }),
    maxResolutionDeg: z
      .number({ message: 'Aggregation of max resolution degree should be a number' })
      .min(VALIDATIONS.resolutionDeg.min as number, {
        message: `Aggregation of max resolution degree should not be less than ${VALIDATIONS.resolutionDeg.min as number}`,
      })
      .max(VALIDATIONS.resolutionDeg.max as number, {
        message: `Aggregation of max resolution degree should not be larger than ${VALIDATIONS.resolutionDeg.max as number}`,
      }),
    maxResolutionMeter: z
      .number({ message: 'Aggregation of max resolution meter should be a number' })
      .min(VALIDATIONS.resolutionMeter.min as number, {
        message: `Aggregation of max resolution meter should not be less than ${VALIDATIONS.resolutionMeter.min as number}`,
      })
      .max(VALIDATIONS.resolutionMeter.max as number, {
        message: `Aggregation of max resolution meter should not be larger than ${VALIDATIONS.resolutionMeter.max as number}`,
      }),
    minHorizontalAccuracyCE90: z
      .number({ message: 'Aggregation of min horizontal accuracy CE90 should be a number' })
      .min(VALIDATIONS.horizontalAccuracyCE90.min, {
        message: `Aggregation of min horizontal accuracy CE90 should not be less than ${VALIDATIONS.horizontalAccuracyCE90.min}`,
      })
      .max(VALIDATIONS.horizontalAccuracyCE90.max, {
        message: `Aggregation of min horizontal accuracy CE90 should not be larger than ${VALIDATIONS.horizontalAccuracyCE90.max}`,
      }),
    minResolutionDeg: z
      .number({ message: 'Aggregation of min resolution degree should be a number' })
      .min(VALIDATIONS.resolutionDeg.min as number, {
        message: `Aggregation of min resolution degree should not be less than ${VALIDATIONS.resolutionDeg.min as number}`,
      })
      .max(VALIDATIONS.resolutionDeg.max as number, {
        message: `Aggregation of min resolution degree should not be larger than ${VALIDATIONS.resolutionDeg.max as number}`,
      }),
    minResolutionMeter: z
      .number({ message: 'Aggregation of min resolution meter should be a number' })
      .min(VALIDATIONS.resolutionMeter.min as number, {
        message: `Aggregation of min resolution meter should not be less than ${VALIDATIONS.resolutionMeter.min as number}`,
      })
      .max(VALIDATIONS.resolutionMeter.max as number, {
        message: `Aggregation of min resolution meter should not be larger than ${VALIDATIONS.resolutionMeter.max as number}`,
      }),
    productBoundingBox: z
      .string({ message: 'Aggregation of product bounding box should be a string' })
      .regex(new RegExp('^-?(0|[1-9]\\d*)(\\.\\d*)?,-?(0|[1-9]\\d*)(\\.\\d*)?,-?(0|[1-9]\\d*)(\\.\\d*)?,-?(0|[1-9]\\d*)(\\.\\d*)?$'), {
        message: 'Aggregation of product bounding box must be of the shape min_x,min_y,max_x,max_y',
      }),
    sensors: z
      .array(
        z
          .string({ message: 'Aggregation of sensors should be an array of strings' })
          .regex(new RegExp('^(?! ).+(?<! )$'), { message: 'Aggregation of sensors should be an array with items matching a pattern' }),
        { message: 'Aggregation of sensors should be an array' }
      )
      .min(1, { message: 'Aggregation of sensors should have an array length of at least 1' }),
  },
  { message: 'Could not calculate aggregation' }
);
