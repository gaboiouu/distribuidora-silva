import {
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Admin, AuthRequest } from "../auth/auth";
import { Database } from "../common/database";
import { BillingService } from "./billing.service";
import {
  InvoicesQueryDto,
  IssueCreditNoteDto,
  IssueGuideDto,
  IssueSaleInvoiceDto,
  SequenceDto,
} from "./dto";
import { NubefactClient } from "./nubefact.client";

@ApiTags("Facturación SUNAT")
@ApiBearerAuth()
@Controller()
export class BillingController {
  constructor(
    private service: BillingService,
    private db: Database,
  ) {}

  @Get("billing/config") configuration() {
    return this.service.configuration();
  }

  @Admin() @Post("billing/check") checkConnection() {
    return this.service.checkConnection();
  }

  @Admin() @Get("billing/sequences") sequences() {
    return this.db.invoiceSequence.findMany({ orderBy: { serie: "asc" } });
  }

  @Admin() @Patch("billing/sequences") sequence(
    @Body() dto: SequenceDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.configureSequence(
      dto.serie,
      dto.lastNumber,
      req.actor.id,
    );
  }

  @Post("sales/:id/invoices")
  issueSaleInvoice(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: IssueSaleInvoiceDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.issueSaleInvoice(id, dto, req.actor.id);
  }

  @Admin()
  @Post("invoices/:id/credit-notes")
  issueCreditNote(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: IssueCreditNoteDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.issueCreditNote(id, dto, req.actor.id);
  }

  @Post("sales/:id/guides")
  issueGuide(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: IssueGuideDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.issueGuide(id, dto, req.actor.id);
  }

  @Post("invoices/:id/sync")
  syncInvoice(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.service.syncInvoice(id, req.actor.id);
  }

  @Get("invoices")
  list(@Query() query: InvoicesQueryDto) {
    const { type, status, saleId, q, ...page } = query;
    const trimmed = q?.trim();
    const numeric =
      trimmed && /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
    return this.db.invoice.findMany({
      ...page,
      where: {
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(saleId ? { saleId } : {}),
        ...(trimmed
          ? {
              OR: [
                { serie: { contains: trimmed, mode: "insensitive" } },
                { customerName: { contains: trimmed, mode: "insensitive" } },
                { customerDocument: { contains: trimmed } },
                ...(numeric ? [{ number: numeric }] : []),
              ],
            }
          : {}),
      },
      include: {
        sale: { select: { id: true, total: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  @Get("invoices/:id")
  async getById(@Param("id", ParseUUIDPipe) id: string) {
    const invoice = await this.db.invoice.findUnique({
      where: { id },
      include: {
        sale: {
          include: {
            customer: true,
            items: { include: { product: true } },
          },
        },
        relatedInvoice: {
          select: { id: true, type: true, serie: true, number: true },
        },
        relatedDocuments: {
          select: {
            id: true,
            type: true,
            serie: true,
            number: true,
            status: true,
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException("Comprobante no encontrado");
    return invoice;
  }
}

@Module({
  controllers: [BillingController],
  providers: [BillingService, NubefactClient],
})
export class BillingModule {}
