import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { SaleStatus } from "@prisma/client";
export class PageDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip = 0;
  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take = 25;
}
export class SearchDto extends PageDto {
  @ApiPropertyOptional({
    description: "Texto a buscar en nombre/SKU/documento",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
export class SalesQueryDto extends PageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
  @ApiPropertyOptional({ enum: SaleStatus })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;
}
