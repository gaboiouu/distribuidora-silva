import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { IgvType, InvoiceType, Prisma, SunatStatus } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { Database } from "../common/database";
import { config } from "../config";
import { IssueCreditNoteDto, IssueGuideDto, IssueSaleInvoiceDto } from "./dto";
import { NubefactClient, SunatSendResult } from "./nubefact.client";
import { restoreCancelledSale } from "../operations/sale-cancellation";
import { parseBusinessDate } from "../common/date";

const money = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const fingerprint = (dto: object) =>
  createHash("sha256")
    .update(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(dto).sort(([a], [b]) => a.localeCompare(b)),
        ),
      ),
    )
    .digest("hex");

function formatPeruDate(date: Date) {
  const peru = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  const dd = String(peru.getUTCDate()).padStart(2, "0");
  const mm = String(peru.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = peru.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function nubefactDocType(type: InvoiceType) {
  if (type === InvoiceType.FACTURA) return 1;
  if (type === InvoiceType.BOLETA) return 2;
  if (type === InvoiceType.NOTA_CREDITO) return 3;
  return 7;
}

@Injectable()
export class BillingService {
  constructor(
    private db: Database,
    private nubefact: NubefactClient,
  ) {}

  private ensureProvider() {
    if (config.BILLING_PROVIDER !== "NUBEFACT")
      throw new ServiceUnavailableException("La facturación electrónica está desactivada hasta configurar el proveedor elegido");
  }

  private transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(fn, {
      isolationLevel: "Serializable",
      timeout: 15000,
    });
  }

  private resolveCustomerDoc(
    invoiceType: "FACTURA" | "BOLETA",
    total: Prisma.Decimal,
    customer: { name: string; document: string | null; address: string | null },
    dto: IssueSaleInvoiceDto,
  ) {
    const doc = dto.customerDocument ?? customer.document ?? undefined;
    let docType = dto.customerDocumentType;
    if (!docType) {
      if (doc && /^\d{11}$/.test(doc)) docType = "6";
      else if (doc && /^\d{8}$/.test(doc)) docType = "1";
      else docType = "-";
    }

    if (invoiceType === "FACTURA") {
      if (docType !== "6" || !doc || !/^\d{11}$/.test(doc)) {
        throw new BadRequestException(
          "Para emitir factura el cliente debe tener RUC de 11 dígitos",
        );
      }
    } else {
      if (docType === "6" && (!doc || !/^\d{11}$/.test(doc))) {
        throw new BadRequestException("El RUC debe tener 11 dígitos");
      }
      if (docType === "1" && (!doc || !/^\d{8}$/.test(doc))) {
        throw new BadRequestException("El DNI debe tener 8 dígitos");
      }
      if (docType === "-" && total.gt(700)) {
        throw new BadRequestException(
          "Boletas mayores a S/ 700.00 requieren DNI o RUC del cliente",
        );
      }
    }

    return {
      docType,
      docNumber: docType === "-" ? "-" : (doc ?? "-"),
      name: dto.customerName ?? customer.name,
      address: dto.customerAddress ?? customer.address ?? "-",
    };
  }

  private computeBreakdown(
    items: {
      quantity: number;
      unitPrice: Prisma.Decimal;
      product: { sku: string; name: string; presentation: string };
    }[],
    igvType: IgvType,
  ) {
    let subtotal = money(0);
    let igv = money(0);
    let total = money(0);

    const mappedItems = items.map((item) => {
      const lineTotal = item.unitPrice.mul(item.quantity).toDecimalPlaces(2);
      let lineSubtotal: Prisma.Decimal;
      let lineIgv: Prisma.Decimal;
      let valorUnitario: Prisma.Decimal;
      let tipoIgvCode: number;

      if (igvType === IgvType.GRAVADO) {
        valorUnitario = item.unitPrice.div("1.18").toDecimalPlaces(6);
        lineSubtotal = lineTotal.div("1.18").toDecimalPlaces(2);
        lineIgv = lineTotal.minus(lineSubtotal);
        tipoIgvCode = 1;
      } else if (igvType === IgvType.EXONERADO) {
        valorUnitario = item.unitPrice;
        lineSubtotal = lineTotal;
        lineIgv = money(0);
        tipoIgvCode = 8;
      } else {
        valorUnitario = item.unitPrice;
        lineSubtotal = lineTotal;
        lineIgv = money(0);
        tipoIgvCode = 9;
      }

      subtotal = subtotal.plus(lineSubtotal);
      igv = igv.plus(lineIgv);
      total = total.plus(lineTotal);

      return {
        unidad_de_medida: "NIU",
        codigo: item.product.sku,
        descripcion: `${item.product.name} (${item.product.presentation})`,
        cantidad: item.quantity,
        valor_unitario: Number(valorUnitario.toFixed(6)),
        precio_unitario: Number(item.unitPrice.toFixed(2)),
        subtotal: Number(lineSubtotal.toFixed(2)),
        tipo_de_igv: tipoIgvCode,
        igv: Number(lineIgv.toFixed(2)),
        total: Number(lineTotal.toFixed(2)),
        anticipo_regularizacion: false,
      };
    });

    return { subtotal, igv, total, mappedItems };
  }

  private async persistSunatResult(
    invoiceId: string,
    result: SunatSendResult,
    actor: string,
    lockToken: string,
  ) {
    return this.transaction(async (tx) => {
      const current = await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
      });
      if (current.syncLockToken !== lockToken)
        throw new ConflictException(
          "La sincronización fue retomada por otra solicitud",
        );
      // Una consulta fallida conserva el último resultado fiscal confirmado.
      if (
        result.providerError ||
        (current.sunatAccepted && !result.sunatAccepted)
      ) {
        return tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: current.sunatAccepted ? current.status : SunatStatus.ERROR,
            lastSyncedAt: new Date(),
            lastSyncError: result.sunatDescription,
            sunatDescription: current.sunatAccepted
              ? current.sunatDescription
              : result.sunatDescription,
          },
        });
      }
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: result.status,
          sunatAccepted: result.sunatAccepted,
          sunatDescription: result.sunatDescription ?? null,
          sunatNote: result.sunatNote ?? null,
          sunatResponseCode: result.sunatResponseCode ?? null,
          sunatSoapError: result.sunatSoapError ?? null,
          hashCode: result.hashCode || current.hashCode,
          qrString: result.qrString || current.qrString,
          pdfUrl: result.pdfUrl || current.pdfUrl,
          xmlUrl: result.xmlUrl || current.xmlUrl,
          cdrUrl: result.cdrUrl || current.cdrUrl,
          providerResponse: result.rawResponse
            ? (result.rawResponse as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          lastSyncedAt: new Date(),
          lastSyncError: null,
          voided: current.voided || result.voided,
        },
      });
      if (
        updated.type === InvoiceType.NOTA_CREDITO &&
        updated.sunatAccepted &&
        updated.cancelSaleOnAcceptance &&
        updated.saleId
      ) {
        const sale = await tx.sale.findUniqueOrThrow({
          where: { id: updated.saleId },
          include: { items: true },
        });
        await restoreCancelledSale(
          tx,
          sale,
          actor,
          `Nota de crédito ${updated.serie}-${updated.number}: ${updated.creditNoteReason}`,
        );
      }
      await tx.auditLog.create({
        data: {
          actorId: actor,
          action: `invoice.sunat_${result.status.toLowerCase()}`,
          entityId: invoiceId,
        },
      });
      return updated;
    });
  }

  async issueSaleInvoice(
    saleId: string,
    dto: IssueSaleInvoiceDto,
    actor: string,
  ) {
    this.ensureProvider();
    const reserved = await this.transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({
        where: { requestKey: dto.requestKey },
      });
      if (existing) {
        if (
          existing.saleId !== saleId ||
          existing.type !== dto.type ||
          (existing.requestFingerprint &&
            existing.requestFingerprint !== fingerprint(dto))
        ) {
          throw new ConflictException("Clave utilizada para otro comprobante");
        }
        return { existing, created: false };
      }

      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          customer: true,
          items: { include: { product: true } },
          returns: { include: { items: true } },
          invoices: true,
        },
      });
      if (!sale) throw new NotFoundException("Venta no encontrada");
      if (sale.status === "CANCELLED") {
        throw new ConflictException(
          "No se puede emitir comprobante de una venta anulada",
        );
      }
      const alreadyHasActiveFiscal = sale.invoices.some(
        (inv) =>
          (inv.type === InvoiceType.FACTURA ||
            inv.type === InvoiceType.BOLETA) &&
          inv.status !== SunatStatus.REJECTED,
      );
      if (alreadyHasActiveFiscal) {
        throw new ConflictException(
          "Esta venta ya tiene una boleta o factura registrada",
        );
      }

      const invoiceType =
        dto.type === "FACTURA" ? InvoiceType.FACTURA : InvoiceType.BOLETA;
      const igvType = dto.igvType ?? IgvType.GRAVADO;
      const party = this.resolveCustomerDoc(
        dto.type,
        sale.total,
        sale.customer,
        dto,
      );
      const serie =
        dto.serie ??
        (dto.type === "FACTURA"
          ? config.SUNAT_FACTURA_SERIE
          : config.SUNAT_BOLETA_SERIE);
      if (!serie.startsWith(dto.type === "FACTURA" ? "F" : "B")) {
        throw new BadRequestException(
          "La serie no corresponde al tipo de comprobante",
        );
      }
      const balance = sale.total.minus(sale.paid);
      if (
        sale.dueAt &&
        balance.gt(0) &&
        formatPeruDate(sale.dueAt) !== formatPeruDate(new Date()) &&
        sale.dueAt < new Date()
      ) {
        throw new BadRequestException(
          "Actualiza la fecha de vencimiento antes de facturar una venta al crédito vencida",
        );
      }

      const seq = await tx.invoiceSequence.upsert({
        where: { serie },
        create: { serie, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });

      const returnedByProduct = new Map<string, number>();
      for (const returned of sale.returns) for (const item of returned.items)
        returnedByProduct.set(item.productId, (returnedByProduct.get(item.productId) ?? 0) + item.quantity);
      const netItems = sale.items.map(item => ({ ...item, quantity: item.quantity - (returnedByProduct.get(item.productId) ?? 0) })).filter(item => item.quantity > 0);
      const { subtotal, igv, total, mappedItems } = this.computeBreakdown(
        netItems,
        igvType,
      );
      const fecha = formatPeruDate(new Date());

      const payload: Record<string, unknown> = {
        operacion: "generar_comprobante",
        tipo_de_comprobante: nubefactDocType(invoiceType),
        serie,
        numero: seq.lastNumber,
        sunat_transaction: 1,
        cliente_tipo_de_documento: party.docType,
        cliente_numero_de_documento: party.docNumber,
        cliente_denominacion: party.name,
        cliente_direccion: party.address,
        fecha_de_emision: fecha,
        condiciones_de_pago:
          sale.dueAt && balance.gt(0) ? "CRÉDITO" : "CONTADO",
        ...(sale.dueAt && balance.gt(0)
          ? {
              fecha_de_vencimiento: formatPeruDate(sale.dueAt),
              venta_al_credito: [
                {
                  cuota: 1,
                  fecha_de_pago: formatPeruDate(sale.dueAt),
                  importe: Number(balance.toFixed(2)),
                },
              ],
            }
          : {}),
        moneda: 1,
        porcentaje_de_igv: 18.0,
        total_gravada:
          igvType === IgvType.GRAVADO ? Number(subtotal.toFixed(2)) : 0,
        total_exonerada:
          igvType === IgvType.EXONERADO ? Number(subtotal.toFixed(2)) : 0,
        total_inafecta:
          igvType === IgvType.INAFECTO ? Number(subtotal.toFixed(2)) : 0,
        total_igv: Number(igv.toFixed(2)),
        total: Number(total.toFixed(2)),
        enviar_automaticamente_a_la_sunat: true,
        enviar_automaticamente_al_cliente: false,
        items: mappedItems,
      };

      const invoice = await tx.invoice.create({
        data: {
          requestKey: dto.requestKey,
          requestFingerprint: fingerprint(dto),
          saleId: sale.id,
          type: invoiceType,
          serie,
          number: seq.lastNumber,
          customerDocumentType: party.docType,
          customerDocument: party.docNumber,
          customerName: party.name,
          customerAddress: party.address,
          igvType,
          subtotal,
          igv,
          total,
          providerPayload: payload as Prisma.InputJsonValue,
          createdBy: actor,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor,
          action: "invoice.create",
          entityId: invoice.id,
        },
      });
      return { existing: invoice, created: true, payload };
    });

    if (!reserved.created) return reserved.existing;
    return this.syncInvoice(reserved.existing.id, actor);
  }

  async issueCreditNote(
    invoiceId: string,
    dto: IssueCreditNoteDto,
    actor: string,
  ) {
    this.ensureProvider();
    const reserved = await this.transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({
        where: { requestKey: dto.requestKey },
      });
      if (existing) {
        if (
          existing.relatedInvoiceId !== invoiceId ||
          (existing.requestFingerprint &&
            existing.requestFingerprint !== fingerprint(dto))
        ) {
          throw new ConflictException(
            "Clave utilizada para otra nota de crédito",
          );
        }
        return { existing, created: false };
      }

      const target = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          sale: { include: { items: { include: { product: true } } } },
        },
      });
      if (!target) throw new NotFoundException("Comprobante no encontrado");
      if (
        target.type !== InvoiceType.FACTURA &&
        target.type !== InvoiceType.BOLETA
      ) {
        throw new BadRequestException(
          "La nota de crédito solo aplica a facturas o boletas",
        );
      }
      if (!target.sunatAccepted) {
        throw new ConflictException(
          "El comprobante original aún no está aceptado por SUNAT",
        );
      }
      if (target.voided)
        throw new ConflictException("El comprobante ya está anulado");
      if (
        await tx.invoice.findFirst({
          where: {
            relatedInvoiceId: target.id,
            type: InvoiceType.NOTA_CREDITO,
            status: { not: SunatStatus.REJECTED },
          },
        })
      ) {
        throw new ConflictException(
          "El comprobante ya tiene una nota de crédito total registrada",
        );
      }
      if (!target.sale) {
        throw new BadRequestException("Comprobante sin venta asociada");
      }

      const serie =
        dto.serie ??
        (target.type === InvoiceType.FACTURA
          ? config.SUNAT_NC_FACTURA_SERIE
          : config.SUNAT_NC_BOLETA_SERIE);
      if (!serie.startsWith(target.serie[0]))
        throw new BadRequestException(
          "La serie de la nota debe corresponder al comprobante original",
        );

      const seq = await tx.invoiceSequence.upsert({
        where: { serie },
        create: { serie, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });

      const originalPayload = target.providerPayload as Record<
        string,
        unknown
      > | null;
      if (!originalPayload || !Array.isArray(originalPayload.items))
        throw new BadRequestException(
          "Falta el detalle fiscal original para emitir la nota",
        );
      const { subtotal, igv, total } = target;
      const mappedItems = originalPayload.items;
      const creditCode = dto.creditNoteCode ?? "01";

      const payload: Record<string, unknown> = {
        operacion: "generar_comprobante",
        tipo_de_comprobante: nubefactDocType(InvoiceType.NOTA_CREDITO),
        serie,
        numero: seq.lastNumber,
        sunat_transaction: 1,
        cliente_tipo_de_documento: target.customerDocumentType,
        cliente_numero_de_documento: target.customerDocument,
        cliente_denominacion: target.customerName,
        cliente_direccion: target.customerAddress ?? "-",
        fecha_de_emision: formatPeruDate(new Date()),
        moneda: 1,
        porcentaje_de_igv: 18.0,
        total_gravada:
          target.igvType === IgvType.GRAVADO ? Number(subtotal.toFixed(2)) : 0,
        total_exonerada:
          target.igvType === IgvType.EXONERADO
            ? Number(subtotal.toFixed(2))
            : 0,
        total_inafecta:
          target.igvType === IgvType.INAFECTO ? Number(subtotal.toFixed(2)) : 0,
        total_igv: Number(igv.toFixed(2)),
        total: Number(total.toFixed(2)),
        documento_que_se_modifica_tipo: nubefactDocType(target.type),
        documento_que_se_modifica_serie: target.serie,
        documento_que_se_modifica_numero: target.number,
        tipo_de_nota_de_credito: Number(creditCode),
        observaciones: dto.reason,
        enviar_automaticamente_a_la_sunat: true,
        enviar_automaticamente_al_cliente: false,
        items: mappedItems,
      };

      const invoice = await tx.invoice.create({
        data: {
          requestKey: dto.requestKey,
          requestFingerprint: fingerprint(dto),
          cancelSaleOnAcceptance: dto.cancelSale ?? false,
          saleId: target.saleId,
          relatedInvoiceId: target.id,
          type: InvoiceType.NOTA_CREDITO,
          serie,
          number: seq.lastNumber,
          customerDocumentType: target.customerDocumentType,
          customerDocument: target.customerDocument,
          customerName: target.customerName,
          customerAddress: target.customerAddress,
          igvType: target.igvType,
          subtotal,
          igv,
          total,
          creditNoteCode: creditCode,
          creditNoteReason: dto.reason,
          providerPayload: payload as Prisma.InputJsonValue,
          createdBy: actor,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor,
          action: "invoice.credit_note_create",
          entityId: invoice.id,
        },
      });
      return {
        existing: invoice,
        created: true,
        payload,
        saleId: target.saleId,
      };
    });

    if (!reserved.created) return reserved.existing;
    return this.syncInvoice(reserved.existing.id, actor);
  }

  async issueGuide(saleId: string, dto: IssueGuideDto, actor: string) {
    this.ensureProvider();
    const reserved = await this.transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({
        where: { requestKey: dto.requestKey },
      });
      if (existing) {
        if (
          existing.saleId !== saleId ||
          existing.type !== InvoiceType.GUIA_REMISION ||
          (existing.requestFingerprint &&
            existing.requestFingerprint !== fingerprint(dto))
        ) {
          throw new ConflictException("Clave utilizada para otra guía");
        }
        return { existing, created: false };
      }

      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      });
      if (!sale) throw new NotFoundException("Venta no encontrada");
      if (sale.status === "CANCELLED") {
        throw new ConflictException(
          "No se puede emitir guía de una venta anulada",
        );
      }

      const doc = sale.customer.document ?? "-";
      const docType = /^\d{11}$/.test(doc)
        ? "6"
        : /^\d{8}$/.test(doc)
          ? "1"
          : "-";
      if (docType === "-")
        throw new BadRequestException(
          "La guía requiere identificar al destinatario con DNI o RUC",
        );
      if (money(dto.grossWeight).lte(0))
        throw new BadRequestException("El peso debe ser mayor a cero");
      const transportType = dto.transportType ?? (dto.carrierDoc ? "01" : "02");
      if (
        transportType === "01" &&
        (!dto.carrierDoc || !dto.carrierName || !dto.carrierDeliveryDate)
      ) {
        throw new BadRequestException(
          "El transporte público requiere RUC, razón social y fecha de entrega al transportista",
        );
      }
      if (
        transportType === "02" &&
        (!dto.driverDocument ||
          !dto.driverName ||
          !dto.driverLastName ||
          !dto.driverLicense)
      ) {
        throw new BadRequestException(
          "El transporte privado requiere documento, nombres, apellidos y licencia del conductor",
        );
      }
      const serie = dto.serie ?? config.SUNAT_GUIA_SERIE;
      const seq = await tx.invoiceSequence.upsert({
        where: { serie },
        create: { serie, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });

      const transferDate = parseBusinessDate(dto.transferStartDate);
      const payload: Record<string, unknown> = {
        operacion: "generar_guia",
        tipo_de_comprobante: nubefactDocType(InvoiceType.GUIA_REMISION),
        serie,
        numero: seq.lastNumber,
        cliente_tipo_de_documento: docType,
        cliente_numero_de_documento: doc,
        cliente_denominacion: sale.customer.name,
        cliente_direccion: dto.endAddress,
        fecha_de_emision: formatPeruDate(new Date()),
        motivo_de_traslado: dto.reasonCode ?? "01",
        peso_bruto_total: Number(dto.grossWeight),
        peso_bruto_unidad_de_medida: "KGM",
        numero_de_bultos: dto.packages,
        tipo_de_transporte: transportType,
        fecha_de_inicio_de_traslado: formatPeruDate(transferDate),
        fecha_de_entrega_al_transportista: dto.carrierDeliveryDate
          ? formatPeruDate(parseBusinessDate(dto.carrierDeliveryDate))
          : undefined,
        transportista_documento_tipo: transportType === "01" ? "6" : undefined,
        transportista_documento_numero: dto.carrierDoc,
        transportista_denominacion: dto.carrierName,
        transportista_placa_numero: dto.plate,
        conductor_documento_tipo:
          transportType === "02" ? (dto.driverDocumentType ?? "1") : undefined,
        conductor_documento_numero: dto.driverDocument,
        conductor_nombre: dto.driverName,
        conductor_apellidos: dto.driverLastName,
        conductor_numero_licencia: dto.driverLicense,
        punto_de_partida_ubigeo: dto.startUbigeo,
        punto_de_llegada_ubigeo: dto.endUbigeo,
        punto_de_partida_direccion: dto.startAddress,
        punto_de_llegada_direccion: dto.endAddress,
        enviar_automaticamente_al_cliente: false,
        items: sale.items.map((item) => ({
          unidad_de_medida: "NIU",
          codigo: item.product.sku,
          descripcion: `${item.product.name} (${item.product.presentation})`,
          cantidad: item.quantity,
        })),
      };

      const invoice = await tx.invoice.create({
        data: {
          requestKey: dto.requestKey,
          saleId: sale.id,
          type: InvoiceType.GUIA_REMISION,
          requestFingerprint: fingerprint(dto),
          serie,
          number: seq.lastNumber,
          customerDocumentType: docType,
          customerDocument: doc,
          customerName: sale.customer.name,
          customerAddress: dto.endAddress,
          igvType: IgvType.GRAVADO,
          subtotal: money(0),
          igv: money(0),
          total: sale.total,
          guideReasonCode: dto.reasonCode ?? "01",
          guideTransferStartDate: transferDate,
          guideGrossWeight: money(dto.grossWeight),
          guidePackages: dto.packages,
          guideStartAddress: dto.startAddress,
          guideEndAddress: dto.endAddress,
          guideCarrierDoc: dto.carrierDoc ?? null,
          guideCarrierName: dto.carrierName ?? null,
          guidePlate: dto.plate ?? null,
          providerPayload: payload as Prisma.InputJsonValue,
          createdBy: actor,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor,
          action: "invoice.guide_create",
          entityId: invoice.id,
        },
      });
      return { existing: invoice, created: true, payload };
    });

    if (!reserved.created) return reserved.existing;
    return this.syncInvoice(reserved.existing.id, actor);
  }

  async syncInvoice(id: string, actor: string) {
    this.ensureProvider();
    const lockToken = randomUUID();
    const claimed = await this.db.invoice.updateMany({
      where: {
        id,
        OR: [
          { syncLockedUntil: null },
          { syncLockedUntil: { lt: new Date() } },
        ],
      },
      data: {
        syncLockToken: lockToken,
        syncLockedUntil: new Date(Date.now() + 120000),
      },
    });
    if (claimed.count !== 1) {
      if (!(await this.db.invoice.findUnique({ where: { id } })))
        throw new NotFoundException("Comprobante no encontrado");
      throw new ConflictException("El comprobante ya se está sincronizando");
    }
    try {
      const invoice = await this.db.invoice.findUniqueOrThrow({
        where: { id },
      });
      const query = {
        operacion:
          invoice.type === InvoiceType.GUIA_REMISION
            ? "consultar_guia"
            : "consultar_comprobante",
        tipo_de_comprobante: nubefactDocType(invoice.type),
        serie: invoice.serie,
        numero: invoice.number,
      };
      let result = await this.nubefact.send(query);
      if (result.sunatResponseCode === "24" && !invoice.sunatAccepted) {
        const payload = invoice.providerPayload as Record<
          string,
          unknown
        > | null;
        if (!payload)
          throw new BadRequestException(
            "El comprobante no tiene datos de envío",
          );
        await this.db.invoice.update({
          where: { id, syncLockToken: lockToken },
          data: { sentAt: new Date() },
        });
        result = await this.nubefact.send(payload);
        if (result.sunatResponseCode === "23")
          result = await this.nubefact.send(query);
      } else if (
        !invoice.sentAt &&
        result.configured &&
        !result.providerError
      ) {
        result = {
          configured: true,
          status: SunatStatus.ERROR,
          sunatAccepted: false,
          providerError: true,
          sunatDescription:
            "La serie y número ya existen en NubeFact. Revisa el correlativo antes de vincular este comprobante",
        };
      }
      return await this.persistSunatResult(id, result, actor, lockToken);
    } finally {
      await this.db.invoice.updateMany({
        where: { id, syncLockToken: lockToken },
        data: { syncLockToken: null, syncLockedUntil: null },
      });
    }
  }

  configuration() {
    return {
      provider: config.BILLING_PROVIDER,
      configured: config.BILLING_PROVIDER === "NUBEFACT" && this.nubefact.isConfigured(),
      missing: [
        !config.NUBEFACT_API_URL && "NUBEFACT_API_URL",
        !config.NUBEFACT_TOKEN && "NUBEFACT_TOKEN",
      ].filter(Boolean),
      series: {
        factura: config.SUNAT_FACTURA_SERIE,
        boleta: config.SUNAT_BOLETA_SERIE,
        notaFactura: config.SUNAT_NC_FACTURA_SERIE,
        notaBoleta: config.SUNAT_NC_BOLETA_SERIE,
        guia: config.SUNAT_GUIA_SERIE,
      },
    };
  }

  async checkConnection() {
    this.ensureProvider();
    const result = await this.nubefact.send({
      operacion: "consultar_comprobante",
      tipo_de_comprobante: 1,
      serie: config.SUNAT_FACTURA_SERIE,
      numero: 1,
    });
    return {
      configured: result.configured,
      authenticated:
        result.configured &&
        (!result.providerError || result.sunatResponseCode === "24"),
      description:
        result.sunatResponseCode === "24"
          ? "NubeFact respondió con credenciales válidas; el comprobante consultado no existe"
          : result.sunatDescription,
    };
  }

  async configureSequence(serie: string, lastNumber: number, actor: string) {
    return this.transaction(async (tx) => {
      const current = await tx.invoiceSequence.findUnique({ where: { serie } });
      const lastInvoice = await tx.invoice.aggregate({
        where: { serie },
        _max: { number: true },
      });
      if (
        lastNumber <
        Math.max(current?.lastNumber ?? 0, lastInvoice._max.number ?? 0)
      )
        throw new ConflictException("El correlativo no puede retroceder");
      const sequence = await tx.invoiceSequence.upsert({
        where: { serie },
        create: { serie, lastNumber },
        update: { lastNumber },
      });
      await tx.auditLog.create({
        data: { actorId: actor, action: "invoice.sequence", entityId: serie },
      });
      return sequence;
    });
  }
}
