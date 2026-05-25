import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', component: () => import('../views/LoginView.vue') },
    { path: '/register', component: () => import('../views/RegisterView.vue') },
    {
      path: '/accounts/:accountId',
      component: () => import('../layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: (to) => `/accounts/${to.params.accountId}/pg/article` },
         {path: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { requiresAdmin: true } },
         {path: 'dashboard/new', component: () => import('../views/WidgetEditorView.vue'), meta: { requiresAdmin: true } },
          {path: 'dashboard/:widgetId/edit', component: () => import('../views/WidgetEditorView.vue'), meta: { requiresAdmin: true } },
        //{ path: 'dashboard', redirect: (to) => `/accounts/${to.params.accountId}/pg/article` },
        //{ path: 'dashboard/new', redirect: (to) => `/accounts/${to.params.accountId}/pg/article` },
        //{ path: 'dashboard/:widgetId/edit', redirect: (to) => `/accounts/${to.params.accountId}/pg/article` },
        { path: 'products',   component: () => import('../views/ProductsView.vue') },
        { path: 'deliveries', component: () => import('../views/DeliveriesView.vue') },
        { path: 'documents', component: () => import('../views/DocumentsView.vue') },
        { path: 'suppliers', component: () => import('../views/SuppliersView.vue') },
        { path: 'clients', component: () => import('../views/ClientsView.vue') },
        { path: 'invoices', component: () => import('../views/InvoicesView.vue') },
        { path: 'categories', component: () => import('../views/CategoriesView.vue'), meta: { requiresAdmin: true } },
        { path: 'users', component: () => import('../views/UsersView.vue'), meta: { requiresAdmin: true } },
        { path: 'templates', component: () => import('../views/TemplatesView.vue'), meta: { requiresAdmin: true } },
        { path: 'loaders', component: () => import('../views/LoadersView.vue') },
        { path: 'loaders/new', component: () => import('../views/LoaderEditorView.vue'), meta: { requiresAdmin: true } },
        { path: 'loaders/:loaderId/edit', component: () => import('../views/LoaderEditorView.vue'), meta: { requiresAdmin: true } },
        { path: 'settings', component: () => import('../views/SettingsView.vue'), meta: { requiresAdmin: true } },
        { path: 'account', component: () => import('../views/AccountView.vue') },
        { path: 'audit',  component: () => import('../views/AuditView.vue'),  meta: { requiresAdmin: true } },
        { path: 'schema', component: () => import('../views/SchemaView.vue'), meta: { requiresAdmin: true } },
        { path: 'help',    component: () => import('../views/HelpView.vue'),    meta: { requiresAdmin: true } },
        { path: 'alerts',  component: () => import('../views/AlertsView.vue'),  meta: { requiresAdmin: true } },
        { path: 'column-settings', component: () => import('../views/ColumnSettingsView.vue'), meta: { requiresAdmin: true } },
        { path: 'pg/:table', component: () => import('../views/PgTableView.vue'), meta: { requiresAuth: true } },
        { path: 'camera', component: () => import('../views/CameraView.vue') },
      ],
    },
    // Root: redirect to last visited route or default
    {
      path: '/',
      redirect: () => {
        const last = localStorage.getItem('lastRoute');
        if (last) return last;
        const aid = localStorage.getItem('accountId');
        return aid ? `/accounts/${aid}/products` : '/login';
      },
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (auth.token && !auth.user) await auth.fetchMe();

  const requiresAuth = to.matched.some(r => r.meta.requiresAuth);

  if (requiresAuth && !auth.token) return '/login';

  const effectiveAdmin = auth.user?.role === 'admin' && !auth.viewAsUser;

  const requiresAdmin = to.matched.some(r => r.meta.requiresAdmin);
  if (requiresAdmin && !effectiveAdmin) {
    return `/accounts/${auth.user?.account_id}/products`;
  }

  // Enforce screen-access settings for non-admin users
  const GUARDED_SCREENS = ['products', 'deliveries', 'documents', 'suppliers', 'clients', 'invoices', 'loaders'];
  const lastSegment = to.path.split('/').pop() ?? '';
  if (!effectiveAdmin && auth.account && GUARDED_SCREENS.includes(lastSegment)) {
    const screenSettings = auth.account.properties?.screens ?? {};
    if (screenSettings[lastSegment] === false) {
      const firstEnabled = GUARDED_SCREENS.find(s => screenSettings[s] !== false) ?? 'products';
      return `/accounts/${auth.user!.account_id}/${firstEnabled}`;
    }
  }

  // Prevent accessing another account's URL
  if (to.params.accountId && auth.user) {
    if (Number(to.params.accountId) !== auth.user.account_id) {
      return `/accounts/${auth.user.account_id}/products`;
    }
  }

  if ((to.path === '/login' || to.path === '/register') && auth.token) {
    const last = localStorage.getItem('lastRoute');
    const aid = localStorage.getItem('accountId');
    return last || (aid ? `/accounts/${aid}/products` : '/');
  }
});

export default router;
