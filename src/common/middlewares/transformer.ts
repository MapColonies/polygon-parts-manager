import { BadRequestError } from '@map-colonies/error-types';
import { polygonPartsEntityPatternSchema } from '@map-colonies/raster-shared';
import { inject, singleton } from 'tsyringe';
import { ZodError, z } from 'zod';
import type { EntitiesMetadata, EntityIdentifier, EntityIdentifierObject, EntityNames, PolygonPartsPayload } from '../../polygonParts/models/interfaces';
import { SERVICES } from '../constants';
import type { ApplicationConfig, DbConfig, IConfig } from '../interfaces';

@singleton()
export class Transformer {
  public readonly entitiesMetadataParser: (entitiesMetadata: unknown) => EntitiesMetadata;
  private readonly applicationConfig: ApplicationConfig;
  private readonly schema: DbConfig['schema'];

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig) {
    this.applicationConfig = this.config.get<ApplicationConfig>('application');
    this.schema = this.config.get<DbConfig['schema']>('db.schema');

    const partsDBEntityNameSchema = z.object({
      entityName: z
        .string()
        .transform((val) =>
          val.replaceAll(
            new RegExp(`(^${this.applicationConfig.entities.parts.namePrefix})|(${this.applicationConfig.entities.parts.nameSuffix}$)`, 'g'),
            ''
          )
        )
        .pipe(polygonPartsEntityPatternSchema)
        .transform((val) => this.getEntitiesMetadata({ polygonPartsEntityName: val }).entitiesNames.parts.entityName),
      databaseObjectQualifiedName: z
        .string()
        .transform((val) =>
          val.replaceAll(
            new RegExp(
              `(^${this.schema}.${this.applicationConfig.entities.parts.namePrefix})|(${this.applicationConfig.entities.parts.nameSuffix}$)`,
              'g'
            ),
            ''
          )
        )
        .pipe(polygonPartsEntityPatternSchema)
        .transform((val) => this.getEntitiesMetadata({ polygonPartsEntityName: val }).entitiesNames.parts.databaseObjectQualifiedName),
    });

    const polygonPartsDBEntityNameSchema = z.object({
      entityName: z
        .string()
        .transform((val) =>
          val.replaceAll(
            new RegExp(
              `(^${this.applicationConfig.entities.polygonParts.namePrefix})|(${this.applicationConfig.entities.polygonParts.nameSuffix}$)`,
              'g'
            ),
            ''
          )
        )
        .pipe(polygonPartsEntityPatternSchema)
        .transform((val) => this.getEntitiesMetadata({ polygonPartsEntityName: val }).entitiesNames.polygonParts.entityName),
      databaseObjectQualifiedName: z
        .string()
        .transform((val) =>
          val.replaceAll(
            new RegExp(
              `(^${this.schema}.${this.applicationConfig.entities.polygonParts.namePrefix})|(${this.applicationConfig.entities.polygonParts.nameSuffix}$)`,
              'g'
            ),
            ''
          )
        )
        .pipe(polygonPartsEntityPatternSchema)
        .transform((val) => this.getEntitiesMetadata({ polygonPartsEntityName: val }).entitiesNames.polygonParts.databaseObjectQualifiedName),
    });

    const entitiesMetadataSchema = z
      .object({
        entityIdentifier: polygonPartsEntityPatternSchema,
        entitiesNames: z
          .object({
            parts: partsDBEntityNameSchema,
            polygonParts: polygonPartsDBEntityNameSchema,
          })
          .strict(),
      })
      .strict();

    this.entitiesMetadataParser = (entitiesMetadata: unknown): EntitiesMetadata => {
      return entitiesMetadataSchema.parse(entitiesMetadata);
    };
  }

  public readonly getDatabaseObjectQualifiedName = (
    schema: Lowercase<string>,
    value: EntityNames['entityName']
  ): EntityNames['databaseObjectQualifiedName'] => {
    return `${schema}.${value}` satisfies EntityNames['databaseObjectQualifiedName'];
  };

  public readonly getEntitiesMetadata = (
    entityIdentifierOptions: EntityIdentifierObject | Pick<PolygonPartsPayload, 'productId' | 'productType'>
  ): EntitiesMetadata => {
    const entityIdentifier = (
      'polygonPartsEntityName' in entityIdentifierOptions
        ? entityIdentifierOptions.polygonPartsEntityName
        : [entityIdentifierOptions.productId, entityIdentifierOptions.productType].join('_').toLowerCase()
    ) as EntityIdentifier;
    const partsEntityName =
      `${this.applicationConfig.entities.parts.namePrefix}${entityIdentifier}${this.applicationConfig.entities.parts.nameSuffix}` satisfies EntityNames['entityName'];
    const polygonPartsEntityName =
      `${this.applicationConfig.entities.polygonParts.namePrefix}${entityIdentifier}${this.applicationConfig.entities.polygonParts.nameSuffix}` satisfies EntityNames['entityName'];

    return {
      entityIdentifier,
      entitiesNames: {
        parts: {
          entityName: partsEntityName,
          databaseObjectQualifiedName: this.getDatabaseObjectQualifiedName(this.schema, partsEntityName),
        },
        polygonParts: {
          entityName: polygonPartsEntityName,
          databaseObjectQualifiedName: this.getDatabaseObjectQualifiedName(this.schema, polygonPartsEntityName),
        },
      },
    };
  };

  public readonly parseEntitiesMetadata = (input: EntityIdentifierObject | PolygonPartsPayload): EntitiesMetadata => {
    try {
      const entitiesMetadata = this.getEntitiesMetadata(input);
      return this.entitiesMetadataParser(entitiesMetadata);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestError(`Invalid request parameter resource identifier: ${error.message}`);
      }
      throw error;
    }
  };
}
