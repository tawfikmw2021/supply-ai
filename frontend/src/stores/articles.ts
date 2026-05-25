import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api';

export interface Article {
  id: number;
  code: string | null;
  nom: string;
  designation_courte: string | null;
  description: string | null;
  code_barre: string | null;
  prix_achat_ht: number;
  prix_vente_ht: number;
  prix_achat_ttc: number;
  prix_vente_ttc: number;
  marge: number;
  famille: string | null;
  id_famille: number | null;
  marque: string | null;
  id_marque: number | null;
  taux_tva: number | null;
  id_tva: number | null;
  stock_total: number;
  hors_stock: number | null;   // 0 | 1 (bit column cast to int)
  sommeil: number | null;      // 0 | 1
  alerte_stock: number | null;
  date_creation: string | null;
  has_image: boolean;
}

export interface FamilleOption { id: number; libelle: string; }
export interface MarqueOption  { id: number; libelle: string; }
export interface TvaOption     { id: number; taux: number;   }

export interface ArticleUpdatePayload {
  code?: string | null;
  nom: string;
  designation_courte?: string | null;
  description?: string | null;
  code_barre?: string | null;
  prix_achat_ht?: number | null;
  prix_vente_ht?: number | null;
  prix_achat_ttc?: number | null;
  prix_vente_ttc?: number | null;
  id_famille?: number | null;
  id_marque?: number | null;
  id_tva?: number | null;
  hors_stock?: number;
  sommeil?: number;
  alerte_stock?: number | null;
}

export interface FetchArticlesOpts {
  page?: number;
  search?: string;
  famille?: string;
  sommeil?: boolean;
}

export const useArticlesStore = defineStore('articles', () => {
  const articles  = ref<Article[]>([]);
  const total     = ref(0);
  const page      = ref(1);
  const limit     = ref(50);
  const loading   = ref(false);
  const saving    = ref(false);
  const error     = ref('');
  const familles  = ref<FamilleOption[]>([]);
  const marques   = ref<MarqueOption[]>([]);
  const tvas      = ref<TvaOption[]>([]);

  async function fetchArticles(opts: FetchArticlesOpts = {}) {
    loading.value = true;
    error.value   = '';
    try {
      const params: Record<string, any> = {
        page:  opts.page  ?? page.value,
        limit: limit.value,
      };
      if (opts.search)  params.search  = opts.search;
      if (opts.famille) params.famille = opts.famille;
      if (opts.sommeil) params.sommeil = '1';

      const { data } = await api.get('/articles', { params });
      articles.value = data.articles;
      total.value    = data.total;
      page.value     = data.page;
    } catch (e: any) {
      error.value = e.response?.data?.message ?? 'Erreur chargement articles';
    } finally {
      loading.value = false;
    }
  }

  async function fetchFamilles() {
    try {
      const { data } = await api.get('/articles/familles');
      familles.value = data.familles;
    } catch { /* silent */ }
  }

  async function fetchMarques() {
    try {
      const { data } = await api.get('/articles/marques');
      marques.value = data.marques;
    } catch { /* silent */ }
  }

  async function fetchTvas() {
    try {
      const { data } = await api.get('/articles/tvas');
      tvas.value = data.tvas;
    } catch { /* silent */ }
  }

  async function updateArticle(id: number, payload: ArticleUpdatePayload): Promise<Article> {
    saving.value = true;
    try {
      const { data } = await api.put(`/articles/${id}`, payload);
      const idx = articles.value.findIndex(a => a.id === id);
      if (idx !== -1) articles.value[idx] = data.article;
      return data.article as Article;
    } finally {
      saving.value = false;
    }
  }

  async function uploadImage(id: number, file: File): Promise<void> {
    const fd = new FormData();
    fd.append('image', file);
    await api.post(`/articles/${id}/image`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    // Mark has_image in place
    const idx = articles.value.findIndex(a => a.id === id);
    if (idx !== -1) articles.value[idx] = { ...articles.value[idx], has_image: true };
  }

  async function deleteImage(id: number): Promise<void> {
    await api.delete(`/articles/${id}/image`);
    const idx = articles.value.findIndex(a => a.id === id);
    if (idx !== -1) articles.value[idx] = { ...articles.value[idx], has_image: false };
  }

  return {
    articles, total, page, limit, loading, saving, error,
    familles, marques, tvas,
    fetchArticles, fetchFamilles, fetchMarques, fetchTvas,
    updateArticle, uploadImage, deleteImage,
  };
});
