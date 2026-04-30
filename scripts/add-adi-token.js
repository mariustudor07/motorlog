/**
 * EAS eas-build-post-install hook — runs after expo prebuild completes.
 * Injects the Google Play package-name verification token into the
 * Android assets folder.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets');
const file = path.join(dir, 'adi-registration.properties');
const token = 'CEL2S7OYQELK2AAAAAAAAAAAAA';

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, token);
console.log('✓ ADI token written to', file);
