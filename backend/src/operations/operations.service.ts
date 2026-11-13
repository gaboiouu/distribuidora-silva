import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Database } from "../common/database";
import { restoreCancelledSale } from "./sale-cancellation";
import { parseBusinessDate } from "../common/date";
import {
  CancelSaleDto,
  SaleDto,
  SaleReturnDto,
  PurchaseDto,
  PaymentDto,
  ExpenseDto,
  DeliveryDto,
} from "./dto";
const money = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
@Injectable()
export class OperationsService {
  constructor(private db: Database) {}
  private transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(fn, {
      isolationLevel: "Serializable",
      timeout: 15000,
    });
  }
  private uniqueItems(items: { productId: string }[]) {
    if (new Set(items.map((i) => i.productId)).size !== items.length)
      throw new BadRequestException("Agrupa las cantidades del mismo producto");
  }
  async sale(dto: SaleDto, actor: string) {
    this.uniqueItems(dto.items);
    return this.transaction(async (tx) => {
      const existing = await tx.sale.findUnique({
        where: { requestKey: dto.requestKey },
        include: { items: true },
      });
      if (existing) {
        const canonical = (items: { productId: string; quantity: number }[]) =>
          JSON.stringify(
            items
              .map((i) => ({ productId: i.productId, quantity: i.quantity }))
              .sort((a, b) => a.productId.localeCompare(b.productId)),
          );
        if (
          existing.customerId !== dto.customerId ||
          !(
            dto.dueAt
              ? [
                  parseBusinessDate(dto.dueAt).toISOString(),
                  new Date(dto.dueAt).toISOString(),
                ]
              : [null]
          ).some((date) => date === (existing.dueAt?.toISOString() ?? null)) ||
          canonical(existing.items) !== canonical(dto.items) ||
          !dto.items.every((i) => {
            if (!i.unitPrice) return true;
            const saved = existing.items.find(
              (s) => s.productId === i.productId,
            );
            return !!saved && saved.unitPrice.equals(i.unitPrice);
          })
        )
          throw new ConflictException("Clave utilizada para otra venta");
        return existing;
      }
      const items = [];
      let total = money(0);
      for (const item of [...dto.items].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      )) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product?.active)
          throw new BadRequestException("Producto no disponible");
        const changed = await tx.product.updateMany({
          where: {
            id: product.id,
            active: true,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } },
        });
        if (changed.count !== 1)
          throw new ConflictException("Stock insuficiente");
        const unitPrice = item.unitPrice
          ? money(item.unitPrice)
          : product.price;
        if (unitPrice.lte(0))
          throw new BadRequestException("El precio debe ser positivo");
        total = total.plus(unitPrice.mul(item.quantity));
        items.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          unitCost: product.cost,
        });
      }
      if (total.lte(0) || total.gt("9999999999.99"))
        throw new BadRequestException("Total fuera de rango");
      const sale = await tx.sale.create({
        data: {
          requestKey: dto.requestKey,
          customerId: dto.customerId,
          total,
          dueAt: dto.dueAt ? parseBusinessDate(dto.dueAt) : null,
          createdBy: actor,
          items: { create: items },
        },
        include: { items: true },
      });
      await tx.stockMovement.createMany({
        data: items.map((i) => ({
          productId: i.productId,
          quantity: -i.quantity,
          reason: "SALE",
          reference: sale.id,
          createdBy: actor,
        })),
      });
      await tx.auditLog.create({
        data: { actorId: actor, action: "sale.create", entityId: sale.id },
      });
      return sale;
    });
  }
  async purchase(dto: PurchaseDto, actor: string) {
    this.uniqueItems(dto.items);
    return this.transaction(async (tx) => {
      const existing = await tx.purchase.findUnique({
        where: { requestKey: dto.requestKey },
        include: { items: true, installments: true },
      });
      if (existing) {
        const canonical = (
          items: {
            productId: string;
            quantity: number;
            unitCost: Prisma.Decimal.Value;
          }[],
        ) =>
          JSON.stringify(
            items
              .map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitCost: money(i.unitCost).toFixed(2),
              }))
              .sort((a, b) => a.productId.localeCompare(b.productId)),
          );
        if (
          existing.supplierId !== dto.supplierId ||
          (dto.purchasedAt ? existing.purchasedAt.toISOString().slice(0, 10) !== dto.purchasedAt.slice(0, 10) : false) ||
          canonical(existing.items) !== canonical(dto.items) ||
          existing.paymentMethod !== (dto.paymentMethod ?? "CASH") ||
          (existing.cardName ?? null) !== (dto.cardName?.trim() ?? null) ||
          JSON.stringify(existing.installments.map(i => ({ number: i.number, amount: i.amount.toFixed(2), dueAt: i.dueAt.toISOString().slice(0, 10) })).sort((a, b) => a.number - b.number)) !==
          JSON.stringify((dto.installments ?? []).map((i, index) => ({ number: index + 1, amount: i.amount, dueAt: i.dueAt })))
        )
          throw new ConflictException("Clave utilizada para otra compra");
        return existing;
      }
      const total = dto.items.reduce(
        (sum, i) => sum.plus(money(i.unitCost).mul(i.quantity)),
        money(0),
      );
      if (total.lte(0) || total.gt("9999999999.99"))
        throw new BadRequestException("Total fuera de rango");
      const method = dto.paymentMethod ?? "CASH";
      if (method === "CARD") {
        if (!dto.cardName?.trim() || !dto.installments?.length)
          throw new BadRequestException("Indica la tarjeta y cada cuota con monto y vencimiento");
        const installmentTotal = dto.installments.reduce((sum, i) => sum.plus(money(i.amount)), money(0));
        if (dto.installments.some(i => money(i.amount).lte(0)) || !installmentTotal.equals(total))
          throw new BadRequestException("Las cuotas deben ser positivas y sumar el total de la compra");
      } else if (dto.cardName || dto.installments?.length) {
        throw new BadRequestException("Las cuotas y tarjeta solo aplican a compras con tarjeta");
      }
      const purchase = await tx.purchase.create({
        data: {
          requestKey: dto.requestKey,
          supplierId: dto.supplierId,
          purchasedAt: dto.purchasedAt ? parseBusinessDate(dto.purchasedAt) : new Date(),
          total,
          paymentMethod: method,
          cardName: method === "CARD" ? dto.cardName!.trim() : null,
          createdBy: actor,
          items: { create: dto.items },
          installments: method === "CARD" ? { create: dto.installments!.map((i, index) => ({ number: index + 1, amount: i.amount, dueAt: parseBusinessDate(i.dueAt) })) } : undefined,
        },
        include: { items: true, installments: true },
      });
      for (const item of [...dto.items].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      )) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity }, cost: item.unitCost },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            reason: "PURCHASE",
            reference: purchase.id,
            createdBy: actor,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor,
          action: "purchase.create",
          entityId: purchase.id,
        },
      });
      return purchase;
    });
  }
  async payPurchaseInstallment(purchaseId: string, installmentId: string, actor: string) {
    return this.transaction(async (tx) => {
      const installment = await tx.purchaseInstallment.findUnique({ where: { id: installmentId } });
      if (!installment || installment.purchaseId !== purchaseId)
        throw new NotFoundException("Cuota no encontrada");
      if (installment.paidAt) return installment;
      const paid = await tx.purchaseInstallment.update({ where: { id: installmentId }, data: { paidAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: actor, action: "purchase.installment_paid", entityId: installmentId } });
      return paid;
    });
  }
  async payment(saleId: string, dto: PaymentDto, actor: string) {
    const amount = money(dto.amount);
    if (amount.lte(0))
      throw new BadRequestException("El pago debe ser positivo");
    return this.transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { requestKey: dto.requestKey },
      });
      if (existing) {
        if (
          existing.saleId !== saleId ||
          !existing.amount.equals(amount) ||
          existing.method !== dto.method
        )
          throw new ConflictException("Clave utilizada para otro pago");
        return existing;
      }
      const sale = await tx.sale.findUnique({ where: { id: saleId } });
      if (!sale) throw new NotFoundException("Venta no encontrada");
      if (sale.status === "CANCELLED")
        throw new ConflictException("La venta está anulada");
      if (sale.paid.plus(amount).gt(sale.total))
        throw new ConflictException("El pago excede el saldo");
      await tx.sale.update({
        where: { id: saleId },
        data: { paid: { increment: amount } },
      });
      const payment = await tx.payment.create({
        data: { ...dto, saleId, createdBy: actor },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor,
          action: "payment.create",
          entityId: payment.id,
        },
      });
      return payment;
    });
  }
  async expense(dto: ExpenseDto, actor: string) {
    if (money(dto.amount).lte(0))
      throw new BadRequestException("El gasto debe ser positivo");
    return this.transaction(async (tx) => {
      const existing = await tx.expense.findUnique({
        where: { requestKey: dto.requestKey },
      });
      if (existing) {
        if (
          existing.description !== dto.description ||
          !existing.amount.equals(dto.amount)
        )
          throw new ConflictException("Clave utilizada para otro gasto");
        return existing;
      }
      const expense = await tx.expense.create({
        data: { ...dto, createdBy: actor },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor,
          action: "expense.create",
          entityId: expense.id,
        },
      });
      return expense;
    });
  }
  async delivery(id: string, dto: DeliveryDto, actor: string) {
    return this.transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id } });
      if (!sale) throw new NotFoundException();
      if (sale.status === "CANCELLED")
        throw new ConflictException("La venta está anulada");
      const transitions: Record<string, string[]> = {
        PENDING: ["DISPATCHED", "PICKED_UP"],
        DISPATCHED: ["DELIVERED"],
        DELIVERED: [],
        PICKED_UP: [],
      };
      if (
        sale.delivery !== dto.status &&
        !transitions[sale.delivery].includes(dto.status)
      )
        throw new ConflictException("Transición de entrega inválida");
      const updated = await tx.sale.update({
        where: { id },
        data: { delivery: dto.status },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor,
          action: `delivery.${dto.status}`,
          entityId: id,
        },
      });
      return updated;
    });
  }

  async returnSale(saleId: string, dto: SaleReturnDto, actor: string) {
    this.uniqueItems(dto.items);
    return this.transaction(async (tx) => {
      const existing = await tx.saleReturn.findUnique({ where: { requestKey: dto.requestKey }, include: { items: true } });
      if (existing) {
        const requested = dto.items.map(i => `${i.productId}:${i.quantity}`).sort().join("|");
        const saved = existing.items.map(i => `${i.productId}:${i.quantity}`).sort().join("|");
        if (existing.saleId !== saleId || existing.reason !== dto.reason || existing.refundMethod !== (dto.refundMethod ?? null) || requested !== saved)
          throw new ConflictException("Clave utilizada para otra devolución");
        return existing;
      }
      const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { items: true, returns: { include: { items: true } }, invoices: true } });
      if (!sale) throw new NotFoundException("Venta no encontrada");
      if (sale.status !== "ACTIVE") throw new ConflictException("La venta ya está anulada");
      if (sale.invoices.some(i => i.status !== "REJECTED" && !i.voided))
        throw new ConflictException("La venta tiene un comprobante fiscal; registra primero la nota de crédito correspondiente");
      const returned = new Map<string, number>();
      for (const prior of sale.returns) for (const item of prior.items)
        returned.set(item.productId, (returned.get(item.productId) ?? 0) + item.quantity);
      let credit = money(0);
      const lines = dto.items.map(item => {
        const original = sale.items.find(i => i.productId === item.productId);
        if (!original || item.quantity > original.quantity - (returned.get(item.productId) ?? 0))
          throw new BadRequestException("Cantidad a devolver excede las cajas vendidas pendientes de devolución");
        credit = credit.plus(original.unitPrice.mul(item.quantity));
        return { productId: item.productId, quantity: item.quantity, unitPrice: original.unitPrice, unitCost: original.unitCost };
      });
      const newTotal = sale.total.minus(credit);
      if (newTotal.lt(0)) throw new ConflictException("Devolución excede el total de la venta");
      const newPaid = sale.paid.gt(newTotal) ? newTotal : sale.paid;
      const refund = sale.paid.minus(newPaid);
      if (refund.gt(0) && !dto.refundMethod)
        throw new BadRequestException(`Debes indicar cómo se devuelven S/ ${refund.toFixed(2)} al cliente`);
      if (refund.equals(0) && dto.refundMethod)
        throw new BadRequestException("No hay dinero cobrado que devolver en esta operación");
      const record = await tx.saleReturn.create({ data: {
        requestKey: dto.requestKey, saleId, reason: dto.reason, creditAmount: credit,
        refundAmount: refund, refundMethod: dto.refundMethod ?? null, createdBy: actor,
        items: { create: lines },
      }, include: { items: true } });
      for (const line of lines) {
        await tx.product.update({ where: { id: line.productId }, data: { stock: { increment: line.quantity } } });
        await tx.stockMovement.create({ data: { productId: line.productId, quantity: line.quantity, reason: "SALE_RETURN", reference: record.id, createdBy: actor } });
      }
      await tx.sale.update({ where: { id: saleId }, data: {
        total: newTotal, paid: newPaid,
        ...(newTotal.equals(0) ? { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: actor, cancelReason: dto.reason } : {}),
      } });
      await tx.auditLog.create({ data: { actorId: actor, action: "sale.return", entityId: record.id } });
      return record;
    });
  }
  async cancelSale(id: string, dto: CancelSaleDto, actor: string) {
    return this.transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: { items: true, invoices: true, returns: true },
      });
      if (!sale) throw new NotFoundException("Venta no encontrada");
      if (sale.status === "CANCELLED") return sale;
      if (sale.paid.gt(0)) throw new ConflictException("La venta tiene cobros. Registra una devolución para dejar constancia del dinero devuelto");
      if (sale.returns.length) throw new ConflictException("Esta venta ya tiene devoluciones. Devuelve las cajas restantes para cerrarla sin duplicar stock");

      const fiscalPending = sale.invoices.some(
        (invoice) =>
          (invoice.type === "FACTURA" || invoice.type === "BOLETA") &&
          invoice.status !== "REJECTED" &&
          !invoice.voided &&
          !sale.invoices.some(
            (note) =>
              note.relatedInvoiceId === invoice.id &&
              note.type === "NOTA_CREDITO" &&
              note.sunatAccepted &&
              !note.voided &&
              ["01", "06"].includes(note.creditNoteCode ?? ""),
          ),
      );
      if (fiscalPending)
        throw new ConflictException(
          "Sincroniza el comprobante y registra su nota de crédito total antes de anular la venta",
        );
      return restoreCancelledSale(tx, sale, actor, dto.reason);
    });
  }
}
