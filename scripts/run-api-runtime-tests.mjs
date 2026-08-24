import {
  createConnection,
} from 'node:net';

import {
  spawn,
} from 'node:child_process';

import {
  fileURLToPath,
} from 'node:url';

import {
  dirname,
  resolve,
} from 'node:path';

import process from 'node:process';

const scriptDirectory =
  dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

const workspaceRoot =
  resolve(
    scriptDirectory,
    '..',
  );

const apiMainPath =
  resolve(
    workspaceRoot,
    'apps',
    'api',
    'dist',
    'src',
    'main.js',
  );

const vitestEntryPath =
  resolve(
    workspaceRoot,
    'node_modules',
    'vitest',
    'vitest.mjs',
  );

const HOST =
  '127.0.0.1';

const PORT =
  Number(
    process.env.API_RUNTIME_PORT ??
      '3000',
  );

const BASE_URL =
  process.env.API_RUNTIME_BASE_URL ??
  `http://${HOST}:${PORT}/api`;

const API_KEY =
  process.env.INTERNAL_API_KEY;

const STARTUP_TIMEOUT_MS =
  60_000;

const POLL_INTERVAL_MS =
  250;

const RUNTIME_CONFIG =
  resolve(
    workspaceRoot,
    'apps',
    'api',
    'vitest.runtime.config.mts',
  );

const API_ENV_FILE =
  resolve(
    workspaceRoot,
    'apps',
    'api',
    '.env',
  );

let apiProcess =
  null;

let apiStartedByRunner =
  false;

let stopping =
  false;

function writeStdout(
  message,
) {
  process.stdout.write(
    `${message}\n`,
  );
}

function writeStderr(
  message,
) {
  process.stderr.write(
    `${message}\n`,
  );
}

function wait(
  milliseconds,
) {
  return new Promise(
    (
      resolvePromise,
    ) => {
      setTimeout(
        resolvePromise,
        milliseconds,
      );
    },
  );
}

function isPortOpen() {
  return new Promise(
    (
      resolvePromise,
    ) => {
      const socket =
        createConnection({
          host:
            HOST,

          port:
            PORT,
        });

      let completed =
        false;

      const finish =
        (
          result,
        ) => {
          if (
            completed
          ) {
            return;
          }

          completed =
            true;

          socket.destroy();

          resolvePromise(
            result,
          );
        };

      socket.once(
        'connect',
        () =>
          finish(true),
      );

      socket.once(
        'error',
        () =>
          finish(false),
      );

      socket.setTimeout(
        1_000,
        () =>
          finish(false),
      );
    },
  );
}

async function isApiReady() {
  if (
    !(await isPortOpen())
  ) {
    return false;
  }

  try {
    const response =
      await fetch(
        `${BASE_URL}/internal/notification-reconciliation`,
        {
          method:
            'GET',
        },
      );

    /*
     * 401 is the expected unauthenticated response and proves
     * that the Nest application and protected route are live.
     *
     * 200 is also accepted for environments where the route is
     * configured differently.
     */
    return (
      response.status ===
        401 ||
      response.status ===
        200
    );
  } catch {
    return false;
  }
}

async function waitForApi() {
  const deadline =
    Date.now() +
    STARTUP_TIMEOUT_MS;

  while (
    Date.now() <
    deadline
  ) {
    if (
      await isApiReady()
    ) {
      return;
    }

    await wait(
      POLL_INTERVAL_MS,
    );
  }

  throw new Error(
    `API did not become ready at ${BASE_URL} within ${STARTUP_TIMEOUT_MS}ms.`,
  );
}

function startApi() {
  apiStartedByRunner =
    true;

  writeStdout(
    `[api-runtime] Starting built API from ${apiMainPath}`,
  );

  apiProcess =
    spawn(
      process.execPath,
      [
        '--env-file',
        API_ENV_FILE,
        apiMainPath,
      ],
      {
        cwd:
          workspaceRoot,

        env: {
          ...process.env,

          PORT:
            String(
              PORT,
            ),
        },

        stdio:
          'inherit',

        windowsHide:
          false,
      },
    );

  apiProcess.once(
    'error',
    (
      error,
    ) => {
      writeStderr(
        `[api-runtime] Failed to start API: ${String(error)}`,
      );
    },
  );

  apiProcess.once(
    'exit',
    (
      code,
      signal,
    ) => {
      if (
        stopping
      ) {
        return;
      }

      if (
        code !==
        0
      ) {
        writeStderr(
          `[api-runtime] API exited unexpectedly with code=${String(code)} signal=${String(signal)}`,
        );
      }
    },
  );
}

function stopApi() {
  if (
    !apiProcess ||
    !apiStartedByRunner ||
    stopping
  ) {
    return;
  }

  stopping =
    true;

  const pid =
    apiProcess.pid;

  if (
    !pid
  ) {
    return;
  }

  writeStdout(
    `[api-runtime] Stopping API process ${String(pid)}`,
  );

  if (
    process.platform ===
    'win32'
  ) {
    const taskkill =
      spawn(
        'taskkill.exe',
        [
          '/PID',
          String(
            pid,
          ),
          '/T',
          '/F',
        ],
        {
          stdio:
            'ignore',

          windowsHide:
            true,
        },
      );

    taskkill.unref();

    return;
  }

  apiProcess.kill(
    'SIGTERM',
  );
}

async function runVitest() {
  writeStdout(
    `[api-runtime] Running Vitest runtime suite from ${vitestEntryPath}`,
  );

  const child =
    spawn(
      process.execPath,
      [
        vitestEntryPath,
        'run',
        '--config',
        RUNTIME_CONFIG,
        '--reporter=verbose',
      ],
      {
        cwd:
          workspaceRoot,

        env: {
          ...process.env,

          API_RUNTIME_BASE_URL:
            BASE_URL,
        },

        stdio:
          'inherit',

        windowsHide:
          false,
      },
    );

  return new Promise(
    (
      resolvePromise,
      rejectPromise,
    ) => {
      child.once(
        'error',
        (
          error,
        ) => {
          rejectPromise(
            error,
          );
        },
      );

      child.once(
        'exit',
        (
          code,
          signal,
        ) => {
          if (
            signal
          ) {
            rejectPromise(
              new Error(
                `Vitest exited with signal ${signal}.`,
              ),
            );

            return;
          }

          resolvePromise(
            code ??
              1,
          );
        },
      );
    },
  );
}

async function main() {
  if (
    !API_KEY
  ) {
    throw new Error(
      'INTERNAL_API_KEY must be configured before API runtime tests can run.',
    );
  }

  if (
    await isApiReady()
  ) {
    writeStdout(
      `[api-runtime] Reusing existing API at ${BASE_URL}`,
    );
  } else {
    startApi();

    await waitForApi();

    writeStdout(
      '[api-runtime] API is ready.',
    );
  }

  const exitCode =
    await runVitest();

  if (
    exitCode !==
    0
  ) {
    process.exitCode =
      exitCode;
  }

  /*
   * Explicitly stop an API that this runner started.
   *
   * Do not stop an API that was already running before this
   * runner began.
   */
  stopApi();
}

const cleanup =
  () => {
    stopApi();
  };

process.once(
  'SIGINT',
  cleanup,
);

process.once(
  'SIGTERM',
  cleanup,
);

try {
  await main();
} catch (
  error
) {
  writeStderr(
    `[api-runtime] Runtime test runner failed: ${String(error)}`,
  );

  process.exitCode =
    1;

  stopApi();
}