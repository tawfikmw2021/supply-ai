import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api';

export interface ProductCategory {
  id: number;
  name: string;
  color: string;
  description: string;
  created_at: string;
}

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<ProductCategory[]>([]);
  const loading = ref(false);

  async function fetchCategories() {
    loading.value = true;
    try {
      const { data } = await api.get('/categories');
      categories.value = data.categories;
    } finally {
      loading.value = false;
    }
  }

  async function createCategory(payload: Omit<ProductCategory, 'id' | 'created_at'>) {
    const { data } = await api.post('/categories', payload);
    categories.value.push(data.category);
    categories.value.sort((a, b) => a.name.localeCompare(b.name));
    return data.category as ProductCategory;
  }

  async function updateCategory(id: number, payload: Partial<Omit<ProductCategory, 'id' | 'created_at'>>) {
    const { data } = await api.put(`/categories/${id}`, payload);
    const idx = categories.value.findIndex(c => c.id === id);
    if (idx !== -1) categories.value[idx] = data.category;
    categories.value.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function deleteCategory(id: number) {
    await api.delete(`/categories/${id}`);
    categories.value = categories.value.filter(c => c.id !== id);
  }

  return { categories, loading, fetchCategories, createCategory, updateCategory, deleteCategory };
});
