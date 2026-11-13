export type Role = "ADMIN" | "MEMBER";

export type DeliveryStatus =
  | "PENDING"
  | "DISPATCHED"
  | "DELIVERED"
  | "PICKED_UP";

export type SaleStatus = "ACTIVE" | "CANCELLED";

export type InvoiceType =
  | "FACTURA"
  | "BOLETA"
  | "NOTA_CREDITO"
  | "GUIA_REMISION";

export type SunatStatus =
  | "PENDING"
  | "ACCEPTED"
  | "OBSERVED"
  | "REJECTED"
  | "ERROR";

export type IgvType = "GRAVADO" | "EXONERADO" | "INAFECTO";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  presentation: string;
  unitsPerBox: number;
  price: string;
  cost: string;
  stock: number;
  active: boolean;
  published: boolean;
  boxProductId?: string | null;
  boxesPerMaster?: number | null;
  boxProduct?: Product | null;
  createdAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  document?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  document?: string | null;
  phone?: string | null;
}

export interface SaleItem {
  id: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitPrice: string;
  unitCost: string;
}

export interface Payment {
  id: string;
  requestKey: string;
  saleId: string;
  amount: string;
  method: "CASH" | "TRANSFER" | "YAPE" | "PLIN";
  createdAt: string;
}

export interface Invoice {
  id: string;
  requestKey: string;
  saleId?: string | null;
  relatedInvoiceId?: string | null;
  type: InvoiceType;
  serie: string;
  number: number;
  customerDocumentType: string;
  customerDocument: string;
  customerName: string;
  customerAddress?: string | null;
  igvType: IgvType;
  subtotal: string;
  igv: string;
  total: string;
  status: SunatStatus;
  sunatAccepted: boolean;
  sunatDescription?: string | null;
  sunatNote?: string | null;
  sunatResponseCode?: string | null;
  sunatSoapError?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  cdrUrl?: string | null;
  providerPayload?: { fecha_de_emision?: string; moneda?: number; items?: Array<{ unidad_de_medida: string; codigo: string; descripcion: string; cantidad: number; valor_unitario: number; precio_unitario: number; total: number }> } | null;
  createdAt: string;
}

export interface Sale {
  id: string;
  requestKey: string;
  customerId: string;
  customer: Customer;
  total: string;
  paid: string;
  dueAt?: string | null;
  delivery: DeliveryStatus;
  status: SaleStatus;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  items: SaleItem[];
  payments: Payment[];
  returns?: Array<{ id: string; reason: string; creditAmount: string; refundAmount: string; refundMethod?: string | null; createdAt: string; items: Array<{ productId: string; quantity: number }> }>;
  invoices?: Invoice[];
  createdAt: string;
}

export interface PurchaseItem {
  id: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitCost: string;
}

export interface Purchase {
  id: string;
  requestKey: string;
  supplierId: string;
  supplier?: Supplier;
  total: string;
  paymentMethod: "CASH" | "CARD" | "TRANSFER";
  cardName?: string | null;
  installments: Array<{ id: string; number: number; amount: string; dueAt: string; paidAt?: string | null }>;
  purchasedAt: string;
  items: PurchaseItem[];
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  product?: Product;
  quantity: number;
  reason: string;
  reference?: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  todaySalesCount: number;
  todaySalesTotal: string;
  receivablesCount: number;
  receivablesTotal: string;
  lowStockProductsCount: number;
  pendingDeliveriesCount: number;
  sunatAttentionCount: number;
}
export interface FinancePeriod {
  month: number;
  investment: string;
  revenue: string;
  goodsCost: string;
  expenses: string;
  estimatedProfit: string;
}
export interface DashboardInsights {
  days: { date: string; total: string; orders: number }[];
  topProducts: { name: string; boxes: number }[];
  recentSales: { id: string; customer: string; total: string; paid: string; createdAt: string }[];
  monthSales: string;
  orderCount: number;
}

