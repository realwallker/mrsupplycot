import seedProducts from "../data/catalog.json";
import type { AppUser, Product, Quote, QuoteItem } from "../types";
import { hasSupabase, supabase } from "./supabase";

type Listener = () => void;
const PRODUCTS_KEY = "mrsupply.products.v1";
const QUOTES_KEY = "mrsupply.quotes.v1";

const productFromDb = (row: Record<string, unknown>): Product => ({
  id: String(row.id), sourceId: Number(row.source_id ?? 0), sku: String(row.sku ?? ""),
  ean: String(row.ean ?? ""), brand: String(row.brand ?? ""), name: String(row.name ?? ""),
  searchName: String(row.search_name ?? ""), category: String(row.category ?? ""),
  subcategory: String(row.subcategory ?? ""), presentation: String(row.presentation ?? ""),
  content: String(row.content ?? ""), unit: String(row.unit ?? ""), flavor: String(row.flavor ?? ""),
  format: String(row.format ?? ""), cost: Number(row.cost ?? 0), pvp: Number(row.pvp ?? 0),
  supplier: String(row.supplier ?? ""), status: String(row.status ?? "Activo"),
  imageUrl: String(row.image_url ?? ""), stock: String(row.stock ?? ""),
  deliveryDays: Number(row.delivery_days ?? 0), notes: String(row.notes ?? ""),
  updatedAt: String(row.updated_at ?? new Date().toISOString()),
});

const productToDb = (product: Product) => ({
  id: product.id, source_id: product.sourceId || null, sku: product.sku || null, ean: product.ean || null,
  brand: product.brand, name: product.name, search_name: product.searchName, category: product.category,
  subcategory: product.subcategory, presentation: product.presentation, content: product.content,
  unit: product.unit, flavor: product.flavor, format: product.format, cost: product.cost, pvp: product.pvp,
  supplier: product.supplier, status: product.status, image_url: product.imageUrl, stock: product.stock,
  delivery_days: product.deliveryDays, notes: product.notes, updated_at: new Date().toISOString(),
});

const quoteFromDb = (row: Record<string, unknown>, items: Record<string, unknown>[]): Quote => ({
  id: String(row.id), number: String(row.number), clientName: String(row.client_name ?? ""),
  clientId: String(row.client_id ?? ""), clientPhone: String(row.client_phone ?? ""),
  clientEmail: String(row.client_email ?? ""), issuedAt: String(row.issued_at ?? ""),
  validUntil: String(row.valid_until ?? ""), status: row.status as Quote["status"],
  taxRate: Number(row.tax_rate ?? 0), globalDiscount: Number(row.global_discount ?? 0),
  notes: String(row.notes ?? ""), createdBy: String(row.created_by ?? ""),
  updatedAt: String(row.updated_at ?? new Date().toISOString()),
  items: items.filter((item) => item.quote_id === row.id).map((item): QuoteItem => ({
    id: String(item.id), productId: String(item.product_id ?? ""), sku: String(item.sku ?? ""),
    name: String(item.name ?? ""), presentation: String(item.presentation ?? ""),
    imageUrl: String(item.image_url ?? ""), quantity: Number(item.quantity ?? 1),
    unitPrice: Number(item.unit_price ?? 0), discount: Number(item.discount ?? 0),
  })),
});

class DataService {
  products: Product[] = [];
  quotes: Quote[] = [];
  user: AppUser = { id: "local", email: "demo@mrsupply.local", name: "Administrador" };
  ready = false;
  online = hasSupabase;
  private listeners = new Set<Listener>();
  private initialized = false;
  private remoteMutationDepth = 0;
  private remoteReloadTimer: number | null = null;
  private channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("mrsupply-sync") : null;

