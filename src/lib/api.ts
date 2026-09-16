import type {
  Product,
  Category,
  Promotion,
  StoreSettings,
  User,
  ActivityLog,
  Order,
  AdminStats,
  CartItem,
  ProductStatus,
  OrderStatus
} from '../types';

import {
  initFirestoreDataIfEmpty,
  getFirestoreStoreSettings,
  updateFirestoreStoreSettings,
  getFirestoreCategories,
  saveFirestoreCategory,
  getFirestoreProducts,
  getFirestoreProductById,
  saveFirestoreProduct,
  deleteFirestoreProduct,
  updateFirestoreProductStatus,
  duplicateFirestoreProduct,
  bulkSyncFirestoreProducts,
  getFirestorePromotions,
  saveFirestorePromotion,
  deleteFirestorePromotion,
  submitFirestoreOrder,
  getFirestoreOrders,
  updateFirestoreOrderStatus,
  getFirestoreUsers,
  saveFirestoreUser,
  deleteFirestoreUser,
  getFirestoreActivityLogs,
  subscribeToFirestoreProducts,
  subscribeToFirestoreSettings
} from './firestoreService';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('purplepuff_admin_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function getCurrentAdminName(): string {
  try {
    const userStr = localStorage.getItem('purplepuff_admin_user');
    if (userStr) {
      const u = JSON.parse(userStr);
      return u.name || 'Admin';
    }
  } catch {}
  return 'Admin';
}

// ---------------- Public API ----------------

export async function fetchStoreSettings(): Promise<StoreSettings> {
  try {
    return await getFirestoreStoreSettings();
  } catch (err) {
    console.warn('Falling back to local API for settings:', err);
    const res = await fetch(`${API_BASE}/public/store-settings`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load store settings');
    return res.json();
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    return await getFirestoreCategories();
  } catch (err) {
    console.warn('Falling back to local API for categories:', err);
    const res = await fetch(`${API_BASE}/public/categories`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load categories');
    return res.json();
  }
}

export async function fetchProducts(): Promise<Product[]> {
  try {
    return await getFirestoreProducts();
  } catch (err) {
    console.warn('Falling back to local API for products:', err);
    const res = await fetch(`${API_BASE}/public/products`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load products');
    return res.json();
  }
}

export async function fetchProductById(id: string): Promise<Product> {
  try {
    const prod = await getFirestoreProductById(id);
    if (prod) return prod;
  } catch (err) {
    console.warn('Falling back to local API for product by ID:', err);
  }
  const res = await fetch(`${API_BASE}/public/products/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Product not found');
  return res.json();
}

export async function fetchPromotions(): Promise<Promotion[]> {
  try {
    return await getFirestorePromotions();
  } catch (err) {
    console.warn('Falling back to local API for promotions:', err);
    const res = await fetch(`${API_BASE}/public/promotions`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load promotions');
    return res.json();
  }
}

export async function submitCustomerOrder(data: {
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  items: CartItem[];
  notes?: string;
}): Promise<Order> {
  try {
    // 1. Save directly to Cloud Firestore
    const order = await submitFirestoreOrder(data);
    // 2. Also background sync to server if available
    fetch(`${API_BASE}/public/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(() => {});
    return order;
  } catch (err) {
    console.warn('Direct Firestore order submission failed, trying API fallback:', err);
    const res = await fetch(`${API_BASE}/public/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errRes = await res.json().catch(() => ({}));
      throw new Error(errRes.error || 'Failed to submit order');
    }
    return res.json();
  }
}

// ---------------- Auth API ----------------

export async function adminLogin(email: string, password: string, remember = false): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, remember })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Invalid credentials');
  }
  const data = await res.json();
  localStorage.setItem('purplepuff_admin_token', data.token);
  localStorage.setItem('purplepuff_admin_user', JSON.stringify(data.user));
  return data;
}

export async function checkAdminSession(): Promise<{ authenticated: boolean; user?: User }> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
      cache: 'no-store'
    });
    if (!res.ok) {
      localStorage.removeItem('purplepuff_admin_token');
      localStorage.removeItem('purplepuff_admin_user');
      return { authenticated: false };
    }
    const data = await res.json();
    return { authenticated: true, user: data.user };
  } catch {
    return { authenticated: false };
  }
}

export async function fetchPublicData(): Promise<{
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  promotions: Promotion[];
}> {
  // Ensure Firestore is initialized
  await initFirestoreDataIfEmpty();

  const [settings, categories, products, promotions] = await Promise.all([
    fetchStoreSettings(),
    fetchCategories(),
    fetchProducts(),
    fetchPromotions()
  ]);
  return { settings, categories, products, promotions };
}

export async function fetchAdminDashboardData(): Promise<{
  stats: AdminStats;
  logs: ActivityLog[];
  orders: Order[];
  users: User[];
}> {
  const [stats, logs, orders, users] = await Promise.all([
    adminGetStats(),
    adminGetActivityLogs(),
    adminGetOrders(),
    adminGetUsers().catch(() => [])
  ]);
  return { stats, logs, orders, users };
}

// ---------------- Admin CRUD Operations (Direct Firestore with API synchronization) ----------------

export async function saveAdminProduct(product: Partial<Product>): Promise<Product> {
  const adminName = getCurrentAdminName();
  try {
    // Write directly to Cloud Firestore
    const saved = await saveFirestoreProduct(product, adminName);
    // Background sync to server
    if (product.id) {
      fetch(`${API_BASE}/admin/products/${product.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(saved)
      }).catch(() => {});
    } else {
      fetch(`${API_BASE}/admin/products`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(saved)
      }).catch(() => {});
    }
    return saved;
  } catch (err) {
    console.warn('Direct Firestore save failed, using API:', err);
    if (product.id) {
      return adminUpdateProduct(product.id, product);
    }
    return adminCreateProduct(product);
  }
}

export async function deleteAdminProduct(id: string): Promise<{ success: boolean; id: string }> {
  const adminName = getCurrentAdminName();
  try {
    await deleteFirestoreProduct(id, adminName);
    fetch(`${API_BASE}/admin/products/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    }).catch(() => {});
    return { success: true, id };
  } catch (err) {
    console.warn('Direct Firestore delete failed, using API:', err);
    const res = await fetch(`${API_BASE}/admin/products/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const errRes = await res.json().catch(() => ({}));
      throw new Error(errRes.error || 'Failed to delete product');
    }
    return res.json();
  }
}

export async function updateAdminProductStatus(id: string, status: ProductStatus): Promise<Product> {
  const adminName = getCurrentAdminName();
  try {
    const updated = await updateFirestoreProductStatus(id, status, adminName);
    fetch(`${API_BASE}/admin/products/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    }).catch(() => {});
    if (updated) return updated;
  } catch (err) {
    console.warn('Direct Firestore status update failed, using API:', err);
  }
  return adminUpdateProduct(id, { status });
}

export async function saveAdminCategory(category: Partial<Category>): Promise<Category> {
  try {
    const saved = await saveFirestoreCategory(category);
    fetch(category.id ? `${API_BASE}/admin/categories/${category.id}` : `${API_BASE}/admin/categories`, {
      method: category.id ? 'PUT' : 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(saved)
    }).catch(() => {});
    return saved;
  } catch (err) {
    if (category.id) {
      return adminUpdateCategory(category.id, category);
    }
    return adminCreateCategory(category);
  }
}

export async function saveAdminPromotion(promo: Partial<Promotion>): Promise<Promotion> {
  try {
    const saved = await saveFirestorePromotion(promo);
    fetch(promo.id ? `${API_BASE}/admin/promotions/${promo.id}` : `${API_BASE}/admin/promotions`, {
      method: promo.id ? 'PUT' : 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(saved)
    }).catch(() => {});
    return saved;
  } catch (err) {
    if (promo.id) {
      return adminUpdatePromotion(promo.id, promo);
    }
    return adminCreatePromotion(promo);
  }
}

export async function deleteAdminPromotion(id: string): Promise<void> {
  try {
    await deleteFirestorePromotion(id);
    fetch(`${API_BASE}/admin/promotions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    }).catch(() => {});
  } catch (err) {
    return adminDeletePromotion(id);
  }
}

