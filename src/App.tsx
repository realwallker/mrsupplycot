import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, BadgeDollarSign, Check, ChevronLeft, ChevronRight, CircleDollarSign,
  Cloud, CloudOff, Download, FileSpreadsheet, History, LayoutDashboard,
  Menu, Minus, Package, Pencil, Plus, Printer, RotateCcw, Save, Search,
  ShoppingBag, Trash2, Upload, X,
} from "lucide-react";
import { useData } from "./hooks/useData";
import { exportProducts, exportQuote, importProducts } from "./lib/excel";
import { exportQuotePdf } from "./lib/pdf";
import { emptyProduct, emptyQuote, quoteTotals, type Product, type Quote, type QuoteStatus } from "./types";

type View = "dashboard" | "catalog" | "quotes";
const money = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const shortDate = new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" });

function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  if (!product.imageUrl || failed) return <div className="product-placeholder"><Package size={30} /></div>;
  return <img src={product.imageUrl} alt={product.name} loading="lazy" onError={() => setFailed(true)} />;
}

function ProductModal({ product, onClose, onSave, onDelete }: {
  product: Product; onClose: () => void; onSave: (product: Product) => Promise<void>; onDelete?: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(product);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof Product, value: string | number) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    await onSave({ ...draft, searchName: draft.searchName || `${draft.name} ${draft.presentation}`.trim() });
    setSaving(false); onClose();
  };
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <form className="modal product-modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
      <header><div><span className="eyebrow">CATÁLOGO</span><h2>{product.name ? "Editar producto" : "Nuevo producto"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X /></button></header>
      <div className="form-grid">
        <label className="wide">Producto<input required value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label>SKU<input value={draft.sku} onChange={(e) => set("sku", e.target.value)} /></label>
        <label>Marca<input value={draft.brand} onChange={(e) => set("brand", e.target.value)} /></label>
        <label>PVP<input required type="number" min="0" step="0.01" value={draft.pvp} onChange={(e) => set("pvp", Number(e.target.value))} /></label>
        <label>Costo<input type="number" min="0" step="0.01" value={draft.cost} onChange={(e) => set("cost", Number(e.target.value))} /></label>
        <label>Categoría<input value={draft.category} onChange={(e) => set("category", e.target.value)} /></label>
        <label>Presentación<input value={draft.presentation} onChange={(e) => set("presentation", e.target.value)} /></label>
        <label>Sabor<input value={draft.flavor} onChange={(e) => set("flavor", e.target.value)} /></label>
        <label>Stock<input value={draft.stock} onChange={(e) => set("stock", e.target.value)} /></label>
        <label>Días de entrega<input type="number" min="0" value={draft.deliveryDays} onChange={(e) => set("deliveryDays", Number(e.target.value))} /></label>
        <label>Estado<select value={draft.status} onChange={(e) => set("status", e.target.value)}><option>Activo</option><option>Inactivo</option><option>Agotado</option></select></label>
        <label className="wide">URL de imagen<input type="url" value={draft.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} /></label>
        <label className="wide">Notas<textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} /></label>
      </div>
      <footer>
        {onDelete && <button type="button" className="button danger ghost" onClick={onDelete}><Trash2 size={16} /> Eliminar</button>}
        <span />
        <button type="button" className="button ghost" onClick={onClose}>Cancelar</button>
        <button className="button gold" disabled={saving}><Save size={16} /> {saving ? "Guardando…" : "Guardar producto"}</button>
      </footer>
    </form>
  </div>;
}

