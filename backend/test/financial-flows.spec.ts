import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { OperationsService } from "../src/operations/operations.service";
import { Database } from "../src/common/database";

const decimal = (value: string) => new Prisma.Decimal(value);

describe("Compras con tarjeta y devoluciones", () => {
  it("registra cuotas cuyo total coincide con la compra y permite marcar una pagada", async () => {
    const purchaseId = randomUUID();
    const installmentId = randomUUID();
    const tx = {
      purchase: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: purchaseId }),
      },
      purchaseInstallment: {
        findUnique: jest.fn().mockResolvedValue({ id: installmentId, purchaseId, paidAt: null }),
        update: jest.fn().mockResolvedValue({ id: installmentId, purchaseId, paidAt: new Date() }),
      },
      product: { update: jest.fn() },
      stockMovement: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const db = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) } as unknown as Database;
    const service = new OperationsService(db);
    const productId = randomUUID();
    const actor = randomUUID();
    await service.purchase({
      requestKey: randomUUID(), supplierId: randomUUID(),
      items: [{ productId, quantity: 2, unitCost: "50.00" }],
      paymentMethod: "CARD", cardName: "Visa BCP",
      installments: [{ amount: "40.00", dueAt: "2026-12-15" }, { amount: "60.00", dueAt: "2027-01-15" }],
    }, actor);
    const payload = tx.purchase.create.mock.calls[0][0].data;
    expect(payload.installments.create).toHaveLength(2);
    expect(payload.installments.create.map((item: { amount: string }) => item.amount)).toEqual(["40.00", "60.00"]);
    await service.payPurchaseInstallment(purchaseId, installmentId, actor);
    expect(tx.purchaseInstallment.update).toHaveBeenCalledTimes(1);
  });

  it("rechaza cuotas que no cubren la compra antes de alterar inventario", async () => {
    const tx = {
      purchase: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      product: { update: jest.fn() }, stockMovement: { create: jest.fn() }, auditLog: { create: jest.fn() },
    };
    const service = new OperationsService({ $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) } as unknown as Database);
    await expect(service.purchase({ requestKey: randomUUID(), supplierId: randomUUID(), items: [{ productId: randomUUID(), quantity: 2, unitCost: "50.00" }], paymentMethod: "CARD", cardName: "Visa", installments: [{ amount: "90.00", dueAt: "2026-12-15" }] }, randomUUID())).rejects.toThrow("sumar el total");
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it("descuenta la devolución de la deuda, reintegra cajas y registra solo el dinero realmente devuelto", async () => {
    const productId = randomUUID();
    const saleId = randomUUID();
    const tx = {
      saleReturn: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: randomUUID(), items: [] }),
      },
      sale: {
        findUnique: jest.fn().mockResolvedValue({
          id: saleId, status: "ACTIVE", total: decimal("100.00"), paid: decimal("80.00"),
          items: [{ productId, quantity: 10, unitPrice: decimal("10.00"), unitCost: decimal("7.00") }],
          returns: [], invoices: [],
        }),
        update: jest.fn(),
      },
      product: { update: jest.fn() },
      stockMovement: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const db = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) } as unknown as Database;
    const service = new OperationsService(db);
    await service.returnSale(saleId, { requestKey: randomUUID(), reason: "Cliente devolvió cuatro displays", items: [{ productId, quantity: 4 }], refundMethod: "YAPE" }, randomUUID());
    const returnData = tx.saleReturn.create.mock.calls[0][0].data;
    expect(returnData.creditAmount.toFixed(2)).toBe("40.00");
    expect(returnData.refundAmount.toFixed(2)).toBe("20.00");
    expect(tx.sale.update.mock.calls[0][0].data.total.toFixed(2)).toBe("60.00");
    expect(tx.sale.update.mock.calls[0][0].data.paid.toFixed(2)).toBe("60.00");
    expect(tx.product.update).toHaveBeenCalledWith(expect.objectContaining({ data: { stock: { increment: 4 } } }));
  });

  it("no devuelve dos veces la misma caja", async () => {
    const productId = randomUUID();
    const saleId = randomUUID();
    const tx = {
      saleReturn: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      sale: { findUnique: jest.fn().mockResolvedValue({
        id: saleId, status: "ACTIVE", total: decimal("60.00"), paid: decimal("0.00"),
        items: [{ productId, quantity: 10, unitPrice: decimal("10.00"), unitCost: decimal("7.00") }],
        returns: [{ items: [{ productId, quantity: 4 }] }], invoices: [],
      }) },
      product: { update: jest.fn() }, stockMovement: { create: jest.fn() }, auditLog: { create: jest.fn() },
    };
    const service = new OperationsService({ $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) } as unknown as Database);
    await expect(service.returnSale(saleId, { requestKey: randomUUID(), reason: "Cliente devuelve mercadería", items: [{ productId, quantity: 7 }] }, randomUUID())).rejects.toThrow("excede las cajas");
    expect(tx.saleReturn.create).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });
});
