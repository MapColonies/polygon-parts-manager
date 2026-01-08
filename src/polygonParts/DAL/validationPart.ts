import { Check, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';
import { MultiPolygon, Polygon } from 'geojson';
import type { ValidatePartRecord } from '../models/interfaces';
import { BasePart } from './basePart';

@Entity({ name: 'validation_parts' })
@Unique(['insertionOrder'])
@Check('imaging times', `"imaging_time_begin_utc" <= "imaging_time_end_utc"`)
export class ValidatePart extends BasePart implements ValidatePartRecord {  
  @PrimaryColumn({ type: 'text' })
  public readonly id!: string;

  @Column({ type: 'bigint', insert: false, generated: 'identity', generatedIdentity: 'ALWAYS' })
  public readonly insertionOrder!: number;

  // Use a generic 'Geometry' spatialFeatureType so the column can hold Polygon or MultiPolygon
  @Column({ type: 'geometry', spatialFeatureType: 'Geometry', srid: 4326, precision: 20 })
  @Index({ spatial: true })
  // Enforce geometry type to be POLYGON or MULTIPOLYGON
  @Check('footprint', `GeometryType("footprint") IN ('POLYGON','MULTIPOLYGON')`)
  @Check('geometry extent', `Box2D("footprint") @Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)'))`)
  public footprint!: Polygon | MultiPolygon;

  @Column({ type: 'boolean', default: false, insert: false })
  @Index()
  public readonly validated!: boolean;
}
