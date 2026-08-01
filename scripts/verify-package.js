'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { RUNTIME_FILES } = require('./extension-files');

const projectRoot = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(
  path.join(projectRoot, 'manifest.json'),
  'utf8'
));
const packagePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(
    projectRoot,
    'web-ext-artifacts',
    `soundcloud-like-ratio-${manifest.version}.zip`
  );

function findEndOfCentralDirectory(archive) {
  const minimumOffset = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimumOffset; offset--) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error('Unable to find the ZIP central directory.');
}

function readZipEntries(packageFile) {
  const archive = fs.readFileSync(packageFile);
  const directoryEnd = findEndOfCentralDirectory(archive);
  const entryCount = archive.readUInt16LE(directoryEnd + 10);
  let offset = archive.readUInt32LE(directoryEnd + 16);
  const entries = new Map();

  for (let index = 0; index < entryCount; index++) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid ZIP central directory entry.');
    }

    const compressionMethod = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const filenameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localHeaderOffset = archive.readUInt32LE(offset + 42);
    const filename = archive
      .subarray(offset + 46, offset + 46 + filenameLength)
      .toString('utf8');

    entries.set(filename, {
      compressedSize,
      compressionMethod,
      localHeaderOffset
    });
    offset += 46 + filenameLength + extraLength + commentLength;
  }

  return {
    archive,
    entries
  };
}

function extractEntry(zip, filename) {
  const entry = zip.entries.get(filename);
  if (!entry) {
    throw new Error(`ZIP entry not found: ${filename}`);
  }

  const offset = entry.localHeaderOffset;
  if (zip.archive.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error(`Invalid local ZIP header for ${filename}.`);
  }

  const filenameLength = zip.archive.readUInt16LE(offset + 26);
  const extraLength = zip.archive.readUInt16LE(offset + 28);
  const dataOffset = offset + 30 + filenameLength + extraLength;
  const compressed = zip.archive.subarray(
    dataOffset,
    dataOffset + entry.compressedSize
  );

  if (entry.compressionMethod === 0) {
    return compressed;
  }

  if (entry.compressionMethod === 8) {
    return zlib.inflateRawSync(compressed);
  }

  throw new Error(
    `Unsupported ZIP compression method ${entry.compressionMethod}.`
  );
}

if (!fs.existsSync(packagePath)) {
  throw new Error(`Extension package not found: ${packagePath}`);
}

const zip = readZipEntries(packagePath);
const actualFiles = [...zip.entries.keys()]
  .filter((entry) => entry && !entry.endsWith('/'))
  .sort();
const expectedFiles = [...RUNTIME_FILES].sort();

if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error([
    'Unexpected extension package contents.',
    `Expected: ${expectedFiles.join(', ')}`,
    `Actual: ${actualFiles.join(', ')}`
  ].join('\n'));
}

const packagedManifest = JSON.parse(
  extractEntry(zip, 'manifest.json').toString('utf8')
);

if (packagedManifest.version !== manifest.version) {
  throw new Error(
    `Packaged manifest version ${packagedManifest.version} does not match ${manifest.version}.`
  );
}

console.log(`Verified ${path.relative(projectRoot, packagePath)}`);
