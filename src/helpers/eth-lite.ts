import { recoverPersonalSignature } from "@metamask/eth-sig-util";

export function checkSignerAddr(nonce: string, signature: string) {
  return recoverPersonalSignature({
      data: nonce as unknown,
      signature
  });
}