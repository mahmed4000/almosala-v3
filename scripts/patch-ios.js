const fs = require('fs');
const path = require('path');

function patchPackageSwift(file) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  if (content.includes('swift-tools-version: 6.2') || content.includes('swift-tools-version:6.2')) {
    content = content.replace(/swift-tools-version:\s*6\.2/g, 'swift-tools-version: 6.0');
    modified = true;
  }

  // Remove trailing commas before closing paren
  const noTrailingCommas = content.replace(/,(\s*\))/g, '$1');
  if (noTrailingCommas !== content) {
    content = noTrailingCommas;
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`[patch-ios] Patched Package.swift: ${file}`);
  }
}

function scanAndPatch(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '.git' && entry.name !== '.DerivedData' && entry.name !== 'build') {
        scanAndPatch(fullPath);
      }
    } else {
      const name = entry.name;
      if (name === 'Package.swift') {
        patchPackageSwift(fullPath);
      } else if (name === 'RuntimeScheduler.h') {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('SWIFT_RETURNS_RETAINED') || content.includes('SWIFT_RETURNS_UNRETAINED')) {
          content = content.replace(/SWIFT_RETURNS_RETAINED/g, '').replace(/SWIFT_RETURNS_UNRETAINED/g, '');
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`[patch-ios] Patched RuntimeScheduler.h: ${fullPath}`);
        }
      } else if (name === 'JavaScriptRuntime.swift') {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('consuming JavaScriptValuesBuffer,')) {
          content = content.replace(/consuming JavaScriptValuesBuffer,/g, 'consuming JavaScriptValuesBuffer');
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`[patch-ios] Patched JavaScriptRuntime.swift: ${fullPath}`);
        }
      } else if (name.endsWith('.swift')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('weak let')) {
          content = content.replace(/weak let/g, 'weak var');
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`[patch-ios] Patched weak let: ${fullPath}`);
        }
      }
    }
  }
}

console.log('[patch-ios] Running compatibility patches...');
const root = path.resolve(__dirname, '..');
scanAndPatch(path.join(root, 'node_modules'));
scanAndPatch(path.join(root, 'ios'));
console.log('[patch-ios] Completed successfully.');
