-- Type: classification

-- DROP TYPE IF EXISTS "PolygonParts".classification;

CREATE TYPE "PolygonParts".classification AS ENUM
    ('Unclassified', 'Confidential', 'Secret', 'TopSecret');

ALTER TYPE "PolygonParts".classification
    OWNER TO postgres;


-- Type: product_type

-- DROP TYPE IF EXISTS "PolygonParts".product_type;

CREATE TYPE "PolygonParts".product_type AS ENUM
    ('Orthophoto', 'OrthophotoHistory', 'OrthophotoBest', 'RasterMap', 'RasterMapBest', 'RasterAid', 'RasterAidBest', 'RasterVector', 'RasterVectorBest');

ALTER TYPE "PolygonParts".product_type
    OWNER TO postgres;
