const bip32Like = (path: string): boolean => {
  if (path === "m/") return true;
  return /^m(((\/[0-9]+h)+|(\/[0-9]+H)+|(\/[0-9]+')*)((\/[0-9]+)*))$/.test(
    path,
  );
};
const HARDENED = 0x80000000;
// https://github.com/shapeshift/hdwallet/blob/805617c2018543d611522d69d6b4e063ec9755b5/packages/hdwallet-core/src/utils.ts#L68
/**
 * Convert a BIP32 path to an address list
 * @param path - BIP32 path string
 * @returns Array of address indices
 */
const bip32ToAddressNList = (path: string): number[] => {
  if (!bip32Like(path)) {
    throw new Error(`Not a bip32 path: '${path}'`);
  }
  if (/^m\//i.test(path)) {
    path = path.slice(2);
  }
  const segments = path.split("/");
  if (segments.length === 1 && segments[0] === "") return [];
  const ret = new Array(segments.length);
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) {
      throw new Error("Invalid segment");
    }
    const tmp = /(\d+)([hH']?)/.exec(segment);
    if (tmp === null) {
      throw new Error("Invalid input");
    }
    const childIndex = tmp[1];
    if (!childIndex) {
      throw new Error("Invalid child index format");
    }
    ret[i] = parseInt(childIndex, 10);
    if (ret[i] >= HARDENED) {
      throw new Error("Invalid child index");
    }
    const modifier = tmp[2];
    if (modifier === "h" || modifier === "H" || modifier === "'") {
      ret[i] += HARDENED;
    } else if (modifier && modifier.length !== 0) {
      throw new Error("Invalid modifier");
    }
  }
  return ret;
};

export { bip32ToAddressNList };