function QuoteDocument({ quote }: { quote: Quote }) {
  const totals = quoteTotals(quote);
  return <article className="quote-document">
    <header>
      <div className="document-brand"><img src="/mrsupply-logo.png" alt="Mr Supply" /><div><strong>MR SUPPLY</strong><span>Performance · Wellness · Lifestyle</span></div></div>
      <div className="document-number"><span>COTIZACIÓN</span><strong>{quote.number}</strong></div>
    </header>
    <section className="document-meta">
      <div><small>PREPARADO PARA</small><strong>{quote.clientName || "Cliente"}</strong><span>{[quote.clientId, quote.clientPhone, quote.clientEmail].filter(Boolean).join(" · ")}</span></div>
      <div><small>EMISIÓN</small><strong>{quote.issuedAt}</strong></div>
      <div><small>VÁLIDA HASTA</small><strong>{quote.validUntil}</strong></div>
    </section>
    <table><thead><tr><th>Producto</th><th>Cant.</th><th>PVP</th><th>Desc.</th><th>Total</th></tr></thead>
      <tbody>{quote.items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><span>{[item.sku, item.presentation].filter(Boolean).join(" · ")}</span></td><td>{item.quantity}</td><td>{money.format(item.unitPrice)}</td><td>{item.discount}%</td><td>{money.format(item.quantity * item.unitPrice * (1 - item.discount / 100))}</td></tr>)}</tbody>
    </table>
    <section className="document-bottom"><div className="document-note"><small>NOTAS</small><p>{quote.notes || "Precios expresados en dólares estadounidenses. Disponibilidad sujeta a confirmación."}</p></div>
      <div className="document-totals"><div><span>Subtotal</span><strong>{money.format(totals.subtotal)}</strong></div>{totals.discount > 0 && <div><span>Descuento</span><strong>−{money.format(totals.discount)}</strong></div>}<div><span>Impuesto ({quote.taxRate}%)</span><strong>{money.format(totals.tax)}</strong></div><div className="grand-total"><span>TOTAL</span><strong>{money.format(totals.total)}</strong></div></div>
    </section>
    <footer><span>MR SUPPLY</span><span>Gracias por confiar en nosotros.</span></footer>
  </article>;
}

function QuotePanel({ quote, onChange, onNew, onLoad, onNotify }: {
  quote: Quote; onChange: (quote: Quote) => void; onNew: () => void; onLoad: (quote: Quote) => void; onNotify: (message: string) => void;
}) {
  const data = useData();
  const [pdfBusy, setPdfBusy] = useState(false);
  const totals = quoteTotals(quote);
  const set = <K extends keyof Quote>(key: K, value: Quote[K]) => onChange({ ...quote, [key]: value, updatedAt: new Date().toISOString() });
  const updateItem = (id: string, patch: Partial<Quote["items"][number]>) => set("items", quote.items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const save = async () => { await data.saveQuote(quote); onNotify("Cotización guardada y sincronizada"); };
  const print = () => window.print();
  const downloadPdf = async () => {
    if (!quote.items.length) { onNotify("Agrega al menos un producto antes de descargar"); return; }
    setPdfBusy(true);
    try { await exportQuotePdf(quote); onNotify("PDF premium generado"); }
    catch (error) { onNotify(`No se pudo generar el PDF: ${(error as Error).message}`); }
    finally { setPdfBusy(false); }
  };
  return <aside className="quote-panel">
    <header className="quote-panel-header"><div><span className="eyebrow">COTIZACIÓN ACTIVA</span><button className="quote-number" onClick={() => onLoad(quote)}>{quote.number}</button></div><button className="icon-button light" title="Nueva cotización" onClick={onNew}><Plus /></button></header>
    <div className="quote-scroll">
      <section className="client-fields">
        <label>Cliente<input value={quote.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Nombre o empresa" /></label>
        <div><label>Identificación<input value={quote.clientId} onChange={(e) => set("clientId", e.target.value)} /></label><label>Teléfono<input value={quote.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} /></label></div>
        <label>Correo<input type="email" value={quote.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} /></label>
      </section>
      <section className="quote-lines">
        <div className="section-label"><span>Productos</span><span>{quote.items.length} ítems</span></div>
        {!quote.items.length && <div className="empty-lines"><ShoppingBag /><strong>Tu cotización está vacía</strong><span>Agrega productos desde el catálogo.</span></div>}
        {quote.items.map((item) => <div className="quote-line" key={item.id}>
          <div className="line-heading"><div><strong>{item.name}</strong><span>{item.sku || item.presentation}</span></div><button className="mini-button" onClick={() => set("items", quote.items.filter((line) => line.id !== item.id))}><X size={15} /></button></div>
          <div className="line-controls">
            <div className="quantity-control"><button onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}><Minus /></button><input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value)) })} /><button onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}><Plus /></button></div>
            <label><span>PVP</span><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })} /></label>
            <label><span>Desc. %</span><input type="number" min="0" max="100" value={item.discount} onChange={(e) => updateItem(item.id, { discount: Number(e.target.value) })} /></label>
          </div>
          <div className="line-total">{money.format(item.quantity * item.unitPrice * (1 - item.discount / 100))}</div>
        </div>)}
      </section>
      <section className="quote-settings">
        <div><label>Válida hasta<input type="date" value={quote.validUntil} onChange={(e) => set("validUntil", e.target.value)} /></label><label>Estado<select value={quote.status} onChange={(e) => set("status", e.target.value as QuoteStatus)}><option>Borrador</option><option>Enviada</option><option>Aprobada</option><option>Vencida</option><option>Anulada</option></select></label></div>
        <div><label>Descuento global<input type="number" min="0" max="100" value={quote.globalDiscount} onChange={(e) => set("globalDiscount", Number(e.target.value))} /></label><label>Impuesto %<input type="number" min="0" max="100" value={quote.taxRate} onChange={(e) => set("taxRate", Number(e.target.value))} /></label></div>
        <label>Notas<textarea value={quote.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Condiciones, entrega, forma de pago…" /></label>
      </section>
    </div>
    <section className="quote-summary"><div><span>Subtotal</span><strong>{money.format(totals.subtotal)}</strong></div>{totals.discount > 0 && <div><span>Descuento</span><strong>−{money.format(totals.discount)}</strong></div>}<div><span>Impuesto</span><strong>{money.format(totals.tax)}</strong></div><div className="total"><span>Total</span><strong>{money.format(totals.total)}</strong></div>
      <div className="quote-actions"><button className="button gold" onClick={save}><Save size={16} /> Guardar</button><button className="button pdf-button" disabled={pdfBusy} onClick={downloadPdf}><Download size={16} /> {pdfBusy ? "Creando…" : "PDF"}</button><button className="button dark" title="Imprimir" onClick={print}><Printer size={16} /></button><button className="button dark" title="Exportar Excel" onClick={() => exportQuote(quote)}><FileSpreadsheet size={16} /></button></div>
    </section>
    <div className="print-only"><QuoteDocument quote={quote} /></div>
  </aside>;
}

