import { RASTER_PRODUCT_TYPE_LIST, RasterProductTypes } from '@map-colonies/raster-shared';
import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { MultiPolygon, Polygon } from 'geojson';
import type { ValidatePartRecord } from '../models/interfaces';

@Entity({ name: 'validation_parts' })
@Check('imaging times', `"imaging_time_begin_utc" <= "imaging_time_end_utc"`)
export class ValidatePart implements ValidatePartRecord {
  @PrimaryColumn({ type: 'uuid' })
  public readonly id!: string;

  @Column({ name: 'product_id', type: 'text', collation: 'ucs_basic' })
  @Index()
  @Check('product id', `"product_id" ~ '^[A-Za-z]{1}[A-Za-z0-9_]{0,37}$'`)
  public productId!: string;

  @Column({
    type: 'enum',
    enumName: 'product_type_enum',
    enum: RASTER_PRODUCT_TYPE_LIST,
  })
  @Index()
  public productType!: RasterProductTypes;

  @Column({ type: 'uuid' })
  @Index()
  public catalogId!: string;

  @Column({ type: 'text', collation: 'ucs_basic', nullable: true })
  public sourceId?: string;

  @Column({ type: 'text', collation: 'ucs_basic' })
  public sourceName!: string;

  @Column({ type: 'text', collation: 'ucs_basic' })
  @Check('product version', `"product_version" ~ '^[1-9]\\\\d*(\\\\.(0|[1-9]\\\\d?))?$'`)
  public productVersion!: string;

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

  @Column({ type: 'numeric' })
  @Check('horizontal accuracy ce90', `"horizontal_accuracy_ce90" BETWEEN 0.01 AND 4000`)
  public horizontalAccuracyCE90!: number;

  @Column({ type: 'text', collation: 'ucs_basic' })
  public sensors!: string;

  @Column({ type: 'text', collation: 'ucs_basic', nullable: true })
  public countries?: string;

  @Column({ type: 'text', collation: 'ucs_basic', nullable: true })
  public cities?: string;

  @Column({ type: 'text', collation: 'ucs_basic', nullable: true })
  public description?: string;

  // Use a generic 'Geometry' spatialFeatureType so the column can hold Polygon or MultiPolygon
  @Column({ type: 'geometry', spatialFeatureType: 'Geometry', srid: 4326, precision: 20 })
  @Index({ spatial: true })
  // Enforce geometry type to be POLYGON or MULTIPOLYGON
  @Check('validation_footprint_type_chk', `GeometryType("footprint") IN ('POLYGON','MULTIPOLYGON')`)
  @Check('geometry extent', `Box2D("footprint") @Box2D(ST_GeomFromText('LINESTRING(-180 -90, 180 90)'))`)
  public footprint!: Polygon | MultiPolygon;

  @Column({ type: 'boolean', default: false, insert: false })
  @Index()
  public readonly processed!: boolean;
}
