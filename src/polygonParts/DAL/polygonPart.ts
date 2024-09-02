import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { PolygonPartRecord } from '../models/interfaces';
import { Common } from './common';

@Entity({ name: 'polygon_parts', schema: 'polygon_parts', database: 'postgres' })
export class PolygonPart extends Common implements PolygonPartRecord {
  @PrimaryGeneratedColumn('uuid', {
    name: 'id',
    primaryKeyConstraintName: 'polygon_part_pkey',
  })
  public id!: string;

  @Column({ name: 'part_id', type: 'uuid' })
  @Index('polygon_parts_part_id_idx')
  public partId!: string;
}
