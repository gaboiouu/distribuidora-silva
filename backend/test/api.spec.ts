import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { hash } from "argon2";
import { AppModule } from "../src/app.module";
import { Database } from "../src/common/database";
import { setup } from "../src/setup";
import { OperationsService } from "../src/operations/operations.service";

describe("API + PostgreSQL", () => {
  let app: INestApplication;
  let db: Database;
  let ops: OperationsService;
  let token: string;
  let actor: string;
  let product: string;
  let customer: string;
  let supplier: string;
  const prefix = "/api/v1";
  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes("silva_test"))
      throw new Error("Las pruebas requieren una base silva_test dedicada");
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    setup(app);
    await app.init();
    db = app.get(Database);
    ops = app.get(OperationsService);
    const email = `${randomUUID()}@test.example`;
    actor = (
      await db.user.create({
        data: {
          email,
          name: "Test",
          passwordHash: await hash("Test-password-123!"),
          role: "ADMIN",
        },
      })
    ).id;
    const login = await request(app.getHttpServer())
      .post(prefix + "/auth/login")
      .send({ email, password: "Test-password-123!" })
      .expect(201);
    token = login.body.accessToken;
    customer = (await db.customer.create({ data: { name: "Cliente prueba" } }))
      .id;
    supplier = (
      await db.supplier.create({ data: { name: "Proveedor prueba" } })
    ).id;
  });
  beforeEach(async () => {
    product = (
      await db.product.create({
        data: {
          sku: randomUUID(),
          name: "Sublime",
          presentation: "Caja 24",
          unitsPerBox: 24,
          price: "35.50",
          cost: "30.00",
          published: true,
        },
      })
    ).id;
  });
  afterAll(async () => {
    await app?.close();
  });
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const buy = (id: string, quantity: number) =>
    ops.purchase(
      {
        requestKey: randomUUID(),
        supplierId: supplier,
        items: [{ productId: id, quantity, unitCost: "30.00" }],
      },
      actor,
    );
  it("comprueba salud y rechaza acceso anónimo", async () => {
    await request(app.getHttpServer())
      .get(prefix + "/health")
      .expect(200);
    await request(app.getHttpServer())
      .get(prefix + "/sales")
      .expect(401);
    await request(app.getHttpServer())
      .get(prefix + "/sales")
      .set("Authorization", "Bearer invalid")
      .expect(401);
  });
  it("valida campos y prohíbe editar el stock directamente", async () => {
    await request(app.getHttpServer())
      .patch(prefix + "/products/" + product)
      .set(auth())
      .send({ stock: 999 })
      .expect(400);
    await request(app.getHttpServer())
      .post(prefix + "/sales")
      .set(auth())
      .send({
        requestKey: randomUUID(),
        customerId: customer,
        items: [{ productId: product, quantity: -1 }],
      })
      .expect(400);
  });
  it("catálogo público no expone costos ni inventario interno", async () => {
    const res = await request(app.getHttpServer())
      .get(prefix + "/catalog?take=100")
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const item of res.body) {
      expect(item.cost).toBeUndefined();
      expect(item.stock).toBeUndefined();
    }
  });
  it("registra venta, precio histórico y reintento sin duplicar stock", async () => {
    await buy(product, 10);
    const dto = {
      requestKey: randomUUID(),
      customerId: customer,
      items: [{ productId: product, quantity: 2 }],
    };
    const first = await ops.sale(dto, actor);
    const second = await ops.sale(dto, actor);
    expect(first.id).toBe(second.id);
    expect(first.total.toFixed(2)).toBe("71.00");
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: product } })).stock,
    ).toBe(8);
    await db.product.update({
      where: { id: product },
      data: { price: "40.00" },
    });
    expect(
      (
        await db.saleItem.findFirstOrThrow({ where: { saleId: first.id } })
      ).unitPrice.toFixed(2),
    ).toBe("35.50");
  });
  it("rechaza reutilizar clave de venta con otra cantidad", async () => {
    await buy(product, 5);
    const dto = {
      requestKey: randomUUID(),
      customerId: customer,
      items: [{ productId: product, quantity: 1 }],
    };
    await ops.sale(dto, actor);
    await expect(
      ops.sale({ ...dto, items: [{ productId: product, quantity: 2 }] }, actor),
    ).rejects.toThrow();
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: product } })).stock,
    ).toBe(4);
  });
  it("impide duplicar compra y gastos en reintentos", async () => {
    const dto = {
      requestKey: randomUUID(),
      supplierId: supplier,
      items: [{ productId: product, quantity: 3, unitCost: "30.00" }],
    };
    await ops.purchase(dto, actor);
    await ops.purchase(dto, actor);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: product } })).stock,
    ).toBe(3);
    const expense = {
      requestKey: randomUUID(),
      description: "Transporte",
      amount: "12.50",
    };
    const first = await ops.expense(expense, actor);
    expect((await ops.expense(expense, actor)).id).toBe(first.id);
    await expect(
      ops.expense({ ...expense, amount: "15.00" }, actor),
    ).rejects.toThrow();
  });
  it("revierte todos los descuentos de stock si un producto no alcanza", async () => {
    await buy(product, 5);
    const other = await db.product.create({
      data: {
        sku: randomUUID(),
        name: "Sin stock",
        presentation: "Caja",
        unitsPerBox: 24,
        price: "10.00",
        cost: "5.00",
      },
    });
    await expect(
      ops.sale(
        {
          requestKey: randomUUID(),
          customerId: customer,
          items: [
            { productId: product, quantity: 2 },
            { productId: other.id, quantity: 1 },
          ],
        },
        actor,
      ),
    ).rejects.toThrow();
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: product } })).stock,
    ).toBe(5);
  });
  it("dos ventas concurrentes no pueden vender la última caja dos veces", async () => {
    await buy(product, 1);
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        ops.sale(
          {
            requestKey: randomUUID(),
            customerId: customer,
            items: [{ productId: product, quantity: 1 }],
          },
          actor,
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: product } })).stock,
    ).toBe(0);
  });
  it("pagos parciales precisos, idempotentes y sin sobrepago", async () => {
    await buy(product, 1);
    const sale = await ops.sale(
      {
        requestKey: randomUUID(),
        customerId: customer,
        items: [{ productId: product, quantity: 1 }],
      },
      actor,
    );
    const dto = { requestKey: randomUUID(), amount: "10.10", method: "CASH" };
    await ops.payment(sale.id, dto, actor);
    await ops.payment(sale.id, dto, actor);
    expect(
      (
        await db.sale.findUniqueOrThrow({ where: { id: sale.id } })
      ).paid.toFixed(2),
    ).toBe("10.10");
    await expect(
      ops.payment(
        sale.id,
        { ...dto, requestKey: randomUUID(), amount: "25.41" },
        actor,
      ),
    ).rejects.toThrow();
    await ops.payment(
      sale.id,
      { ...dto, requestKey: randomUUID(), amount: "25.40" },
      actor,
    );
    expect(
      (
        await db.sale.findUniqueOrThrow({ where: { id: sale.id } })
      ).paid.toFixed(2),
    ).toBe("35.50");
  });
  it("pagos concurrentes no exceden la deuda", async () => {
    await buy(product, 1);
    const sale = await ops.sale(
      {
        requestKey: randomUUID(),
        customerId: customer,
        items: [{ productId: product, quantity: 1 }],
      },
      actor,
    );
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        ops.payment(
          sale.id,
          { requestKey: randomUUID(), amount: "30.00", method: "CASH" },
          actor,
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("restringe entregas a transiciones válidas", async () => {
    await buy(product, 1);
    const sale = await ops.sale(
      {
        requestKey: randomUUID(),
        customerId: customer,
        items: [{ productId: product, quantity: 1 }],
      },
      actor,
    );
    await expect(
      ops.delivery(sale.id, { status: "DELIVERED" }, actor),
    ).rejects.toThrow();
    await ops.delivery(sale.id, { status: "DISPATCHED" }, actor);
    await ops.delivery(sale.id, { status: "DELIVERED" }, actor);
    await expect(
      ops.delivery(sale.id, { status: "PENDING" }, actor),
    ).rejects.toThrow();
  });
  it("rota refresh una vez y revoca acceso al cerrar sesión", async () => {
    const email = `${randomUUID()}@test.example`;
    await db.user.create({
      data: {
        email,
        name: "Familiar",
        passwordHash: await hash("Test-password-123!"),
      },
    });
    await request(app.getHttpServer())
      .post(prefix + "/auth/login")
      .send({ email, password: "wrong" })
      .expect(401);
    const login = await request(app.getHttpServer())
      .post(prefix + "/auth/login")
      .send({ email, password: "Test-password-123!" })
      .expect(201);
    await request(app.getHttpServer())
      .post(prefix + "/products")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({})
      .expect(403);
    const refresh = await request(app.getHttpServer())
      .post(prefix + "/auth/refresh")
      .send({ refreshToken: login.body.refreshToken })
      .expect(201);
    await request(app.getHttpServer())
      .post(prefix + "/auth/refresh")
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
    await request(app.getHttpServer())
      .post(prefix + "/auth/logout")
      .set("Authorization", `Bearer ${refresh.body.accessToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .get(prefix + "/sales")
      .set("Authorization", `Bearer ${refresh.body.accessToken}`)
      .expect(401);
  });
});
