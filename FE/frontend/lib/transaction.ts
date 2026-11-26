import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasDatabaseCode } from "@/lib/business-error";

// Đọc và sửa trong cùng transaction để hai yêu cầu không cùng bán một ghế.
export async function runTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!hasDatabaseCode(error, "P2034") || attempt === 2) throw error;
    }
  }
  throw new Error("Transaction retry exhausted");
}
