import { Prisma, Sale, SaleItem } from "@prisma/client";

export async function restoreCancelledSale(
  tx: Prisma.TransactionClient,
  sale: Sale & { items: SaleItem[] },
  actor: string,
  reason: string,
) {
  if (sale.status === "CANCELLED") return sale;
  for (const item of [...sale.items].sort((a, b) =>
    a.productId.localeCompare(b.productId),
  )) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        productId: item.productId,
        quantity: item.quantity,
        reason: "SALE_CANCEL",
        reference: sale.id,
        createdBy: actor,
      },
    });
  }
  const updated = await tx.sale.update({
    where: { id: sale.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledBy: actor,
      cancelReason: reason,
    },
    include: { items: true, payments: true },
  });
  await tx.auditLog.create({
    data: { actorId: actor, action: "sale.cancel", entityId: sale.id },
  });
  return updated;
}
