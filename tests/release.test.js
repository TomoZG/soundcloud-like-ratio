'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test } = require('node:test');
const { RUNTIME_FILES } = require('../scripts/extension-files');
const { verifyReleaseTag } = require('../scripts/verify-release-tag');

const projectRoot = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(
  path.join(projectRoot, 'manifest.json'),
  'utf8'
));
const packageJson = JSON.parse(fs.readFileSync(
  path.join(projectRoot, 'package.json'),
  'utf8'
));

function readPngDimensions(relativePath) {
  const image = fs.readFileSync(path.join(projectRoot, relativePath));
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ]);

  assert.deepEqual(image.subarray(0, 8), pngSignature);

  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20)
  };
}

describe('release metadata', () => {
  test('keeps manifest and package versions aligned', () => {
    assert.equal(manifest.version, packageJson.version);
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  });

  test('declares narrow cross-browser metadata', () => {
    assert.equal(
      manifest.homepage_url,
      'https://github.com/TomoZG/soundcloud-like-ratio'
    );
    assert.equal(
      manifest.browser_specific_settings.gecko.id,
      'soundcloud-like-ratio@tomozg.github.io'
    );
    assert.deepEqual(
      manifest.browser_specific_settings.gecko.data_collection_permissions,
      { required: ['none'] }
    );
    assert.equal(manifest.permissions, undefined);
    assert.deepEqual(manifest.content_scripts[0].matches, [
      'https://soundcloud.com/*'
    ]);
  });

  test('includes correctly sized PNG icons in the runtime allow-list', () => {
    for (const size of [16, 32, 48, 128]) {
      const relativePath = `icons/icon-${size}.png`;
      assert.equal(manifest.icons[String(size)], relativePath);
      assert.ok(RUNTIME_FILES.includes(relativePath));
      assert.deepEqual(readPngDimensions(relativePath), {
        width: size,
        height: size
      });
    }
  });

  test('accepts only a matching semantic release tag', () => {
    assert.equal(verifyReleaseTag(`v${manifest.version}`), manifest.version);
    assert.throws(
      () => verifyReleaseTag('v9.9.9'),
      /does not match extension version/
    );
    assert.throws(() => verifyReleaseTag('release-1.0.0'), /form v1\.2\.3/);
  });
});
