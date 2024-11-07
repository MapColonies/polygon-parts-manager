import { Check, Column, CreateDateColumn, Index, type Polygon } from 'typeorm';
import type { CommonRecord, ProductType } from '../models/interfaces';
import { PRODUCT_TYPES } from '../models/constants';

export class Common implements CommonRecord {
  @Column({ name: 'product_id', type: 'text', collation: 'C.UTF-8' })
  @Index()
  @Check('product id', `"product_id" ~ '^[A-Za-z]{1}[A-Za-z0-9_]{0,37}$'`)
  public productId!: string;

  @Column({
    type: 'enum',
    enumName: 'product_type_enum',
    enum: PRODUCT_TYPES,
  })
  @Index()
  public productType!: ProductType;

  @Column({ type: 'uuid' })
  @Index()
  public catalogId!: string;

  @Column({ type: 'text', collation: 'C.UTF-8', nullable: true })
  public sourceId?: string;

  @Column({ type: 'text', collation: 'C.UTF-8' })
  public sourceName!: string;

  @Column({ type: 'text', collation: 'C.UTF-8' })
  @Check('product version', `"product_version" ~ '^[1-9]\\\\d*(\\\\.(0|[1-9]\\\\d?))?$'`)
  public productVersion!: string;

  @CreateDateColumn({ type: 'timestamp with time zone', insert: false })
  @Index()
  public readonly ingestionDateUTC!: Date;

  @Column({ type: 'timestamp with time zone' })
  @Check('imaging time begin utc', `"imaging_time_begin_utc" < now()`)
  @Index()
  public imagingTimeBeginUTC!: Date;

  @Column({ type: 'timestamp with time zone' })
  @Check('imaging time end utc', `"imaging_time_end_utc" < now()`)
  @Index()
  public imagingTimeEndUTC!: Date;

  @Column({ type: 'numeric' })
  @Index()
  @Check('resolution degree', `"resolution_degree" BETWEEN 0.000000167638063430786 AND 0.703125`)
  public resolutionDegree!: number;

  @Column({ type: 'numeric' })
  @Index()
  @Check('resolution meter', `"resolution_meter" BETWEEN 0.0185 AND 78271.52`)
  public resolutionMeter!: number;

  @Column({ type: 'numeric' })
  @Check('source resolution meter', `"source_resolution_meter" BETWEEN 0.0185 AND 78271.52`)
  public sourceResolutionMeter!: number;

  @Column({ type: 'real' })
  @Check('horizontal accuracy ce90', `"horizontal_accuracy_ce90" BETWEEN 0.01 AND 4000`)
  public horizontalAccuracyCE90!: number;

  @Column({ type: 'text', collation: 'C.UTF-8' })
  public sensors!: string;

  @Column({ type: 'text', collation: 'C.UTF-8', nullable: true })
  public countries?: string;

  @Column({ type: 'text', collation: 'C.UTF-8', nullable: true })
  public cities?: string;

  @Column({ type: 'text', collation: 'C.UTF-8', nullable: true })
  public description?: string;

  @Column({ type: 'geometry', spatialFeatureType: 'Polygon', srid: 4326, precision: 20 })
  @Index({ spatial: true })
  @Check('valid geometry', `ST_IsValid("footprint")`)
  @Check('geometry extent', `Box2D("footprint") @Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)'))`)
  public footprint!: Polygon;
}
