'use strict';

const { GenericContainer, Wait } = require('testcontainers');

const POSTGRES_IMAGE = process.env.POSTGRES_IMAGE ?? 'postgis/postgis:17-3.5';
const POSTGRES_INTERNAL_PORT = 5432;

module.exports = async function () {
  if (process.env.USE_EXTERNAL_DB === 'true') {
    return;
  }

  const container = await new GenericContainer(POSTGRES_IMAGE)
    .withExposedPorts(POSTGRES_INTERNAL_PORT)
    .withEnvironment({
      POSTGRES_USER: 'postgres',
      POSTGRES_PASSWORD: '1234',
      POSTGRES_DB: 'test',
    })
    .withWaitStrategy(Wait.forSuccessfulCommand('pg_isready -U postgres -d test'))
    .withStartupTimeout(120_000)
    .start();

  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getMappedPort(POSTGRES_INTERNAL_PORT));

  global.__POSTGRES_CONTAINER__ = container;
};
