const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
export const CODE_LENGTH = 7;
export const MAX_ATTEMPTS = 5;

export interface GenerateUniqueCodeDeps {
  exists: (code: string) => Promise<boolean>;
  randomCode?: () => string | Promise<string>;
  maxAttempts?: number;
}

export function randomCode(length = CODE_LENGTH): string {
  const result: string[] = [];
  const bytes = new Uint8Array(32);

  while (result.length < length) {
    globalThis.crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte >= 252) {
        continue;
      }

      result.push(ALPHABET.charAt(byte % ALPHABET.length));
      if (result.length === length) {
        break;
      }
    }
  }

  return result.join("");
}

export async function generateUniqueCode(
  deps: GenerateUniqueCodeDeps,
): Promise<string> {
  const attempts = deps.maxAttempts ?? MAX_ATTEMPTS;
  const generate = deps.randomCode ?? (() => randomCode());

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code = await generate();
    if (!(await deps.exists(code))) {
      return code;
    }
  }

  throw new Error("alias_taken");
}
