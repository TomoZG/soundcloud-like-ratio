'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { RUNTIME_FILES } = require('./extension-files');

const projectRoot = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(
  path.join(projectRoot, 'manifest.json'),
  'utf8'
));
const temporarySource = fs.mkdtempSync(
  path.join(os.tmpdir(), 'soundcloud-like-ratio-build-')
);
const artifactsDirectory = path.join(projectRoot, 'web-ext-artifacts');
const filename = `soundcloud-like-ratio-${manifest.version}.zip`;
const webExtExecutable = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'web-ext.cmd' : 'web-ext'
);

try {
  RUNTIME_FILES.forEach((relativePath) => {
    const destination = path.join(temporarySource, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(projectRoot, relativePath), destination);
  });

  const result = spawnSync(webExtExecutable, [
    'build',
    '--source-dir', temporarySource,
    '--artifacts-dir', artifactsDirectory,
    '--filename', filename,
    '--overwrite-dest',
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
