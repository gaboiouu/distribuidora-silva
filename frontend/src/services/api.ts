import {
  Customer,
  DashboardSummary,
  Invoice,
  Payment,
  Product,
  Purchase,
  Sale,
  StockMovement,
  Supplier,
  User,
} from "../types";
import type { FinancePeriod } from "../types";
import type { DashboardInsights } from "../types";

const BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

class ApiError extends Error {
  statusCode: number;
  data: unknown;
  constructor(message: string, statusCode: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.data = data;
  }
}

export const authStorage = {
  getToken: () => localStorage.getItem("silva_access_token"),
  setToken: (token: string) =>
    localStorage.setItem("silva_access_token", token),
  clearToken: () => localStorage.removeItem("silva_access_token"),
  getRefreshToken: () => localStorage.getItem("silva_refresh_token"),
  setRefreshToken: (token: string) =>
    localStorage.setItem("silva_refresh_token", token),
  clearAll: () => {
    localStorage.removeItem("silva_access_token");
    localStorage.removeItem("silva_refresh_token");
  },
};

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) return null;
  refreshInFlight = (async () => {
    const response = await fetch(`${BASE_URL.replace(/\/+$/, "")}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (response.status === 401) return null;
    if (!response.ok) throw new ApiError("No se pudo renovar la sesión", response.status);
    const data = await response.json() as { accessToken: string; refreshToken: string };
    if (authStorage.getRefreshToken() !== refreshToken) return null;
    authStorage.setToken(data.accessToken);
    authStorage.setRefreshToken(data.refreshToken);
    return data.accessToken;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${BASE_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;

  let res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401 && token && !endpoint.startsWith("auth/login")) {
    const latestToken = authStorage.getToken();
    const renewedToken = latestToken && latestToken !== token ? latestToken : await refreshAccessToken();
    if (renewedToken) {
      headers.Authorization = `Bearer ${renewedToken}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  if (!res.ok) {
    let errorDetail = `Error ${res.status}`;
    try {
      const errJson = await res.json();
      if (typeof errJson.error === "string") {
        errorDetail = errJson.error;
      } else if (errJson.error?.message) {
        errorDetail = Array.isArray(errJson.error.message)
          ? errJson.error.message.join(", ")
          : String(errJson.error.message);
      } else if (errJson.message) {
        errorDetail = Array.isArray(errJson.message)
          ? errJson.message.join(", ")
          : String(errJson.message);
      }
    } catch {
      errorDetail = await res.text().catch(() => `Error ${res.status}`);
    }

    if (res.status === 401 && token && !endpoint.startsWith("auth/login")) {
      authStorage.clearAll();
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    throw new ApiError(errorDetail, res.status);
  }

  return res.json() as Promise<T>;
}

export const api = {
  async getHealth(): Promise<{ status: string; environment: "development" | "staging" | "production" }> {
    return request("health");
  },
  // Auth
  async login(credentials: { email: string; password: string }) {
    const data = await request<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>("auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    authStorage.setToken(data.accessToken);
    authStorage.setRefreshToken(data.refreshToken);
    return data;
  },

  async logout() {
    try {
      await request("auth/logout", { method: "POST" });
    } finally {
      authStorage.clearAll();
    }
  },

  async getMe(): Promise<User> {
    return request<User>("auth/me");
  },

  // Public Catalog
  async getPublicCatalog(params?: { skip?: number; take?: number }) {
    const query = new URLSearchParams({
      skip: String(params?.skip ?? 0),
      take: String(params?.take ?? 100),
    });
    return request<
      Array<{
        id: string;
        sku: string;
        name: string;
        presentation: string;
        unitsPerBox: number;
        price: string;
      }>
    >(`catalog?${query}`);
  },

  // Dashboard
  async getDashboardSummary(): Promise<DashboardSummary> {
    return request<DashboardSummary>("dashboard/summary");
  },
  async getDashboardInsights(): Promise<DashboardInsights> {
    return request<DashboardInsights>("dashboard/insights");
  },
  async getAnnualFinance(year: number): Promise<{
    year: number;
    annual: FinancePeriod;
    months: FinancePeriod[];
  }> {
    return request(`finance/annual?year=${year}`);
  },

  // Products
  async getProducts(params?: { q?: string; skip?: number; take?: number }) {
    const query = new URLSearchParams({
      skip: String(params?.skip ?? 0),
      take: String(params?.take ?? 100),
      ...(params?.q ? { q: params.q } : {}),
    });
    return request<Product[]>(`products?${query}`);
  },

  async createProduct(data: {
    sku: string;
    name: string;
    presentation: string;
    unitsPerBox: number;
    price: string;
    cost: string;
    published?: boolean;
    active?: boolean;
    initialStock?: number;
  }) {
    return request<Product>("products", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateProduct(id: string, data: Partial<Product>) {
    return request<Product>(`products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async configurePackaging(
    id: string,
    data: { boxProductId: string; boxesPerMaster: number },
  ) {
    return request<Product>(`products/${id}/packaging`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Inventory
  async adjustStock(data: {
    productId: string;
    delta: number;
    reason: "INITIAL_STOCK" | "COUNT_CORRECTION" | "DAMAGE" | "OTHER";
    notes?: string;
  }) {
    return request("inventory/adjustments", {
      method: "POST",
      body: JSON.stringify({
        requestKey: crypto.randomUUID(),
        ...data,
      }),
    });
  },

  async convertMaster(data: {
    masterProductId: string;
    masterQuantity: number;
  }) {
    return request("inventory/conversions", {
      method: "POST",
      body: JSON.stringify({
        requestKey: crypto.randomUUID(),
        ...data,
      }),
    });
  },

  async getMovements(params?: { skip?: number; take?: number }) {
    const query = new URLSearchParams({
      skip: String(params?.skip ?? 0),
      take: String(params?.take ?? 50),
    });
    return request<StockMovement[]>(`inventory/movements?${query}`);
  },

  // Customers
  async getCustomers(params?: { q?: string; skip?: number; take?: number }) {
    const query = new URLSearchParams({
      skip: String(params?.skip ?? 0),
      take: String(params?.take ?? 100),
      ...(params?.q ? { q: params.q } : {}),
    });
    return request<Customer[]>(`customers?${query}`);
  },

  async createCustomer(data: {
    name: string;
    document?: string;
    phone?: string;
    address?: string;
  }) {
    return request<Customer>("customers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateCustomer(id: string, data: Partial<Customer>) {
    return request<Customer>(`customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Suppliers
  async getSuppliers(params?: { q?: string; skip?: number; take?: number }) {
    const query = new URLSearchParams({
      skip: String(params?.skip ?? 0),
      take: String(params?.take ?? 100),
      ...(params?.q ? { q: params.q } : {}),
    });
    return request<Supplier[]>(`suppliers?${query}`);
  },

  async createSupplier(data: {
    name: string;
    document?: string;
    phone?: string;
  }) {
    return request<Supplier>("suppliers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Sales
  async getSales(params?: {
    customerId?: string;
    status?: string;
    skip?: number;
    take?: number;
  }) {
    const query = new URLSearchParams({
      skip: String(params?.skip ?? 0),
      take: String(params?.take ?? 50),
      ...(params?.customerId ? { customerId: params.customerId } : {}),
      ...(params?.status ? { status: params.status } : {}),
    });
    return request<Sale[]>(`sales?${query}`);
  },

  async getSaleById(id: string): Promise<Sale> {
    return request<Sale>(`sales/${id}`);
  },

  async createSale(data: {
    customerId: string;
    items: Array<{ productId: string; quantity: number; unitPrice?: string }>;
    dueAt?: string;
  }) {
    return request<Sale>("sales", {
      method: "POST",
      body: JSON.stringify({
        requestKey: crypto.randomUUID(),
        ...data,
      }),
    });
  },

  async addPayment(
    saleId: string,
    data: { amount: string; method: "CASH" | "TRANSFER" | "YAPE" | "PLIN" },
  ) {
    return request<Payment>(`sales/${saleId}/payments`, {
      method: "POST",
      body: JSON.stringify({
        requestKey: crypto.randomUUID(),
        ...data,
      }),
    });
  },

  async updateDelivery(
    saleId: string,
    status: "PENDING" | "DISPATCHED" | "DELIVERED" | "PICKED_UP",
  ) {
    return request<Sale>(`sales/${saleId}/delivery`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async cancelSale(saleId: string, reason: string) {
    return request<Sale>(`sales/${saleId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  async returnSale(saleId: string, data: { reason: string; items: Array<{ productId: string; quantity: number }>; refundMethod?: "CASH" | "TRANSFER" | "YAPE" | "PLIN" }) {
    return request(`sales/${saleId}/returns`, { method: "POST", body: JSON.stringify({ requestKey: crypto.randomUUID(), ...data }) });
  },

  // Receivables (Cuentas por Cobrar)
  async getReceivables(params?: { skip?: number; take?: number }) {
    const query = new URLSearchParams({
      skip: String(params?.skip ?? 0),
      take: String(params?.take ?? 50),
    });
    return request<Sale[]>(`receivables?${query}`);
  },

  // Purchases
  async getPurchases(params?: { skip?: number; take?: number }) {
    const query = new URLSearchParams({
      skip: String(params?.skip ?? 0),
      take: String(params?.take ?? 50),
    });
    return request<Purchase[]>(`purchases?${query}`);
  },
  async getPendingPurchaseInstallments() {
    return request<Array<{ id: string; number: number; amount: string; dueAt: string; purchaseId: string; purchase: { id: string; cardName: string | null; supplier: { name: string } } }>>("purchases/installments");
  },

  async createPurchase(data: {
    supplierId: string;
    purchasedAt?: string;
    items: Array<{ productId: string; quantity: number; unitCost: string }>;
    paymentMethod?: "CASH" | "CARD" | "TRANSFER";
    cardName?: string;
    installments?: Array<{ amount: string; dueAt: string }>;
  }) {
    return request<Purchase>("purchases", {
      method: "POST",
      body: JSON.stringify({
        requestKey: crypto.randomUUID(),
        ...data,
      }),
    });
  },

  async payPurchaseInstallment(purchaseId: string, installmentId: string) {
    return request(`purchases/${purchaseId}/installments/${installmentId}/pay`, { method: "PATCH" });
  },

  // Expenses & Cash
  async getExpenses(params?: { skip?: number; take?: number }) {
    const query = new URLSearchParams({
      skip: String(params?.skip ?? 0),
      take: String(params?.take ?? 50),
    });
    return request<
      Array<{
        id: string;
        description: string;
        amount: string;
        createdAt: string;
      }>
    >(`expenses?${query}`);
  },

  async createExpense(data: { description: string; amount: string }) {
    return request("expenses", {
      method: "POST",
      body: JSON.stringify({
        requestKey: crypto.randomUUID(),
        ...data,
      }),
    });
  },

  async getCashSummary() {
    return request<{
      collections: string;
      cardPayments: string;
      expenses: string;
      scope: string;
    }>("cash/summary");
  },

  // Billing / SUNAT
  async getBillingConfig() {
    return request<{ provider: "DISABLED" | "NUBEFACT"; configured: boolean; missing: string[] }>("billing/config");
  },
  async checkBillingConnection() {
    return request<{ configured: boolean; authenticated: boolean; description?: string }>("billing/check", {
      method: "POST",
    });
  },
  async getInvoices(params?: {
    type?: string;
    status?: string;
    saleId?: string;
    q?: string;
    skip?: number;
    take?: number;
  }) {
    const query = new URLSearchParams({
      skip: String(params?.skip ?? 0),
      take: String(params?.take ?? 50),
      ...(params?.type ? { type: params.type } : {}),
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.saleId ? { saleId: params.saleId } : {}),
      ...(params?.q ? { q: params.q } : {}),
    });
    return request<Invoice[]>(`invoices?${query}`);
  },

  async getInvoiceById(id: string) {
    return request<Invoice>(`invoices/${id}`);
  },

  async issueSaleInvoice(
    saleId: string,
    data: {
      type: "FACTURA" | "BOLETA";
      igvType?: "GRAVADO" | "EXONERADO" | "INAFECTO";
      serie?: string;
      customerDocumentType?: "6" | "1" | "-";
      customerDocument?: string;
      customerName?: string;
      customerAddress?: string;
    },
  ) {
    return request<Invoice>(`sales/${saleId}/invoices`, {
      method: "POST",
      body: JSON.stringify({
        requestKey: crypto.randomUUID(),
        ...data,
      }),
    });
  },

  async issueCreditNote(
    invoiceId: string,
    data: {
      reason: string;
      creditNoteCode?: string;
      serie?: string;
      cancelSale?: boolean;
    },
  ) {
    return request<Invoice>(`invoices/${invoiceId}/credit-notes`, {
      method: "POST",
      body: JSON.stringify({
        requestKey: crypto.randomUUID(),
        ...data,
      }),
    });
  },

  async issueGuide(
    saleId: string,
    data: {
      transferStartDate: string;
      grossWeight: string;
      packages: number;
      startAddress: string;
      endAddress: string;
      carrierDoc?: string;
      carrierName?: string;
      plate?: string;
      reasonCode?: string;
      serie?: string;
    },
  ) {
    return request<Invoice>(`sales/${saleId}/guides`, {
      method: "POST",
      body: JSON.stringify({
        requestKey: crypto.randomUUID(),
        ...data,
      }),
    });
  },

  async syncInvoice(id: string) {
    return request<Invoice>(`invoices/${id}/sync`, { method: "POST" });
  },

  // Users (ADMIN)
  async getUsers(params?: { skip?: number; take?: number }) {
    const query = new URLSearchParams({
      skip: String(params?.skip ?? 0),
      take: String(params?.take ?? 50),
    });
    return request<User[]>(`users?${query}`);
  },

  async createUser(data: {
    email: string;
    name: string;
    password: string;
    role?: "ADMIN" | "MEMBER";
  }) {
    return request<User>("users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateUser(
    id: string,
    data: { name?: string; role?: "ADMIN" | "MEMBER"; active?: boolean },
  ) {
    return request<User>(`users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async resetUserPassword(id: string, password: string) {
    return request<{ ok: boolean }>(`users/${id}/password`, {
      method: "PATCH",
      body: JSON.stringify({ password }),
    });
  },
};

