-- View: PolygonParts.polygon_parts
-- DROP MATERIALIZED VIEW IF EXISTS "PolygonParts".polygon_parts;
CREATE MATERIALIZED VIEW IF NOT EXISTS "PolygonParts".polygon_parts TABLESPACE pg_default AS WITH joined_parts AS (
   SELECT row_number() OVER (
         PARTITION BY polygon_parts.geom
         ORDER BY parts."internalId" DESC
      ) AS row_num,
      st_transform(polygon_parts.geom, 4326) geom,
      parts."internalId",
      parts."recordId",
      parts."productId",
      parts."productName",
      parts."productVersion",
      parts."ingestionDate",
      parts."sourceDateStart",
      parts."sourceDateEnd",
      parts."minResolutionDeg",
      parts."maxResolutionDeg",
      parts."minResolutionMeter",
      parts."maxResolutionMeter",
      parts."minHorizontalAccuracyCE90",
      parts."maxHorizontalAccuracyCE90",
      parts.sensors,
      parts.region,
      parts.classification,
      parts.description,
      parts."imageName",
      parts."productType",
      parts."srsName"
   FROM (
         SELECT (
               st_dump(
                  "PolygonParts".mc_merge_polygons(
                     inner_parts.geom
                     ORDER BY inner_parts."internalId"
                  )
               )
            ).geom AS geom,
            inner_parts."recordId"
         FROM (
               SELECT st_transform(parts_1.geom, 3395) geom,
                  parts_1."recordId",
                  parts_1."internalId"
               FROM "PolygonParts".parts parts_1
            ) inner_parts
         GROUP BY inner_parts."recordId"
      ) polygon_parts
      LEFT JOIN "PolygonParts".parts parts ON st_coveredby(polygon_parts.geom, st_transform(parts.geom, 3395))
      AND polygon_parts."recordId" = parts."recordId"
)
SELECT row_number() OVER () AS id,
   joined_parts.geom,
   joined_parts."internalId",
   joined_parts."recordId",
   joined_parts."productId",
   joined_parts."productName",
   joined_parts."productVersion",
   joined_parts."ingestionDate",
   joined_parts."sourceDateStart",
   joined_parts."sourceDateEnd",
   joined_parts."minResolutionDeg",
   joined_parts."maxResolutionDeg",
   joined_parts."minResolutionMeter",
   joined_parts."maxResolutionMeter",
   joined_parts."minHorizontalAccuracyCE90",
   joined_parts."maxHorizontalAccuracyCE90",
   joined_parts.sensors,
   joined_parts.region,
   joined_parts.classification,
   joined_parts.description,
   joined_parts."imageName",
   joined_parts."productType",
   joined_parts."srsName"
FROM joined_parts
WHERE joined_parts.row_num = 1 WITH DATA;
ALTER TABLE IF EXISTS "PolygonParts".polygon_parts OWNER TO postgres;
CREATE INDEX polygon_parts_geom_idx ON "PolygonParts".polygon_parts USING gist (geom) TABLESPACE pg_default;
CREATE UNIQUE INDEX polygon_parts_id_idx ON "PolygonParts".polygon_parts USING btree (id) TABLESPACE pg_default;
