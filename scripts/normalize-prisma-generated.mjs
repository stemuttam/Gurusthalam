import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';

import {
  join,
  resolve,
} from 'node:path';

const generatedRoot = resolve(
  'libs/shared/database/src/generated/prisma',
);

const textExtensions = new Set([
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
]);

let changedFiles = 0;

function writeError(
  message,
) {
  process.stderr.write(
    `${message}\n`,
  );
}

function writeInfo(
  message,
) {
  process.stdout.write(
    `${message}\n`,
  );
}

function normalizeFile(
  filePath,
) {
  const original =
    readFileSync(
      filePath,
      'utf8',
    );

  const normalized =
    original
      .replace(
        /\r\n/g,
        '\n',
      )
      .replace(
        /\r/g,
        '\n',
      )
      .replace(
        /[ \t]+$/gm,
        '',
      );

  if (
    normalized ===
    original
  ) {
    return;
  }

  writeFileSync(
    filePath,
    normalized,
    'utf8',
  );

  changedFiles += 1;
}

function walk(
  directory,
) {
  const entries =
    readdirSync(
      directory,
      {
        withFileTypes:
          true,
      },
    );

  for (
    const entry of entries
  ) {
    const fullPath =
      join(
        directory,
        entry.name,
      );

    if (
      entry.isDirectory()
    ) {
      walk(
        fullPath,
      );
      continue;
    }

    const extensionIndex =
      fullPath.lastIndexOf(
        '.',
      );

    if (
      extensionIndex ===
      -1
    ) {
      continue;
    }

    const extension =
      fullPath
        .slice(
          extensionIndex,
        )
        .toLowerCase();

    if (
      !textExtensions.has(
        extension,
      )
    ) {
      continue;
    }

    normalizeFile(
      fullPath,
    );
  }
}

if (
  !existsSync(
    generatedRoot,
  )
) {
  writeError(
    `[prisma-normalize] Generated Prisma directory not found: ${generatedRoot}`,
  );

  process.exit(
    1,
  );
}

walk(
  generatedRoot,
);

writeInfo(
  `[prisma-normalize] Checked ${generatedRoot}`,
);

writeInfo(
  `[prisma-normalize] Normalized ${changedFiles} generated file(s)`,
);