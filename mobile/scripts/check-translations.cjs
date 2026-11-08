const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const filePath = path.join(__dirname, '..', 'src', 'context', 'I18nContext.tsx');
const sourceText = fs.readFileSync(filePath, 'utf8');
const sourceFile = ts.createSourceFile(
  filePath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

let translationsDeclaration;

function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === 'translations'
  ) {
    translationsDeclaration = node;
  }
  ts.forEachChild(node, visit);
}

function propertyName(property) {
  if (!property.name) return null;
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) {
    return property.name.text;
  }
  return null;
}

function objectKeys(node) {
  if (!ts.isObjectLiteralExpression(node)) return null;
  return node.properties
    .filter((property) => ts.isPropertyAssignment(property))
    .map((property) => propertyName(property))
    .filter(Boolean);
}

visit(sourceFile);

if (!translationsDeclaration || !translationsDeclaration.initializer) {
  console.error('Could not find the translations dictionary in I18nContext.tsx.');
  process.exit(1);
}

const root = translationsDeclaration.initializer;
const requiredLanguages = ['fr', 'en', 'ar', 'de'];
const dictionaries = new Map();

if (ts.isObjectLiteralExpression(root)) {
  for (const property of root.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const language = propertyName(property);
    if (!requiredLanguages.includes(language)) continue;
    const keys = objectKeys(property.initializer);
    if (!keys) {
      console.error('Translation dictionary for "' + language + '" is not an object literal.');
      process.exit(1);
    }
    dictionaries.set(language, keys);
  }
}

const missingLanguages = requiredLanguages.filter((language) => !dictionaries.has(language));
if (missingLanguages.length) {
  console.error('Missing language dictionaries: ' + missingLanguages.join(', '));
  process.exit(1);
}

const referenceKeys = new Set(dictionaries.get('fr'));
let failed = false;

for (const language of requiredLanguages) {
  const keys = new Set(dictionaries.get(language));
  const missing = [...referenceKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !referenceKeys.has(key));

  if (missing.length || extra.length) {
    failed = true;
    console.error(
      language + ': missing [' + missing.join(', ') + '], extra [' + extra.join(', ') + ']',
    );
  } else {
    console.log(language + ': ' + keys.size + ' translation keys OK');
  }
}

if (failed) process.exit(1);
console.log('Translation key parity: OK');
