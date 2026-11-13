import { INestApplication, ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { json } from "express";
import { Errors } from "./common/errors";
import { config } from "./config";
export function setup(app: INestApplication) {
  app.use(helmet());
  app.use(json({ limit: "100kb" }));
  app.setGlobalPrefix("api/v1");
  const origins = config.CORS_ORIGIN.split(",").map((u) => u.trim());
  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    methods: ["GET", "POST", "PATCH"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
}
