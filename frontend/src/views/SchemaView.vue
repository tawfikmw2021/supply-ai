<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#6c63ff',
    primaryTextColor: '#1a1a2e',
    primaryBorderColor: '#5a52d5',
    lineColor: '#6c63ff',
    secondaryColor: '#f0f2f5',
    tertiaryColor: '#ffffff',
    background: '#ffffff',
    mainBkg: '#f8f7ff',
    nodeBorder: '#6c63ff',
    clusterBkg: '#f0f2f5',
    titleColor: '#1a1a2e',
    edgeLabelBackground: '#ffffff',
    fontFamily: 'system-ui, sans-serif',
  },
});

const erRef = ref<HTMLElement | null>(null);
const flowRef = ref<HTMLElement | null>(null);
const activeTab = ref<'er' | 'workflow'>('er');

const ER_DIAGRAM = `
erDiagram
  documents {
    int id PK
    text type
    text url
    text properties
    text created_at
  }
  products {
    int id PK
    text name
    text category
    real price
    int stock
    text description
    int document_id FK
    text created_at
  }
  suppliers {
    int id PK
    text name
    text email
    text phone
    text address
    text category
    text notes
    text created_at
  }
  clients {
    int id PK
    text name
    text email
    text phone
    text address
    text notes
    text created_at
  }
  invoices {
    int id PK
    text type
    text reference
    int client_id FK
    int supplier_id FK
    text date
    text due_date
    text status
    text notes
    text created_at
  }
  invoice_lines {
    int id PK
    int invoice_id FK
    text description
    real quantity
    real unit_price
  }
  loaders {
    int id PK
    text name
    text file_format
    text delimiter
    int has_header
    text target_table
    text upsert_key
    text on_conflict
    text mapping
    text created_at
  }
  dashboard_widgets {
    int id PK
    text title
    text chart_type
    text query
    text config
    int position
    text width
    text created_at
  }
  templates {
    int id PK
    text name
    text type
    int is_default_client
    int is_default_supplier
    text html
    text created_at
  }
  help {
    int id PK
    text type
    text message
    int user_id
    text user_name
    text status
    text created_at
  }

  products   ||--o| documents      : "document_id"
  invoices   }o--o| clients        : "client_id"
  invoices   }o--o| suppliers      : "supplier_id"
  invoice_lines }|--|| invoices    : "invoice_id"
`;

const WORKFLOW_DIAGRAM = `
flowchart TD
  subgraph Import["📥 Import de données"]
    F([Fichier CSV / Excel]) --> LC[Loader Config]
    LC --> |mapping + upsert| TBL[(Table cible)]
  end

  subgraph Docs["📄 Documents"]
    UP([Upload fichier]) --> DOC[(documents)]
    DOC --> |document_id| PRD
  end

  subgraph Catalogue["📦 Catalogue"]
    PRD[(products)]
    SUP[(suppliers)]
    CLI[(clients)]
  end

  subgraph Facturation["🧾 Facturation"]
    CLI --> INV[Invoice]
    SUP --> INV
    INV --> |invoice_id| LIG[invoice_lines]
    INV --> S1([draft])
    S1 --> S2([sent])
    S2 --> S3([paid])
    S2 --> S4([cancelled])
  end

  subgraph Analyse["📊 Analyse"]
    PRD --> |SQL query| WGT[Dashboard Widget]
    SUP --> |SQL query| WGT
    INV --> |SQL query| WGT
    WGT --> CHT([Graphique])
  end

  subgraph Templates["🖨️ Modèles"]
    TPL[(templates)] --> |PDF render| INV
  end

  subgraph Feedback["💬 Aide"]
    USR([Utilisateur]) --> HLP[(help)]
    HLP --> ADM([Admin review])
  end

  TBL --> PRD
  TBL --> SUP
  TBL --> CLI
`;

async function renderDiagram(el: HTMLElement | null, diagram: string, id: string) {
  if (!el) return;
  const { svg } = await mermaid.render(id, diagram);
  el.innerHTML = svg;
}

async function renderAll() {
  await nextTick();
  await renderDiagram(erRef.value, ER_DIAGRAM, 'er-diagram');
  await renderDiagram(flowRef.value, WORKFLOW_DIAGRAM, 'workflow-diagram');
}

onMounted(renderAll);

