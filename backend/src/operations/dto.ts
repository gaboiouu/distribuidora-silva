import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { DeliveryStatus } from "@prisma/client";
export class ItemDto {
  @ApiProperty() @IsUUID() productId!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(100000) quantity!: number;
}
export class SaleItemDto extends ItemDto {
  @ApiPropertyOptional({
    example: "35.50",
    description:
      "Precio pactado por presentación; si se omite se usa el precio del catálogo",
  })
  @IsOptional()
  @Matches(/^(0|[1-9]\d{0,7})\.\d{2}$/)
  unitPrice?: string;
}
export class SaleDto {
  @ApiProperty({
    description: "UUID único por operación; conservar al reintentar",
  })
  @IsUUID()
  requestKey!: string;
  @ApiProperty() @IsUUID() customerId!: string;
  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];
  @ApiPropertyOptional({ description: "Fecha límite para crédito" })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
export class CancelSaleDto {
  @ApiProperty({ example: "Pedido cancelado por el cliente" })
  @IsString()
  @Length(3, 250)
  reason!: string;
}
export class SaleReturnDto {
  @ApiProperty() @IsUUID() requestKey!: string;
  @ApiProperty() @IsString() @Length(3, 250) reason!: string;
  @ApiProperty({ type: [ItemDto] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => ItemDto) items!: ItemDto[];
  @ApiPropertyOptional({ enum: ["CASH", "TRANSFER", "YAPE", "PLIN"] })
  @IsOptional() @IsEnum({ CASH: "CASH", TRANSFER: "TRANSFER", YAPE: "YAPE", PLIN: "PLIN" })
  refundMethod?: "CASH" | "TRANSFER" | "YAPE" | "PLIN";
}
export class PurchaseItemDto extends ItemDto {
  @ApiProperty({ example: "30.00" })
  @Matches(/^(0|[1-9]\d{0,7})\.\d{2}$/)
  unitCost!: string;
}
export class PurchaseDto {
  @ApiProperty() @IsUUID() requestKey!: string;
  @ApiProperty() @IsUUID() supplierId!: string;
  @ApiPropertyOptional({ description: "Fecha de la compra en formato YYYY-MM-DD" })
  @IsOptional() @IsDateString() purchasedAt?: string;
  @ApiProperty({ type: [PurchaseItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
  @ApiPropertyOptional({ enum: ["CASH", "CARD", "TRANSFER"] })
  @IsOptional()
  @IsEnum({ CASH: "CASH", CARD: "CARD", TRANSFER: "TRANSFER" })
  paymentMethod?: "CASH" | "CARD" | "TRANSFER";
  @ApiPropertyOptional({ description: "Nombre de la tarjeta, sin número ni datos sensibles" })
  @IsOptional()
  @IsString()
  @Length(2, 60)
  cardName?: string;
  @ApiPropertyOptional({ type: () => [PurchaseInstallmentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(36)
  @ValidateNested({ each: true })
  @Type(() => PurchaseInstallmentDto)
  installments?: PurchaseInstallmentDto[];
}
export class PurchaseInstallmentDto {
  @ApiProperty({ example: "150.00" })
  @Matches(/^(0|[1-9]\d{0,7})\.\d{2}$/)
  amount!: string;
  @ApiProperty({ example: "2026-12-15" })
  @IsDateString()
  dueAt!: string;
}
export class PaymentDto {
  @ApiProperty() @IsUUID() requestKey!: string;
  @ApiProperty({ example: "50.00" })
  @Matches(/^(0|[1-9]\d{0,7})\.\d{2}$/)
  amount!: string;
  @ApiProperty({ enum: ["CASH", "TRANSFER", "YAPE", "PLIN"] })
  @IsEnum({ CASH: "CASH", TRANSFER: "TRANSFER", YAPE: "YAPE", PLIN: "PLIN" })
  method!: string;
}
export class ExpenseDto {
  @ApiProperty() @IsUUID() requestKey!: string;
  @ApiProperty() @IsString() @Length(3, 250) description!: string;
  @ApiProperty({ example: "20.00" })
  @Matches(/^(0|[1-9]\d{0,7})\.\d{2}$/)
  amount!: string;
}
export class DeliveryDto {
  @ApiProperty({ enum: DeliveryStatus })
  @IsEnum(DeliveryStatus)
  status!: DeliveryStatus;
}
