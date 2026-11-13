import {
  Controller,
  Get,
  Module,
  ServiceUnavailableException,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AccessGuard, AuthModule, Public } from "./auth/auth";
import { Database, DatabaseModule } from "./common/database";
import { CatalogModule } from "./catalog/catalog";
import { OperationsModule } from "./operations/operations.controller";
import { InventoryModule } from "./inventory/inventory.controller";
import { UsersModule } from "./users/users";
import { BillingModule } from "./billing/billing.controller";
import { config } from "./config";
@Controller("health")
class HealthController {
  constructor(private db: Database) {}
  @Public() @Get() async health() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: "ok", environment: config.APP_ENV };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    CatalogModule,
    OperationsModule,
    InventoryModule,
    UsersModule,
    BillingModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class AppModule {}
