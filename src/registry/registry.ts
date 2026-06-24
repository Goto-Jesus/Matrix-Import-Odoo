import * as fs from 'fs';
import * as path from 'path';

const REGISTRY_PATH = path.resolve(process.cwd(), 'import_registry.json');

export interface RegistryEntry {
  specFile: string;
  importedAt: string;
  bomIds: number[];
  status: 'active' | 'archived';
}

type Registry = Record<string, RegistryEntry>;

function load(): Registry {
  if (!fs.existsSync(REGISTRY_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')) as Registry;
  } catch {
    return {};
  }
}

function save(registry: Registry): void {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
}

export function getEntry(sofaName: string): RegistryEntry | null {
  const registry = load();
  return registry[sofaName] ?? null;
}

export function setEntry(sofaName: string, entry: RegistryEntry): void {
  const registry = load();
  registry[sofaName] = entry;
  save(registry);
}

export function archiveEntry(sofaName: string): void {
  const registry = load();
  if (registry[sofaName]) {
    registry[sofaName].status = 'archived';
    save(registry);
  }
}

export function listEntries(): Array<{ name: string } & RegistryEntry> {
  const registry = load();
  return Object.entries(registry).map(([name, entry]) => ({ name, ...entry }));
}
