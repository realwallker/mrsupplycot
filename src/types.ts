export type Product = {
  id: string;
  sourceId?: number;
  sku: string;
  ean: string;
  brand: string;
  name: string;
  searchName: string;
  category: string;
  subcategory: string;
  presentation: string;
  content: string;
  unit: string;
  flavor: string;
  format: string;
  cost: number;
  pvp: number;
  supplier: string;
  status: string;
  imageUrl: string;
  stock: string;
  deliveryDays: number;
  notes: string;
  updatedAt: string;
};

export type QuoteItem = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  presentation: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export type QuoteStatus = "Borrador" | "Enviada" | "Aprobada" | "Vencida" | "Anulada";

export type Quote = {
  id: string;
  number: string;
  clientName: string;
  clientId: string;
  clientPhone: string;
  clientEmail: string;
  issuedAt: string;
  validUntil: string;
  status: QuoteStatus;
  taxRate: number;
  globalDiscount: number;
  notes: string;
  items: QuoteItem[];
  createdBy: string;
  updatedAt: string;
};

export type AppUser = { id: string; email: string; name: string };

export const emptyProduct = (): Product => ({
  id: crypto.randomUUID(), sourceId: 0, sku: "", ean: "", brand: "", name: "",
  searchName: "", category: "", subcategory: "", presentation: "", content: "",
  unit: "", flavor: "", format: "", cost: 0, pvp: 0, supplier: "",
  status: "Activo", imageUrl: "", stock: "pedido", deliveryDays: 7, notes: "",
  updatedAt: new Date().toISOString(),
});

export const emptyQuote = (_sequence = 1): Quote => {
  const now = new Date();
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + 7);
  const dateCode = now.toISOString().slice(2, 10).replaceAll("-", "");
  const uniqueCode = crypto.randomUUID().slice(0, 4).toUpperCase();
  return {
    id: crypto.randomUUID(),
    number: `COT-${dateCode}-${uniqueCode}`,
    clientName: "", clientId: "", clientPhone: "", clientEmail: "",
    issuedAt: now.toISOString().slice(0, 10),
    validUntil: expiry.toISOString().slice(0, 10),
    status: "Borrador", taxRate: 0, globalDiscount: 0, notes: "",
    items: [], createdBy: "", updatedAt: now.toISOString(),
  };
};

export const quoteTotals = (quote: Quote) => {
  const subtotal = quote.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discount / 100), 0,
  );
  const afterDiscount = subtotal * (1 - quote.globalDiscount / 100);
  const tax = afterDiscount * (quote.taxRate / 100);
  return { subtotal, discount: subtotal - afterDiscount, tax, total: afterDiscount + tax };
};
