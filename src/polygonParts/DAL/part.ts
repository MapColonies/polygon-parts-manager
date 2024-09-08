import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { PartRecord } from '../models/interfaces';
import { Common } from './common';

@Entity({ name: 'parts', schema: 'polygon_parts', database: 'postgres' })
@Unique('parts_insertion_order_uq', ['insertionOrder'])
export class Part extends Common implements PartRecord {
  @PrimaryGeneratedColumn('uuid', {
    name: 'id',
    primaryKeyConstraintName: 'part_pkey',
  })
  public readonly id!: string;

  @Column({ name: 'insertion_order', type: 'bigint', insert: false, generated: 'increment' })
  public readonly insertionOrder!: number;

  @Column({ name: 'is_processed_part', type: 'boolean', default: false, insert: false })
  @Index()
  public readonly isProcessedPart!: boolean;
}
