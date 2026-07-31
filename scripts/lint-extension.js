'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const temporarySource = fs.mkdtempSync(
  path.join(os.tmpdir(), 'soundcloud-like-ratio-lint-')
);
const webExtExecutable = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'web-ext.cmd' : 'web-ext'
);

try {
  const manifest = JSON.parse(fs.readFileSync(
    path.join(projectRoot, 'manifest.json'),
    'utf8'
  ));

  // AMO's linter requires signing metadata for every Manifest V3 extension,
  // even though this project supports Firefox through temporary loading only.
  // Add disposable metadata to the lint copy, never to the shipped manifest.
  manifest.browser_specific_settings = {
    gecko: {
      id: 'soundcloud-like-ratio@temporary.invalid',
      data_collection_permissions: {
        required: ['none']
      }
    }
  };

  fs.writeFileSync(
    path.join(temporarySource, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  fs.copyFileSync(
    path.join(projectRoot, 'content.js'),
    path.join(temporarySource, 'content.js')
  );
  fs.copyFileSync(
    path.join(projectRoot, 'styles.css'),
    path.join(temporarySource, 'styles.css')
  );

  const result = spawnSync(webExtExecutable, [
    'lint',
    '--source-dir', temporarySource,
    '--warnings-as-errors',
    '--no-input'
  ], {
    env: {
      ...process.env,
      NO_UPDATE_NOTIFIER: '1'
    },
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(temporarySource, {
    force: true,
    recursive: true
  });
}
