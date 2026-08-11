import { killPort } from '@nx/node/utils';

/* eslint-disable */

module.exports = async function () {
  // Put cleanup logic here
  // (e.g. stopping services, Docker Compose, etc.).
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  await killPort(port);

  console.log(globalThis.TEARDOWN_MESSAGE);
};