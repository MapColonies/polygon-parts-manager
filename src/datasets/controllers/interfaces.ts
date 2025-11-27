import { EntityIdentifier } from '../../polygonParts/models/interfaces';

/**
 * Upsert dataset params
 */
export interface UpsertDatasetParams {
  readonly id: EntityIdentifier; // TODO: underlying EntityIdentifier will be moved and perhaps modified
}

/**
 * Upsert datasetResponseBody
 */
export interface UpsertDatasetResponseBody {}
