import { NubefactClient } from "../src/billing/nubefact.client";
import { config } from "../src/config";

describe("Contrato de respuestas NubeFact", () => {
  const client = new NubefactClient();
  const payload = {
    operacion: "consultar_comprobante",
    tipo_de_comprobante: 1,
    serie: "F001",
    numero: 1,
  };
  const saved = { url: config.NUBEFACT_API_URL, token: config.NUBEFACT_TOKEN };
  let fetchMock: jest.SpyInstance;
  beforeAll(() => {
    config.NUBEFACT_API_URL = "https://api.nubefact.com/api/v1/test-only";
    config.NUBEFACT_TOKEN = "test-only";
    fetchMock = jest.spyOn(globalThis, "fetch");
  });
  afterAll(() => {
    fetchMock.mockRestore();
    config.NUBEFACT_API_URL = saved.url;
    config.NUBEFACT_TOKEN = saved.token;
  });
  it.each([
    null,
    [],
    "not-json",
    { ...payload, aceptada_por_sunat: "false" },
    { ...payload, numero: 2, aceptada_por_sunat: true },
  ])("rechaza respuestas ambiguas o de otro documento %j", async (data) => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(data), { status: 200 }),
    );
    const result = await client.send(payload);
    expect(result.status).toBe("ERROR");
    expect(result.sunatAccepted).toBe(false);
  });
  it("distingue un error de autenticación de un rechazo fiscal", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ errors: "Token inválido", codigo: 10 }), {
        status: 401,
      }),
    );
    expect((await client.send(payload)).status).toBe("ERROR");
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...payload,
          aceptada_por_sunat: false,
          sunat_responsecode: "2335",
          sunat_description: "Rechazado",
        }),
      ),
    );
    expect((await client.send(payload)).status).toBe("REJECTED");
  });
});
