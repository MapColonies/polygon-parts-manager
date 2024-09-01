import { Check, Column, CreateDateColumn, Index, type Polygon } from 'typeorm';
import type { Part } from '../models/polygonParts';

export class Common implements Part {
  @Column({ name: 'product_id', type: 'text', collation: 'C.UTF-8' })
  @Index('polygon_parts_product_id_idx')
  public productId!: string;
  
  @Column({ name: 'product_type', type: 'text', collation: 'C.UTF-8' })
  @Index('polygon_parts_product_type_idx')
  public productType!: string;
  
  @Column({ name: 'catalog_id', type: 'uuid' })
  @Index('polygon_parts_catalog_id_idx')
  public catalogId!: string;

  @Column({ name: 'source_id', type: 'text', collation: 'C.UTF-8', nullable: true })
  public sourceId?: string;

  @Column({ name: 'source_name', type: 'text', collation: 'C.UTF-8', nullable: true })
  public soourceName?: string;

  @Column({ name: 'product_version', type: 'text', collation: 'C.UTF-8', nullable: true })
  public productVersion?: string;

  @CreateDateColumn({ name: 'ingestion_date_utc', type: 'timestamp with time zone' })
  @Index('polygon_parts_ingestion_date_idx')
  public ingestionDateUtc!: Date;

  @Column({ name: 'imaging_time_begin_utc', type: 'timestamp with time zone' })
  @Index('polygon_parts_imaging_time_start_idx')
  public imagingTimeBeginUtc!: Date;

  @Column({ name: 'imaging_time_end_utc', type: 'timestamp with time zone' })
  @Index('polygon_parts_imaging_time_end_idx')
  public imagingTimeEndUtc!: Date;

  @Column({ name: 'resolution_degree', type: 'numeric' })
  @Index('polygon_parts_resolution_degree_idx')
  public resolutionDegree!: number;

  @Column({ name: 'resolution_meter', type: 'numeric' })
  @Index('polygon_parts_resolution_meter_idx')
  public resolutionMeter!: number;

  @Column({ name: 'source_resolution_meter', type: 'numeric' })
  public sourceResolutionMeter!: number;

  @Column({ name: 'horizontal_accuracy_ce_90', type: 'real', nullable: true })
  public horizontalAccuracyCe90?: number;

  @Column({ name: 'sensors', type: 'text', collation: 'C.UTF-8', nullable: true })
  public sensors?: string;

  @Column({ name: 'countries', type: 'text', collation: 'C.UTF-8', nullable: true })
  public countries?: string;

  @Column({ name: 'cities', type: 'text', collation: 'C.UTF-8', nullable: true })
  public cities?: string;

  @Column({ name: 'description', type: 'text', collation: 'C.UTF-8', nullable: true })
  public description?: string;

  @Column({ name: 'geometry', type: 'geometry', spatialFeatureType: 'Polygon', srid: 4326 })
  @Index('polygon_parts_geometry_idx', { spatial: true })
  @Check('valid geometry', `ST_IsValid("geometry")`)
  @Check('geometry extent', `Box2D("geometry") @Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)'))`)
  public geometry!: Polygon;
}