const TABLE_DOCS = [
  {
    icon: '📄', name: 'documents',
    desc: 'Fichiers uploadés (PDF, images, etc.) rattachables à un article.',
    keys: [{ col: 'id', type: 'PK' }],
  },
  {
    icon: '📦', name: 'products',
    desc: 'Catalogue des articles avec prix, stock et catégorie.',
    keys: [{ col: 'id', type: 'PK' }, { col: 'document_id', type: 'FK', ref: 'documents.id' }],
  },
  {
    icon: '🏭', name: 'suppliers',
    desc: 'Fournisseurs avec coordonnées et catégorie.',
    keys: [{ col: 'id', type: 'PK' }],
  },
  {
    icon: '🤝', name: 'clients',
    desc: 'Clients avec coordonnées.',
    keys: [{ col: 'id', type: 'PK' }],
  },
  {
    icon: '🧾', name: 'invoices',
    desc: 'Factures clients ou fournisseurs. Statuts : draft → sent → paid / cancelled.',
    keys: [{ col: 'id', type: 'PK' }, { col: 'client_id', type: 'FK', ref: 'clients.id' }, { col: 'supplier_id', type: 'FK', ref: 'suppliers.id' }],
  },
  {
    icon: '➕', name: 'invoice_lines',
    desc: 'Lignes de détail d\'une facture (description, quantité, prix unitaire).',
    keys: [{ col: 'id', type: 'PK' }, { col: 'invoice_id', type: 'FK', ref: 'invoices.id' }],
  },
  {
    icon: '📥', name: 'loaders',
    desc: 'Configurations d\'import de fichiers CSV/Excel vers les tables cibles.',
    keys: [{ col: 'id', type: 'PK' }],
  },
  {
    icon: '📊', name: 'dashboard_widgets',
    desc: 'Widgets graphiques du tableau de bord. Chaque widget contient une requête SQL et une config de rendu.',
    keys: [{ col: 'id', type: 'PK' }],
  },
  {
    icon: '🖨️', name: 'templates',
    desc: 'Modèles HTML pour la génération de PDF de factures clients ou fournisseurs.',
    keys: [{ col: 'id', type: 'PK' }],
  },
  {
    icon: '💬', name: 'help',
    desc: 'Demandes d\'aide soumises par les utilisateurs (tâche, bug, question, suggestion).',
    keys: [{ col: 'id', type: 'PK' }],
  },
];
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <h1>Schéma de la base de données</h1>
        <p class="subtitle">Modèle objet et workflow du compte</p>
      </div>
    </header>

    <!-- Legend / help panel -->
    <div class="help-panel">
      <div class="help-section">
        <h3>📖 Comment lire ces diagrammes</h3>
        <div class="help-grid">
          <div class="help-card">
            <div class="help-card-title">🗂 Modèle objet (ER)</div>
            <p>Montre toutes les <strong>tables</strong> de la base de données avec leurs colonnes et les liens entre
              elles.</p>
            <ul>
              <li><span class="badge pk">PK</span> Clé primaire — identifiant unique de chaque enregistrement</li>
              <li><span class="badge fk">FK</span> Clé étrangère — référence vers une autre table</li>
              <li><code>||--o|</code> &nbsp;Un article peut avoir <em>zéro ou un</em> document</li>
              <li><code>}|--||</code> &nbsp;Plusieurs lignes appartiennent à <em>une</em> facture</li>
            </ul>
          </div>
          <div class="help-card">
            <div class="help-card-title">🔄 Workflow</div>
            <p>Montre comment les <strong>données circulent</strong> d'un bout à l'autre de l'application.</p>
            <ul>
              <li><strong>Rectangles arrondis</strong> → points d'entrée / actions utilisateur</li>
              <li><strong>Rectangles</strong> → traitements ou étapes intermédiaires</li>
              <li><strong>Cylindres</strong> → tables en base de données</li>
              <li><strong>Flèches étiquetées</strong> → nature du lien entre deux étapes</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="help-section">
        <h3>🗄 Tables du compte</h3>
        <div class="table-legend">
          <div class="tl-row" v-for="t in TABLE_DOCS" :key="t.name">
            <span class="tl-icon">{{ t.icon }}</span>
            <div class="tl-body">
              <span class="tl-name">{{ t.name }}</span>
              <span class="tl-desc">{{ t.desc }}</span>
            </div>
            <div class="tl-keys" v-if="t.keys.length">
              <span v-for="k in t.keys" :key="k.col" class="tl-key">
                <span class="badge" :class="k.type === 'PK' ? 'pk' : 'fk'">{{ k.type }}</span>
                {{ k.col }}
                <span v-if="k.ref" class="tl-ref">→ {{ k.ref }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ active: activeTab === 'er' }" @click="activeTab = 'er'">
        🗂 Modèle objet (ER)
      </button>
      <button class="tab" :class="{ active: activeTab === 'workflow' }" @click="activeTab = 'workflow'">
        🔄 Workflow
      </button>
    </div>

    <div class="diagram-card">
      <div v-show="activeTab === 'er'" ref="erRef" class="diagram-wrap" />
      <div v-show="activeTab === 'workflow'" ref="flowRef" class="diagram-wrap" />
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 1.5rem;
}

