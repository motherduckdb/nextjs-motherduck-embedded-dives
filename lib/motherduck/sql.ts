import { createHash } from "crypto";

export function mdStringLiteral(value: string): string {
  for (let i = 0; i < 16; i++) {
    const tag = `mdq_${createHash("sha256")
      .update(String(i))
      .update(value)
      .digest("hex")
      .slice(0, 16)}`;
    const delimiter = `$${tag}$`;
    if (!value.includes(delimiter)) {
      return `${delimiter}${value}${delimiter}`;
    }
  }

  throw new Error("Unable to safely quote MotherDuck SQL string literal");
}

export function mdPositiveIntegerLiteral(
  value: unknown,
  name: string
): string {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;

  if (!Number.isSafeInteger(numberValue) || numberValue < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return String(numberValue);
}
