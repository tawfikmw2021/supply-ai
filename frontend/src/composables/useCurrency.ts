import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';

export function useCurrency() {
  const auth = useAuthStore();

  const currency = computed<string>(() => auth.account?.properties?.currency ?? 'EUR');

  function formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency.value,
    }).format(value);
  }

  return { currency, formatPrice };
}
