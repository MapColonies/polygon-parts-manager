import { EntitiesMetadata } from '../../polygonParts/models/interfaces';

/**
 * Upsert dataset options
 */
export interface UpsertDatasetOptions {
  readonly entitiesMetadata: EntitiesMetadata; // TODO: move EntitiesMetadata to a central interface folder
}

export type UpsertDatasetResponse = { entityAction: 'created'; relativeEntityURI: string } | { entityAction: 'modified' };
