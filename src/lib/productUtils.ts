import type { Product, Category } from '../types';

/**
 * Standard unit options for products in admin & store
 */
export const UNIT_OPTIONS = [
  { value: '1G', label: '1G (กรัม - สำหรับช่อดอก)' },
  { value: 'ชิ้น', label: 'ชิ้น (สำหรับอุปกรณ์/ของทั่วไป)' },
  { value: 'อัน', label: 'อัน' },
  { value: 'กล่อง', label: 'กล่อง' },
  { value: 'ชุด', label: 'ชุด' },
  { value: 'แพ็ค', label: 'แพ็ค' },
  { value: 'ขวด', label: 'ขวด' },
  { value: 'มวน', label: 'มวน' },
  { value: 'ไม่มี', label: 'ไม่มีหน่วย (แสดงเฉพาะราคา ฿)' }
] as const;

/**
 * Check if a product or category belongs to "ของทั่วไป" or "อุปกรณ์" (General/Accessories)
 */
export function isGeneralOrAccessory(
  product?: Partial<Product> | null,
  category?: Category | null,
  categoryName?: string | null
): boolean {
  if (!product && !category && !categoryName) return false;

  const catId = (product?.category_id || category?.id || '').toLowerCase();
  const catName = (category?.name || categoryName || '').toLowerCase();
  const prodUnit = (product?.unit || '').trim().toLowerCase();

  // 1. If unit is explicitly set to an accessory count unit (and not gram/1G)
  if (prodUnit && prodUnit !== '1g' && prodUnit !== 'g' && prodUnit !== 'กรัม') {
    return true;
  }

  // 2. Specific category IDs known for general/accessory items
  if (
    catId === 'cat-general' ||
    catId.includes('general') ||
    catId.includes('accessory') ||
    catId.includes('accessories')
  ) {
    return true;
  }

  // 3. Category name patterns for general / accessories
  const generalKeywords = [
    'ของทั่วไป',
    'อุปกรณ์',
    'accessory',
    'accessories',
    'general',
    'บ้อง',
    'ไฟแช็ค',
    'เครื่องบด',
    'กระดาษโรล',
    'กระดาษ',
    'grinder',
    'bong',
    'pipe'
  ];

  for (const kw of generalKeywords) {
    if (catName.includes(kw)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a product or category is "ดอก/ช่อดอก" (Flower)
 */
export function isFlowerCategory(
  product?: Partial<Product> | null,
  category?: Category | null,
  categoryName?: string | null
): boolean {
  return !isGeneralOrAccessory(product, category, categoryName);
}

/**
 * Format the price unit label for display on cards and detail view
 * e.g. "/ 1G", "/ ชิ้น", "/ อัน", or "" (empty)
 */
export function formatProductPriceUnit(
  product?: Partial<Product> | null,
  category?: Category | null,
  categoryName?: string | null
): string {
  const isGeneral = isGeneralOrAccessory(product, category, categoryName);

  if (isGeneral) {
    const rawUnit = (product?.unit || '').trim();
    if (rawUnit === 'ไม่มี' || rawUnit === 'none' || rawUnit === '-') {
      return '';
    }
    if (rawUnit) {
      return rawUnit.startsWith('/') ? rawUnit : `/ ${rawUnit}`;
    }
    // Default for general/accessory is '/ ชิ้น'
    return '/ ชิ้น';
  }

  // For flower products:
  const rawUnit = (product?.unit || '').trim();
  if (rawUnit && rawUnit !== '1G' && rawUnit !== 'ไม่มี') {
    return rawUnit.startsWith('/') ? rawUnit : `/ ${rawUnit}`;
  }
  return '/ 1G';
}
