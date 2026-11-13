import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IgvType, InvoiceType, SunatStatus } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { PageDto } from "../common/dto";

export class IssueSaleInvoiceDto {
  @ApiProperty({
    description: "UUID único por operación; conservar al reintentar",
  })
  @IsUUID()
  requestKey!: string;

  @ApiProperty({ enum: ["FACTURA", "BOLETA"] })
  @IsIn(["FACTURA", "BOLETA"])
  type!: "FACTURA" | "BOLETA";

  @ApiPropertyOptional({ enum: IgvType, default: IgvType.GRAVADO })
  @IsOptional()
  @IsEnum(IgvType)
  igvType?: IgvType;

  @ApiPropertyOptional({ example: "F001" })
  @IsOptional()
  @Matches(/^[FB][A-Z0-9]{3}$/)
  serie?: string;

  @ApiPropertyOptional({
    enum: ["6", "1", "-"],
    description: "6=RUC, 1=DNI, -=Varios",
  })
  @IsOptional()
  @IsIn(["6", "1", "-"])
  customerDocumentType?: "6" | "1" | "-";

  @ApiPropertyOptional({ example: "20123456789" })
  @IsOptional()
  @IsString()
  @Length(1, 15)
  customerDocument?: string;

  @ApiPropertyOptional({ example: "Bodega San Martín SAC" })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  customerName?: string;

  @ApiPropertyOptional({ example: "Av. Próceres 123, Lima" })
  @IsOptional()
  @IsString()
  @Length(2, 250)
  customerAddress?: string;
}

export class IssueCreditNoteDto {
  @ApiProperty({
    description: "UUID único por operación; conservar al reintentar",
  })
  @IsUUID()
  requestKey!: string;

  @ApiPropertyOptional({
    example: "01",
    description: "Nota total: 01=Anulación, 06=Devolución total",
  })
  @IsOptional()
  @IsIn(["01", "06"])
  creditNoteCode?: string;

  @ApiProperty({ example: "Anulación de la operación por error en pedido" })
  @IsString()
  @Length(3, 250)
  reason!: string;

  @ApiPropertyOptional({ example: "FC01" })
  @IsOptional()
  @Matches(/^[FB][A-Z0-9]{3}$/)
  serie?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      "Si SUNAT acepta la nota de crédito, anula la venta y devuelve stock",
  })
  @IsOptional()
  @IsBoolean()
  cancelSale?: boolean;
}

export class IssueGuideDto {
  @ApiProperty({
    description: "UUID único por operación; conservar al reintentar",
  })
  @IsUUID()
  requestKey!: string;

  @ApiPropertyOptional({ example: "T001" })
  @IsOptional()
  @Matches(/^T[A-Z0-9]{3}$/)
  serie?: string;

  @ApiProperty({ example: "2026-11-12" })
  @IsDateString()
  transferStartDate!: string;

  @ApiProperty({ example: "150101" })
  @Matches(/^\d{6}$/)
  startUbigeo!: string;

  @ApiProperty({ example: "150101" })
  @Matches(/^\d{6}$/)
  endUbigeo!: string;

  @ApiPropertyOptional({
    enum: ["01", "02"],
    description: "01=público, 02=privado",
  })
  @IsOptional()
  @IsIn(["01", "02"])
  transportType?: "01" | "02";

  @ApiPropertyOptional({
    description: "Fecha de entrega al transportista público",
  })
  @IsOptional()
  @IsDateString()
  carrierDeliveryDate?: string;

  @ApiPropertyOptional({ enum: ["1", "4", "7", "A", "0"] })
  @IsOptional()
  @IsIn(["1", "4", "7", "A", "0"])
  driverDocumentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 15)
  driverDocument?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  driverName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  driverLastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[A-Z0-9]{9,10}$/)
  driverLicense?: string;

  @ApiPropertyOptional({ example: "01", description: "01=Venta" })
  @IsOptional()
  @IsIn(["01"])
  reasonCode?: string;

  @ApiProperty({ example: "45.50", description: "Peso bruto total en KG" })
  @Matches(/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/)
  grossWeight!: string;

  @ApiProperty({ example: 10, description: "Cantidad total de cajas o bultos" })
  @IsInt()
  @Min(1)
  @Max(100000)
  packages!: number;

  @ApiProperty({ example: "Jr. Almacén 100, Lima" })
  @IsString()
  @Length(5, 150)
  startAddress!: string;

  @ApiProperty({ example: "Av. Cliente 450, Lima" })
  @IsString()
  @Length(5, 150)
  endAddress!: string;

  @ApiPropertyOptional({ example: "12345678" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/)
  carrierDoc?: string;

  @ApiPropertyOptional({ example: "Juan Pérez" })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  carrierName?: string;

  @ApiProperty({ example: "ABC123" })
  @Matches(/^[A-Z0-9]{6,8}$/)
  plate!: string;
}

export class SequenceDto {
  @ApiProperty({ example: "F001" })
  @Matches(/^[FBT][A-Z0-9]{3}$/)
  serie!: string;
  @ApiProperty({
    description: "Último número utilizado en NubeFact; 0 para una serie nueva",
  })
  @IsInt()
  @Min(0)
  @Max(99999998)
  lastNumber!: number;
}

export class InvoicesQueryDto extends PageDto {
  @ApiPropertyOptional({ enum: InvoiceType })
  @IsOptional()
  @IsEnum(InvoiceType)
  type?: InvoiceType;

  @ApiPropertyOptional({ enum: SunatStatus })
  @IsOptional()
  @IsEnum(SunatStatus)
  status?: SunatStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}
