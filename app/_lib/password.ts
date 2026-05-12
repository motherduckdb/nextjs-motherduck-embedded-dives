import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("base64url");
  const key = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, encodedKey] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !encodedKey) return false;

  const storedKey = Buffer.from(encodedKey, "base64url");
  const candidateKey = (await scrypt(password, salt, storedKey.length)) as Buffer;
  return (
    storedKey.length === candidateKey.length &&
    crypto.timingSafeEqual(storedKey, candidateKey)
  );
}
