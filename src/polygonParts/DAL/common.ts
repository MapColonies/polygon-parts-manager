import { ProductType } from '@map-colonies/mc-model-types';
import { Check, Column, CreateDateColumn, Index, type Polygon } from 'typeorm';
import type { CommonRecord } from '../models/interfaces';

export class Common implements CommonRecord {
  @Column({ name: 'product_id', type: 'text', collation: 'C.UTF-8' })
  @Index()
  @Check('product id', `product_id ~* '^[a-zA-Z0-9_-]+$'`)
  public productId!: string;

  @Column({
    name: 'product_type',
    type: 'enum',
    enumName: 'product_type_enum',
    enum: ProductType
  })
  @Index()
  public productType!: ProductType;

  @Column({ name: 'catalog_id', type: 'uuid' })
  @Index()
  public catalogId!: string;

  @Column({ name: 'source_id', type: 'text', collation: 'C.UTF-8', nullable: true })
  public sourceId?: string;

  @Column({ name: 'source_name', type: 'text', collation: 'C.UTF-8' })
  public sourceName!: string;

  @Column({ name: 'product_version', type: 'text', collation: 'C.UTF-8' })
  @Check('product version', `"product_version" ~* '^[1-9]\\\\d*(\\\\.(0|[1-9]\\\\d?))?$'`)
  public productVersion!: string;

  @CreateDateColumn({ name: 'ingestion_date_utc', type: 'timestamp with time zone', insert: false })
  @Index()
  public readonly ingestionDateUTC!: Date;

  @Column({ name: 'imaging_time_begin_utc', type: 'timestamp with time zone' })
  @Check('imaging time begin utc', `"imaging_time_begin_utc" < now()`)
  @Index()
  public imagingTimeBeginUTC!: Date;

  @Column({ name: 'imaging_time_end_utc', type: 'timestamp with time zone' })
  @Check('imaging time end utc', `"imaging_time_end_utc" < now()`)
  @Index()
  public imagingTimeEndUTC!: Date;

  @Column({ name: 'resolution_degree', type: 'numeric' })
  @Index()
  @Check('resolution degree', `"resolution_degree" BETWEEN 0.000000167638063430786 AND 0.703125`)
  public resolutionDegree!: number;

  @Column({ name: 'resolution_meter', type: 'numeric' })
  @Index()
  @Check('resolution meter', `"resolution_meter" BETWEEN 0.0185 AND 78271.52`)
  public resolutionMeter!: number;

  @Column({ name: 'source_resolution_meter', type: 'numeric' })
  @Check('source resolution meter', `"source_resolution_meter" BETWEEN 0.0185 AND 78271.52`)
  public sourceResolutionMeter!: number;

  @Column({ name: 'horizontal_accuracy_ce_90', type: 'real' })
  @Check('horizontal accuracy ce 90', `"horizontal_accuracy_ce_90" BETWEEN 0.01 AND 4000`)
  public horizontalAccuracyCE90!: number;

  @Column({ name: 'sensors', type: 'text', collation: 'C.UTF-8' })
  public sensors!: string;

  @Column({ name: 'countries', type: 'text', collation: 'C.UTF-8', nullable: true })
  public countries?: string;

  @Column({ name: 'cities', type: 'text', collation: 'C.UTF-8', nullable: true })
  public cities?: string;

  @Column({ name: 'description', type: 'text', collation: 'C.UTF-8', nullable: true })
  public description?: string;

  @Column({ name: 'geometry', type: 'geometry', spatialFeatureType: 'Polygon', srid: 4326 })
  @Index({ spatial: true })
  @Check('valid geometry', `ST_IsValid("geometry")`)
  @Check('geometry extent', `Box2D("geometry") @Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)'))`)
  public geometry!: Polygon;
}
