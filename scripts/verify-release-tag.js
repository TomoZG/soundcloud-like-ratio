'use strict';

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(
  path.join(projectRoot, 'manifest.json'),
  'utf8'
));
const packageJson = JSON.parse(fs.readFileSync(
  path.join(projectRoot, 'package.json'),
  'utf8'
));

function verifyReleaseTag(tag) {
  if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
    throw new Error('Release tag must use the form v1.2.3.');
  }

  const tagVersion = tag.slice(1);

  if (manifest.version !== packageJson.version) {
    throw new Error(
      `Manifest version ${manifest.version} does not match package version ${packageJson.version}.`
    );
  }

  if (tagVersion !== manifest.version) {
    throw new Error(
      `Tag version ${tagVersion} does not match extension version ${manifest.version}.`
    );
  }

  return tagVersion;
}

if (require.main === module) {
  console.log(verifyReleaseTag(process.argv[2]));
}

module.exports = {
  verifyReleaseTag
};
