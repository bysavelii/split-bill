const BASE64_URL_ALPHABET = /^[A-Za-z0-9_-]*$/u;
const BASE64_BLOCK_LENGTH = 4;
/** Остаток 1 невозможен: один знак base64 несёт всего 6 бит, меньше целого байта. */
const IMPOSSIBLE_REMAINDER = 1;

/** UTF-8, затем base64url без `=`: результат состоит только из знаков `A-Za-z0-9_-`. */
export function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const base64 = btoa(bytesToBinaryString(bytes));

  return base64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** `undefined`, если знаки чужие, длина невозможна или байты не образуют UTF-8. */
export function decodeBase64Url(code: string): string | undefined {
  if (!BASE64_URL_ALPHABET.test(code)) return undefined;
  if (code.length % BASE64_BLOCK_LENGTH === IMPOSSIBLE_REMAINDER) {
    return undefined;
  }

  const bytes = decodeBytes(code);
  if (bytes === undefined) return undefined;

  return decodeUtf8(bytes);
}

function bytesToBinaryString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

function decodeBytes(code: string): Uint8Array | undefined {
  const base64 = code.replaceAll("-", "+").replaceAll("_", "/");
  const paddingLength =
    (BASE64_BLOCK_LENGTH - (base64.length % BASE64_BLOCK_LENGTH)) %
    BASE64_BLOCK_LENGTH;
  const padded = base64 + "=".repeat(paddingLength);

  try {
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    return undefined;
  }
}

function decodeUtf8(bytes: Uint8Array): string | undefined {
  // ignoreBOM: true оставляет метку порядка байтов в тексте, а не съедает её.
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

  try {
    return decoder.decode(bytes);
  } catch {
    return undefined;
  }
}
