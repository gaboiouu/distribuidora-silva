import {
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
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  PartialType,
} from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";
import { Prisma } from "@prisma/client";
import { Database } from "../common/database";
import { PageDto, SearchDto } from "../common/dto";
import { Admin, AuthRequest, Public } from "../auth/auth";
export class ProductDto {
  @ApiProperty() @IsString() @Length(1, 60) sku!: string;
  @ApiProperty() @IsString() @Length(2, 150) name!: string;
  @ApiProperty({ example: "Caja de 24 unidades" })
  @IsString()
  @Length(2, 100)
  presentation!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(10000) unitsPerBox!: number;
  @ApiProperty({
    example: "35.50",
    description: "Soles por presentación; importe final comercial",
  })
  @Matches(/^(0|[1-9]\d{0,7})\.\d{2}$/)
  price!: string;
  @ApiProperty({ example: "30.00" })
  @Matches(/^(0|[1-9]\d{0,7})\.\d{2}$/)
  cost!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() published?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
class CreateProductDto extends ProductDto {
  @ApiPropertyOptional({
    example: 10,
    description: "Stock inicial en cajas al crear el producto",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  initialStock?: number;
}
class UpdateProductDto extends PartialType(ProductDto) {}
class PartyDto {
  @ApiProperty() @IsString() @Length(2, 150) name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^(\d{8}|\d{11})$/)
  document?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(6, 25)
  phone?: string;
}
class CustomerDto extends PartyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 250)
  address?: string;
}
class UpdatePartyDto extends PartialType(PartyDto) {}
class UpdateCustomerDto extends PartialType(CustomerDto) {}
@ApiTags("Catálogo")
@ApiBearerAuth()
@Controller()
export class CatalogController {
  constructor(private db: Database) {}
  @Get("products") products(@Query() query: SearchDto) {
    const { q, ...page } = query;
    return this.db.product.findMany({
      ...page,
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
    });
  }
  @Get("products/:id") async productById(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const p = await this.db.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException("Producto no encontrado");
    return p;
  }
  @Admin() @Post("products") product(
    @Body() dto: CreateProductDto,
    @Req() req: AuthRequest,
  ) {
    const { initialStock, ...data } = dto;
    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const p = await tx.product.create({
        data: { ...data, stock: initialStock ?? 0 },
      });
      if (initialStock && initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: p.id,
            quantity: initialStock,
            reason: "INITIAL_STOCK",
            reference: p.id,
            createdBy: req.actor.id,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: req.actor.id,
          action: "product.create",
          entityId: p.id,
        },
      });
      return p;
    });
  }
  @Admin() @Patch("products/:id") update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: AuthRequest,
  ) {
    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const p = await tx.product.update({ where: { id }, data: dto });
      await tx.auditLog.create({
        data: { actorId: req.actor.id, action: "product.update", entityId: id },
      });
      return p;
    });
  }
  @Public() @Get("catalog") catalog(@Query() page: PageDto) {
    return this.db.product.findMany({
      ...page,
      where: { published: true, active: true },
      select: {
        id: true,
        sku: true,
        name: true,
        presentation: true,
        unitsPerBox: true,
        price: true,
      },
      orderBy: { name: "asc" },
    });
  }
  @Get("customers") customers(@Query() query: SearchDto) {
    const { q, ...page } = query;
    return this.db.customer.findMany({
      ...page,
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { document: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
    });
  }
  @Get("customers/:id") async customerById(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const c = await this.db.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Cliente no encontrado");
    return c;
  }
  @Post("customers") customer(@Body() dto: CustomerDto) {
    return this.db.customer.create({ data: dto });
  }
  @Patch("customers/:id") updateCustomer(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.db.customer.update({ where: { id }, data: dto });
  }
  @Get("suppliers") suppliers(@Query() query: SearchDto) {
    const { q, ...page } = query;
    return this.db.supplier.findMany({
      ...page,
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      orderBy: { name: "asc" },
    });
  }
  @Admin() @Post("suppliers") supplier(@Body() dto: PartyDto) {
    return this.db.supplier.create({ data: dto });
  }
  @Admin() @Patch("suppliers/:id") updateSupplier(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartyDto,
  ) {
    return this.db.supplier.update({ where: { id }, data: dto });
  }
  @Get("inventory/movements") movements(@Query() page: PageDto) {
    return this.db.stockMovement.findMany({
      ...page,
      orderBy: { createdAt: "desc" },
    });
  }
  @Admin() @Get("audit") audit(@Query() page: PageDto) {
    return this.db.auditLog.findMany({
      ...page,
      orderBy: { createdAt: "desc" },
    });
  }
}
@Module({ controllers: [CatalogController] })
export class CatalogModule {}