  constructor() {
    this.channel?.addEventListener("message", () => this.reloadLocal());
    window.addEventListener("storage", () => this.reloadLocal());
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit() { this.listeners.forEach((listener) => listener()); }
  private broadcast() { this.channel?.postMessage({ at: Date.now() }); }
  private scheduleRemoteReload(delay = 320) {
    if (!supabase) return;
    if (this.remoteReloadTimer !== null) window.clearTimeout(this.remoteReloadTimer);
    this.remoteReloadTimer = window.setTimeout(() => {
      this.remoteReloadTimer = null;
      if (this.remoteMutationDepth > 0) { this.scheduleRemoteReload(delay); return; }
      void this.reloadRemote();
    }, delay);
  }

  private async runRemoteMutation(action: () => Promise<void>) {
    this.remoteMutationDepth += 1;
    try { await action(); }
    finally { this.remoteMutationDepth -= 1; }
    if (this.remoteReloadTimer !== null) {
      window.clearTimeout(this.remoteReloadTimer);
      this.remoteReloadTimer = null;
    }
    await this.reloadRemote();
  }

  private reloadLocal() {
    if (hasSupabase) return;
    this.products = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "null") || seedProducts;
    this.quotes = JSON.parse(localStorage.getItem(QUOTES_KEY) || "[]");
    this.ready = true;
    this.emit();
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;
    if (!supabase) { this.reloadLocal(); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) this.user = {
      id: auth.user.id, email: auth.user.email ?? "", name: auth.user.user_metadata?.name || auth.user.email?.split("@")[0] || "Usuario",
    };
    await this.reloadRemote();
    if (this.products.length === 0) await this.importProducts(seedProducts as Product[]);
    if (auth.user) await this.syncSeedImages();
    supabase.channel("mr-supply-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => this.scheduleRemoteReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, () => this.scheduleRemoteReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "quote_items" }, () => this.scheduleRemoteReload())
      .subscribe();
  }

  private async syncSeedImages() {
    if (!supabase) return;
    const seededBySku = new Map((seedProducts as Product[]).filter((product) => product.sku && product.imageUrl).map((product) => [product.sku, product.imageUrl]));
    const updates = this.products
      .filter((product) => !product.imageUrl && seededBySku.has(product.sku))
      .map((product) => ({ ...product, imageUrl: seededBySku.get(product.sku) ?? "" }));
    if (!updates.length) return;
    const { error } = await supabase.from("products").upsert(updates.map(productToDb), { onConflict: "sku" });
    if (error) throw error;
    await this.reloadRemote();
  }

  private async reloadRemote() {
    if (!supabase) return;
    const [{ data: products, error: productError }, { data: quotes, error: quoteError }, { data: items, error: itemError }] = await Promise.all([
      supabase.from("products").select("*").order("brand").order("name"),
      supabase.from("quotes").select("*").order("updated_at", { ascending: false }),
      supabase.from("quote_items").select("*").order("position"),
    ]);
    if (productError || quoteError || itemError) throw productError || quoteError || itemError;
    this.products = (products ?? []).map((row) => productFromDb(row));
    this.quotes = (quotes ?? []).map((row) => quoteFromDb(row, items ?? []));
    this.ready = true;
    this.emit();
  }

  async saveProduct(product: Product) {
    const value = { ...product, updatedAt: new Date().toISOString() };
    if (supabase) {
      const client = supabase;
      await this.runRemoteMutation(async () => {
        const { error } = await client.from("products").upsert(productToDb(value));
        if (error) throw error;
      });
      return;
    }
    const index = this.products.findIndex((item) => item.id === value.id || (value.sku && item.sku === value.sku));
    if (index >= 0) this.products[index] = value; else this.products.unshift(value);
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.products)); this.emit(); this.broadcast();
  }

  async importProducts(products: Product[]) {
    if (supabase) {
      const client = supabase;
      await this.runRemoteMutation(async () => {
        const { data: existing, error: lookupError } = await client.from("products").select("id,sku");
        if (lookupError) throw lookupError;
        const idsBySku = new Map((existing ?? []).filter((item) => item.sku).map((item) => [item.sku, item.id]));
        const safeProducts = products.map((product) => ({ ...product, id: idsBySku.get(product.sku) ?? product.id }));
        const { error } = await client.from("products").upsert(safeProducts.map(productToDb), { onConflict: "sku" });
        if (error) throw error;
      });
      return;
    }
    const next = [...this.products];
    for (const product of products) {
      const index = next.findIndex((item) => (product.sku && item.sku === product.sku) || item.id === product.id);
      if (index >= 0) next[index] = { ...next[index], ...product, id: next[index].id }; else next.push(product);
    }
    this.products = next; localStorage.setItem(PRODUCTS_KEY, JSON.stringify(next)); this.emit(); this.broadcast();
  }

  async deleteProduct(id: string) {
    if (supabase) { const client = supabase; await this.runRemoteMutation(async () => { const { error } = await client.from("products").delete().eq("id", id); if (error) throw error; }); return; }
    this.products = this.products.filter((item) => item.id !== id);
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.products)); this.emit(); this.broadcast();
  }

  async saveQuote(quote: Quote) {
    const value = { ...quote, createdBy: quote.createdBy || this.user.name, updatedAt: new Date().toISOString() };
    if (supabase) {
      const client = supabase;
      await this.runRemoteMutation(async () => {
        const { items, ...base } = value;
        const { error } = await client.from("quotes").upsert({
          id: base.id, number: base.number, client_name: base.clientName, client_id: base.clientId,
          client_phone: base.clientPhone, client_email: base.clientEmail, issued_at: base.issuedAt,
          valid_until: base.validUntil, status: base.status, tax_rate: base.taxRate,
          global_discount: base.globalDiscount, notes: base.notes, created_by: this.user.id,
          updated_at: base.updatedAt,
        });
        if (error) throw error;
        const { error: deleteError } = await client.from("quote_items").delete().eq("quote_id", value.id);
        if (deleteError) throw deleteError;
        if (items.length) {
          const { error: itemError } = await client.from("quote_items").insert(items.map((item, position) => ({
            id: item.id, quote_id: value.id, product_id: item.productId || null, sku: item.sku,
            name: item.name, presentation: item.presentation, image_url: item.imageUrl,
            quantity: item.quantity, unit_price: item.unitPrice, discount: item.discount, position,
          })));
          if (itemError) throw itemError;
        }
      });
      return;
    }
    const index = this.quotes.findIndex((item) => item.id === value.id);
    if (index >= 0) this.quotes[index] = value; else this.quotes.unshift(value);
    localStorage.setItem(QUOTES_KEY, JSON.stringify(this.quotes)); this.emit(); this.broadcast();
  }

  async deleteQuote(id: string) {
    if (supabase) { const client = supabase; await this.runRemoteMutation(async () => { const { error } = await client.from("quotes").delete().eq("id", id); if (error) throw error; }); return; }
    this.quotes = this.quotes.filter((quote) => quote.id !== id);
    localStorage.setItem(QUOTES_KEY, JSON.stringify(this.quotes)); this.emit(); this.broadcast();
  }

  resetLocalCatalog() {
    if (supabase) return;
    this.products = seedProducts as Product[];
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(this.products)); this.emit(); this.broadcast();
  }
}

export const dataService = new DataService();
