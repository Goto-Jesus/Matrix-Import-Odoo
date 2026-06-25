import * as fs from 'fs';
import * as path from 'path';
import { parseDoc } from './parser';
import { OdooImportJson } from './types';

export function parseDocToJson(filePath: string): OdooImportJson {
  const content = fs.readFileSync(filePath, 'utf-8');
  const boms = parseDoc(content);

  return {
    sourceFile: path.basename(filePath),
    generatedAt: new Date().toISOString(),
    boms,
  };
}
