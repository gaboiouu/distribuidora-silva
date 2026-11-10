import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { setup } from "./setup";
import { config } from "./config";
async function main() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  setup(app);
  if (config.NODE_ENV !== "production") {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Distribuidora Silva API")
        .setDescription(
          "Operaciones comerciales en PEN. No emite comprobantes SUNAT todavía.",
        )
        .setVersion("1")
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup("docs", app, doc);
  }
  await app.listen(config.PORT, "0.0.0.0");
}
void main();
