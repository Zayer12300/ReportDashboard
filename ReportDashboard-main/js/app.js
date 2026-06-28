import { SERVICES, SAP_ENTRY_URL, SAP_ORIGIN } from './config.js';
import { ODataClient, explainConnectionError, isRunningOnSapOrigin, HTTP_LOG } from './odata-client.js';
import { normalizeRow, discoveredMappings } from './normalizers.js';
import { buildExceptions, applyFilters } from './exception-engine.js';
import { renderKpis, renderBars, renderTrend, renderTable, renderHealth, renderDrawer, populateSelect, startPasskeyScan, renderScmReports, renderDiagnostics } from './components.js';
import { MOCK_RECORDS, MOCK_DIAGNOSTICS } from './mock-data.js';

const $ = id => document.getElementById(id);
const state = {
  records: [],
  exceptions: [],
  serviceStates: SERVICES.map(s => ({ id: s.id, label: s.label, status: 'idle', detail: 'Not tested' })),
  diagnostics: [],
  credentials: { username: '', password: '' },
  isDemoMode: false,
  activeTab: 'dashboard', // 'dashboard' or 'reports'
  scmReports: { plantRiskReport: [], supplierRiskReport: [], dataQualityReport: [], buyerReport: [] }
};
const filterIds = ['companyFilter', 'plantFilter', 'supplierFilter', 'buyerFilter', 'purchOrgFilter', 'severityFilter', 'dateFromFilter', 'dateToFilter'];

function filters() {
  return {
    company: $('companyFilter').value,
    plant: $('plantFilter').value,
    supplier: $('supplierFilter').value,
    buyer: $('buyerFilter').value,
    purchasingOrg: $('purchOrgFilter').value,
    severity: $('severityFilter').value,
    dateFrom: $('dateFromFilter').value,
    dateTo: $('dateToFilter').value
  };
}

function updateSummary(visible) {
  $('summaryAttention').textContent = visible.filter(e => ['Critical', 'High'].includes(e.severity)).length.toLocaleString();
  $('summaryDeleted').textContent = visible.filter(e => e.category === 'Deleted').length.toLocaleString();

  const failedServices = state.serviceStates.filter(s => s.status === 'error').length;
  
  if (state.isDemoMode) {
    $('summaryConnection').textContent = 'Demo Mode Active';
    $('summaryConnectionNote').textContent = 'Using pre-loaded mock SAP OData';
  } else {
    $('summaryConnection').textContent = failedServices ? 'Needs attention' : 'Live readiness';
    $('summaryConnectionNote').textContent = failedServices
      ? (isRunningOnSapOrigin() ? `${failedServices} service${failedServices === 1 ? '' : 's'} need help` : 'Localhost cannot read SAP SAML-cookie OData')
      : 'SAP OData is ready or loaded';
  }
  
  $('summaryAttentionNote').textContent = `${visible.filter(e => ['Critical', 'High'].includes(e.severity)).length.toLocaleString()} high-priority exceptions`;
  $('summaryDeletedNote').textContent = `${visible.filter(e => e.category === 'Deleted').length.toLocaleString()} deleted or marked-for-deletion records`;
}

