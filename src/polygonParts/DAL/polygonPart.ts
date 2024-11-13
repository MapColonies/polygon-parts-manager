import { Column, Entity, Index } from 'typeorm';
import type { PolygonPartRecord } from '../models/interfaces';
import { Common } from './common';

@Entity({ name: 'polygon_parts' })
export class PolygonPart extends Common implements PolygonPartRecord {
  @Column({ type: 'uuid' })
  @Index()
  public readonly partId!: string;

  @Column({ type: 'bigint' })
  public readonly insertionOrder!: number;
}
