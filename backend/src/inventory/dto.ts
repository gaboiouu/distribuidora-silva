import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from "class-validator";

export enum AdjustmentReason {
  INITIAL_STOCK = "INITIAL_STOCK",
  COUNT_CORRECTION = "COUNT_CORRECTION",
  DAMAGE = "DAMAGE",
  OTHER = "OTHER",
}

export class PackagingDto {
  @ApiProperty({ description: "Producto que representa la caja pequeña" })
  @IsUUID()
  boxProductId!: string;

  @ApiProperty({ example: 12, description: "Cajas pequeñas por caja máster" })
  @IsInt()
  @Min(1)
  @Max(10000)
  boxesPerMaster!: number;
}

export class ConversionDto {
  @ApiProperty({ description: "UUID de la operación; conservar al reintentar" })
  @IsUUID()
  requestKey!: string;

  @ApiProperty()
  @IsUUID()
  masterProductId!: string;

  @ApiProperty({ example: 2, description: "Número de máster que se abren" })
  @IsInt()
  @Min(1)
  @Max(100000)
  masterQuantity!: number;
}

export class AdjustmentDto {
  @ApiProperty({ description: "UUID de la operación; conservar al reintentar" })
  @IsUUID()
  requestKey!: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({
    example: 10,
    description: "Cajas a sumar (positivo) o restar (negativo)",
  })
  @IsInt()
  @Min(-100000)
  @Max(100000)
  delta!: number;

  @ApiProperty({ enum: AdjustmentReason })
  @IsEnum(AdjustmentReason)
  reason!: AdjustmentReason;

  @ApiPropertyOptional({ example: "Conteo inicial de almacén" })
  @IsOptional()
  @IsString()
  @Length(1, 250)
  notes?: string;
}
