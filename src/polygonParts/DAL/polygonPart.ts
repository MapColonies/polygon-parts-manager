import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { PolygonPartRecord } from '../models/interfaces';
import { Common } from './common';

@Entity({ name: 'polygon_parts' })
@Unique('polygon_parts_insertion_order_uq', ['insertionOrder'])
export class PolygonPart extends Common implements PolygonPartRecord {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'polygon_parts_pkey',
  })
  public readonly id!: string;

  @Column({ type: 'uuid' })
  @Index()
  public readonly partId!: string;

  @Column({ type: 'bigint' })
  public readonly insertionOrder!: number;
}
