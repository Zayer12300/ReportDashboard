import { activeAuth, SETTINGS, SAP_ORIGIN } from './config.js';

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

  async discover() {
    const started = performance.now();
    const probe = await this.probeAuth();
    if (!probe.ok) {
      throw new Error(probe.error || 'SSO probe failed');
    }

    const response = await this.request(`${this.baseUrl}/$metadata`, { accept: 'application/xml' });
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('SAP returned an interactive sign-in page instead of OData metadata. Run the dashboard from the approved SAP origin.');
    }

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

  async readEntity(entity, top = SETTINGS.pageSize) {
    const query = new URLSearchParams({ '$top': String(top), '$format': 'json' });
    const url = `${this.baseUrl}/${encodeURIComponent(entity.name)}?${query}`;
    const response = await this.request(url);
    const payload = await response.json();
    const rows = payload.value || payload.d?.results || [];
    return { rows, nextLink: payload['@odata.nextLink'] || payload.d?.__next || null, url };
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
