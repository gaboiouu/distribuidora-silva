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
import { Admin, AuthRequest } from "../auth/auth";
import { Database } from "../common/database";
import { PageDto } from "../common/dto";
import { AdjustmentDto, ConversionDto, PackagingDto } from "./dto";
import { InventoryService } from "./inventory.service";

@ApiTags("Inventario")
@ApiBearerAuth()
@Controller()
export class InventoryController {
  constructor(
    private service: InventoryService,
    private db: Database,
  ) {}

  @Admin()
  @Patch("products/:id/packaging")
  packaging(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PackagingDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.configurePackaging(id, dto, req.actor.id);
  }

  @Post("inventory/conversions")
  convert(@Body() dto: ConversionDto, @Req() req: AuthRequest) {
    return this.service.convert(dto, req.actor.id);
  }

  @Get("inventory/conversions")
  conversions(@Query() page: PageDto) {
    return this.db.stockConversion.findMany({
      ...page,
      orderBy: { createdAt: "desc" },
    });
  }

  @Admin()
  @Post("inventory/adjustments")
  adjust(@Body() dto: AdjustmentDto, @Req() req: AuthRequest) {
    return this.service.adjust(dto, req.actor.id);
  }

  @Admin()
  @Get("inventory/adjustments")
  adjustments(@Query() page: PageDto) {
    return this.db.stockAdjustment.findMany({
      ...page,
      include: {
        product: {
          select: { id: true, sku: true, name: true, presentation: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

@Module({ controllers: [InventoryController], providers: [InventoryService] })
export class InventoryModule {}