export async function saveAdminSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
  try {
    const saved = await updateFirestoreStoreSettings(settings);
    fetch(`${API_BASE}/admin/store-settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(saved)
    }).catch(() => {});
    return saved;
  } catch (err) {
    return adminUpdateStoreSettings(settings);
  }
}

export async function saveAdminUser(userData: Partial<User> & { password?: string }): Promise<User> {
  try {
    const saved = await saveFirestoreUser(userData);
    if (userData.id) {
      fetch(`${API_BASE}/admin/users/${userData.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(userData)
      }).catch(() => {});
    } else {
      fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(userData)
      }).catch(() => {});
    }
    return saved;
  } catch (err) {
    if (userData.id) {
      return adminUpdateUser(userData.id, userData);
    }
    return adminCreateUser({
      name: userData.name || '',
      email: userData.email || '',
      role: userData.role || 'STAFF',
      password: userData.password || 'password123'
    });
  }
}

export async function deleteAdminUser(id: string): Promise<void> {
  try {
    await deleteFirestoreUser(id);
    fetch(`${API_BASE}/admin/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    }).catch(() => {});
  } catch {
    const res = await fetch(`${API_BASE}/admin/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete user');
  }
}

export async function adminLogout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } finally {
    localStorage.removeItem('purplepuff_admin_token');
    localStorage.removeItem('purplepuff_admin_user');
  }
}

// ---------------- Admin Statistics & Lists ----------------

export async function adminGetStats(): Promise<AdminStats> {
  try {
    const [products, promotions, orders] = await Promise.all([
      getFirestoreProducts(),
      getFirestorePromotions(),
      getFirestoreOrders()
    ]);

    return {
      totalProducts: products.length,
      availableProducts: products.filter(p => p.status === 'AVAILABLE').length,
      soldOutProducts: products.filter(p => p.status === 'SOLD OUT').length,
      activePromotions: promotions.filter(p => p.status === 'ACTIVE').length,
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'PENDING').length
    };
  } catch {
    const res = await fetch(`${API_BASE}/admin/stats`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load stats');
    return res.json();
  }
}

