import { Check, Column, CreateDateColumn, Index, type Polygon } from 'typeorm';
import type { CommonRecord } from '../models/interfaces';

export class Common implements CommonRecord {
  @Column({ name: 'product_id', type: 'text', collation: 'C.UTF-8' })
  @Index()
  public productId!: string;

  @Column({ name: 'product_type', type: 'text', collation: 'C.UTF-8' })
  @Index()
  public productType!: string;

  @Column({ name: 'catalog_id', type: 'uuid' })
  @Index()
  public catalogId!: string;

  @Column({ name: 'source_id', type: 'text', collation: 'C.UTF-8', nullable: true })
  public sourceId?: string;

  @Column({ name: 'source_name', type: 'text', collation: 'C.UTF-8' })
  public sourceName?: string;

  @Column({ name: 'product_version', type: 'text', collation: 'C.UTF-8' })
  public productVersion?: string;

  @CreateDateColumn({ name: 'ingestion_date_utc', type: 'timestamp with time zone', insert: false })
  @Index()
  public readonly ingestionDateUTC!: Date;

  @Column({ name: 'imaging_time_begin_utc', type: 'timestamp with time zone' })
  @Index()
  public imagingTimeBeginUTC!: Date;

  @Column({ name: 'imaging_time_end_utc', type: 'timestamp with time zone' })
  @Index()
  public imagingTimeEndUTC!: Date;

  @Column({ name: 'resolution_degree', type: 'numeric' })
  @Index()
  public resolutionDegree!: number;

  @Column({ name: 'resolution_meter', type: 'numeric' })
  @Index()
  public resolutionMeter!: number;

  @Column({ name: 'source_resolution_meter', type: 'numeric' })
  public sourceResolutionMeter!: number;

  @Column({ name: 'horizontal_accuracy_ce_90', type: 'real' })
  public horizontalAccuracyCE90?: number;

  @Column({ name: 'sensors', type: 'text', array: true, collation: 'C.UTF-8' })
  public sensors?: string[];

  @Column({ name: 'countries', type: 'text', array: true, collation: 'C.UTF-8', nullable: true })
  public countries?: string[];

  @Column({ name: 'cities', type: 'text', array: true, collation: 'C.UTF-8', nullable: true })
  public cities?: string[];

  @Column({ name: 'description', type: 'text', collation: 'C.UTF-8', nullable: true })
  public description?: string;

  @Column({ name: 'geometry', type: 'geometry', spatialFeatureType: 'Polygon', srid: 4326 })
  @Index({ spatial: true })
  @Check('valid geometry', `ST_IsValid("geometry")`)
  @Check('geometry extent', `Box2D("geometry") @Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)'))`)
  public geometry!: Polygon;
}
