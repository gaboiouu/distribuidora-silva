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
export class SaleDto {
  @ApiProperty({
    description: "UUID único por operación; conservar al reintentar",
  })
  @IsUUID()
  requestKey!: string;
  @ApiProperty() @IsUUID() customerId!: string;
  @ApiProperty({ type: [ItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items!: ItemDto[];
  @ApiPropertyOptional({ description: "Fecha límite para crédito" })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
export class PurchaseItemDto extends ItemDto {
  @ApiProperty({ example: "30.00" })
  @Matches(/^(0|[1-9]\d{0,7})\.\d{2}$/)
  unitCost!: string;
}
export class PurchaseDto {
  @ApiProperty() @IsUUID() requestKey!: string;
  @ApiProperty() @IsUUID() supplierId!: string;
  @ApiProperty({ type: [PurchaseItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
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