export async function adminGetProducts(): Promise<Product[]> {
  return fetchProducts();
}

export async function adminBulkSyncProducts(products: Partial<Product>[]): Promise<{ success: boolean; count: number; products: Product[] }> {
  try {
    const result = await bulkSyncFirestoreProducts(products, getCurrentAdminName());
    const latestProducts = await getFirestoreProducts();
    fetch(`${API_BASE}/admin/products/bulk-sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ products })
    }).catch(() => {});
    return { success: true, count: result.count, products: latestProducts };
  } catch (err) {
    const res = await fetch(`${API_BASE}/admin/products/bulk-sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ products })
    });
    if (!res.ok) {
      const errRes = await res.json().catch(() => ({}));
      throw new Error(errRes.error || 'Failed to sync products');
    }
    return res.json();
  }
}

export async function adminCreateProduct(product: Partial<Product>): Promise<Product> {
  return saveAdminProduct(product);
}

export async function adminUpdateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  return saveAdminProduct({ ...updates, id });
}

export async function adminDuplicateProduct(id: string): Promise<Product> {
  try {
    const dup = await duplicateFirestoreProduct(id, getCurrentAdminName());
    if (dup) {
      fetch(`${API_BASE}/admin/products/${id}/duplicate`, {
        method: 'POST',
        headers: getAuthHeaders()
      }).catch(() => {});
      return dup;
    }
  } catch {}
  const res = await fetch(`${API_BASE}/admin/products/${id}/duplicate`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to duplicate product');
  return res.json();
}

export async function adminArchiveProduct(id: string): Promise<Product> {
  return updateAdminProductStatus(id, 'ARCHIVED');
}

export async function adminRestoreProduct(id: string): Promise<Product> {
  return updateAdminProductStatus(id, 'AVAILABLE');
}

export async function adminGetCategories(): Promise<Category[]> {
  return fetchCategories();
}

export async function adminCreateCategory(cat: Partial<Category>): Promise<Category> {
  return saveAdminCategory(cat);
}

export async function adminUpdateCategory(id: string, updates: Partial<Category>): Promise<Category> {
  return saveAdminCategory({ ...updates, id });
}

export async function adminGetPromotions(): Promise<Promotion[]> {
  return fetchPromotions();
}

export async function adminCreatePromotion(promo: Partial<Promotion>): Promise<Promotion> {
  return saveAdminPromotion(promo);
}

export async function adminUpdatePromotion(id: string, updates: Partial<Promotion>): Promise<Promotion> {
  return saveAdminPromotion({ ...updates, id });
}

export async function adminDeletePromotion(id: string): Promise<void> {
  return deleteAdminPromotion(id);
}

export async function adminGetStoreSettings(): Promise<StoreSettings> {
  return fetchStoreSettings();
}

export async function adminUpdateStoreSettings(updates: Partial<StoreSettings>): Promise<StoreSettings> {
  return saveAdminSettings(updates);
}

export async function adminGetOrders(): Promise<Order[]> {
  try {
    return await getFirestoreOrders();
  } catch {
    const res = await fetch(`${API_BASE}/admin/orders`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load orders');
    return res.json();
  }
}

export async function adminUpdateOrderStatus(id: string, status: Order['status']): Promise<Order> {
  try {
    const updated = await updateFirestoreOrderStatus(id, status);
    fetch(`${API_BASE}/admin/orders/${id}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    }).catch(() => {});
    if (updated) return updated;
  } catch {}
  const res = await fetch(`${API_BASE}/admin/orders/${id}/status`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error('Failed to update order status');
  return res.json();
}

export const updateAdminOrderStatus = adminUpdateOrderStatus;

export async function adminGetUsers(): Promise<User[]> {
  try {
    return await getFirestoreUsers();
  } catch {
    const res = await fetch(`${API_BASE}/admin/users`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load users');
    return res.json();
  }
}

export async function adminCreateUser(user: { name: string; email: string; role: User['role']; password: string }): Promise<User> {
  const res = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(user)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create user');
  }
  const newUser = await res.json();
  saveFirestoreUser(newUser).catch(() => {});
  return newUser;
}

export async function adminUpdateUser(id: string, updates: Partial<User> & { password?: string }): Promise<User> {
  const res = await fetch(`${API_BASE}/admin/users/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update user');
  const updatedUser = await res.json();
  saveFirestoreUser(updatedUser).catch(() => {});
  return updatedUser;
}

export async function adminGetActivityLogs(): Promise<ActivityLog[]> {
  try {
    const logs = await getFirestoreActivityLogs();
    if (logs.length > 0) return logs;
  } catch {}
  const res = await fetch(`${API_BASE}/admin/activity`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to load activity logs');
  return res.json();
}

export async function uploadAdminImage(dataUrl: string, filename?: string): Promise<string> {
  const res = await fetch(`${API_BASE}/admin/upload-image`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ dataUrl, filename })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload image');
  }
  const data = await res.json();
  return data.url;
}

export {
  subscribeToFirestoreProducts,
  subscribeToFirestoreSettings
};
