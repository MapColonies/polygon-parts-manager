import { BadRequestError } from '@map-colonies/error-types';
import { inject, singleton } from 'tsyringe';
import { ZodType, type ZodTypeDef } from 'zod';
import type { ExistsRequestBody, ValidatePolygonPartsRequestBody } from '../../polygonParts/controllers/interfaces';
import type {
  EntitiesMetadata,
  EntityIdentifier,
  EntityNames,
  EntityIdentifierObject as PolygonPartsEntityIdentifierObject,
  PolygonPartsPayload,
} from '../../polygonParts/models/interfaces';
import { getEntitiesMetadataSchemaFactory } from '../../polygonParts/schemas';
import { SERVICES } from '../constants';
import { ValidationError } from '../errors';
import type { ApplicationConfig, DbConfig, EntityIdentifierObject, IConfig } from '../interfaces';
import { schemaParser } from '../schemas';
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
    entityIdentifierOptions: EntityIdentifierObject | PolygonPartsEntityIdentifierObject | Pick<PolygonPartsPayload, 'productId' | 'productType'>
  ): EntitiesMetadata => {
    const entityIdentifier = (
      'polygonPartsEntityName' in entityIdentifierOptions
        ? entityIdentifierOptions.polygonPartsEntityName
        : 'id' in entityIdentifierOptions
        ? entityIdentifierOptions.id
        : [entityIdentifierOptions.productId, entityIdentifierOptions.productType].join('_').toLowerCase()
    ) as EntityIdentifier;
    const partsEntityName = //TODO: remove
      `${this.applicationConfig.entities.parts.namePrefix}${entityIdentifier}${this.applicationConfig.entities.parts.nameSuffix}` satisfies EntityNames['entityName'];
    const polygonPartsEntityName = //TODO: remove
      `${this.applicationConfig.entities.polygonParts.namePrefix}${entityIdentifier}${this.applicationConfig.entities.polygonParts.nameSuffix}` satisfies EntityNames['entityName'];
    const datasetsEntityName =
      `${this.applicationConfig.entities.datasets.namePrefix}${entityIdentifier}${this.applicationConfig.entities.datasets.nameSuffix}` satisfies EntityNames['entityName'];
    const validationsEntityName =
      `${this.applicationConfig.entities.validations.namePrefix}${entityIdentifier}${this.applicationConfig.entities.validations.nameSuffix}` satisfies EntityNames['entityName'];

    return {
      entityIdentifier,
      entitiesNames: {
        parts: {
          //TODO: remove
          entityName: partsEntityName,
          databaseObjectQualifiedName: this.getDatabaseObjectQualifiedName(this.schema, partsEntityName),
        },
        polygonParts: {
          //TODO: remove
          entityName: polygonPartsEntityName,
          databaseObjectQualifiedName: this.getDatabaseObjectQualifiedName(this.schema, polygonPartsEntityName),
        },
        datasets: {
          entityName: datasetsEntityName,
          databaseObjectQualifiedName: this.getDatabaseObjectQualifiedName(this.schema, datasetsEntityName),
        },
        validations: {
          entityName: validationsEntityName,
          databaseObjectQualifiedName: this.getDatabaseObjectQualifiedName(this.schema, validationsEntityName),
        },
      },
    };
  };

  public readonly parseEntitiesMetadata = (
    input: EntityIdentifierObject | PolygonPartsEntityIdentifierObject | PolygonPartsPayload | ExistsRequestBody | ValidatePolygonPartsRequestBody // TODO: later remove PolygonPartsEntityIdentifierObject
  ): EntitiesMetadata => {
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
