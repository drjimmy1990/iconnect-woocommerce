/**
 * routes/index.ts
 * ---------------
 * Express router exposing trimmed WooCommerce endpoints for n8n.
 * All inputs are validated with zod; routes are rate-limited at the app level.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  getProducts,
  getProduct,
  getCategories,
  getCategory,
  getAttributes,
  getPaymentGateways,
  getShippingZones,
  getShippingZoneMethods,
  getOrders,
  getOrder,
  createOrder,
  trackOrder,
} from "../wc-client.js";
import {
  trimProduct,
  trimProductLite,
  trimOrder,
  trimCategory,
  trimCategoryLite,
  trimPaymentGateway,
  trimShippingZone,
  trimShippingMethod,
} from "../trim.js";

const router: Router = Router();

/* ------------------------------------------------------------------ */
/* Health                                                             */
/* ------------------------------------------------------------------ */

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "woocommerce-api-wrapper" });
});

/* ------------------------------------------------------------------ */
/* Products                                                           */
/* ------------------------------------------------------------------ */

const productsQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  // 100 is WooCommerce's own ceiling. Safe to allow now that the default
  // response is the lite shape (~80 bytes/product instead of ~1.2 KB).
  per_page: z.coerce.number().int().min(1).max(100).default(10),
  page: z.coerce.number().int().min(1).default(1),
  // "lite" (default) -> id, name, price, stock_status only. Use "full" when a
  // caller genuinely needs images/attributes for every row; it is capped lower
  // because the payload is ~15x bigger.
  view: z.enum(["lite", "full"]).default("lite"),
  orderby: z.enum(["date", "id", "title", "slug", "price", "popularity"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  min_price: z.coerce.number().optional(),
  max_price: z.coerce.number().optional(),
  on_sale: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  sku: z.string().optional(),
});

router.get("/products", async (req: Request, res: Response) => {
  try {
    const q = productsQuerySchema.parse(req.query);
    // The full shape is heavy; don't let a caller ask for 100 of them at once.
    const perPage = q.view === "full" ? Math.min(q.per_page, 50) : q.per_page;
    const { data, headers } = await getProducts({
      search: q.search,
      category: q.category,
      per_page: perPage,
      page: q.page,
      orderby: q.orderby,
      order: q.order,
      min_price: q.min_price,
      max_price: q.max_price,
      on_sale: q.on_sale,
      featured: q.featured,
      sku: q.sku,
    });
    const products = data.map(q.view === "full" ? trimProduct : trimProductLite);
    res.json({
      products,
      total: Number(headers["x-wp-total"]) || products.length,
      page: q.page,
      total_pages: Number(headers["x-wp-totalpages"]) || 1,
    });
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message || "Bad request" });
  }
});

router.get("/products/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });
    const product = await getProduct(id);
    res.json(trimProduct(product));
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message || "Not found" });
  }
});

/* ------------------------------------------------------------------ */
/* Categories                                                         */
/* ------------------------------------------------------------------ */

router.get("/categories", async (req: Request, res: Response) => {
  try {
    const parent = req.query.parent as string | undefined;
    // Lite by default (id/name/parent/count); ?view=full adds slug + image.
    const full = req.query.view === "full";
    const { data } = await getCategories({ per_page: 100, parent });
    res.json(data.map(full ? trimCategory : trimCategoryLite));
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get("/categories/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid category ID" });
    const category = await getCategory(id);
    res.json(trimCategory(category));
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/* Attributes                                                         */
/* ------------------------------------------------------------------ */

router.get("/attributes", async (_req: Request, res: Response) => {
  try {
    const data = await getAttributes({ per_page: 100 });
    res.json(data);
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/* Payment Gateways                                                   */
/* ------------------------------------------------------------------ */

router.get("/payment-gateways", async (_req: Request, res: Response) => {
  try {
    const data = await getPaymentGateways();
    res.json(data.map(trimPaymentGateway));
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/* Shipping Zones                                                     */
/* ------------------------------------------------------------------ */

router.get("/shipping-zones", async (_req: Request, res: Response) => {
  try {
    const data = await getShippingZones();
    res.json(data.map(trimShippingZone));
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get("/shipping-zones/:id/methods", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid zone ID" });
    const data = await getShippingZoneMethods(id);
    res.json(data.map(trimShippingMethod));
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/* Orders                                                             */
/* ------------------------------------------------------------------ */

const ordersQuerySchema = z.object({
  per_page: z.coerce.number().int().min(1).max(100).default(10),
  page: z.coerce.number().int().min(1).default(1),
  status: z.string().optional(),
  search: z.string().optional(),
});

router.get("/orders", async (req: Request, res: Response) => {
  try {
    const q = ordersQuerySchema.parse(req.query);
    const { data, headers } = await getOrders({
      per_page: q.per_page,
      page: q.page,
      status: q.status,
      search: q.search,
    });
    const orders = data.map(trimOrder);
    res.json({
      orders,
      total: Number(headers["x-wp-total"]) || orders.length,
      page: q.page,
      total_pages: Number(headers["x-wp-totalpages"]) || 1,
    });
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/* Order Tracking                                                     */
/* ------------------------------------------------------------------ */

const trackQuerySchema = z
  .object({
    order_id: z.coerce.number().optional(),
    order_key: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })
  .refine(
    (d) => (d.order_id && d.order_key) || d.email || d.phone,
    { message: "Provide order_id+order_key, or email, or phone" },
  );

/**
 * IMPORTANT: this literal route MUST stay above "/orders/:id".
 * Express matches in registration order, so "/orders/:id" would otherwise
 * capture "/orders/track" with id="track" and reject it as an invalid ID.
 */
router.get("/orders/track", async (req: Request, res: Response) => {
  try {
    const q = trackQuerySchema.parse(req.query);
    const order = await trackOrder(q);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(trimOrder(order));
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.get("/orders/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });
    const order = await getOrder(id);
    res.json(trimOrder(order));
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/* Create Order                                                       */
/* ------------------------------------------------------------------ */

const createOrderSchema = z.object({
  line_items: z.array(
    z.object({
      product_id: z.number().int(),
      quantity: z.number().int().min(1),
    }),
  ).min(1),
  billing: z.object({
    first_name: z.string(),
    last_name: z.string().optional(),
    phone: z.string(),
    email: z.string().email().optional(),
    address_1: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
  }),
  payment_method: z.string().optional(),
  payment_method_title: z.string().optional(),
  customer_note: z.string().optional(),
});

router.post("/orders", async (req: Request, res: Response) => {
  try {
    const body = createOrderSchema.parse(req.body);
    const wcPayload: Record<string, any> = {
      line_items: body.line_items.map((li) => ({
        product_id: li.product_id,
        quantity: li.quantity,
      })),
      billing: body.billing,
      payment_method: body.payment_method,
      payment_method_title: body.payment_method_title,
      customer_note: body.customer_note,
      set_paid: false,
    };
    const order = await createOrder(wcPayload);
    res.json({
      id: order.id,
      status: order.status,
      total: order.total,
      order_key: order.order_key,
      payment_url: order.checkout_payment_url || order.payment_url || null,
    });
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message || "Bad request" });
  }
});

export default router;