function AppContent() {
  const data = useData();
  const [view, setView] = useState<View>("catalog");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("Todas");
  const [page, setPage] = useState(1);
  const [quote, setQuote] = useState(() => emptyQuote(1));
  const [editing, setEditing] = useState<Product | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const skipAutoSave = useRef(false);
  const pageSize = 24;

  useEffect(() => { data.init().catch((error) => setToast(`No se pudo conectar: ${error.message}`)); }, []);
  useEffect(() => { setPage(1); }, [query, brand]);
  useEffect(() => {
    if (!toast) return; const timer = window.setTimeout(() => setToast(""), 3200); return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (skipAutoSave.current) { skipAutoSave.current = false; return; }
    if (!quote.clientName && quote.items.length === 0) return;
    const timer = window.setTimeout(() => data.saveQuote(quote).catch((error) => setToast(`No se pudo sincronizar: ${error.message}`)), 700);
    return () => clearTimeout(timer);
  }, [quote]);
  useEffect(() => {
    const latest = data.quotes.find((item) => item.id === quote.id);
    if (latest && new Date(latest.updatedAt).getTime() > new Date(quote.updatedAt).getTime()) {
      skipAutoSave.current = true;
      setQuote(latest);
    }
  }, [data.quotes]);

  const brands = useMemo(() => ["Todas", ...Array.from(new Set(data.products.map((p) => p.brand).filter(Boolean))).sort()], [data.products]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.products.filter((p) => (brand === "Todas" || p.brand === brand) && (!term || [p.name, p.sku, p.brand, p.category, p.presentation].join(" ").toLowerCase().includes(term)));
  }, [data.products, query, brand]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  const addProduct = (product: Product) => {
    const existing = quote.items.find((item) => item.productId === product.id);
    const updatedAt = new Date().toISOString();
    if (existing) setQuote({ ...quote, updatedAt, items: quote.items.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item) });
    else setQuote({ ...quote, updatedAt, items: [...quote.items, { id: crypto.randomUUID(), productId: product.id, sku: product.sku, name: product.name, presentation: product.presentation, imageUrl: product.imageUrl, quantity: 1, unitPrice: product.pvp, discount: 0 }] });
    setToast(`${product.name} agregado`);
  };
  const newQuote = () => setQuote(emptyQuote(data.quotes.length + 1));
  const handleImport = async (file?: File) => {
    if (!file) return;
    try { const products = await importProducts(file); await data.importProducts(products); setToast(`${products.length} productos importados o actualizados`); }
    catch (error) { setToast(`Error al importar: ${(error as Error).message}`); }
    if (importRef.current) importRef.current.value = "";
  };
  const stats = useMemo(() => ({
    products: data.products.length, priced: data.products.filter((p) => p.pvp > 0).length,
    images: data.products.filter((p) => p.imageUrl).length, quotes: data.quotes.length,
    approved: data.quotes.filter((q) => q.status === "Aprobada").reduce((sum, q) => sum + quoteTotals(q).total, 0),
  }), [data.products, data.quotes]);

  if (!data.ready) return <div className="loading"><img src="/mrsupply-logo.png" /><span>Cargando catálogo…</span></div>;
  return <div className="app-shell">
    <nav className={`sidebar ${mobileMenu ? "open" : ""}`}>
      <div className="sidebar-brand"><img src="/mrsupply-logo.png" alt="Mr Supply" /><div><strong>MR SUPPLY</strong><span>QUOTATIONS</span></div></div>
      <div className="nav-label">GESTIÓN</div>
      <button className={view === "dashboard" ? "active" : ""} onClick={() => { setView("dashboard"); setMobileMenu(false); }}><LayoutDashboard /> Resumen</button>
      <button className={view === "catalog" ? "active" : ""} onClick={() => { setView("catalog"); setMobileMenu(false); }}><Package /> Catálogo <span>{data.products.length}</span></button>
      <button className={view === "quotes" ? "active" : ""} onClick={() => { setView("quotes"); setMobileMenu(false); }}><History /> Cotizaciones <span>{data.quotes.length}</span></button>
      <div className="sidebar-spacer" />
      <div className="sync-card">{data.online ? <Cloud /> : <CloudOff />}<div><strong>{data.online ? "Sincronización activa" : "Modo local"}</strong><span>{data.online ? "Cambios en tiempo real" : "Conecta Supabase para colaborar"}</span></div></div>
      <div className="user-card"><div className="avatar">MS</div><div><strong>Mr Supply</strong><span>Acceso directo por enlace</span></div></div>
    </nav>
    {mobileMenu && <div className="menu-shade" onClick={() => setMobileMenu(false)} />}
    <main className="workspace">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileMenu(true)}><Menu /></button><div><span className="eyebrow">MR SUPPLY / {view === "catalog" ? "CATÁLOGO" : view === "quotes" ? "COTIZACIONES" : "RESUMEN"}</span><h1>{view === "catalog" ? "Catálogo de productos" : view === "quotes" ? "Historial de cotizaciones" : "Panel ejecutivo"}</h1></div><div className="topbar-actions"><span className={`live-pill ${data.online ? "online" : ""}`}><i />{data.online ? "EN VIVO" : "LOCAL"}</span><button className="button gold" onClick={newQuote}><Plus size={17} /> Nueva cotización</button></div></header>

      {view === "dashboard" && <div className="page dashboard-page">
        <section className="welcome"><div><span className="eyebrow">CONTROL COMERCIAL</span><h2>Todo el catálogo.<br />Una sola experiencia.</h2><p>Gestiona precios, arma propuestas y mantén al equipo trabajando sobre la misma información.</p><button className="button gold" onClick={() => setView("catalog")}>Crear cotización <ChevronRight /></button></div><CircleDollarSign /></section>
        <section className="stat-grid"><div><Package /><span>Productos</span><strong>{stats.products}</strong><small>{stats.priced} con PVP</small></div><div><ShoppingBag /><span>Cotizaciones</span><strong>{stats.quotes}</strong><small>historial compartido</small></div><div><BadgeDollarSign /><span>Valor aprobado</span><strong>{money.format(stats.approved)}</strong><small>cotizaciones aprobadas</small></div><div><Archive /><span>Fotografías</span><strong>{stats.images}</strong><small>{Math.round(stats.images / Math.max(1, stats.products) * 100)}% del catálogo</small></div></section>
        <section className="dashboard-split"><div className="panel"><header><div><span className="eyebrow">ACTIVIDAD</span><h3>Últimas cotizaciones</h3></div><button onClick={() => setView("quotes")}>Ver todas</button></header><QuoteRows quotes={data.quotes.slice(0, 5)} onOpen={setQuote} /></div><div className="panel quick-panel"><span className="eyebrow">ACCESOS RÁPIDOS</span><h3>Gestión del catálogo</h3><button onClick={() => importRef.current?.click()}><Upload /> Importar Excel<span>Actualiza por SKU</span></button><button onClick={() => exportProducts(data.products)}><Download /> Exportar catálogo<span>{data.products.length} productos</span></button><button onClick={() => setEditing(emptyProduct())}><Plus /> Agregar producto<span>Alta manual</span></button>{!data.online && <button onClick={() => data.resetLocalCatalog()}><RotateCcw /> Restaurar base<span>Vuelve al catálogo original</span></button>}</div></section>
      </div>}

      {view === "catalog" && <div className="page catalog-page">
        <section className="catalog-toolbar"><div className="searchbox"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por producto, marca o SKU…" />{query && <button onClick={() => setQuery("")}><X /></button>}</div><select value={brand} onChange={(e) => setBrand(e.target.value)}>{brands.map((item) => <option key={item}>{item}</option>)}</select><button className="button ghost" onClick={() => importRef.current?.click()}><Upload size={16} /> Importar</button><button className="button ghost" onClick={() => exportProducts(data.products)}><Download size={16} /> Exportar</button><button className="button dark" onClick={() => setEditing(emptyProduct())}><Plus size={16} /> Producto</button></section>
        <div className="catalog-meta"><span><strong>{filtered.length}</strong> productos encontrados</span><span>Los PVP pueden editarse al cotizar</span></div>
        <section className="product-grid">{visible.map((product) => <article className="product-card" key={product.id}><button className="edit-product" onClick={() => setEditing(product)} title="Editar producto"><Pencil /></button><div className="product-image"><ProductImage product={product} />{product.stock && <span className="stock-badge">{product.stock}</span>}</div><div className="product-body"><span className="product-brand">{product.brand || "MR SUPPLY"}</span><h3>{product.name}</h3><p>{[product.presentation, product.flavor].filter(Boolean).join(" · ") || product.category}</p><div className="product-footer"><div><small>PVP</small><strong>{money.format(product.pvp)}</strong></div><button onClick={() => addProduct(product)}><Plus /> Agregar</button></div><span className="sku">SKU {product.sku || "—"}</span></div></article>)}</section>
        {!visible.length && <div className="no-results"><Search /><h3>No encontramos coincidencias</h3><p>Prueba con otro nombre, SKU o marca.</p></div>}
        {pages > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft /></button><span>Página <strong>{page}</strong> de {pages}</span><button disabled={page === pages} onClick={() => setPage((p) => p + 1)}><ChevronRight /></button></div>}
      </div>}

      {view === "quotes" && <div className="page quotes-page"><section className="quotes-header"><div><span className="eyebrow">HISTORIAL COMPARTIDO</span><h2>{data.quotes.length} cotizaciones</h2></div><button className="button gold" onClick={() => { newQuote(); setView("catalog"); }}><Plus /> Crear cotización</button></section><div className="panel quotes-table"><QuoteRows quotes={data.quotes} onOpen={(item) => { setQuote(item); setView("catalog"); }} detailed onDelete={(id) => data.deleteQuote(id)} /></div></div>}
      <input ref={importRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleImport(e.target.files?.[0])} />
    </main>
    <QuotePanel quote={quote} onChange={setQuote} onNew={newQuote} onLoad={setQuote} onNotify={setToast} />
    {editing && <ProductModal product={editing} onClose={() => setEditing(null)} onSave={(product) => data.saveProduct(product).then(() => setToast("Producto guardado y sincronizado"))} onDelete={editing.name ? async () => { if (confirm(`¿Eliminar ${editing.name}?`)) { await data.deleteProduct(editing.id); setEditing(null); setToast("Producto eliminado"); } } : undefined} />}
    {toast && <div className="toast"><Check />{toast}</div>}
  </div>;
}

function QuoteRows({ quotes, onOpen, detailed = false, onDelete }: { quotes: Quote[]; onOpen: (quote: Quote) => void; detailed?: boolean; onDelete?: (id: string) => void }) {
  if (!quotes.length) return <div className="empty-table"><History /><strong>Aún no hay cotizaciones</strong><span>La actividad del equipo aparecerá aquí.</span></div>;
  return <div className="quote-list">{quotes.map((quote) => { const total = quoteTotals(quote).total; return <div className="quote-row" key={quote.id} onClick={() => onOpen(quote)}><div className="quote-symbol"><FileSpreadsheet /></div><div><strong>{quote.number}</strong><span>{quote.clientName || "Cliente sin nombre"}</span></div>{detailed && <div className="hide-small"><span>Actualizada</span><strong>{shortDate.format(new Date(quote.updatedAt))}</strong></div>}<div><span>Total</span><strong>{money.format(total)}</strong></div><span className={`status status-${quote.status.toLowerCase()}`}>{quote.status}</span>{onDelete && <button className="mini-button" onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar ${quote.number}?`)) onDelete(quote.id); }}><Trash2 /></button>}<ChevronRight /></div>; })}</div>;
}

export default function App() {
  return <AppContent />;
}
