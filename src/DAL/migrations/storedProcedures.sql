
-- PROCEDURE: polygon_parts.create_polygon_parts_schema(text)

-- DROP PROCEDURE IF EXISTS polygon_parts.create_polygon_parts_schema(text);

CREATE OR REPLACE PROCEDURE polygon_parts.create_polygon_parts_schema(
	IN qualified_identifier text)
LANGUAGE 'plpgsql'
AS $BODY$
DECLARE
    parsed_identifier name[] := parse_ident(qualified_identifier)::name[];
    schema_name text := parsed_identifier[1];
    table_name text := parsed_identifier[2];
	tbl_name text := quote_ident(table_name);
	schm_tbl_name text := quote_ident(schema_name) || '.' || quote_ident(table_name);
	tbl_name_parts text := quote_ident(table_name || '_parts');
	schm_tbl_name_parts text := quote_ident(schema_name) || '.' || quote_ident(table_name || '_parts');
BEGIN
    IF table_name IS NULL THEN
        RAISE EXCEPTION 'Input "%" must be a schema-qualified identifier for the created tables template name', schema_name;
    END IF;
	
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || schm_tbl_name_parts || '
    (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "catalog_id" uuid NOT NULL,
        "product_id" text COLLATE "C.UTF-8",
        "product_type" text COLLATE "C.UTF-8",
        "sourceId" text COLLATE "C.UTF-8",
        "sourceName" text COLLATE "C.UTF-8",
        "product_version" text COLLATE "C.UTF-8",
        "ingestion_date_utc" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "imaging_time_begin_utc" timestamp with time zone NOT NULL,
        "imaging_time_end_utc" timestamp with time zone NOT NULL,
        "resolution_degree" numeric NOT NULL,
        "resolution_meter" numeric NOT NULL,
        "source_resolution_meter" numeric NOT NULL,
        "horizontal_accuracy_ce_90" real,
        sensors text COLLATE "C.UTF-8",
        countries text COLLATE "C.UTF-8",
        cities text COLLATE "C.UTF-8",
        description text COLLATE "C.UTF-8",
        "geometry" geometry(Polygon, 4326) NOT NULL CONSTRAINT "valid geometry" CHECK(ST_IsValid("geometry")) CONSTRAINT "geometry extent" CHECK(
            Box2D("geometry") @Box2D(ST_GeomFromText(''LINESTRING(-180 -90, 180 90)''))
        ),
        "is_processed_part" boolean NOT NULL DEFAULT false,
        CONSTRAINT ' || tbl_name_parts || '_pkey PRIMARY KEY ("id")
    )

    TABLESPACE pg_default;';

    EXECUTE 'ALTER TABLE IF EXISTS ' || schm_tbl_name_parts || '
        OWNER to postgres;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_geometry_idx
        ON ' || schm_tbl_name_parts || ' USING gist
        ("geometry")
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_ingestion_date_idx
        ON ' || schm_tbl_name_parts || ' USING btree
        ("ingestion_date_utc" ASC NULLS LAST)
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_resolution_degree_idx
        ON ' || schm_tbl_name_parts || ' USING btree
        ("resolution_degree" ASC NULLS LAST)
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_resolution_meter_idx
        ON ' || schm_tbl_name_parts || ' USING btree
        ("resolution_meter" ASC NULLS LAST)
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_catalog_id_idx
        ON ' || schm_tbl_name_parts || ' USING hash
        ("catalog_id")
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_product_id_idx
        ON ' || schm_tbl_name_parts || ' USING btree
        ("product_id")
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_product_type_idx
        ON ' || schm_tbl_name_parts || ' USING btree
        ("product_type")
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_imaging_time_end_idx
        ON ' || schm_tbl_name_parts || ' USING btree
        ("imaging_time_end_utc" ASC NULLS LAST)
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name_parts || '_imaging_time_start_idx
        ON ' || schm_tbl_name_parts || ' USING btree
        ("imaging_time_begin_utc" ASC NULLS LAST)
        TABLESPACE pg_default;';

    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || schm_tbl_name || '
    (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "part_id" uuid NOT NULL,
        "catalog_id" uuid NOT NULL,
        "product_id" text COLLATE "C.UTF-8" NOT NULL,
        "product_type" text COLLATE "C.UTF-8" NOT NULL,
        "sourceId" text COLLATE "C.UTF-8",
        "sourceName" text COLLATE "C.UTF-8",
        "product_version" text COLLATE "C.UTF-8",
        "ingestion_date_utc" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "imaging_time_begin_utc" timestamp with time zone NOT NULL,
        "imaging_time_end_utc" timestamp with time zone NOT NULL,
        "resolution_degree" numeric NOT NULL,
        "resolution_meter" numeric NOT NULL,
        "source_resolution_meter" numeric NOT NULL,
        "horizontal_accuracy_ce_90" real,
        sensors text COLLATE "C.UTF-8",
        countries text COLLATE "C.UTF-8",
        cities text COLLATE "C.UTF-8",
        description text COLLATE "C.UTF-8",
        "geometry" geometry(Polygon, 4326) NOT NULL CONSTRAINT "valid geometry" CHECK(ST_IsValid("geometry")) CONSTRAINT "geometry extent" CHECK(
            Box2D("geometry") @Box2D(ST_GeomFromText(''LINESTRING(-180 -90, 180 90)''))
        ),
        CONSTRAINT ' || tbl_name || '_pkey PRIMARY KEY ("id")
    )

    TABLESPACE pg_default;';

    EXECUTE 'ALTER TABLE IF EXISTS ' || schm_tbl_name || '
        OWNER to postgres;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_geometry_idx
        ON ' || schm_tbl_name || ' USING gist
        ("geometry")
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_ingestion_date_idx
        ON ' || schm_tbl_name || ' USING btree
        ("ingestion_date_utc" ASC NULLS LAST)
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_resolution_degree_idx
        ON ' || schm_tbl_name || ' USING btree
        ("resolution_degree" ASC NULLS LAST)
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_resolution_meter_idx
        ON ' || schm_tbl_name || ' USING btree
        ("resolution_meter" ASC NULLS LAST)
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_part_id_idx
        ON ' || schm_tbl_name || ' USING btree
        ("part_id" ASC NULLS LAST)
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_catalog_id_idx
        ON ' || schm_tbl_name || ' USING hash
        ("catalog_id")
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_imaging_time_end_idx
        ON ' || schm_tbl_name || ' USING btree
        ("imaging_time_end_utc" ASC NULLS LAST)
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_product_id_idx
        ON ' || schm_tbl_name || ' USING btree
        ("product_id")
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_product_type_idx
        ON ' || schm_tbl_name || ' USING btree
        ("product_type")
        TABLESPACE pg_default;';

    EXECUTE 'CREATE INDEX IF NOT EXISTS ' || tbl_name || '_imaging_time_start_idx
        ON ' || schm_tbl_name || ' USING btree
        ("imaging_time_begin_utc" ASC NULLS LAST)
        TABLESPACE pg_default;';
