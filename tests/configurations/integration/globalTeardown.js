'use strict';

module.exports = async function () {
  const container = global.__POSTGRES_CONTAINER__;
  if (container) {
    await container.stop();
  }
};
