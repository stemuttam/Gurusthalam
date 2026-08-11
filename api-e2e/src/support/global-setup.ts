import { waitForPortOpen } from '@nx/node/utils';

/* eslint-disable */

module.exports = async function () {
  // Start services that the app needs to run
  // (e.g. database, Docker Compose, etc.).
  console.log('\nSetting up...\n');

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  await waitForPortOpen(port, { host });

  // Pass a message from global setup to global teardown.
  globalThis.TEARDOWN_MESSAGE = '\nTearing down...\n';
};