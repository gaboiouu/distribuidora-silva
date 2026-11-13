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
        .setTitle("Distribuciones Silva API")
        .setDescription(
          "API mayorista en PEN con inventario, ventas, créditos y facturación SUNAT vía Nubefact.",
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
