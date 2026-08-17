export function resolve(...parts: string[]): string {
  return parts.join("/");
}

export function join(...parts: string[]): string {
  return parts.filter(Boolean).join("/");
}

export function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export default { resolve, join, basename };
