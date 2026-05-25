<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps<{
  traces: any[];
  layout?: Record<string, any>;
}>();

const container = ref<HTMLDivElement | null>(null);
let Plotly: any = null;

async function loadPlotly() {
  if (Plotly) return;
  const mod = await import('plotly.js-dist-min');
  // Handle both ESM default export and CJS module.exports shapes
  Plotly = (mod as any).default ?? mod;
}

async function render() {
  if (!container.value || !props.traces.length) return;
  await loadPlotly();
  // Re-check after async gap — component may have unmounted
  if (!container.value) return;
  try {
    const layout: Record<string, any> = {
      margin: { t: 32, b: 40, l: 50, r: 20 },
      autosize: true,
      font: { size: 11, family: 'inherit' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: '#f9f9fc',
      showlegend: props.traces.length > 1,
      ...(props.layout ?? {}),
    };
    Plotly.react(container.value, props.traces, layout, { responsive: true, displayModeBar: false });
  } catch (e) {
    console.warn('PlotlyChart render error:', e);
  }
}

onMounted(render);
watch(() => [props.traces, props.layout], render, { deep: true });
onUnmounted(() => {
  if (Plotly && container.value) {
    try { Plotly.purge(container.value); } catch { /* ignore */ }
  }
});
</script>

<template>
  <div ref="container" class="chart" />
</template>

<style scoped>
.chart { width: 100%; height: 100%; min-height: 0; }
</style>
