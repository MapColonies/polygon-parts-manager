import { BadRequestError } from '@map-colonies/error-types';
import { inject, singleton } from 'tsyringe';
import { ZodType, type ZodTypeDef } from 'zod';
import type { ExistsRequestBody } from '../../polygonParts/controllers/interfaces';
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
      getEntitiesMetadata: this.getEntitiesMetadata,
      ...{ schema: this.schema },
      ...{ entities: this.applicationConfig.entities },
    });
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

  public readonly parseEntitiesMetadata = (input: EntityIdentifierObject | PolygonPartsPayload | ExistsRequestBody): EntitiesMetadata => {
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
  };
}
