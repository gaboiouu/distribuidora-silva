import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { hash } from "argon2";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { Database } from "../src/common/database";
import { setup } from "../src/setup";
import { InventoryService } from "../src/inventory/inventory.service";
import { OperationsService } from "../src/operations/operations.service";

describe("Conversión de máster a cajas pequeñas", () => {
  let app: INestApplication;
  let db: Database;
  let inventory: InventoryService;
  let operations: OperationsService;
  let token: string;
  let actor: string;
  let supplier: string;
  let customer: string;
  const prefix = "/api/v1";
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const databaseName = new URL(process.env.DATABASE_URL ?? "").pathname;
    if (databaseName !== "/silva_test")
      throw new Error("Usa la base dedicada silva_test");
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    setup(app);
    await app.init();
    db = app.get(Database);
    inventory = app.get(InventoryService);
    operations = app.get(OperationsService);
    const email = `${randomUUID()}@test.example`;
    actor = (
      await db.user.create({
        data: {
          email,
          name: "Administrador",
          role: "ADMIN",
          passwordHash: await hash("Test-password-123!"),
        },
      })
    ).id;
    const login = await request(app.getHttpServer())
      .post(prefix + "/auth/login")
      .send({ email, password: "Test-password-123!" })
      .expect(201);
    token = login.body.accessToken;
    supplier = (await db.supplier.create({ data: { name: "Proveedor" } })).id;
    customer = (await db.customer.create({ data: { name: "Cliente" } })).id;
  });

  afterAll(async () => {
    await app?.close();
  });

  async function product(name: string, price: string, unitsPerBox: number) {
    const response = await request(app.getHttpServer())
      .post(prefix + "/products")
      .set(auth())
      .send({
        sku: randomUUID(),
        name,
        presentation: name,
        unitsPerBox,
        price,
        cost: "0.00",
      })
      .expect(201);
    return response.body.id as string;
  }

  async function pair(quantity = 3) {
    const box = await product("Sublime Blanco caja", "10.00", 24);
    const master = await product("Sublime Blanco máster", "110.00", 288);
    await request(app.getHttpServer())
      .patch(`${prefix}/products/${master}/packaging`)
      .set(auth())
      .send({ boxProductId: box, boxesPerMaster: 12 })
      .expect(200);
    await request(app.getHttpServer())
      .post(prefix + "/purchases")
      .set(auth())
      .send({
        requestKey: randomUUID(),
        supplierId: supplier,
        items: [{ productId: master, quantity, unitCost: "90.00" }],
      })
      .expect(201);
    return { master, box };
  }

  const stock = async (id: string) =>
    (await db.product.findUniqueOrThrow({ where: { id } })).stock;

  it("compra máster, abre cajas y vende un pedido mixto por HTTP", async () => {
    const { master, box } = await pair();
    const response = await request(app.getHttpServer())
      .post(prefix + "/inventory/conversions")
      .set(auth())
      .send({
        requestKey: randomUUID(),
        masterProductId: master,
        masterQuantity: 2,
      })
      .expect(201);
    expect(response.body.boxQuantity).toBe(24);
    expect(await stock(master)).toBe(1);
    expect(await stock(box)).toBe(24);
    const small = await db.product.findUniqueOrThrow({ where: { id: box } });
    expect(small.cost.toFixed(2)).toBe("7.50");
    expect(small.price.toFixed(2)).toBe("10.00");
    const movements = await db.stockMovement.findMany({
      where: { reference: response.body.id },
    });
    expect(
      movements.map((movement) => movement.quantity).sort((a, b) => a - b),
    ).toEqual([-2, 24]);
    expect(
      await db.auditLog.count({
        where: { entityId: response.body.id, action: "inventory.convert" },
      }),
    ).toBe(1);

    const triangle = await product("Triángulo caja", "20.00", 24);
    const classic = await product("Sublime Clásico caja", "15.00", 24);
    await request(app.getHttpServer())
      .post(prefix + "/purchases")
      .set(auth())
      .send({
        requestKey: randomUUID(),
        supplierId: supplier,
        items: [
          { productId: triangle, quantity: 5, unitCost: "12.00" },
          { productId: classic, quantity: 3, unitCost: "10.00" },
        ],
      })
      .expect(201);
    const sale = await request(app.getHttpServer())
      .post(prefix + "/sales")
      .set(auth())
      .send({
        requestKey: randomUUID(),
        customerId: customer,
        items: [
          { productId: box, quantity: 8 },
          { productId: triangle, quantity: 5 },
          { productId: classic, quantity: 3 },
          { productId: master, quantity: 1 },
        ],
      })
      .expect(201);
    expect(sale.body.total).toBe("335");
    expect(await stock(box)).toBe(16);
    expect(await stock(master)).toBe(0);
    expect(await stock(triangle)).toBe(0);
    expect(await stock(classic)).toBe(0);
  });

  it("conserva la equivalencia histórica y evita duplicar una conversión al reintentar", async () => {
    const { master, box } = await pair();
    const dto = {
      requestKey: randomUUID(),
      masterProductId: master,
      masterQuantity: 1,
    };
    const first = await request(app.getHttpServer())
      .post(prefix + "/inventory/conversions")
      .set(auth())
      .send(dto)
      .expect(201);
    await request(app.getHttpServer())
      .patch(`${prefix}/products/${master}/packaging`)
      .set(auth())
      .send({ boxProductId: box, boxesPerMaster: 6 })
      .expect(200);
    const retry = await request(app.getHttpServer())
      .post(prefix + "/inventory/conversions")
      .set(auth())
      .send(dto)
      .expect(201);
    expect(retry.body.id).toBe(first.body.id);
    expect(retry.body.boxesPerMaster).toBe(12);
    await request(app.getHttpServer())
      .post(prefix + "/inventory/conversions")
      .set(auth())
      .send({ ...dto, masterQuantity: 2 })
      .expect(409);
    expect(await stock(master)).toBe(2);
    expect(await stock(box)).toBe(12);
    expect(
      await db.stockMovement.count({ where: { reference: first.body.id } }),
    ).toBe(2);
  });

  it("rechaza stock insuficiente sin alterar existencias, costos ni historial", async () => {
    const { master, box } = await pair(1);
    await request(app.getHttpServer())
      .post(prefix + "/inventory/conversions")
      .set(auth())
      .send({
        requestKey: randomUUID(),
        masterProductId: master,
        masterQuantity: 2,
      })
      .expect(409);
    expect(await stock(master)).toBe(1);
    expect(await stock(box)).toBe(0);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: box } })).cost.toFixed(
        2,
      ),
    ).toBe("0.00");
    expect(
      await db.stockConversion.count({ where: { masterProductId: master } }),
    ).toBe(0);
  });

  it("mantiene productos anteriores y valida equivalencias, permisos y cantidades", async () => {
    const legacy = await product("Producto anterior", "30.00", 24);
    const dto = {
      requestKey: randomUUID(),
      masterProductId: legacy,
      masterQuantity: 1,
    };
    await request(app.getHttpServer())
      .post(prefix + "/inventory/conversions")
      .set(auth())
      .send(dto)
      .expect(400);
    await request(app.getHttpServer())
      .patch(`${prefix}/products/${legacy}/packaging`)
      .set(auth())
      .send({ boxProductId: legacy, boxesPerMaster: 12 })
      .expect(400);
    const { master, box } = await pair(1);
    await request(app.getHttpServer())
      .patch(`${prefix}/products/${master}/packaging`)
      .set(auth())
      .send({ boxProductId: box, boxesPerMaster: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`${prefix}/products/${box}/packaging`)
      .set(auth())
      .send({ boxProductId: legacy, boxesPerMaster: 12 })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`${prefix}/products/${legacy}/packaging`)
      .set(auth())
      .send({ boxProductId: master, boxesPerMaster: 12 })
      .expect(400);
    await request(app.getHttpServer())
      .post(prefix + "/inventory/conversions")
      .set(auth())
      .send({ ...dto, masterProductId: master, masterQuantity: 0.5 })
      .expect(400);
    await request(app.getHttpServer())
      .post(prefix + "/inventory/conversions")
      .send(dto)
      .expect(401);
    await db.product.update({ where: { id: box }, data: { active: false } });
    await request(app.getHttpServer())
      .post(prefix + "/inventory/conversions")
      .set(auth())
      .send({ ...dto, masterProductId: master })
      .expect(400);
    expect(await stock(master)).toBe(1);
  });

  it("una venta y una conversión concurrentes no consumen la misma máster", async () => {
    const { master, box } = await pair(1);
    const results = await Promise.allSettled([
      inventory.convert(
        {
          requestKey: randomUUID(),
          masterProductId: master,
          masterQuantity: 1,
        },
        actor,
      ),
      operations.sale(
        {
          requestKey: randomUUID(),
          customerId: customer,
          items: [{ productId: master, quantity: 1 }],
        },
        actor,
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await stock(master)).toBe(0);
    const converted = results[0].status === "fulfilled";
    expect(await stock(box)).toBe(converted ? 12 : 0);
    expect(
      await db.stockConversion.count({ where: { masterProductId: master } }),
    ).toBe(converted ? 1 : 0);
  });

  it("dos conversiones simultáneas con la misma clave crean una sola operación", async () => {
    const { master, box } = await pair(2);
    const dto = {
      requestKey: randomUUID(),
      masterProductId: master,
      masterQuantity: 1,
    };
    const results = await Promise.allSettled([
      inventory.convert(dto, actor),
      inventory.convert(dto, actor),
    ]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    await inventory.convert(dto, actor);
    expect(await stock(master)).toBe(1);
    expect(await stock(box)).toBe(12);
    expect(
      await db.stockConversion.count({ where: { requestKey: dto.requestKey } }),
    ).toBe(1);
  });
});
