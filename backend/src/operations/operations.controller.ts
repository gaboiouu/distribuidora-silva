import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Database } from "../common/database";
import { PageDto } from "../common/dto";
import { Admin, AuthRequest } from "../auth/auth";
import { OperationsService } from "./operations.service";
import {
  DeliveryDto,
  ExpenseDto,
  PaymentDto,
  PurchaseDto,
  SaleDto,
} from "./dto";
@ApiTags("Operaciones")
@ApiBearerAuth()
@Controller()
export class OperationsController {
  constructor(
    private service: OperationsService,
    private db: Database,
  ) {}
  @Post("sales") sale(@Body() dto: SaleDto, @Req() req: AuthRequest) {
    return this.service.sale(dto, req.actor.id);
  }
  @Get("sales") sales(@Query() page: PageDto) {
    return this.db.sale.findMany({
      ...page,
      include: { items: true, payments: true },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post("sales/:id/payments") payment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PaymentDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.payment(id, dto, req.actor.id);
  }
  @Patch("sales/:id/delivery") delivery(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeliveryDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.delivery(id, dto, req.actor.id);
  }
  @Admin() @Post("purchases") purchase(
    @Body() dto: PurchaseDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.purchase(dto, req.actor.id);
  }
  @Admin() @Get("purchases") purchases(@Query() page: PageDto) {
    return this.db.purchase.findMany({
      ...page,
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  }
  @Admin() @Post("expenses") expense(
    @Body() dto: ExpenseDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.expense(dto, req.actor.id);
  }
  @Admin() @Get("expenses") expenses(@Query() page: PageDto) {
    return this.db.expense.findMany({
      ...page,
      orderBy: { createdAt: "desc" },
    });
  }
  @Get("receivables") receivables(@Query() page: PageDto) {
    return this.db.sale.findMany({
      ...page,
      where: { paid: { lt: this.db.sale.fields.total } },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
    });
  }
  @Admin() @Get("cash/summary") async cash() {
    const [payments, expenses] = await this.db.$transaction([
      this.db.payment.aggregate({ _sum: { amount: true } }),
      this.db.expense.aggregate({ _sum: { amount: true } }),
    ]);
    return {
      collections: payments._sum.amount?.toFixed(2) ?? "0.00",
      expenses: expenses._sum.amount?.toFixed(2) ?? "0.00",
      scope: "Cobros y gastos registrados; no incluye pagos a proveedores",
    };
  }
}
@Module({ controllers: [OperationsController], providers: [OperationsService] })
export class OperationsModule {}
