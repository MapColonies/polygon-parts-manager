import { Check, Column, Entity, Index, Unique } from 'typeorm';
import type { PartRecord } from '../models/interfaces';
import { Common } from './common';

@Entity({ name: 'parts' })
@Unique(['insertionOrder'])
@Check('imaging times', `"imaging_time_begin_utc" <= "imaging_time_end_utc"`)
export class Part extends Common implements PartRecord {
  @Column({ type: 'bigint', insert: false, generated: 'identity', generatedIdentity: 'ALWAYS' })
  public readonly insertionOrder!: number;

  @Column({ type: 'boolean', default: false, insert: false })
  @Index()
  public readonly isProcessedPart!: boolean;
}