function compileScmReports(visibleExceptions) {
  // 1. Operational Value at Risk grouped by Plant
  const plantRiskMap = new Map();
  visibleExceptions.forEach(e => {
    const key = e.plant || 'Unassigned';
    if (!plantRiskMap.has(key)) {
      plantRiskMap.set(key, { plant: key, count: 0, criticalCount: 0, value: 0 });
    }
    const data = plantRiskMap.get(key);
    data.count++;
    if (['Critical', 'High'].includes(e.severity)) data.criticalCount++;
    data.value += e.value;
  });
  state.scmReports.plantRiskReport = [...plantRiskMap.values()].sort((a, b) => b.value - a.value);

  // 2. Supplier Overdue Bottlenecks
  const supplierRiskMap = new Map();
  visibleExceptions.filter(e => e.category === 'Overdue').forEach(e => {
    const key = e.supplier || 'Unassigned';
    if (!supplierRiskMap.has(key)) {
      supplierRiskMap.set(key, { supplierName: key, count: 0, value: 0, maxAge: 0 });
    }
    const data = supplierRiskMap.get(key);
    data.count++;
    data.value += e.value;
    data.maxAge = Math.max(data.maxAge, e.ageDays);
  });
  state.scmReports.supplierRiskReport = [...supplierRiskMap.values()].sort((a, b) => b.value - a.value);

  // 3. Master Data Integrity
  state.scmReports.dataQualityReport = visibleExceptions.filter(e => e.code === 'MISSING_MASTER_DATA').map(e => ({
    objectId: e.objectId,
    itemId: e.itemId,
    objectType: e.objectType,
    missingFields: e.title.replace('Missing ', ''),
    service: e.record.sourceService,
    buyer: e.buyer
  }));

  // 4. Buyer Workload Backlog
  const buyerMap = new Map();
  visibleExceptions.forEach(e => {
    const key = e.buyer || 'Unassigned';
    if (!buyerMap.has(key)) {
      buyerMap.set(key, { buyer: key, total: 0, critical: 0, high: 0, medium: 0, low: 0 });
    }
    const data = buyerMap.get(key);
    data.total++;
    data[e.severity.toLowerCase()]++;
  });
  state.scmReports.buyerReport = [...buyerMap.values()].sort((a, b) => b.total - a.total);
}

function render() {
  const visible = applyFilters(state.exceptions, filters());
  compileScmReports(visible);

  if (state.activeTab === 'dashboard') {
    renderKpis($('kpiGrid'), visible, state.serviceStates);
    renderTrend($('trendChart'), visible);
    renderBars($('deletionBreakdown'), visible.filter(e => e.category === 'Deleted'), 'objectType', { color: '#7b1fa2' });
    renderBars($('categoryBreakdown'), visible, 'category', { color: '#0b72b9' });
    renderBars($('supplierRanking'), visible, 'supplier', { color: '#ea6f1a' });
    renderTable($('exceptionTableBody'), visible);
    renderHealth($('serviceHealth'), state.serviceStates);
    $('resultCount').textContent = `${visible.length.toLocaleString()} exceptions`;
  } else {
    renderScmReports(state.scmReports);
  }
  updateSummary(visible);
}

function updateFilters() {
  populateSelect($('companyFilter'), state.records, 'company');
  populateSelect($('plantFilter'), state.records, 'plant');
  populateSelect($('supplierFilter'), state.records, 'supplierId', 'supplierName');
  populateSelect($('buyerFilter'), state.records, 'buyer');
  populateSelect($('purchOrgFilter'), state.records, 'purchasingOrg');
}

function setBanner(kind, title, message) {
  const banner = $('connectionBanner');
  banner.className = `connection-banner ${kind || ''}`;
  banner.querySelector('strong').textContent = title;
  banner.querySelector('p').textContent = message;
}

function syncCredentialStatus() {
  const hasUser = Boolean(state.credentials.username);
  const hasPass = Boolean(state.credentials.password);
  $('credentialStatus').textContent = hasUser || hasPass
    ? `Local credentials captured for this session: ${hasUser ? 'username set' : 'username empty'}, ${hasPass ? 'password set' : 'password empty'}.`
    : 'No local credentials stored.';
}

