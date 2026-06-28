import { activeAuth, SETTINGS, SAP_ORIGIN } from './config.js';

// Global Audit Log for Network Traffic
export const HTTP_LOG = [];

function logRequest(log) {
  HTTP_LOG.push({
    timestamp: new Date(),
    ...log
  });
}

const normalizeUrl = value => value.replace(/\/$/, '');

export function isRunningOnSapOrigin() {
  return window.location.origin === SAP_ORIGIN;
}

function buildHeaders(extraHeaders = {}) {
  return {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...extraHeaders
  };
}

export class ODataClient {
  constructor(service) {
    this.service = service;
    this.baseUrl = normalizeUrl(service.baseUrl);
    this.metadata = null;
    this.version = '2';
  }

  async request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || SETTINGS.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        credentials: 'include',
        mode: 'cors',
        headers: buildHeaders(options.headers || {}),
        body: options.body || undefined,
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const suffix = text && text.length < 160 ? ` - ${text.trim()}` : '';
        throw new Error(`HTTP ${response.status} ${response.statusText}${suffix}`);
      }

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${Math.round((options.timeout || SETTINGS.requestTimeoutMs) / 1000)}s`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // Network request wrapper supporting retries with exponential backoff and logging
  async requestWithRetry(url, options = {}, retries = 3, delay = 1000) {
    let lastError;
    for (let i = 0; i < retries; i++) {
      const start = performance.now();
      try {
        const response = await this.request(url, options);
        const latency = Math.round(performance.now() - start);
        
        logRequest({
          serviceId: this.service.id,
          url,
          method: options.method || 'GET',
          status: response.status,
          statusText: response.statusText,
          latencyMs: latency,
          attempt: i + 1,
          success: true
        });
        
        return response;
      } catch (error) {
        lastError = error;
        const latency = Math.round(performance.now() - start);
        
        logRequest({
          serviceId: this.service.id,
          url,
          method: options.method || 'GET',
          status: error.message.includes('HTTP') ? error.message.split(' ')[1] : 'Network Error',
          statusText: error.message,
          latencyMs: latency,
          attempt: i + 1,
          success: false
        });
        
        if (i < retries - 1) {
          // Wait with exponential backoff: 1s -> 2s -> 4s
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }
    throw lastError;
  }

  async probeAuth() {
    const probeUrl = `${this.baseUrl}/$metadata`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SETTINGS.ssoProbeTimeout);

    try {
      const response = await fetch(probeUrl, {
        method: 'GET',
        credentials: 'include',
        mode: 'cors',
        headers: buildHeaders({ Accept: 'application/xml' }),
        signal: controller.signal
      });
      const contentType = response.headers.get('content-type') || '';
      const html = contentType.includes('text/html');
      const xml = contentType.includes('xml');

      if (response.status === 200 && xml && !html) {
        activeAuth.probeOk = true;
        return { ok: true, status: response.status };
      }

      if (html) {
        activeAuth.probeOk = false;
        return {
          ok: false,
          status: response.status,
          error: isRunningOnSapOrigin()
            ? 'SAP returned a sign-in page instead of OData metadata.'
            : `SAP returned a sign-in page instead of OData metadata. The dashboard is running on ${window.location.origin}, but SAP session cookies stay on ${SAP_ORIGIN}.`
        };
      }

      if (response.status === 401) {
        activeAuth.probeOk = false;
        return { ok: false, status: 401, error: 'SAP rejected the session. Open SAP in the browser, complete SSO, then retry.' };
      }

      if (xml) {
        activeAuth.probeOk = true;
        const body = await response.text().catch(() => '');
        return { ok: true, status: response.status, body };
      }

      activeAuth.probeOk = false;
      return {
        ok: false,
        status: response.status,
        error: 'The SAP endpoint answered, but not with OData metadata.'
      };
    } catch (error) {
      activeAuth.probeOk = false;
      return { ok: false, error: error.message };
    } finally {
      clearTimeout(timer);
    }
  }

  // Schema discovery with session storage caching to optimize latency
  async discover() {
    const cacheKey = `sap_metadata_cache_${this.service.id}`;
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
      try {
        const cached = JSON.parse(cachedData);
        this.version = cached.version;
        this.metadata = cached.metadata;
        
        // Log cached metadata resolution
        logRequest({
          serviceId: this.service.id,
          url: `${this.baseUrl}/$metadata`,
          method: 'GET_CACHE',
          status: 200,
          statusText: 'Resolved from sessionStorage cache',
          latencyMs: 0,
          attempt: 1,
          success: true
        });
        
        return this.metadata;
      } catch (e) {
        sessionStorage.removeItem(cacheKey);
      }
    }

    const started = performance.now();
    const probe = await this.probeAuth();
    if (!probe.ok) {
      throw new Error(probe.error || 'SSO probe failed');
    }

    // Call request with retry wrapper
    const response = await this.requestWithRetry(`${this.baseUrl}/$metadata`, { headers: { Accept: 'application/xml' } });
    const xmlText = await response.text();
    const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (xml.querySelector('parsererror')) {
      throw new Error('SAP returned invalid OData metadata XML');
    }

    this.version = xml.documentElement.getAttribute('Version')?.startsWith('4') ? '4' : '2';

    const byLocalName = name => [...xml.getElementsByTagNameNS('*', name)];
    const types = new Map();
    byLocalName('EntityType').forEach(type => {
      const properties = [...type.children]
        .filter(child => child.localName === 'Property')
        .map(property => property.getAttribute('Name'));
      types.set(type.getAttribute('Name'), properties);
    });

    const entitySets = byLocalName('EntitySet').map(set => {
      const typeName = (set.getAttribute('EntityType') || '').split('.').pop();
      return { name: set.getAttribute('Name'), type: typeName, properties: types.get(typeName) || [] };
    });

    this.metadata = { entitySets, latencyMs: Math.round(performance.now() - started), version: this.version };
    
    // Save to session cache
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ version: this.version, metadata: this.metadata }));
    } catch (e) {
      console.warn('Failed to cache metadata to sessionStorage:', e);
    }
    
    return this.metadata;
  }

  scoreEntity(entity) {
    const name = `${entity.name} ${entity.type}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hintScore = this.service.entityHints.reduce((score, hint) => score + (name.includes(hint.replace(/[^a-z0-9]/g, '')) ? 10 : 0), 0);
    const propertyText = entity.properties.join(' ').toLowerCase();
    const useful = ['purchaseorder', 'supplier', 'companycode', 'plant', 'creationdate', 'deliverydate'];
    return hintScore + useful.filter(p => propertyText.includes(p)).length;
  }

  chooseEntities(limit = 2) {
    if (!this.metadata) return [];
    return this.metadata.entitySets
      .map(entity => ({ ...entity, score: this.scoreEntity(entity) }))
      .filter(entity => entity.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // OData entities data fetching with full pagination support
  async readEntity(entity, top = SETTINGS.pageSize) {
    const rows = [];
    let nextLink = null;
    let pagesFetched = 0;
    const maxPages = SETTINGS.maxPagesPerEntity || 4;
    const queryUrl = `${this.baseUrl}/${encodeURIComponent(entity.name)}?$top=${top}&$format=json`;

    do {
      let requestUrl = nextLink || queryUrl;
      
      // Safety resolve of relative OData nextLinks
      if (nextLink && !nextLink.startsWith('http')) {
        const serviceBase = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
        requestUrl = new URL(nextLink, serviceBase).href;
      }
      
      const response = await this.requestWithRetry(requestUrl);
      const payload = await response.json();
      const pageRows = payload.value || payload.d?.results || [];
      rows.push(...pageRows);
      
      nextLink = payload['@odata.nextLink'] || payload.d?.__next || null;
      pagesFetched++;
      
      if (pagesFetched >= maxPages) {
        console.warn(`Paging threshold hit (${maxPages} pages) for entity set ${entity.name}.`);
        break;
      }
    } while (nextLink);

    return { rows, pagesFetched, url: queryUrl };
  }
}

export function explainConnectionError(error) {
  const raw = error?.message || String(error);
  if (/session cookies stay on/i.test(raw)) return raw;
  if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) {
    return `The browser blocked the cross-origin SAML/OData request. This page is running on ${window.location.origin}, but SAP OData is on ${SAP_ORIGIN}. Run the dashboard on the SAP/Web Dispatcher origin.`;
  }
  if (/sign-in page/i.test(raw) || /SAML/i.test(raw)) return raw;
  if (/401|403/.test(raw)) return 'SAP rejected the session. Open SAP in the browser, complete SSO, then retry.';
  return raw;
}

export function clearCredentials() {
  activeAuth.mode = 'windows_sso';
  activeAuth.probeOk = false;
}
