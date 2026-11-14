const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const eas = JSON.parse(
  fs.readFileSync(path.join(root, 'eas.json'), 'utf8'),
);
const apiConfig = fs.readFileSync(
  path.join(root, 'src/config/api.ts'),
  'utf8',
);

const preview = eas.build?.preview;
const production = eas.build?.production;

assert.ok(preview, 'EAS preview profile must exist');
assert.equal(
  preview.environment,
  'preview',
  'EAS preview must use the dedicated preview environment',
);
assert.equal(
  preview.env?.EXPO_PUBLIC_APP_ENV,
  'preview',
  'EAS preview must identify itself as preview at runtime',
);
assert.notEqual(
  preview.env?.EXPO_PUBLIC_API_URL,
  'https://liftely-api.onrender.com',
  'EAS preview must never target the production API',
);
assert.equal(
  production?.env?.EXPO_PUBLIC_API_URL,
  'https://liftely-api.onrender.com',
  'Production API URL must remain explicitly configured for production',
);
assert.match(
  apiConfig,
  /Preview builds require a dedicated staging EXPO_PUBLIC_API_URL/,
  'Runtime must fail closed when preview has no dedicated API URL',
);
assert.match(
  apiConfig,
  /Preview builds cannot use the production LIFTELY API/,
  'Runtime must reject the production API host in preview',
);

console.log('Preview API isolation checks passed.');