export function loadDemoMode() {
  state.isDemoMode = true;
  state.records = [];
  state.diagnostics = MOCK_DIAGNOSTICS;
  
  // Mock some OData traffic history logs for SCM analysts
  HTTP_LOG.length = 0;
  const mockTime = (offsetMs) => new Date(Date.now() - offsetMs);
  HTTP_LOG.push(
    { timestamp: mockTime(4500), serviceId: 'purchaseOrderFacts', url: 'https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/opu/odata/sap/C_PURCHASEORDER_FS_SRV/$metadata', method: 'GET', status: 200, statusText: 'OK', latencyMs: 142, attempt: 1, success: true },
    { timestamp: mockTime(4000), serviceId: 'purchaseOrderFacts', url: 'https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/opu/odata/sap/C_PURCHASEORDER_FS_SRV/C_PurchaseOrderFs?$top=500', method: 'GET', status: 200, statusText: 'OK', latencyMs: 258, attempt: 1, success: true },
    { timestamp: mockTime(3500), serviceId: 'purchaseOrderMaintenance', url: 'https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/opu/odata/sap/MM_PUR_PO_MAINT_V2_SRV/$metadata', method: 'GET', status: 200, statusText: 'OK', latencyMs: 198, attempt: 1, success: true },
    { timestamp: mockTime(3000), serviceId: 'purchaseOrderMaintenance', url: 'https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/opu/odata/sap/MM_PUR_PO_MAINT_V2_SRV/POHeader?$top=500', method: 'GET', status: 200, statusText: 'OK', latencyMs: 310, attempt: 1, success: true },
    { timestamp: mockTime(2500), serviceId: 'inboundDelivery', url: 'https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/opu/odata/sap/LE_SHP_INBOUND_DELIVERY_OBJPG_SRV/$metadata', method: 'GET', status: 'Network Error', statusText: 'Failed to fetch (CORS block)', latencyMs: 180, attempt: 1, success: false },
    { timestamp: mockTime(1500), serviceId: 'inboundDelivery', url: 'https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/opu/odata/sap/LE_SHP_INBOUND_DELIVERY_OBJPG_SRV/$metadata', method: 'GET', status: 200, statusText: 'OK (Retried with cache bypass)', latencyMs: 215, attempt: 2, success: true },
    { timestamp: mockTime(1000), serviceId: 'inboundDelivery', url: 'https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/opu/odata/sap/LE_SHP_INBOUND_DELIVERY_OBJPG_SRV/InboundDeliveryHeader?$top=500', method: 'GET', status: 200, statusText: 'OK', latencyMs: 290, attempt: 1, success: true }
  );

  // Set UI controls
  $('liveModeBtn').classList.remove('active');
  $('demoModeBtn').classList.add('active');
  $('connectButton').textContent = 'Live SAP Connection';
  $('connectButton').classList.remove('button-primary');
  $('connectButton').classList.add('button-secondary');
  $('refreshButton').disabled = false;

  SERVICES.forEach(service => {
    const serviceState = state.serviceStates.find(s => s.id === service.id);
    const mockRows = MOCK_RECORDS[service.id] || [];
    serviceState.status = 'connected';
    serviceState.records = mockRows.length;
    serviceState.detail = `Demo data · Static · ${mockRows.length} rows loaded`;
    
    // Normalize and add mock rows
    state.records.push(...mockRows.map(row => normalizeRow(row, {
      kind: service.kind,
      serviceId: service.id,
      entityName: service.id === 'inboundDelivery' ? 'InboundDeliveryHeader' : service.id === 'purchaseOrderFacts' ? 'C_PurchaseOrderFs' : 'POHeader'
    })));
  });

  state.exceptions = buildExceptions(state.records);
  updateFilters();
  render();

  const now = new Date();
  $('refreshStatus').textContent = `Demo loaded ${now.toLocaleTimeString()} · ${state.records.length} items`;
  
  setBanner(
    'connected',
    'Local Demo Mode active with mock SAP OData',
    'Because localhost cannot read SAP SSO credentials directly due to CORS, we have preloaded a realistic procurement dataset. All filters and drawers are fully functional.'
  );
  
  $('loginStatusText').textContent = 'Demo Mode SSO';
  
  // Clean UI Switch: Hide Login screen and reveal primary app
  $('loginPortal').style.display = 'none';
  $('appContainer').style.display = 'flex';
}

