import { createHash } from 'node:crypto';

// SHA-256 fingerprints of bearer tokens exposed in historical participant files.
// Keep only fingerprints here; see SEC-03 in SECURITY-AUDIT-2026-11-07.md.
const revokedTokenHashes = new Set([
  '07711f8306020e1f185fe7d8ce05b099bf441cccada4cf2b68e931222ca5455f',
  '589923a8b11289aa894590278170c44d79c05be37e2da8d33a294234fba7da18',
  '75dd099284c228761afbc4ec984b97411cc546378d430bbfd1068a9cbcb7af49',
  '78220e3f280eb039c03fe347d40ee0d68bfd3ad6eef41bdd38e346b0e676f9a3',
  'a74d8a609714a2d6dce5fb552667083ed621f643bbca74c045e9dbee96daf905',
  'b7a853d8e76fe3a573f1a0708eec088ef7eabab4f7f0424c01ec9247628bba64',
  'c439642838e444a83fdb5cc8a3d919a56a2e7f5a6d96fb493ec5c2a28bf5af3c',
  'f01298aa073fa3ab07f1e67115bc9fa40aefcf0c46e7b95b4adcc1880cf00b37',
]);

export function isTicketRevoked(token: string): boolean {
  return revokedTokenHashes.has(createHash('sha256').update(token.trim()).digest('hex'));
}
