import md5 from "blueimp-md5";

/** Lowercase hex MD5 (Gravatar). */
export function md5Hex(input: string): string {
  return md5(input);
}