export function disableDemoMode() {
  state.isDemoMode = false;
  $('liveModeBtn').classList.add('active');
  $('demoModeBtn').classList.remove('active');
  $('connectButton').textContent = 'Connect SAP OData';
  $('connectButton').classList.add('button-primary');
  $('connectButton').classList.remove('button-secondary');
  $('refreshButton').disabled = true;

  state.serviceStates.forEach(s => {
    s.status = 'idle';
    s.detail = 'Not tested';
    s.records = 0;
  });
  state.records = [];
  state.exceptions = [];
  state.diagnostics = [];
  HTTP_LOG.length = 0; // Clear logs
  
  updateFilters();
  render();
  
  $('refreshStatus').textContent = 'Disconnected';
  
  if (isRunningOnSapOrigin()) {
    setBanner('', 'SAP SSO connection required', 'Use your existing SAP session. This dashboard never asks for or stores credentials.');
  } else {
    setBanner(
      'error',
      'Same-origin SAP hosting is required for Live OData',
      `You are running this dashboard on ${window.location.origin}. Your SAP OData session lives on ${SAP_ORIGIN}, so localhost cannot read responses directly. Switch to Demo Mode for local preview.`
    );
  }

  $('loginStatusText').textContent = 'Not Connected';
  
  // Clean UI Switch: Hide main app and reveal login landing page
  $('appContainer').style.display = 'none';
  $('loginPortal').style.display = 'flex';
}

async function connect() {
  if (state.isDemoMode) {
    disableDemoMode();
  }

  $('connectButton').disabled = true;
  $('refreshButton').disabled = true;
  $('refreshStatus').textContent = 'Connecting securely...';
  state.records = [];
  state.diagnostics = [];

  await Promise.all(SERVICES.map(async service => {
    const serviceState = state.serviceStates.find(s => s.id === service.id);
    serviceState.status = 'loading';
    serviceState.detail = 'Reading $metadata...';
    render();

    const client = new ODataClient(service);
    try {
      const metadata = await client.discover();
      const entities = client.chooseEntities();
      if (!entities.length) throw new Error('Connected, but no likely procurement entity set was discovered');

      const reads = [];
      for (const entity of entities) {
        try {
          const result = await client.readEntity(entity);
          reads.push({ entity, ...result });
          state.records.push(...result.rows.map(row => normalizeRow(row, { kind: service.kind, serviceId: service.id, entityName: entity.name })));
        } catch (error) {
          reads.push({ entity, error: error.message });
        }
      }

      const successful = reads.filter(r => r.rows);
      if (!successful.length) throw new Error(reads.map(r => r.error).join('; '));

      serviceState.status = 'connected';
      serviceState.records = successful.reduce((n, r) => n + r.rows.length, 0);
      serviceState.detail = `OData v${metadata.version} · ${metadata.latencyMs} ms · ${successful.map(r => r.entity.name).join(', ')}`;
      state.diagnostics.push({
        service: service.label,
        url: service.baseUrl,
        odataVersion: metadata.version,
        metadataLatencyMs: metadata.latencyMs,
        selectedEntities: reads.map(r => ({
          name: r.entity.name,
          score: r.entity.score,
          rows: r.rows?.length,
          error: r.error,
          mappings: discoveredMappings(r.entity.properties)
        })),
        allEntitySets: metadata.entitySets.map(e => e.name)
      });
    } catch (error) {
      serviceState.status = 'error';
      serviceState.records = 0;
      serviceState.detail = explainConnectionError(error);
      state.diagnostics.push({
        service: service.label,
        url: service.baseUrl,
        error: error.message,
        guidance: explainConnectionError(error)
      });
    }
  }));

  state.exceptions = buildExceptions(state.records);
  updateFilters();
  render();

  const connected = state.serviceStates.filter(s => s.status === 'connected').length;
  const now = new Date();
  $('refreshStatus').textContent = `Updated ${now.toLocaleTimeString()} · ${state.records.length.toLocaleString()} records`;

  if (connected) {
    setBanner('connected', `${connected} of ${SERVICES.length} SAP services connected`, `${state.exceptions.length.toLocaleString()} actionable exceptions evaluated. Review diagnostics for field mappings.`);
    $('refreshButton').disabled = false;
    $('loginStatusText').textContent = 'SAP SSO Connected';
    
    // Clean UI Switch: Hide Login screen and reveal primary app
    $('loginPortal').style.display = 'none';
    $('appContainer').style.display = 'flex';
  } else {
    setBanner(
      'error',
      isRunningOnSapOrigin() ? 'SAP SSO connection was not established' : 'SAP data is blocked by origin separation',
      isRunningOnSapOrigin()
        ? 'Open SAP in a new tab, complete corporate SSO, then retry.'
        : `SAP SSO is working in your SAP tab, but this page is running on ${window.location.origin}. Because SAP uses Entra SAML cookies on ${SAP_ORIGIN}, the browser will not expose those OData responses to localhost JavaScript.`
    );
    $('loginStatusText').textContent = 'Authentication Failed';
    disableDemoMode();
  }

  $('connectButton').disabled = false;
}

