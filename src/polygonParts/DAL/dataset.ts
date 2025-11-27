import { Column, Entity, Index } from 'typeorm';
import type { PartRecord } from '../models/interfaces';
import { Common } from './common';

@Entity({ name: 'datasets' })
export class Dataset extends Common implements PartRecord {
  @Column({ type: 'bigint', insert: false, generated: 'identity', generatedIdentity: 'ALWAYS' })
  public readonly insertionOrder!: number;

  @Column({ type: 'boolean', default: false, insert: false })
  @Index()
  public readonly isProcessedPart!: boolean;
}
