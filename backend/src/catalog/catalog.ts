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
import { Database } from "../common/database";
import { PageDto } from "../common/dto";
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
@ApiTags("Catálogo")
@ApiBearerAuth()
@Controller()
export class CatalogController {
  constructor(private db: Database) {}
  @Get("products") products(@Query() page: PageDto) {
    return this.db.product.findMany({
      ...page,
      orderBy: { createdAt: "desc" },
    });
  }
  @Admin() @Post("products") product(
    @Body() dto: ProductDto,
    @Req() req: AuthRequest,
  ) {
    return this.db.$transaction(async (tx) => {
      const p = await tx.product.create({ data: dto });
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
    return this.db.$transaction(async (tx) => {
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
  @Get("customers") customers(@Query() page: PageDto) {
    return this.db.customer.findMany({ ...page, orderBy: { name: "asc" } });
  }
  @Post("customers") customer(@Body() dto: CustomerDto) {
    return this.db.customer.create({ data: dto });
  }
  @Get("suppliers") suppliers(@Query() page: PageDto) {
    return this.db.supplier.findMany({ ...page, orderBy: { name: "asc" } });
  }
  @Admin() @Post("suppliers") supplier(@Body() dto: PartyDto) {
    return this.db.supplier.create({ data: dto });
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
