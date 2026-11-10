import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Database } from "../common/database";
import {
  SaleDto,
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
          (existing.dueAt?.toISOString() ?? null) !==
            (dto.dueAt ? new Date(dto.dueAt).toISOString() : null) ||
          canonical(existing.items) !== canonical(dto.items)
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
        total = total.plus(product.price.mul(item.quantity));
        items.push({
          ...item,
          unitPrice: product.price,
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
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
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
        include: { items: true },
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
          canonical(existing.items) !== canonical(dto.items)
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
      const purchase = await tx.purchase.create({
        data: {
          requestKey: dto.requestKey,
          supplierId: dto.supplierId,
          total,
          createdBy: actor,
          items: { create: dto.items },
        },
        include: { items: true },
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
}
