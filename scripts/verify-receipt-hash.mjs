import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;

const { computeReceiptHash } = await import('../src/gate/receipt.ts');

for (const name of ['github-merge', 'spring-service-mutation']) {
  const receipt = JSON.parse(
    await readFile(new URL(`../src/gate/golden/${name}.json`, import.meta.url), 'utf8'),
  );
  const computed = await computeReceiptHash(receipt);
  const ok = computed === receipt.receipt_hash;
  console.log(
    `${name}: computed=${computed} expected=${receipt.receipt_hash} ${ok ? 'MATCH' : 'MISMATCH'}`,
  );
  if (!ok) process.exit(1);
}
console.log('golden hashes verified');
