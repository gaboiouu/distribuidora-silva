import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { hash } from "argon2";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { Database } from "../src/common/database";
import { config } from "../src/config";
import { setup } from "../src/setup";
import { OperationsService } from "../src/operations/operations.service";
import { BillingService } from "../src/billing/billing.service";

describe("Facturación y acceso familiar con PostgreSQL", () => {
  let app: INestApplication;
  let db: Database;
  let operations: OperationsService;
  let billing: BillingService;
  let actor: string;
  let token: string;
  let customerId: string;
  let fetchMock: jest.SpyInstance;
  const remote = new Map<string, Record<string, unknown>>();
  const sent: Record<string, unknown>[] = [];
  const savedConfig = {
    url: config.NUBEFACT_API_URL,
    token: config.NUBEFACT_TOKEN,
    provider: config.BILLING_PROVIDER,
  };
  const prefix = "/api/v1";
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const response = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status });
  const key = (data: Record<string, unknown>) =>
    `${data.tipo_de_comprobante}-${data.serie}-${data.numero}`;

  beforeAll(async () => {
    if (new URL(process.env.DATABASE_URL ?? "").pathname !== "/silva_test")
      throw new Error("Usa silva_test");
    config.BILLING_PROVIDER = "NUBEFACT";
    config.NUBEFACT_API_URL = "https://api.nubefact.com/api/v1/test-only";
    config.NUBEFACT_TOKEN = "test-only";
    fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, options) => {
        const payload = JSON.parse(String(options?.body));
        if (payload.operacion.startsWith("consultar"))
          return response(
            remote.get(key(payload)) ?? {
              errors: "El documento no existe",
              codigo: 24,
            },
          );
        sent.push(payload);
        const result = {
          tipo_de_comprobante: payload.tipo_de_comprobante,
          serie: payload.serie,
          numero: payload.numero,
          aceptada_por_sunat: true,
          sunat_responsecode: "0",
          sunat_description: "Aceptado",
          enlace_del_pdf: "https://example.test/invoice.pdf",
          enlace_del_xml: "https://example.test/invoice.xml",
          enlace_del_cdr: "https://example.test/invoice.cdr",
        };
        remote.set(key(payload), result);
        return response(result);
      });
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    setup(app);
    await app.init();
    db = app.get(Database);
    operations = app.get(OperationsService);
    billing = app.get(BillingService);
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
    token = (
      await request(app.getHttpServer())
        .post(prefix + "/auth/login")
        .send({ email, password: "Test-password-123!" })
        .expect(201)
    ).body.accessToken;
    customerId = (
      await db.customer.create({
        data: {
          name: "Cliente de prueba",
          document: randomUUID()
            .replace(/\D/g, "")
            .padEnd(11, "1")
            .slice(0, 11),
          address: "Dirección de prueba",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app?.close();
    fetchMock?.mockRestore();
    config.NUBEFACT_API_URL = savedConfig.url;
    config.NUBEFACT_TOKEN = savedConfig.token;
    config.BILLING_PROVIDER = savedConfig.provider;
  });

  async function sale(dueAt?: string) {
    const product = await db.product.create({
      data: {
        sku: randomUUID(),
        name: "Sublime",
        presentation: "Caja",
        unitsPerBox: 24,
        price: "118.00",
        cost: "80.00",
        stock: 5,
      },
    });
    const created = await operations.sale(
      {
        requestKey: randomUUID(),
        customerId,
        items: [{ productId: product.id, quantity: 2 }],
        dueAt,
      },
      actor,
    );
    return { ...created, productId: product.id };
  }

  async function issue(saleId: string) {
    return request(app.getHttpServer())
      .post(`${prefix}/sales/${saleId}/invoices`)
      .set(auth())
      .send({ requestKey: randomUUID(), type: "FACTURA" })
      .expect(201);
  }

  it("ADMIN administra usuarios y MEMBER no accede a esa función", async () => {
    const me = await request(app.getHttpServer())
      .get(prefix + "/auth/me")
      .set(auth())
      .expect(200);
    expect(me.body.role).toBe("ADMIN");
    expect(me.body.passwordHash).toBeUndefined();
    const email = `${randomUUID()}@test.example`;
    const user = await request(app.getHttpServer())
      .post(prefix + "/users")
      .set(auth())
      .send({ email, name: "Familiar", password: "Test-password-123!" })
      .expect(201);
    expect(user.body.passwordHash).toBeUndefined();
    const login = await request(app.getHttpServer())
      .post(prefix + "/auth/login")
      .send({ email, password: "Test-password-123!" })
      .expect(201);
    await request(app.getHttpServer())
      .get(prefix + "/users")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`${prefix}/users/${user.body.id}`)
      .set(auth())
      .send({ active: false })
      .expect(200);
    await request(app.getHttpServer())
      .get(prefix + "/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .patch(`${prefix}/users/${actor}`)
      .set(auth())
      .send({ active: false })
      .expect(400);
    await request(app.getHttpServer())
      .get(prefix + "/dashboard/summary")
      .set(auth())
      .expect(200);
  });

  it("consulta la configuración y verifica credenciales sin generar documentos", async () => {
    await request(app.getHttpServer())
      .get(prefix + "/billing/config")
      .expect(401);
    const configuration = await request(app.getHttpServer())
      .get(prefix + "/billing/config")
      .set(auth())
      .expect(200);
    expect(configuration.body.configured).toBe(true);
    expect(configuration.body.token).toBeUndefined();
    const count = sent.length;
    const check = await request(app.getHttpServer())
      .post(prefix + "/billing/check")
      .set(auth())
      .expect(201);
    expect(check.body.authenticated).toBe(true);
    expect(sent).toHaveLength(count);
  });

  it("factura la venta al crédito con IGV, cuota y fecha peruana, con idempotencia", async () => {
    const order = await sale("2030-03-12");
    const dto = { requestKey: randomUUID(), type: "FACTURA" };
    const invoice = await request(app.getHttpServer())
      .post(`${prefix}/sales/${order.id}/invoices`)
      .set(auth())
      .send(dto)
      .expect(201);
    expect(invoice.body.sunatAccepted).toBe(true);
    expect(invoice.body.total).toBe("236");
    expect(invoice.body.igv).toBe("36");
    expect(invoice.body.providerPayload.venta_al_credito).toEqual([
      { cuota: 1, fecha_de_pago: "12-03-2030", importe: 236 },
    ]);
    const count = sent.length;
    const retry = await request(app.getHttpServer())
      .post(`${prefix}/sales/${order.id}/invoices`)
      .set(auth())
      .send(dto)
      .expect(201);
    expect(retry.body.id).toBe(invoice.body.id);
    expect(sent).toHaveLength(count);
    await request(app.getHttpServer())
      .post(`${prefix}/sales/${order.id}/invoices`)
      .set(auth())
      .send({ ...dto, customerName: "Otro cliente" })
      .expect(409);
    await request(app.getHttpServer())
      .post(`${prefix}/sales/${order.id}/invoices`)
      .set(auth())
      .send({ ...dto, requestKey: randomUUID() })
      .expect(409);
    await request(app.getHttpServer())
      .post(`${prefix}/sales/${order.id}/cancel`)
      .set(auth())
      .send({ reason: "Prueba de anulación" })
      .expect(409);
  });

  it("conserva la aceptación y los archivos ante un error posterior de NubeFact", async () => {
    const order = await sale();
    const invoice = await issue(order.id);
    fetchMock.mockResolvedValueOnce(
      response({ errors: "Servicio no disponible", codigo: 40 }, 503),
    );
    const sync = await request(app.getHttpServer())
      .post(`${prefix}/invoices/${invoice.body.id}/sync`)
      .set(auth())
      .expect(201);
    expect(sync.body.status).toBe("ACCEPTED");
    expect(sync.body.sunatAccepted).toBe(true);
    expect(sync.body.pdfUrl).toBe(invoice.body.pdfUrl);
    expect(sync.body.lastSyncError).toBeTruthy();
  });

  it("recupera un envío aceptado cuya respuesta se perdió sin volver a generarlo", async () => {
    const order = await sale();
    const normal = fetchMock.getMockImplementation()!;
    fetchMock
      .mockImplementationOnce(normal)
      .mockImplementationOnce(async (url: unknown, options: unknown) => {
        await normal(url, options);
        throw new Error("Respuesta perdida");
      });
    const invoice = await issue(order.id);
    expect(invoice.body.status).toBe("ERROR");
    const count = sent.length;
    const sync = await request(app.getHttpServer())
      .post(`${prefix}/invoices/${invoice.body.id}/sync`)
      .set(auth())
      .expect(201);
    expect(sync.body.sunatAccepted).toBe(true);
    expect(sent).toHaveLength(count);
  });

  it("la nota total usa el detalle fiscal histórico y cancela una sola vez tras sincronizar", async () => {
    const order = await sale();
    const invoice = await issue(order.id);
    await db.product.update({
      where: { id: order.productId },
      data: { name: "Nombre modificado" },
    });
    const normal = fetchMock.getMockImplementation()!;
    fetchMock
      .mockImplementationOnce(normal)
      .mockImplementationOnce(async (url: unknown, options: unknown) => {
        const result = await normal(url, options);
        const data = await result.json();
        remote.set(key(data), { ...data, aceptada_por_sunat: true });
        return response({
          ...data,
          aceptada_por_sunat: false,
          sunat_responsecode: null,
        });
      });
    const note = await request(app.getHttpServer())
      .post(`${prefix}/invoices/${invoice.body.id}/credit-notes`)
      .set(auth())
      .send({
        requestKey: randomUUID(),
        reason: "Devolución total",
        creditNoteCode: "06",
        cancelSale: true,
      })
      .expect(201);
    expect(note.body.status).toBe("PENDING");
    expect(note.body.providerPayload.items).toEqual(
      invoice.body.providerPayload.items,
    );
    expect(note.body.providerPayload.observaciones).toBe("Devolución total");
    await request(app.getHttpServer())
      .post(`${prefix}/invoices/${note.body.id}/sync`)
      .set(auth())
      .expect(201);
    await request(app.getHttpServer())
      .post(`${prefix}/invoices/${note.body.id}/sync`)
      .set(auth())
      .expect(201);
    expect(
      (await db.sale.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe("CANCELLED");
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: order.productId } }))
        .stock,
    ).toBe(5);
    expect(
      await db.stockMovement.count({
        where: { reference: order.id, reason: "SALE_CANCEL" },
      }),
    ).toBe(1);
    await request(app.getHttpServer())
      .post(`${prefix}/invoices/${invoice.body.id}/credit-notes`)
      .set(auth())
      .send({
        requestKey: randomUUID(),
        reason: "Otra devolución",
        creditNoteCode: "06",
      })
      .expect(409);
    await request(app.getHttpServer())
      .post(`${prefix}/invoices/${invoice.body.id}/credit-notes`)
      .set(auth())
      .send({
        requestKey: randomUUID(),
        reason: "Parcial sin detalle",
        creditNoteCode: "07",
      })
      .expect(400);
  });

  it("deja pendiente un documento sin credenciales y bloquea la cancelación hasta resolverlo", async () => {
    const order = await sale();
    config.NUBEFACT_TOKEN = undefined;
    let invoice;
    try {
      invoice = await issue(order.id);
    } finally {
      config.NUBEFACT_TOKEN = "test-only";
    }
    expect(invoice.body.status).toBe("PENDING");
    expect(invoice.body.sentAt).toBeNull();
    await request(app.getHttpServer())
      .post(`${prefix}/sales/${order.id}/cancel`)
      .set(auth())
      .send({ reason: "Cancelar pendiente" })
      .expect(409);
    const sync = await request(app.getHttpServer())
      .post(`${prefix}/invoices/${invoice.body.id}/sync`)
      .set(auth())
      .expect(201);
    expect(sync.body.sunatAccepted).toBe(true);
  });

  it("envía guía con ubigeos y conductor sin desplazar la fecha del traslado", async () => {
    const order = await sale();
    const dto = {
      requestKey: randomUUID(),
      transferStartDate: "2030-03-12",
      grossWeight: "25.50",
      packages: 2,
      startAddress: "Dirección origen",
      endAddress: "Dirección destino",
      startUbigeo: "150101",
      endUbigeo: "150101",
      transportType: "02",
      driverDocument: "12345678",
      driverName: "Conductor",
      driverLastName: "Prueba",
      driverLicense: "Q12345678",
      plate: "ABC123",
    };
    const guide = await request(app.getHttpServer())
      .post(`${prefix}/sales/${order.id}/guides`)
      .set(auth())
      .send(dto)
      .expect(201);
    expect(guide.body.providerPayload.fecha_de_inicio_de_traslado).toBe(
      "12-03-2030",
    );
    expect(guide.body.providerPayload.punto_de_partida_ubigeo).toBe("150101");
    expect(guide.body.providerPayload.conductor_numero_licencia).toBe(
      "Q12345678",
    );
  });

  it("protege correlativos y detecta un número ocupado en NubeFact", async () => {
    const serie = "F" + randomUUID().slice(0, 3).toUpperCase();
    await request(app.getHttpServer())
      .patch(prefix + "/billing/sequences")
      .set(auth())
      .send({ serie, lastNumber: 100 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(prefix + "/billing/sequences")
      .set(auth())
      .send({ serie, lastNumber: 99 })
      .expect(409);
    remote.set(`1-${serie}-101`, {
      serie,
      numero: 101,
      tipo_de_comprobante: 1,
      aceptada_por_sunat: true,
    });
    const order = await sale();
    const invoice = await request(app.getHttpServer())
      .post(`${prefix}/sales/${order.id}/invoices`)
      .set(auth())
      .send({ requestKey: randomUUID(), type: "FACTURA", serie })
      .expect(201);
    expect(invoice.body.status).toBe("ERROR");
    expect(invoice.body.sunatAccepted).toBe(false);
    expect(invoice.body.lastSyncError).toContain("ya existen");
  });

  it("un bloqueo de sincronización impide solicitudes simultáneas al proveedor", async () => {
    const order = await sale();
    const invoice = await issue(order.id);
    await db.invoice.update({
      where: { id: invoice.body.id },
      data: {
        syncLockToken: randomUUID(),
        syncLockedUntil: new Date(Date.now() + 60000),
      },
    });
    const count = fetchMock.mock.calls.length;
    await expect(billing.syncInvoice(invoice.body.id, actor)).rejects.toThrow(
      "sincronizando",
    );
    expect(fetchMock.mock.calls.length).toBe(count);
  });
});