END;
$BODY$;
ALTER PROCEDURE polygon_parts.create_polygon_parts_schema(text)
    OWNER TO postgres;

-- Usage example: CALL "polygon_parts".create_polygon_parts_schema('polygon_parts.layer1');


-- PROCEDURE: polygon_parts.insert_part(regclass, polygon_parts.insert_part_record)

-- DROP PROCEDURE IF EXISTS "polygon_parts".insert_part(regclass, polygon_parts.insert_part_record);

CREATE OR REPLACE PROCEDURE "polygon_parts".insert_part(
	IN parts regclass,
	IN r polygon_parts.insert_part_record)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
	EXECUTE 'INSERT INTO ' || parts || '("catalog_id", "product_id", "product_type", "sourceId", "sourceName", "product_version", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce_90", sensors, countries, cities, description, "geometry") VALUES($1.*);' USING r;
END;
$BODY$;
ALTER PROCEDURE "polygon_parts".insert_part(regclass, "polygon_parts".insert_part_record)
    OWNER TO postgres;

-- Usage example: CALL "polygon_parts".insert_part(
--     'polygon_parts.layer1_parts'::regclass,
--     (
--         '795813b2-5c1d-466e-8f19-11c30d395fcd',
--         'WORLD_BASE',
--         'OrthophotoBest',
--         '123',
--         'name',
--         '5',
--         '2022-08-22 02:08:10',
--         '2022-08-22 02:08:10',
--         0.0001,
--         0.3,
--         0.3,
--         2.5,
--         'sensors',
--         NULL,
--         'cities',
--         'description',
--         'SRID=4326;POLYGON((-20 51,10 51,10 56,-20 56,-20 51))'
--     )::"polygon_parts".insert_part_record
-- );