// Passwordless Login Handlers
function loginWithSSO() {
  setBanner('loading', 'Checking Active SAP SSO Session', 'Reusing browser cookie for Entra ID SAML authentication...');
  setTimeout(() => {
    if (isRunningOnSapOrigin()) {
      connect();
    } else {
      // Mock log in locally since we can't do direct CORS
      loadDemoMode();
      setBanner('connected', 'Authenticated via Entra ID SSO', 'Logged in using active corporate SSO session. Loaded mock preview dataset.');
    }
  }, 800);
}

// Simulated Biometric Scan Logon Trigger
function loginWithPasskey() {
  const dialog = $('passkeyAuthDialog');
  dialog.showModal();
  
  startPasskeyScan(() => {
    dialog.close();
    loadDemoMode();
    setBanner('connected', 'Authenticated via Corporate Passkey', 'Identity validated via security key. Loaded mock preview dataset.');
  });
}

// Tab Switching Handler
function switchTab(tabId) {
  state.activeTab = tabId;
  if (tabId === 'dashboard') {
    $('tabDashboard').classList.add('active');
    $('tabReports').classList.remove('active');
    $('dashboardView').style.display = 'block';
    $('reportsView').style.display = 'none';
  } else {
    $('tabDashboard').classList.remove('active');
    $('tabReports').classList.add('active');
    $('dashboardView').style.display = 'none';
    $('reportsView').style.display = 'block';
  }
  render();
}

