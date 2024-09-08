import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { PolygonPartRecord } from '../models/interfaces';
import { Common } from './common';

@Entity({ name: 'polygon_parts', schema: 'polygon_parts', database: 'postgres' })
@Unique('polygon_parts_insertion_order_uq', ['insertionOrder'])
export class PolygonPart extends Common implements PolygonPartRecord {
  @PrimaryGeneratedColumn('uuid', {
    name: 'id',
    primaryKeyConstraintName: 'polygon_part_pkey',
  })
  public readonly id!: string;

  @Column({ name: 'part_id', type: 'uuid' })
  @Index()
  public readonly partId!: string;

  @Column({ name: 'insertion_order', type: 'bigint', insert: false, generated: 'increment' })
  public readonly insertionOrder!: number;
}
