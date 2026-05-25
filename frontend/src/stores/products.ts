import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api';

export interface ProductDocument {
  id: number;
  type: string;
  url: string;
  properties: Record<string, any>;
}

export interface StockMovement {
  id: number;
  product_id: number;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  user_name: string;
  created_at: string;
}

export interface Product {
  id: number;
  code: string;
  name: string;
  category: string;
  price: number;
  sale_price: number;
  vat: number;
  stock: number;
  description: string;
  manufacturer: string;
  supplier_id: number | null;
  supplier: { id: number; name: string } | null;
  barcode: string;
  document_id: number | null;
  document: ProductDocument | null;
  created_at: string;
}

export const useProductsStore = defineStore('products', () => {
  const products = ref<Product[]>([]);
  const loading = ref(false);

  async function fetchProducts() {
    loading.value = true;
    try {
      const { data } = await api.get('/products');
      products.value = data.products;
    } finally {
      loading.value = false;
    }
  }

  async function createProduct(payload: Partial<Omit<Product, 'id' | 'document' | 'supplier'>>) {
    const { data } = await api.post('/products', payload);
    products.value.unshift(data.product);
    return data.product as Product;
  }

  async function updateProduct(id: number, payload: Partial<Omit<Product, 'id' | 'document' | 'supplier'>>) {
    const { data } = await api.put(`/products/${id}`, payload);
    const idx = products.value.findIndex(p => p.id === id);
    if (idx !== -1) products.value[idx] = data.product;
    return data.product as Product;
  }

  async function uploadImage(id: number, file: File) {
    const form = new FormData();
    form.append('image', file);
    const { data } = await api.post(`/products/${id}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const idx = products.value.findIndex(p => p.id === id);
    if (idx !== -1) products.value[idx] = data.product;
  }

  async function getMovements(id: number): Promise<StockMovement[]> {
    const { data } = await api.get(`/products/${id}/movements`);
    return data.movements;
  }

  async function addMovement(id: number, payload: { type: string; quantity: number; reason: string }) {
    const { data } = await api.post(`/products/${id}/movements`, payload);
    const idx = products.value.findIndex(p => p.id === id);
    if (idx !== -1) products.value[idx].stock = data.product.stock;
    return data.movement as StockMovement;
  }

  async function deleteProduct(id: number) {
    await api.delete(`/products/${id}`);
    products.value = products.value.filter(p => p.id !== id);
  }

  return { products, loading, fetchProducts, createProduct, updateProduct, uploadImage, getMovements, addMovement, deleteProduct };
});
