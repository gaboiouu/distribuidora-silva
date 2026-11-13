import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { Database } from "../common/database";
import { PageDto, SalesQueryDto } from "../common/dto";
import { Admin, AuthRequest } from "../auth/auth";
import { OperationsService } from "./operations.service";
import {
  CancelSaleDto,
  DeliveryDto,
  ExpenseDto,
  PaymentDto,
  PurchaseDto,
  SaleDto,
  SaleReturnDto,
} from "./dto";
@ApiTags("Operaciones")
@ApiBearerAuth()
@Controller()
export class OperationsController {
  constructor(
    private service: OperationsService,
    private db: Database,
  ) {}
  @Admin() @Get("finance/annual") async annualFinance(@Query("year") yearText?: string) {
    const currentYear = new Date(Date.now() - 5 * 60 * 60 * 1000).getUTCFullYear();
    const year = yearText === undefined ? currentYear : Number(yearText);
    if (!Number.isInteger(year) || year < 2000 || year > currentYear + 1)
      throw new BadRequestException("Año inválido");
    const start = new Date(Date.UTC(year, 0, 1, 5));
    const end = new Date(Date.UTC(year + 1, 0, 1, 5));
    const range = { gte: start, lt: end };
    const [purchases, sales, expenses, returns] = await this.db.$transaction([
      this.db.purchase.findMany({ where: { purchasedAt: range }, select: { total: true, purchasedAt: true } }),
      this.db.sale.findMany({ where: { createdAt: range, OR: [{ status: "ACTIVE" }, { returns: { some: {} } }] }, select: { total: true, createdAt: true, items: { select: { quantity: true, unitCost: true } }, returns: { select: { creditAmount: true } } } }),
      this.db.expense.findMany({ where: { createdAt: range }, select: { amount: true, createdAt: true } }),
      this.db.saleReturn.findMany({ where: { createdAt: range }, select: { creditAmount: true, createdAt: true, items: { select: { quantity: true, unitCost: true } } } }),
    ]);
    const months = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      investment: new Prisma.Decimal(0),
      revenue: new Prisma.Decimal(0),
      goodsCost: new Prisma.Decimal(0),
      expenses: new Prisma.Decimal(0),
    }));
    const monthOf = (date: Date) => new Date(date.getTime() - 5 * 60 * 60 * 1000).getUTCMonth();
    for (const purchase of purchases) months[monthOf(purchase.purchasedAt)].investment = months[monthOf(purchase.purchasedAt)].investment.plus(purchase.total);
    for (const sale of sales) {
      const month = months[monthOf(sale.createdAt)];
      month.revenue = month.revenue.plus(sale.returns.reduce((sum, item) => sum.plus(item.creditAmount), sale.total));
      for (const item of sale.items) month.goodsCost = month.goodsCost.plus(item.unitCost.mul(item.quantity));
    }
    for (const returned of returns) {
      const month = months[monthOf(returned.createdAt)];
      month.revenue = month.revenue.minus(returned.creditAmount);
      for (const item of returned.items) month.goodsCost = month.goodsCost.minus(item.unitCost.mul(item.quantity));
    }
    for (const expense of expenses) months[monthOf(expense.createdAt)].expenses = months[monthOf(expense.createdAt)].expenses.plus(expense.amount);
    const format = (row: typeof months[number]) => ({
      month: row.month,
      investment: row.investment.toFixed(2),
      revenue: row.revenue.toFixed(2),
      goodsCost: row.goodsCost.toFixed(2),
      expenses: row.expenses.toFixed(2),
      estimatedProfit: row.revenue.minus(row.goodsCost).minus(row.expenses).toFixed(2),
    });
    const annual = months.reduce((sum, month) => ({
      month: 0,
      investment: sum.investment.plus(month.investment),
      revenue: sum.revenue.plus(month.revenue),
      goodsCost: sum.goodsCost.plus(month.goodsCost),
      expenses: sum.expenses.plus(month.expenses),
    }), { month: 0, investment: new Prisma.Decimal(0), revenue: new Prisma.Decimal(0), goodsCost: new Prisma.Decimal(0), expenses: new Prisma.Decimal(0) });
    return { year, annual: format(annual), months: months.map(format) };
  }
  @Post("sales") sale(@Body() dto: SaleDto, @Req() req: AuthRequest) {
    return this.service.sale(dto, req.actor.id);
  }
  @Get("sales") sales(@Query() query: SalesQueryDto) {
    const { customerId, status, ...page } = query;
    return this.db.sale.findMany({
      ...page,
      where: {
        ...(customerId ? { customerId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        customer: {
          select: { id: true, name: true, document: true, phone: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, sku: true, name: true, presentation: true },
            },
          },
        },
        payments: true,
        returns: { include: { items: true }, orderBy: { createdAt: "desc" } },
        invoices: {
          select: {
            id: true,
            type: true,
            serie: true,
            number: true,
            status: true,
            sunatAccepted: true,
            pdfUrl: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  @Get("sales/:id") async saleById(@Param("id", ParseUUIDPipe) id: string) {
    const sale = await this.db.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        payments: true,
        returns: { include: { items: true }, orderBy: { createdAt: "desc" } },
        customer: true,
        invoices: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!sale) throw new NotFoundException("Venta no encontrada");
    return sale;
  }
  @Admin() @Post("sales/:id/cancel") cancelSale(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelSaleDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.cancelSale(id, dto, req.actor.id);
  }
  @Post("sales/:id/returns") returnSale(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaleReturnDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.returnSale(id, dto, req.actor.id);
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
  @Admin() @Get("purchases/installments") pendingPurchaseInstallments() {
    return this.db.purchaseInstallment.findMany({
      where: { paidAt: null },
      include: { purchase: { select: { id: true, cardName: true, supplier: { select: { name: true } } } } },
      orderBy: { dueAt: "asc" },
      take: 100,
    });
  }
  @Admin() @Get("purchases") purchases(@Query() page: PageDto) {
    return this.db.purchase.findMany({
      ...page,
      include: {
        supplier: { select: { id: true, name: true, document: true } },
        installments: { orderBy: { number: "asc" } },
        items: {
          include: {
            product: {
              select: { id: true, sku: true, name: true, presentation: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  @Admin() @Patch("purchases/:id/installments/:installmentId/pay") payPurchaseInstallment(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("installmentId", ParseUUIDPipe) installmentId: string,
    @Req() req: AuthRequest,
  ) {
    return this.service.payPurchaseInstallment(id, installmentId, req.actor.id);
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
  @Get("receivables") async receivables(@Query() page: PageDto) {
    const allActive = await this.db.sale.findMany({
      where: { status: "ACTIVE" },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
    });
    const pending = allActive.filter((s) => s.paid.lt(s.total));
    const skip = page.skip ?? 0;
    const take = page.take ?? 20;
    return pending.slice(skip, skip + take);
  }
  @Get("dashboard/summary") async summary() {
    const peruOffsetMs = 5 * 60 * 60 * 1000;
    const localNow = new Date(Date.now() - peruOffsetMs);
    const startOfTodayUtc = new Date(
      Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate(),
      ) + peruOffsetMs,
    );
    const [
      todaySales,
      activeSales,
      lowStockProductsCount,
      pendingDeliveriesCount,
      sunatAttentionCount,
    ] = await this.db.$transaction([
      this.db.sale.aggregate({
        where: { status: "ACTIVE", createdAt: { gte: startOfTodayUtc } },
        _count: true,
        _sum: { total: true },
      }),
      this.db.sale.findMany({
        where: { status: "ACTIVE" },
        select: { total: true, paid: true },
      }),
      this.db.product.count({ where: { active: true, stock: { lte: 5 } } }),
      this.db.sale.count({ where: { status: "ACTIVE", delivery: "PENDING" } }),
      this.db.invoice.count({
        where: { status: { in: ["PENDING", "ERROR", "REJECTED"] } },
      }),
    ]);
    const pendingSales = activeSales.filter((s) => s.paid.lt(s.total));
    const receivablesCount = pendingSales.length;
    const receivablesTotal = pendingSales.reduce(
      (sum, s) => sum.plus(s.total.minus(s.paid)),
      new Prisma.Decimal(0),
    );
    return {
      todaySalesCount: todaySales._count,
      todaySalesTotal: todaySales._sum.total?.toFixed(2) ?? "0.00",
      receivablesCount,
      receivablesTotal: receivablesTotal.toFixed(2),
      lowStockProductsCount,
      pendingDeliveriesCount,
      sunatAttentionCount,
    };
  }
  @Get("dashboard/insights") async insights() {
    const now = Date.now();
    const since = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sales = await this.db.sale.findMany({
      where: { status: "ACTIVE", createdAt: { gte: since } },
      select: {
        id: true, createdAt: true, total: true, paid: true,
        customer: { select: { name: true } },
        items: { select: { quantity: true, productId: true, product: { select: { name: true } } } },
        returns: { select: { items: { select: { productId: true, quantity: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    const days = Array.from({ length: 30 }, (_, offset) => {
      const date = new Date(now - (29 - offset) * 24 * 60 * 60 * 1000);
      return { date: new Date(date.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10), total: new Prisma.Decimal(0), orders: 0 };
    });
    const byDay = new Map(days.map(day => [day.date, day]));
    const products = new Map<string, { name: string; boxes: number }>();
    for (const sale of sales) {
      const date = new Date(sale.createdAt.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const day = byDay.get(date);
      if (day) { day.total = day.total.plus(sale.total); day.orders++; }
      for (const item of sale.items) {
        const product = products.get(item.productId) ?? { name: item.product.name, boxes: 0 };
        product.boxes += item.quantity;
        products.set(item.productId, product);
      }
      for (const returned of sale.returns) for (const item of returned.items) {
        const product = products.get(item.productId);
        if (product) product.boxes -= item.quantity;
      }
    }
    return {
      days: days.map(day => ({ ...day, total: day.total.toFixed(2) })),
      topProducts: [...products.values()].filter(p => p.boxes > 0).sort((a, b) => b.boxes - a.boxes).slice(0, 5),
      recentSales: sales.slice(0, 5).map(sale => ({ id: sale.id, customer: sale.customer.name, total: sale.total.toFixed(2), paid: sale.paid.toFixed(2), createdAt: sale.createdAt })),
      monthSales: sales.reduce((sum, sale) => sum.plus(sale.total), new Prisma.Decimal(0)).toFixed(2),
      orderCount: sales.length,
    };
  }
  @Admin() @Get("cash/summary") async cash() {
    const [payments, refunds, cardPayments, expenses] = await this.db.$transaction([
      this.db.payment.aggregate({ _sum: { amount: true } }),
      this.db.saleReturn.aggregate({ _sum: { refundAmount: true } }),
      this.db.purchaseInstallment.aggregate({ where: { paidAt: { not: null } }, _sum: { amount: true } }),
      this.db.expense.aggregate({ _sum: { amount: true } }),
    ]);
    return {
      collections: (payments._sum.amount ?? new Prisma.Decimal(0)).minus(refunds._sum.refundAmount ?? 0).toFixed(2),
      cardPayments: cardPayments._sum.amount?.toFixed(2) ?? "0.00",
      expenses: expenses._sum.amount?.toFixed(2) ?? "0.00",
      scope: "Cobros netos de devoluciones, gastos y cuotas de tarjeta registradas. No incluye compras de contado ni saldos bancarios",
    };
  }
}
@Module({ controllers: [OperationsController], providers: [OperationsService] })
export class OperationsModule {}
