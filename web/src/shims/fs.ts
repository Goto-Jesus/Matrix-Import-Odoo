export function existsSync(): boolean {
  return false;
}

export function readFileSync(): string {
  throw new Error("fs.readFileSync is not available in the browser");
}

export function writeFileSync(): void {}

export function mkdirSync(): void {}

export function statSync(): { isDirectory(): boolean; isFile(): boolean } {
  throw new Error("fs.statSync is not available in the browser");
}

export function readdirSync(): string[] {
  return [];
}

export default {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
  readdirSync,
};
