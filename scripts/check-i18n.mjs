import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const i18nDir = path.join(root, 'src', 'i18n');
const baseline = 'en.ts';
const localeFiles = fs
  .readdirSync(i18nDir)
  .filter((name) => name.endsWith('.ts') && name !== 'index.ts')
  .sort();
const strict = process.argv.includes('--strict');

function readDefaultObject(filePath) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const objects = new Map();

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name)
        && declaration.initializer
        && ts.isObjectLiteralExpression(declaration.initializer)
      ) {
        objects.set(declaration.name.text, declaration.initializer);
      }
    }
  }

  for (const statement of source.statements) {
    if (
      ts.isExportAssignment(statement)
      && ts.isObjectLiteralExpression(statement.expression)
    ) {
      return statement.expression;
    }
    if (
      ts.isExportAssignment(statement)
      && ts.isIdentifier(statement.expression)
      && objects.has(statement.expression.text)
    ) {
      return objects.get(statement.expression.text);
    }
  }
  throw new Error(`No default object export found in ${path.relative(root, filePath)}`);
}

function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function collectKeys(node, prefix = '') {
  const keys = [];
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = propertyName(property.name);
    if (!name) continue;

    const key = prefix ? `${prefix}.${name}` : name;
    const value = property.initializer;
    if (ts.isObjectLiteralExpression(value)) {
      keys.push(...collectKeys(value, key));
    } else {
      keys.push(key);
    }
  }
  return keys;
}

const baselinePath = path.join(i18nDir, baseline);
const baselineKeys = new Set(collectKeys(readDefaultObject(baselinePath)));
let hasError = false;

for (const fileName of localeFiles) {
  if (fileName === baseline) continue;
  const filePath = path.join(i18nDir, fileName);
  const keys = new Set(collectKeys(readDefaultObject(filePath)));
  const missing = [...baselineKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !baselineKeys.has(key));

  if (missing.length > 0 || extra.length > 0) {
    hasError = true;
    console.error(`\n${fileName}`);
    if (missing.length > 0) {
      console.error(`  Missing (${missing.length}): ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ', ...' : ''}`);
    }
    if (extra.length > 0) {
      console.error(`  Extra (${extra.length}): ${extra.slice(0, 20).join(', ')}${extra.length > 20 ? ', ...' : ''}`);
    }
  }
}

if (hasError) {
  const message = strict
    ? 'i18n key check failed.'
    : 'i18n key drift detected. Run with --strict to fail on drift.';
  console.error(`\n${message}`);
  if (strict) process.exitCode = 1;
} else {
  console.log(`i18n key check passed for ${localeFiles.length} locale files.`);
}
