import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Module,
  Post,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  Req,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { ApiBearerAuth, ApiProperty, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsString, Length, Matches } from "class-validator";
import { Request } from "express";
import { createHash, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { Database } from "../common/database";
import { config } from "../config";
export const Public = () => SetMetadata("public", true);
export const Admin = () => SetMetadata("admin", true);
export type AuthRequest = Request & {
  actor: { id: string; role: string; sessionId: string };
};
class LoginDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @Length(1, 128) password!: string;
}
class RefreshDto {
  @ApiProperty() @IsString() @Matches(/^[a-f0-9]{96}$/) refreshToken!: string;
}
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
@Injectable()
export class AuthService {
  private dummyHash = argon2.hash(randomBytes(32).toString("hex"), {
    type: argon2.argon2id,
  });
  constructor(
    private db: Database,
    private jwt: JwtService,
  ) {}
  async login(dto: LoginDto) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    const valid = await argon2.verify(
      user?.passwordHash ?? (await this.dummyHash),
      dto.password,
    );
    if (!user?.active || !valid)
      throw new UnauthorizedException("Credenciales inválidas");
    return this.issue(user.id);
  }
  private async issue(userId: string) {
    const refreshToken = randomBytes(48).toString("hex");
    const session = await this.db.session.create({
      data: {
        userId,
        tokenHash: digest(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    return {
      accessToken: await this.jwt.signAsync({ sub: userId, sid: session.id }),
      refreshToken,
      expiresIn: 900,
    };
  }
  async refresh(token: string) {
    const session = await this.db.session.findUnique({
      where: { tokenHash: digest(token) },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.active
    )
      throw new UnauthorizedException();
    const refreshToken = randomBytes(48).toString("hex");
    const next = await this.db.$transaction(async (tx) => {
      const claimed = await tx.session.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) throw new UnauthorizedException();
      return tx.session.create({
        data: {
          userId: session.userId,
          tokenHash: digest(refreshToken),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
    });
    return {
      accessToken: await this.jwt.signAsync({
        sub: session.userId,
        sid: next.id,
      }),
      refreshToken,
      expiresIn: 900,
    };
  }
  async logout(id: string) {
    await this.db.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
  async me(userId: string) {
    return this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });
  }
}
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private db: Database,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride("public", [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException();
    let payload: { sub: string; sid: string };
    try {
      payload = await this.jwt.verifyAsync(header.slice(7));
    } catch {
      throw new UnauthorizedException();
    }
    if (!payload.sub || !payload.sid) throw new UnauthorizedException();
    const session = await this.db.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.active
    )
      throw new UnauthorizedException();
    if (
      this.reflector.getAllAndOverride("admin", [
        context.getHandler(),
        context.getClass(),
      ]) &&
      session.user.role !== "ADMIN"
    )
      throw new ForbiddenException();
    req.actor = {
      id: session.userId,
      role: session.user.role,
      sessionId: session.id,
    };
    return true;
  }
}
@ApiTags("Acceso")
@Controller("auth")
export class AuthController {
  constructor(private service: AuthService) {}
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.service.refresh(dto.refreshToken);
  }
  @ApiBearerAuth() @Post("logout") logout(@Req() req: AuthRequest) {
    return this.service.logout(req.actor.sessionId);
  }
  @ApiBearerAuth() @Get("me") me(@Req() req: AuthRequest) {
    return this.service.me(req.actor.id);
  }
}
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: config.JWT_SECRET,
      signOptions: {
        expiresIn: "15m",
        issuer: "silva-api",
        audience: "silva-app",
      },
      verifyOptions: {
        issuer: "silva-api",
        audience: "silva-app",
        algorithms: ["HS256"],
      },
    }),
  ],
  providers: [AuthService, AccessGuard],
  controllers: [AuthController],
  exports: [AccessGuard],
})
export class AuthModule {}
