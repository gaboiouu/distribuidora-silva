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
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import { Prisma, Role } from "@prisma/client";
import * as argon2 from "argon2";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from "class-validator";
import { Admin, AuthRequest } from "../auth/auth";
import { Database } from "../common/database";
import { PageDto } from "../common/dto";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

class CreateUserDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @Length(2, 120) name!: string;
  @ApiProperty({ minLength: 14, maxLength: 128 })
  @IsString()
  @Length(14, 128)
  password!: string;
  @ApiPropertyOptional({ enum: Role, default: Role.MEMBER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class ResetPasswordDto {
  @ApiProperty({ minLength: 14, maxLength: 128 })
  @IsString()
  @Length(14, 128)
  password!: string;
}

@ApiTags("Usuarios")
@ApiBearerAuth()
@Admin()
@Controller("users")
export class UsersController {
  constructor(private db: Database) {}

  @Get()
  list(@Query() page: PageDto) {
    return this.db.user.findMany({
      ...page,
      select: userSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @Req() req: AuthRequest) {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          name: dto.name,
          passwordHash,
          role: dto.role ?? Role.MEMBER,
        },
        select: userSelect,
      });
      await tx.auditLog.create({
        data: {
          actorId: req.actor.id,
          action: "user.create",
          entityId: user.id,
        },
      });
      return user;
    });
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthRequest,
  ) {
    if (
      id === req.actor.id &&
      (dto.active === false || (dto.role && dto.role !== Role.ADMIN))
    ) {
      throw new BadRequestException(
        "No puedes desactivar o quitar privilegios a tu propia cuenta",
      );
    }
    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.user.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException("Usuario no encontrado");
      const user = await tx.user.update({
        where: { id },
        data: dto,
        select: userSelect,
      });
      if (dto.active === false) {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.auditLog.create({
        data: { actorId: req.actor.id, action: "user.update", entityId: id },
      });
      return user;
    });
  }

  @Patch(":id/password")
  async resetPassword(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @Req() req: AuthRequest,
  ) {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.user.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException("Usuario no encontrado");
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: req.actor.id,
          action: "user.password_reset",
          entityId: id,
        },
      });
      return { ok: true };
    });
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