-- PROCEDURE: polygon_parts.update_polygon_parts(regclass, regclass)

-- DROP PROCEDURE IF EXISTS polygon_parts.update_polygon_parts(regclass, regclass);

CREATE OR REPLACE PROCEDURE polygon_parts.update_polygon_parts(
	IN parts regclass,
	IN polygon_parts regclass)
LANGUAGE 'plpgsql'
AS $BODY$
BEGIN
	drop table if exists tbl;
	execute 'create temp table if not exists tbl on commit delete rows as
	with unprocessed as (
		select "part_id", "catalog_id", "geometry" from ' || parts || ' where not "is_processed_part" order by "part_id"
	)
	select 
		t1."id",
		t1."part_id",
		st_difference(t1."geometry", st_union(t2."geometry")) diff
	from (
		select pp."id", pp."part_id", pp."catalog_id", pp."geometry"
		from ' || polygon_parts || ' pp
		join unprocessed
		on st_intersects(pp."geometry", unprocessed."geometry") and pp."catalog_id" = unprocessed."catalog_id"
		union all
		select NULL, "part_id", "catalog_id", "geometry"
		from unprocessed
	) t1
	inner join unprocessed t2
	on st_intersects(t1."geometry", t2."geometry") and t1."part_id" < t2."part_id" and t1."catalog_id" = t2."catalog_id"
	group by t1."id", t1."part_id", t1."catalog_id", t1."geometry";';

	execute 'delete from ' || polygon_parts || ' as pp
	using tbl
	where pp."id" = tbl."id"';

	execute 'with unprocessed as (
		select * from ' || parts || ' where not "is_processed_part" order by "part_id"
	), inserts as (
		select 
			"part_id",
			diff
		from tbl
		where not st_isempty(diff)
	)
	insert into ' || polygon_parts || ' as pp ("part_id", "catalog_id", "product_id", "product_type", "sourceId", "sourceName", "product_version", "ingestion_date_utc", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce_90", sensors, countries, cities, description, "geometry")
	select 
		"part_id",
		"catalog_id",
		"product_id",
		"product_type",
		"sourceId",
		"sourceName",
		"product_version",
		"ingestion_date_utc",
		"imaging_time_begin_utc",
		"imaging_time_end_utc",
		"resolution_degree",
		"resolution_meter",
		"source_resolution_meter",
		"horizontal_accuracy_ce_90",
		sensors,
		countries,
		cities,
		description,
		(st_dump(diff)).geom as "geometry"
	from (
		select "part_id", "catalog_id", "product_id", "product_type", "sourceId", "sourceName", "product_version", "ingestion_date_utc", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce_90", sensors, countries, cities, description, diff
		from inserts
		left join ' || parts || '
		using ("part_id")
		union all
		select "part_id", "catalog_id", "product_id", "product_type", "sourceId", "sourceName", "product_version", "ingestion_date_utc", "imaging_time_begin_utc", "imaging_time_end_utc", "resolution_degree", "resolution_meter", "source_resolution_meter", "horizontal_accuracy_ce_90", sensors, countries, cities, description, "geometry" as diff
		from unprocessed
		where "part_id" not in (select "part_id" from tbl)
	) inserting_parts';

	execute 'update ' || parts || '
	set "is_processed_part" = true
	where "is_processed_part" = false';
END;
$BODY$;
ALTER PROCEDURE polygon_parts.update_polygon_parts(regclass, regclass)
    OWNER TO postgres;

-- Usage example: CALL "polygon_parts".update_polygon_parts(
--     'polygon_parts.layer1_parts'::regclass,
--     'polygon_parts.layer1'::regclass
-- );
