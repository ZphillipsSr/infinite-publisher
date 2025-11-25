import crypto from "crypto";
import fs from "fs";

export function hashFile(path: string): string {
  const data = fs.readFileSync(path);
  return crypto.createHash("sha256").update(data).digest("hex");
}