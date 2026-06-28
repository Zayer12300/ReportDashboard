import { SERVICES, SAP_ENTRY_URL, SAP_ORIGIN } from './config.js';
import { ODataClient, explainConnectionError, isRunningOnSapOrigin } from './odata-client.js';
import { normalizeRow, discoveredMappings } from './normalizers.js';
import { buildExceptions, applyFilters } from './exception-engine.js';
import { renderKpis, renderBars, renderTrend, renderTable, renderHealth, renderDrawer, populateSelect } from './components.js';

const $ = id => document.getElementById(id);
const state = {
  records: [],
  exceptions: [],
  serviceStates: SERVICES.map(s => ({ id: s.id, label: s.label, status: 'idle', detail: 'Not tested' })),
  diagnostics: [],
  credentials: { username: '', password: '' }
};
const filterIds = ['companyFilter', 'plantFilter', 'supplierFilter', 'buyerFilter', 'purchOrgFilter', 'severityFilter', 'dateFromFilter', 'dateToFilter'];

if (!isRunningOnSapOrigin()) {
  setTimeout(() => {
    setBanner(
      'error',
      'Same-origin SAP hosting is still required',
      `You are running this dashboard on ${window.location.origin}. Your SAP OData session lives on ${SAP_ORIGIN}, so localhost cannot read the OData responses even when the XML opens in another SAP tab.`
    );
  }, 0);
}

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
  $('summaryConnection').textContent = failedServices ? 'Needs attention' : 'Live readiness';
  $('summaryConnectionNote').textContent = failedServices
    ? (isRunningOnSapOrigin() ? `${failedServices} service${failedServices === 1 ? '' : 's'} need help` : 'Localhost cannot read SAP SAML-cookie OData')
    : 'SAP OData is ready or loaded';
  $('summaryAttentionNote').textContent = `${visible.filter(e => ['Critical', 'High'].includes(e.severity)).length.toLocaleString()} high-priority exceptions`;
  $('summaryDeletedNote').textContent = `${visible.filter(e => e.category === 'Deleted').length.toLocaleString()} deleted or marked-for-deletion records`;
}

function render() {
  const visible = applyFilters(state.exceptions, filters());
  renderKpis($('kpiGrid'), visible, state.serviceStates);
  renderTrend($('trendChart'), visible);
  renderBars($('deletionBreakdown'), visible.filter(e => e.category === 'Deleted'), 'objectType', { color: '#7b1fa2' });
  renderBars($('categoryBreakdown'), visible, 'category', { color: '#0b72b9' });
  renderBars($('supplierRanking'), visible, 'supplier', { color: '#ea6f1a' });
  renderTable($('exceptionTableBody'), visible);
  renderHealth($('serviceHealth'), state.serviceStates);
  $('resultCount').textContent = `${visible.length.toLocaleString()} exceptions`;
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

async function connect() {
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
  $('diagnosticsOutput').textContent = JSON.stringify(state.diagnostics, null, 2);

  if (connected) {
    setBanner('connected', `${connected} of ${SERVICES.length} SAP services connected`, `${state.exceptions.length.toLocaleString()} actionable exceptions evaluated. Review diagnostics for field mappings and any unavailable service.`);
    $('refreshButton').disabled = false;
  } else {
    setBanner(
      'error',
      isRunningOnSapOrigin() ? 'SAP SSO connection was not established' : 'SAP data is blocked by origin separation',
      isRunningOnSapOrigin()
        ? 'Open SAP in a new tab, complete corporate SSO, then retry.'
        : `SAP SSO is working in your SAP tab, but this page is running on ${window.location.origin}. Because SAP uses Entra SAML cookies on ${SAP_ORIGIN}, the browser will not expose those OData responses to localhost JavaScript.`
    );
  }

  $('connectButton').disabled = false;
  $('connectButton').textContent = connected ? 'Reconnect' : 'Retry SSO connection';
}

filterIds.forEach(id => $(id).addEventListener('change', render));
$('clearFilters').addEventListener('click', () => {
  filterIds.forEach(id => $(id).value = '');
  render();
});
$('connectButton').addEventListener('click', connect);
$('refreshButton').addEventListener('click', connect);
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
$('showDiagnostics').addEventListener('click', () => $('diagnosticsDialog').showModal());
$('closeDiagnostics').addEventListener('click', () => $('diagnosticsDialog').close());
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

render();
syncCredentialStatus();
