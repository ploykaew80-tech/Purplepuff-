import type { Product, StoreSettings, Order, CartItem } from '../types';

/**
 * Normalizes LINE Official Account ID to format with '@'
 * e.g. '798shear' -> '@798shear', '@798shear' -> '@798shear'
 */
export function formatLineHandle(raw?: string): string {
  const clean = (raw || '@798shear').trim();
  return clean.startsWith('@') ? clean : `@${clean}`;
}

/**
 * URL to add friend or open LINE Official Account
 */
export function getLineAddFriendUrl(rawHandle?: string): string {
  const handle = formatLineHandle(rawHandle);
  const clean = handle.replace(/^@+/, '');
  // Both https://line.me/R/ti/p/@id and https://page.line.me/id work reliably
  return `https://line.me/R/ti/p/@${clean}`;
}

/**
 * URL to open LINE chat with a pre-filled message
 */
export function getLineMessageUrl(rawHandle: string | undefined, messageText: string): string {
  const handle = formatLineHandle(rawHandle);
  const clean = handle.replace(/^@+/, '');
  const encoded = encodeURIComponent(messageText);
  return `https://line.me/R/oaMessage/@${clean}/?${encoded}`;
}

/**
 * Generates direct LINE order link for a single product from ProductDetailModal
 */
export function getLineProductOrderUrl(
  product: Product,
  quantity: number,
  settings?: StoreSettings | null
): string {
  const unitText = product.unit ? ` ${product.unit}` : '';
  const total = product.price * quantity;
  const text = 
    `[PURPLE PUFF — สั่งซื้อสินค้า]\n` +
    `🌿 สินค้า: ${product.product_name}\n` +
    `📦 จำนวน: ${quantity}${unitText}\n` +
    `💰 ยอดรวม: ฿${total.toLocaleString()}\n` +
    `\nสนใจสั่งซื้อรายการนี้ครับ/ค่ะ รบกวนแจ้งสรุปยอดและช่องทางชำระเงินด้วยครับ`;

  return getLineMessageUrl(settings?.line_username, text);
}

/**
 * Generates direct LINE order link for all cart items from CartDrawer
 */
export function getLineCartCheckoutUrl(
  items: CartItem[],
  settings?: StoreSettings | null
): string {
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemsText = items
    .map(i => `• ${i.product.product_name} x ${i.quantity} (฿${(i.product.price * i.quantity).toLocaleString()})`)
    .join('\n');

  const text =
    `[PURPLE PUFF — สั่งซื้อผ่านตะกร้า]\n` +
    `รายการสินค้า:\n${itemsText}\n` +
    `💰 ยอดรวมสินค้า: ฿${total.toLocaleString()}\n` +
    `\nต้องการสั่งซื้อรายการข้างต้นครับ/ค่ะ รบกวนแจ้งรายละเอียดจัดส่งด้วยครับ`;

  return getLineMessageUrl(settings?.line_username, text);
}

/**
 * Generates direct LINE order confirmation link for a submitted order
 */
export function getLineOrderConfirmationUrl(
  order: Order,
  settings?: StoreSettings | null
): string {
  const itemListText = order.items
    .map(i => `• ${i.product.product_name} x ${i.quantity} (฿${(i.product.price * i.quantity).toLocaleString()})`)
    .join('\n');

  const text =
    `[PURPLE PUFF ORDER #${order.id}]\n` +
    `👤 ผู้สั่ง: ${order.customer_name}\n` +
    `📞 เบอร์โทร: ${order.customer_phone}\n` +
    `📍 ที่อยู่จัดส่ง: ${order.delivery_address || 'รับหน้าร้าน'}\n` +
    `📦 รายการสินค้า:\n${itemListText}\n` +
    `💰 ยอดรวม: ฿${order.total_amount.toLocaleString()}\n` +
    (order.notes ? `📝 หมายเหตุ: ${order.notes}\n` : '') +
    `\nขอยืนยันคำสั่งซื้อเรียบร้อยแล้วครับ`;

  return getLineMessageUrl(settings?.line_username, text);
}

/**
 * URL for Instagram Profile
 */
export function getInstagramUrl(rawHandle?: string): string {
  const handle = (rawHandle || 'Pulplepuff').trim();
  if (handle.startsWith('http://') || handle.startsWith('https://')) {
    return handle;
  }
  const clean = handle.replace(/^@+/, '');
  return `https://instagram.com/${clean}`;
}

/**
 * URL for Phone Call
 */
export function getPhoneCallUrl(rawPhone?: string): string {
  const clean = (rawPhone || '0902743754').replace(/[^0-9+]/g, '');
  return `tel:${clean}`;
}

/**
 * URL for Google Maps location
 */
export function getGoogleMapsUrl(rawUrl?: string): string {
  return rawUrl || 'https://maps.app.goo.gl/CyT3Fp4SpJW27sYF8?g_st=ic';
}
