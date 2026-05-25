import type { Invoice } from '../stores/invoices';
import type { Client } from '../stores/clients';
import type { Supplier } from '../stores/suppliers';

const statusLabel: Record<string, string> = {
  draft: 'Brouillon', sent: 'Envoyée', paid: 'Payée', cancelled: 'Annulée',
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

function linesTable(lines: Invoice['lines'], formatPrice: (v: number) => string): string {
  const rows = (lines ?? []).map(l => `
    <tr>
      <td>${l.description}</td>
      <td class="r">${Number(l.quantity).toLocaleString('fr-FR')}</td>
      <td class="r">${formatPrice(l.unit_price)}</td>
      <td class="r line-total">${formatPrice(l.quantity * l.unit_price)}</td>
    </tr>`).join('');
  return `
    <table>
      <thead><tr>
        <th>Désignation</th><th class="r">Qté</th><th class="r">Prix unitaire</th><th class="r">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function renderInvoiceHtml(
  templateHtml: string,
  invoice: Invoice,
  entity: Client | Supplier | undefined,
  accountName: string,
  formatPrice: (v: number) => string,
): string {
  const subtotal = (invoice.lines ?? []).reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const notesSection = invoice.notes
    ? `<div class="notes-box"><div class="notes-label">Notes</div><div class="notes-text">${invoice.notes}</div></div>`
    : '';

  const vars: Record<string, string> = {
    account_name:         accountName,
    invoice_reference:    invoice.reference,
    invoice_date:         fmtDate(invoice.date),
    invoice_due_date:     fmtDate(invoice.due_date),
    invoice_status:       invoice.status,
    invoice_status_label: statusLabel[invoice.status] ?? invoice.status,
    entity_type_label:    invoice.type === 'client' ? 'Client' : 'Fournisseur',
    entity_name:          invoice.entity_name ?? '—',
    entity_email:         (entity as any)?.email ?? '',
    entity_phone:         (entity as any)?.phone ?? '',
    entity_address:       (entity as any)?.address ?? '',
    notes:                invoice.notes,
    notes_section:        notesSection,
    lines_table:          linesTable(invoice.lines, formatPrice),
    subtotal:             formatPrice(subtotal),
    currency:             '', // filled by caller if needed
  };

  return (templateHtml ?? '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

export function printHtml(html: string, title = 'Facture'): void {
  const win = window.open('', '_blank', 'width=960,height=760');
  if (!win) { alert('Veuillez autoriser les pop-ups pour télécharger le PDF.'); return; }
  win.document.write(html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`));
  win.document.close();
  win.focus();
  // Small delay lets CSS render before the print dialog opens
  setTimeout(() => { win.print(); }, 600);
}
