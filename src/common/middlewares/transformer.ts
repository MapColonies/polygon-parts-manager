import { BadRequestError } from '@map-colonies/error-types';
import { inject, singleton } from 'tsyringe';
import { ZodType, type ZodTypeDef } from 'zod';
import type {
  EntitiesMetadata,
  EntityIdentifier,
  EntityIdentifierObject,
  EntityNames,
  PolygonPartsPayload,
} from '../../polygonParts/models/interfaces';
import { getEntitiesMetadataSchemaFactory, schemaParser } from '../../polygonParts/schemas';
import { SERVICES } from '../constants';
import { ValidationError } from '../errors';
import type { ApplicationConfig, DbConfig, IConfig } from '../interfaces';
import type { DeepMapValues } from '../types';

@singleton()
export class Transformer {
  private readonly applicationConfig: ApplicationConfig;
  private readonly schema: DbConfig['schema'];
  private readonly entitiesMetadataSchema: ZodType<EntitiesMetadata, ZodTypeDef, DeepMapValues<EntitiesMetadata, string>>;

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig) {
    this.applicationConfig = this.config.get<ApplicationConfig>('application');
    this.schema = this.config.get<DbConfig['schema']>('db.schema');
    this.entitiesMetadataSchema = getEntitiesMetadataSchemaFactory({
      ...{ schema: this.schema },
      ...{ entities: this.applicationConfig.entities },
    });
  }

  public static getDatabaseObjectQualifiedName(
    schema: Lowercase<string>,
    value: EntityNames['entityName']
  ): EntityNames['databaseObjectQualifiedName'] {
    return `${schema}.${value}` satisfies EntityNames['databaseObjectQualifiedName'];
  }

  public static getEntityIdentifier(
    entityIdentifierOptions: EntityIdentifierObject | Pick<PolygonPartsPayload, 'productId' | 'productType'>
  ): EntityIdentifier {
    return (
      'polygonPartsEntityName' in entityIdentifierOptions
        ? entityIdentifierOptions.polygonPartsEntityName
        : [entityIdentifierOptions.productId, entityIdentifierOptions.productType].join('_').toLowerCase()
    ) as EntityIdentifier;
  }

  public static getEntityName(
    entityIdentifier: EntityIdentifier,
    entityNameOptions: { namePrefix: Lowercase<string>; nameSuffix: Lowercase<string> }
  ): EntityNames['entityName'] {
    return `${entityNameOptions.namePrefix}${entityIdentifier}${entityNameOptions.nameSuffix}` satisfies EntityNames['entityName'];
  }

  public getEntitiesMetadata(
    entityIdentifierOptions: EntityIdentifierObject | Pick<PolygonPartsPayload, 'productId' | 'productType'>
  ): EntitiesMetadata {
    const entityIdentifier = Transformer.getEntityIdentifier(entityIdentifierOptions);
    const partsEntityName = Transformer.getEntityName(entityIdentifier, this.applicationConfig.entities.parts);
    const polygonPartsEntityName = Transformer.getEntityName(entityIdentifier, this.applicationConfig.entities.polygonParts);

    return {
      entityIdentifier,
      entitiesNames: {
        parts: {
          entityName: partsEntityName,
          databaseObjectQualifiedName: Transformer.getDatabaseObjectQualifiedName(this.schema, partsEntityName),
        },
        polygonParts: {
          entityName: polygonPartsEntityName,
          databaseObjectQualifiedName: Transformer.getDatabaseObjectQualifiedName(this.schema, polygonPartsEntityName),
        },
      },
    };
  }

  public parseEntitiesMetadata(input: EntityIdentifierObject | PolygonPartsPayload): EntitiesMetadata {
    try {
      const entitiesMetadata = this.getEntitiesMetadata(input);
      return schemaParser({
        schema: this.entitiesMetadataSchema,
        value: entitiesMetadata,
        errorMessagePrefix: 'Invalid request parameter resource identifier',
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new BadRequestError(error.message);
      }
      throw error;
    }
  }
}