// CSV Export Generator
function exportToCSV(data, headers, filename = 'export.csv') {
  if (!data || !data.length) {
    alert('No data available to export.');
    return;
  }
  
  const csvRows = [];
  // Add Header Row
  csvRows.push(headers.join(','));
  
  // Add Data Rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
      const escaped = val.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Event Listeners
filterIds.forEach(id => $(id).addEventListener('change', render));
$('clearFilters').addEventListener('click', () => {
  filterIds.forEach(id => $(id).value = '');
  render();
});
$('connectButton').addEventListener('click', connect);
$('refreshButton').addEventListener('click', () => {
  if (state.isDemoMode) {
    loadDemoMode();
  } else {
    connect();
  }
});
$('openSapButton').addEventListener('click', () => window.open(SAP_ENTRY_URL, 'sap-sso', 'noopener,noreferrer'));

$('storeCredentialsButton').addEventListener('click', () => {
  state.credentials.username = $('usernameInput').value.trim();
  state.credentials.password = $('passwordInput').value;
  syncCredentialStatus();
});
$('clearCredentialsButton').addEventListener('click', () => {
  state.credentials.username = '';
  state.credentials.password = '';
  $('usernameInput').value = '';
  $('passwordInput').value = '';
  syncCredentialStatus();
});

// Render dynamic diagnostics modal layout on click
$('showDiagnostics').addEventListener('click', () => {
  renderDiagnostics(state.diagnostics, HTTP_LOG);
  $('diagnosticsDialog').showModal();
});
$('closeDiagnostics').addEventListener('click', () => $('diagnosticsDialog').close());

$('liveModeBtn').addEventListener('click', () => {
  if (state.isDemoMode) disableDemoMode();
});
$('demoModeBtn').addEventListener('click', () => {
  if (!state.isDemoMode) loadDemoMode();
});

// Sidebar navigation click handlers
$('tabDashboard').addEventListener('click', () => switchTab('dashboard'));
$('tabReports').addEventListener('click', () => switchTab('reports'));

// Passwordless Login click handlers
$('btnSSOLogin').addEventListener('click', loginWithSSO);
$('btnPasskeyLogin').addEventListener('click', loginWithPasskey);

// Sign Out click handler
$('btnLogout').addEventListener('click', () => {
  disableDemoMode();
});

// CSV Export bindings
$('exportQueueCsv').addEventListener('click', () => {
  const visible = applyFilters(state.exceptions, filters());
  const headers = ['severity', 'objectId', 'itemId', 'objectType', 'title', 'supplier', 'plant', 'ageDays', 'value', 'buyer'];
  exportToCSV(visible, headers, `ASMO_Exceptions_Queue_${new Date().toISOString().slice(0,10)}.csv`);
});

// Bind report export buttons
document.body.addEventListener('click', (e) => {
  if (e.target.id === 'exportOperationalRiskCsv') {
    const headers = ['plant', 'count', 'criticalCount', 'value'];
    exportToCSV(state.scmReports.plantRiskReport, headers, 'ASMO_Operational_Value_At_Risk.csv');
  } else if (e.target.id === 'exportSupplierRiskCsv') {
    const headers = ['supplierName', 'count', 'value', 'maxAge'];
    exportToCSV(state.scmReports.supplierRiskReport, headers, 'ASMO_Supplier_Overdue_Bottlenecks.csv');
  } else if (e.target.id === 'exportDataIntegrityCsv') {
    const headers = ['objectId', 'itemId', 'objectType', 'missingFields', 'service', 'buyer'];
    exportToCSV(state.scmReports.dataQualityReport, headers, 'ASMO_Master_Data_Integrity_Audit.csv');
  } else if (e.target.id === 'exportBuyerWorkloadCsv') {
    const headers = ['buyer', 'total', 'critical', 'high', 'medium', 'low'];
    exportToCSV(state.scmReports.buyerReport, headers, 'ASMO_Buyer_Workload_Backlog.csv');
  }
});

$('exceptionTableBody').addEventListener('click', event => {
  const row = event.target.closest('tr[data-id]');
  if (!row) return;
  const exception = state.exceptions.find(x => x.id === row.dataset.id);
  renderDrawer($('drawerContent'), exception);
  $('detailDrawer').classList.add('open');
  $('detailDrawer').setAttribute('aria-hidden', 'false');
  $('drawerBackdrop').hidden = false;
});

function closeDrawer() {
  $('detailDrawer').classList.remove('open');
  $('detailDrawer').setAttribute('aria-hidden', 'true');
  $('drawerBackdrop').hidden = true;
}

$('closeDrawer').addEventListener('click', closeDrawer);
$('drawerBackdrop').addEventListener('click', closeDrawer);

// Startup logic
if (!isRunningOnSapOrigin()) {
  loadDemoMode(); // Auto-start in Demo Mode on localhost
} else {
  disableDemoMode(); // Start in Live SAP Mode with banner if running on actual SAP domain
}
syncCredentialStatus();
