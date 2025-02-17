import { BadRequestError } from '@map-colonies/error-types';
import { inject, singleton } from 'tsyringe';
import { ZodError } from 'zod';
import type {
  EntitiesMetadata,
  EntityIdentifier,
  EntityIdentifierObject,
  EntityNames,
  PolygonPartsPayload,
} from '../../polygonParts/models/interfaces';
import { getEntitiesMetadataSchemaFactory } from '../../polygonParts/schemas';
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

    const entitiesMetadataSchema = getEntitiesMetadataSchemaFactory({
      getEntitiesMetadata: this.getEntitiesMetadata,
      ...{ schema: this.schema },
      ...{ entities: this.applicationConfig.entities },
    });
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
