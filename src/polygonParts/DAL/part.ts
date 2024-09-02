import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { PartRecord } from '../models/interfaces';
import { Common } from './common';

@Entity({ name: 'parts', schema: 'polygon_parts', database: 'postgres' })
export class Part extends Common implements PartRecord {
  @PrimaryGeneratedColumn('uuid', {
    name: 'id',
    primaryKeyConstraintName: 'part_pkey',
  })
  public id!: string;

  @Column({name: 'is_processed_part', type: 'boolean'})
  public isProcessedPart!: boolean
}
