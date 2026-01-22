import type { ValidatePolygonPartsRequestBody } from '../../../../src/polygonParts/controllers/interfaces';
import type { EntitiesMetadata, EntityIdentifierObject, PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';
import { ValidatePart } from '../../../../src/polygonParts/DAL/validationPart';
import { payloadToInsertValidationsData } from '../../../../src/polygonParts/DAL/utils';
import type { HelperDB } from './db';

export async function insertValidationDataDirectly(
    validateRequest: ValidatePolygonPartsRequestBody,
    helperDB: HelperDB,
    schema: string,
    getEntitiesMetadata: (entityIdentifierOptions: EntityIdentifierObject | Pick<PolygonPartsPayload, 'productId' | 'productType'>) => EntitiesMetadata,
    arraySeparator: string
): Promise<string> {
    const entitiesMetadata = getEntitiesMetadata({
        productId: validateRequest.productId,
        productType: validateRequest.productType,
    });
    const validationsTableName = entitiesMetadata.entitiesNames.validations.entityName;

    await helperDB.query(`CALL ${schema}.create_polygon_parts_validations_tables('${schema}.${validationsTableName}')`);

    const validationData = payloadToInsertValidationsData(validateRequest, arraySeparator);

    await helperDB.insert(`${schema}.${validationsTableName}`, ValidatePart, validationData);

    return validationsTableName;
}
