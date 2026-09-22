import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

const apiRoot = fileURLToPath(new URL('.', import.meta.url));

config({
  path: `${apiRoot}.env`,
  override: false,
});