.topbar {
  margin-bottom: 1.25rem;
}

.topbar h1 {
  margin: 0 0 .2rem;
  font-size: 1.5rem;
  color: #1a1a2e;
}

.subtitle {
  margin: 0;
  font-size: .875rem;
  color: #888;
}

.tabs {
  display: flex;
  gap: .5rem;
  margin-bottom: 1rem;
}

.tab {
  padding: .42rem 1.1rem;
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  font-size: .85rem;
  cursor: pointer;
  color: #555;
  font-weight: 500;
  transition: border-color .15s, background .15s, color .15s;
}

.tab:hover {
  border-color: #6c63ff;
  color: #6c63ff;
}

.tab.active {
  border-color: #6c63ff;
  background: #6c63ff;
  color: white;
  font-weight: 600;
}

.diagram-card {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 14px;
  padding: 1.5rem;
  overflow: auto;
}

.diagram-wrap {
  min-width: 600px;
  display: flex;
  justify-content: center;
}

.diagram-wrap :deep(svg) {
  max-width: 100%;
  height: auto;
}

/* ── Help panel ──────────────────────────────────────────── */
.help-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.help-section {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 14px;
  padding: 1.25rem 1.5rem;
}

.help-section h3 {
  margin: 0 0 1rem;
  font-size: .95rem;
  color: #1a1a2e;
}

/* Reading guide cards */
.help-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 760px) {
  .help-grid {
    grid-template-columns: 1fr;
  }
}

.help-card {
  background: #f8f7ff;
  border: 1px solid #e0dcff;
  border-radius: 10px;
  padding: 1rem 1.1rem;
}

.help-card-title {
  font-weight: 700;
  font-size: .88rem;
  color: #1a1a2e;
  margin-bottom: .5rem;
}

.help-card p {
  margin: 0 0 .5rem;
  font-size: .82rem;
  color: #444;
  line-height: 1.6;
}

.help-card ul {
  margin: 0;
  padding-left: 1.1rem;
  font-size: .8rem;
  color: #555;
  line-height: 1.9;
}

.help-card code {
  background: #ede9ff;
  padding: .1rem .35rem;
  border-radius: 4px;
  font-size: .78rem;
  color: #5a52d5;
}

/* Badges */
.badge {
  display: inline-block;
  padding: .1rem .38rem;
  border-radius: 4px;
  font-size: .68rem;
  font-weight: 700;
  vertical-align: middle;
  line-height: 1.4;
}

.badge.pk {
  background: #ede9ff;
  color: #5a52d5;
}

.badge.fk {
  background: #fff3cd;
  color: #b45309;
}

/* Table legend */
.table-legend {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.tl-row {
  display: flex;
  align-items: flex-start;
  gap: .85rem;
  padding: .7rem 0;
  border-bottom: 1px solid #f5f5f5;
}

.tl-row:last-child {
  border-bottom: none;
}

.tl-icon {
  font-size: 1.15rem;
  flex-shrink: 0;
  margin-top: .05rem;
}

.tl-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: .15rem;
  min-width: 0;
}

.tl-name {
  font-weight: 700;
  font-size: .85rem;
  color: #1a1a2e;
  font-family: monospace;
}

.tl-desc {
  font-size: .78rem;
  color: #666;
  line-height: 1.5;
}

.tl-keys {
  display: flex;
  flex-wrap: wrap;
  gap: .35rem;
  flex-shrink: 0;
  align-items: center;
}

.tl-key {
  display: flex;
  align-items: center;
  gap: .3rem;
  font-size: .75rem;
  color: #555;
  white-space: nowrap;
}

.tl-ref {
  color: #aaa;
  font-size: .72rem;
}
</style>
