'use strict';

const { GenericContainer, Wait } = require('testcontainers');

const POSTGRES_IMAGE = process.env.POSTGRES_IMAGE ?? 'postgis/postgis:17-3.5';
const POSTGRES_INTERNAL_PORT = 5432;
const DB_USERNAME = process.env.DB_USERNAME ?? 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ?? '1234';
const DB_NAME = process.env.DB_NAME ?? 'postgres';

module.exports = async function () {
  if (process.env.USE_EXTERNAL_DB === 'true') {
    return;
  }

  const container = await new GenericContainer(POSTGRES_IMAGE)
    .withExposedPorts(POSTGRES_INTERNAL_PORT)
    .withEnvironment({
      POSTGRES_USER: DB_USERNAME,
      POSTGRES_PASSWORD: DB_PASSWORD,
      POSTGRES_DB: DB_NAME,
    })
    .withName('postgres-test-container')
    .withWaitStrategy(Wait.forSuccessfulCommand(`pg_isready -U ${DB_USERNAME} -d ${DB_NAME}`))
    .withStartupTimeout(30_000)
    .start();

  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getMappedPort(POSTGRES_INTERNAL_PORT));
  process.env.DB_USERNAME = DB_USERNAME;
  process.env.DB_PASSWORD = DB_PASSWORD;
  process.env.DB_NAME = DB_NAME;

  global.__POSTGRES_CONTAINER__ = container;
};
