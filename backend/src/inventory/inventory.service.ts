import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Database } from "../common/database";
import { AdjustmentDto, ConversionDto, PackagingDto } from "./dto";

@Injectable()
export class InventoryService {
  constructor(private db: Database) {}

  private transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(fn, {
      isolationLevel: "Serializable",
      timeout: 15000,
    });
  }

  async configurePackaging(id: string, dto: PackagingDto, actor: string) {
    if (id === dto.boxProductId)
      throw new BadRequestException(
        "La máster y la caja deben ser productos distintos",
      );

    return this.transaction(async (tx) => {
      const master = await tx.product.findUnique({ where: { id } });
      const box = await tx.product.findUnique({
        where: { id: dto.boxProductId },
      });
      if (!master || !box)
        throw new NotFoundException("Producto no encontrado");
      if (!master.active || !box.active)
        throw new BadRequestException("Los productos deben estar activos");
      const containingMaster = await tx.product.findFirst({
        where: { boxProductId: id },
      });
      if (box.boxProductId || containingMaster)
        throw new BadRequestException(
          "La relación debe ser de máster a caja pequeña, sin niveles intermedios",
        );

      const product = await tx.product.update({ where: { id }, data: dto });
      await tx.auditLog.create({
        data: { actorId: actor, action: "product.packaging", entityId: id },
      });
      return product;
    });
  }

  async convert(dto: ConversionDto, actor: string) {
    return this.transaction(async (tx) => {
      const existing = await tx.stockConversion.findUnique({
        where: { requestKey: dto.requestKey },
      });
      if (existing) {
        if (
          existing.masterProductId !== dto.masterProductId ||
          existing.masterQuantity !== dto.masterQuantity
        )
          throw new ConflictException("Clave utilizada para otra conversión");
        return existing;
      }

      const master = await tx.product.findUnique({
        where: { id: dto.masterProductId },
      });
      if (!master) throw new NotFoundException("Máster no encontrada");
      if (!master.boxProductId || !master.boxesPerMaster)
        throw new BadRequestException(
          "Configura primero las cajas que contiene la máster",
        );
      const box = await tx.product.findUniqueOrThrow({
        where: { id: master.boxProductId },
      });
      if (!master.active || !box.active)
        throw new BadRequestException("Los productos deben estar activos");

      const boxQuantity = dto.masterQuantity * master.boxesPerMaster;
      if (box.stock + boxQuantity > 2147483647)
        throw new ConflictException(
          "El stock de cajas excede el límite permitido",
        );
      const unitCost = master.cost
        .div(master.boxesPerMaster)
        .toDecimalPlaces(2);
      const changed = await tx.product.updateMany({
        where: { id: master.id, stock: { gte: dto.masterQuantity } },
        data: { stock: { decrement: dto.masterQuantity } },
      });
      if (changed.count !== 1)
        throw new ConflictException("Stock de máster insuficiente");
      await tx.product.update({
        where: { id: box.id },
        data: { stock: { increment: boxQuantity }, cost: unitCost },
      });
      const conversion = await tx.stockConversion.create({
        data: {
          ...dto,
          boxProductId: box.id,
          boxesPerMaster: master.boxesPerMaster,
          boxQuantity,
          unitCost,
          createdBy: actor,
        },
      });
      await tx.stockMovement.createMany({
        data: [
          {
            productId: master.id,
            quantity: -dto.masterQuantity,
            reason: "MASTER_OPENED",
            reference: conversion.id,
            createdBy: actor,
          },
          {
            productId: box.id,
            quantity: boxQuantity,
            reason: "BOXES_RECEIVED",
            reference: conversion.id,
            createdBy: actor,
          },
        ],
      });
      await tx.auditLog.create({
        data: {
          actorId: actor,
          action: "inventory.convert",
          entityId: conversion.id,
        },
      });
      return conversion;
    });
  }

  async adjust(dto: AdjustmentDto, actor: string) {
    if (dto.delta === 0)
      throw new BadRequestException("El ajuste no puede ser 0");

    return this.transaction(async (tx) => {
      const existing = await tx.stockAdjustment.findUnique({
        where: { requestKey: dto.requestKey },
      });
      if (existing) {
        if (
          existing.productId !== dto.productId ||
          existing.delta !== dto.delta ||
          existing.reason !== dto.reason ||
          (existing.notes ?? null) !== (dto.notes ?? null)
        ) {
          throw new ConflictException("Clave utilizada para otro ajuste");
        }
        return existing;
      }

      const product = await tx.product.findUnique({
        where: { id: dto.productId },
      });
      if (!product) throw new NotFoundException("Producto no encontrado");

      if (dto.delta < 0) {
        const changed = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: -dto.delta } },
          data: { stock: { decrement: -dto.delta } },
        });
        if (changed.count !== 1)
          throw new ConflictException("Stock insuficiente para descontar");
      } else {
        if (product.stock + dto.delta > 2147483647) {
          throw new ConflictException("El stock excede el límite permitido");
        }
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { increment: dto.delta } },
        });
      }

      const adjustment = await tx.stockAdjustment.create({
        data: {
          requestKey: dto.requestKey,
          productId: dto.productId,
          delta: dto.delta,
          reason: dto.reason,
          notes: dto.notes ?? null,
          createdBy: actor,
        },
      });
      await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          quantity: dto.delta,
          reason: dto.reason,
          reference: adjustment.id,
          createdBy: actor,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor,
          action: "inventory.adjust",
          entityId: adjustment.id,
        },
      });
      return adjustment;
    });
  }
}
