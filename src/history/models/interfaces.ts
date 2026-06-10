import type { EntityManager } from 'typeorm';
import type { EntitiesMetadata } from '../../polygonParts/models/interfaces';

export interface MoveValidationsToHistoryInTransactionOptions extends MoveValidationsToHistoryOptions {
  entityManager: EntityManager;
}

export interface MoveValidationsToHistoryOptions {
  entitiesMetadata: EntitiesMetadata;
}
