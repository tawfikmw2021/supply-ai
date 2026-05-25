import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api';

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'table';
export type WidgetWidth = 'full' | 'half' | 'third';

export interface WidgetConfig {
  x?: string;
  y?: string;
  y_cols?: string[];
  labels?: string;
  values?: string;
  layout?: Record<string, any>;
}

export interface Widget {
  id: number;
  title: string;
  chart_type: ChartType;
  query: string;
  config: WidgetConfig;
  position: number;
  width: WidgetWidth;
  created_at: string;
  updated_at: string;
}

export interface SchemaColumn { name: string; type: string; }
export interface SchemaTable  { name: string; columns: SchemaColumn[]; }

export function buildTraces(rows: any[], chartType: ChartType, config: WidgetConfig): any[] {
  if (!rows.length) return [];
  switch (chartType) {
    case 'bar':
    case 'line': {
      const yKeys = config.y_cols?.length ? config.y_cols : (config.y ? [config.y] : []);
      if (!config.x || !yKeys.length) return [];
      return yKeys.map(k => ({ type: chartType, x: rows.map(r => r[config.x!]), y: rows.map(r => r[k]), name: k }));
    }
    case 'scatter':
      if (!config.x || !config.y) return [];
      return [{ type: 'scatter', mode: 'markers', x: rows.map(r => r[config.x!]), y: rows.map(r => r[config.y!]) }];
    case 'pie':
      if (!config.labels || !config.values) return [];
      return [{ type: 'pie', labels: rows.map(r => r[config.labels!]), values: rows.map(r => r[config.values!]) }];
    case 'table': {
      const cols = Object.keys(rows[0]);
      return [{ type: 'table', header: { values: cols, fill: { color: '#1a1a2e' }, font: { color: 'white', size: 12 }, align: 'left' }, cells: { values: cols.map(c => rows.map(r => r[c])), fill: { color: ['white', '#f9f9fc'] }, align: 'left', font: { size: 11 } } }];
    }
    default: return [];
  }
}

export const useDashboardStore = defineStore('dashboard', () => {
  const widgets = ref<Widget[]>([]);

  async function fetchWidgets(): Promise<Widget[]> {
    const { data } = await api.get('/dashboard/widgets');
    widgets.value = data.widgets;
    return data.widgets;
  }

  async function fetchWidgetData(id: number): Promise<any[]> {
    const { data } = await api.get(`/dashboard/widgets/${id}/data`);
    return data.rows ?? [];
  }

  async function previewQuery(query: string): Promise<any[]> {
    const { data } = await api.post('/dashboard/preview', { query });
    return data.rows ?? [];
  }

  async function fetchSchema(): Promise<SchemaTable[]> {
    const { data } = await api.get('/dashboard/schema');
    return data.schema ?? [];
  }

  async function createWidget(payload: Partial<Widget>): Promise<Widget> {
    const { data } = await api.post('/dashboard/widgets', payload);
    widgets.value.push(data.widget);
    return data.widget;
  }

  async function updateWidget(id: number, payload: Partial<Widget>): Promise<Widget> {
    const { data } = await api.put(`/dashboard/widgets/${id}`, payload);
    const idx = widgets.value.findIndex(w => w.id === id);
    if (idx !== -1) widgets.value[idx] = data.widget;
    return data.widget;
  }

  async function deleteWidget(id: number): Promise<void> {
    await api.delete(`/dashboard/widgets/${id}`);
    widgets.value = widgets.value.filter(w => w.id !== id);
  }

  async function savePositions(positions: { id: number; position: number }[]): Promise<void> {
    await api.put('/dashboard/widgets/positions', { positions });
  }

  return { widgets, fetchWidgets, fetchWidgetData, previewQuery, fetchSchema, createWidget, updateWidget, deleteWidget, savePositions };
});
