import { Prisma } from "@prisma/client";

// Read the numeric suffix, not lexicographic order (CUS-1000 > CUS-999).
// Call inside a Serializable transaction so concurrent registrations retry.
export async function nextCustomerId(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<{ maxId: string | null }[]>`
    SELECT CAST(MAX(CAST(SUBSTRING(id, 5) AS UNSIGNED)) AS CHAR) AS maxId
    FROM customer
    WHERE id REGEXP '^CUS-[0-9]+$'
  `;
  const next = BigInt(rows[0]?.maxId ?? "0") + BigInt(1);
  return `CUS-${next.toString().padStart(3, "0")}`;
}
