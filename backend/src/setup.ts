import { INestApplication, ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { json } from "express";
import { Errors } from "./common/errors";
import { config } from "./config";
export function setup(app: INestApplication) {
  app.use(helmet());
  app.use(json({ limit: "100kb" }));
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: config.CORS_ORIGIN,
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
