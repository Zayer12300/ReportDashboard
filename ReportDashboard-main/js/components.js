const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const groupCount = (rows, field) => rows.reduce((map, row) => map.set(row[field] || 'Unknown', (map.get(row[field] || 'Unknown') || 0) + 1), new Map());
const money = (value, currency = 'SAR') => new Intl.NumberFormat('en-SA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);

// SVG Icons Dictionary for KPI cards
const ICONS = {
  critical: `<svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4M12 16h.01"/></svg>`,
  deleted: `<svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  newToday: `<svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  missing: `<svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  overdue: `<svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  services: `<svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`
};

export function renderKpis(container, exceptions, services) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const failedServices = services.filter(s => s.status === 'error').length;
  
  const cards = [
    {
      label: 'Critical now',
      value: exceptions.filter(e => e.severity === 'Critical').length,
      sub: 'Immediate action required',
      color: 'var(--critical)',
      icon: ICONS.critical
    },
    {
      label: 'Deleted objects',
      value: exceptions.filter(e => e.category === 'Deleted').length,
      sub: money(exceptions.filter(e => e.category === 'Deleted').reduce((sum, e) => sum + e.value, 0)),
      color: 'var(--primary)',
      icon: ICONS.deleted
    },
    {
      label: 'New today',
      value: exceptions.filter(e => e.detectedAt >= today).length,
      sub: 'First seen today',
      color: 'var(--primary)',
      icon: ICONS.newToday
    },
    {
      label: 'Missing / quality',
      value: exceptions.filter(e => ['Missing', 'Data quality'].includes(e.category)).length,
      sub: 'Incomplete process data',
      color: 'var(--medium)',
      icon: ICONS.missing
    },
    {
      label: 'Overdue',
      value: exceptions.filter(e => e.category === 'Overdue').length,
      sub: 'Past committed date',
      color: 'var(--high)',
      icon: ICONS.overdue
    },
    {
      label: 'Service failures',
      value: failedServices,
      sub: failedServices ? 'Connectivity alert' : 'All services active',
      color: failedServices ? 'var(--critical)' : 'var(--healthy)',
      icon: ICONS.services
    }
  ];

  container.innerHTML = cards.map(c => `
    <article class="kpi-card" style="--accent:${c.color}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div class="kpi-label">${escapeHtml(c.label)}</div>
        <div style="color:${c.color}">${c.icon}</div>
      </div>
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-sub" title="${escapeHtml(c.sub)}">${escapeHtml(c.sub)}</div>
    </article>
  `).join('');
}

export function renderBars(container, rows, field, { limit = 6, color = 'var(--primary)' } = {}) {
  const groups = [...groupCount(rows, field)].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = groups[0]?.[1] || 1;
  container.classList.toggle('empty-state', !groups.length);
  container.innerHTML = groups.length
    ? groups.map(([label, value]) => `
        <div class="bar-row">
          <span title="${escapeHtml(label)}">${escapeHtml(label)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${value / max * 100}%;background:${color}"></div>
          </div>
          <span class="bar-value">${value}</span>
        </div>
      `).join('')
    : 'No matching exceptions.';
}

export function renderTrend(container, exceptions) {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 29 + i);
    return d;
  });
  
  const counts = days.map(day => {
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const rows = exceptions.filter(e => e.detectedAt >= day && e.detectedAt < next);
    return { 
      day, 
      counts: ['Low', 'Medium', 'High', 'Critical'].map(severity => rows.filter(e => e.severity === severity).length) 
    };
  });
  
  const max = Math.max(1, ...counts.map(x => x.counts.reduce((a, b) => a + b, 0)));
  container.classList.remove('empty-state');
  
  container.innerHTML = counts.map(({ day, counts: c }) => {
    const total = c.reduce((a, b) => a + b, 0);
    const labelText = `${day.toLocaleDateString()}: ${total} exception${total === 1 ? '' : 's'} (${c[3]} Crit, ${c[2]} High, ${c[1]} Med, ${c[0]} Low)`;
    return `
      <div class="trend-day" title="${labelText}" style="height:${Math.max(4, total / max * 100)}%">
        ${c.map((n, i) => {
          const heightPercent = n / (total || 1) * 100;
          const severityColors = ['var(--low)', 'var(--medium)', 'var(--high)', 'var(--critical)'];
          return `<span class="trend-segment" style="height:${heightPercent}%;background:${severityColors[i]}"></span>`;
        }).join('')}
      </div>
    `;
  }).join('');
}

export function renderTable(body, exceptions) {
  body.innerHTML = exceptions.length
    ? exceptions.slice(0, 250).map(e => `
        <tr data-id="${escapeHtml(e.id)}">
          <td><span class="severity severity-${e.severity.toLowerCase()}">${e.severity}</span></td>
          <td><strong>${escapeHtml(e.objectId)}</strong>${e.itemId ? ` / ${escapeHtml(e.itemId)}` : ''}<br><small>${escapeHtml(e.objectType)}</small></td>
          <td>${escapeHtml(e.title)}</td>
          <td>${escapeHtml(e.supplier)}</td>
          <td>${escapeHtml(e.plant || '—')}</td>
          <td>${e.ageDays}d</td>
          <td>${money(e.value, e.currency)}</td>
          <td>${escapeHtml(e.buyer)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="8" class="table-empty">No exceptions match the current filters.</td></tr>';
}

export function renderHealth(container, states) {
  container.innerHTML = states.map(s => {
    const statusClass = s.status === 'connected' ? 'ok' : s.status === 'error' ? 'error' : s.status === 'loading' ? 'loading' : '';
    return `
      <div class="service-row">
        <span class="health-dot ${statusClass}"></span>
        <div>
          <div class="service-name" title="${escapeHtml(s.label)}">${escapeHtml(s.label)}</div>
          <div class="service-detail" title="${escapeHtml(s.detail || 'Not tested')}">${escapeHtml(s.detail || 'Not tested')}</div>
        </div>
        <strong>${s.records ?? '—'}</strong>
      </div>
    `;
  }).join('');
}

export function renderDrawer(container, e) {
  const rawFormatted = JSON.stringify(e.record.raw || {}, null, 2);
  container.innerHTML = `
    <div>
      <p class="drawer-header-eyebrow">${escapeHtml(e.category)} Exception</p>
      <h2 class="detail-title">${escapeHtml(e.title)}</h2>
      <p style="margin-top: 8px;">
        <span class="severity severity-${e.severity.toLowerCase()}">${e.severity}</span>
      </p>
    </div>

    <div class="detail-grid">
      <div class="detail-field"><span>Document Type</span><strong>${escapeHtml(e.objectType)}</strong></div>
      <div class="detail-field"><span>Document / Item</span><strong>${escapeHtml(e.objectId)} ${e.itemId ? `/ ${escapeHtml(e.itemId)}` : ''}</strong></div>
      <div class="detail-field"><span>Exposure Value</span><strong>${money(e.value, e.currency)}</strong></div>
      <div class="detail-field"><span>Supplier</span><strong>${escapeHtml(e.supplier)}</strong></div>
      <div class="detail-field"><span>Plant / Org</span><strong>${escapeHtml(e.plant || '—')} / ${escapeHtml(e.purchasingOrg || '—')}</strong></div>
      <div class="detail-field"><span>Buyer (Owner)</span><strong>${escapeHtml(e.buyer)}</strong></div>
    </div>

    <section class="detail-section detail-section-warning">
      <h3>Root Cause Reason</h3>
      <p>${escapeHtml(e.reason)}</p>
    </section>

    <section class="detail-section">
      <h3>Recommended Action</h3>
      <p>${escapeHtml(e.action)}</p>
    </section>

    <section class="detail-section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <h3>Technical SAP Metadata</h3>
        <span class="badge" style="font-size: 9px; cursor: pointer;" onclick="navigator.clipboard.writeText(document.getElementById('drawerRawCode').innerText); alert('Copied raw metadata to clipboard!')">Copy</span>
      </div>
      <pre id="drawerRawCode" class="code-viewer" style="max-height: 180px; font-size: 10px;">${escapeHtml(rawFormatted)}</pre>
    </section>
  `;
}

export function populateSelect(select, records, field, labelField = field) {
  const current = select.value;
  const values = new Map(records.filter(r => r[field]).map(r => [String(r[field]), String(r[labelField] || r[field])]));
  const first = select.options[0].outerHTML;
  select.innerHTML = first + [...values].sort((a, b) => a[1].localeCompare(b[1])).map(([v, l]) => `<option value="${escapeHtml(v)}">${escapeHtml(l)}</option>`).join('');
  select.value = current;
}

// Simulated Biometric Passkey/Badge Scan Animation
export function startPasskeyScan(onSuccess) {
  const dialog = document.getElementById('passkeyAuthDialog');
  const status = document.getElementById('passkeyStatusText');
  const btn = document.getElementById('btnStartPasskeyScan');
  
  btn.disabled = true;
  dialog.classList.remove('success');
  dialog.classList.add('scanning');
  
  const steps = [
    { text: 'Establishing secure communication with reader...', delay: 0 },
    { text: 'Scanning Biometric Passkey / Corporate Badge...', delay: 500 },
    { text: 'Matching credentials against Entra ID directory...', delay: 1100 },
    { text: 'Identity Verified! Access Granted.', delay: 1700 }
  ];
  
  steps.forEach(step => {
    setTimeout(() => {
      status.textContent = step.text;
      if (step.text.startsWith('Identity Verified!')) {
        dialog.classList.remove('scanning');
        dialog.classList.add('success');
        setTimeout(() => {
          btn.disabled = false;
          status.textContent = 'Ready to scan...';
          dialog.classList.remove('success');
          onSuccess();
        }, 600);
      }
    }, step.delay);
  });
}

// Render Supply Chain Management (SCM) impact reports for System Analysts
export function renderScmReports(scmReports) {
  const opBody = document.getElementById('operationalRiskTableBody');
  const supBody = document.getElementById('supplierRiskTableBody');
  const dataBody = document.getElementById('dataIntegrityTableBody');
  const buyerBody = document.getElementById('buyerWorkloadTableBody');

  // 1. Operational Value at Risk by Plant
  opBody.innerHTML = scmReports.plantRiskReport.length
    ? scmReports.plantRiskReport.map(r => `
        <tr>
          <td><strong>${escapeHtml(r.plant)}</strong></td>
          <td>${r.count} cases</td>
          <td><span class="badge" style="background:var(--critical-bg); color:var(--critical); border:1px solid var(--critical-border);">${r.criticalCount} high risk</span></td>
          <td><strong style="color:var(--primary); font-size:13px;">${money(r.value)}</strong></td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" class="table-empty">No plant risk data compiled. Connect to SAP OData or load Demo Mode.</td></tr>';

  // 2. Supplier Overdue Delivery Bottlenecks
  supBody.innerHTML = scmReports.supplierRiskReport.length
    ? scmReports.supplierRiskReport.map(r => `
        <tr>
          <td><strong>${escapeHtml(r.supplierName)}</strong></td>
          <td>${r.count} overdue shipments</td>
          <td><strong style="color:var(--high);">${money(r.value)}</strong></td>
          <td><span class="severity severity-high" style="font-size: 10px;">${r.maxAge}d max delay</span></td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" class="table-empty">No supplier overdue bottlenecks found. Connect to SAP OData or load Demo Mode.</td></tr>';

  // 3. Master Data & Interface Integrity Audit
  dataBody.innerHTML = scmReports.dataQualityReport.length
    ? scmReports.dataQualityReport.map(r => `
        <tr>
          <td><strong>${escapeHtml(r.objectId)}</strong>${r.itemId ? ` / ${escapeHtml(r.itemId)}` : ''}</td>
          <td><small>${escapeHtml(r.objectType)}</small></td>
          <td><span class="severity severity-medium" style="text-transform:none; font-size:10px;">Missing ${escapeHtml(r.missingFields)}</span></td>
          <td><code style="color:#38bdf8; font-size:11px;">${escapeHtml(r.service)}</code></td>
          <td>${escapeHtml(r.buyer)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="5" class="table-empty">Interface compliance: 100% of required fields mapped.</td></tr>';

  // 4. Buyer capacity and backlog workloads
  buyerBody.innerHTML = scmReports.buyerReport.length
    ? scmReports.buyerReport.map(r => `
        <tr>
          <td><strong>${escapeHtml(r.buyer)}</strong></td>
          <td><span class="badge" style="background:rgba(255,255,255,0.06); color:#fff; font-weight:700;">${r.total} exceptions</span></td>
          <td><span style="color:var(--critical); font-weight:700;">${r.critical}</span></td>
          <td><span style="color:var(--high); font-weight:700;">${r.high}</span></td>
          <td><span style="color:var(--medium); font-weight:700;">${r.medium}</span></td>
          <td><span style="color:var(--low); font-weight:700;">${r.low}</span></td>
        </tr>
      `).join('')
    : '<tr><td colspan="6" class="table-empty">No buyer capacity data found. Connect to SAP OData or load Demo Mode.</td></tr>';
}

// Render dynamic diagnostics dialog with schema detail tab and real-time HTTP audit log
export function renderDiagnostics(diagnostics, httpLog) {
  const container = document.getElementById('diagnosticsDialog');
  
  const headerHtml = `
    <header class="dialog-header">
      <div>
        <h3>Connectivity Diagnostics & HTTP Audit Logs</h3>
        <p class="muted">Live OData schema mapping analysis and real-time transaction history.</p>
      </div>
      <button id="closeDiagnostics" class="dialog-close-btn" aria-label="Close Dialog">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </header>
  `;
  
  const tabsHtml = `
    <div style="display:flex; gap:10px; padding: 16px 20px 0;">
      <button id="diagTabSchema" class="btn btn-secondary active" style="padding: 6px 12px; border-radius: var(--radius-md);">OData Schema Maps</button>
      <button id="diagTabTraffic" class="btn btn-secondary" style="padding: 6px 12px; border-radius: var(--radius-md);">HTTP Audit Log (${httpLog.length})</button>
    </div>
  `;
  
  const schemaBody = `
    <div id="diagContentSchema" class="dialog-body">
      <pre class="code-viewer">${escapeHtml(JSON.stringify(diagnostics, null, 2))}</pre>
    </div>
  `;
  
  const trafficBody = `
    <div id="diagContentTraffic" class="dialog-body" style="display:none;">
      <div class="table-wrap" style="max-height: 48vh; overflow-y: auto;">
        <table class="modern-table" style="font-size:11px;">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Request Details</th>
              <th>Status Code</th>
              <th>Latency</th>
              <th>Retry Attempt</th>
            </tr>
          </thead>
          <tbody>
            ${httpLog.length ? httpLog.slice().reverse().map(log => {
              const timeStr = new Date(log.timestamp).toLocaleTimeString();
              const statusClass = log.success ? 'severity-low' : 'severity-critical';
              
              // Simplify long SAP URLs for clear presentation
              const cleanUrl = log.url.replace('https://vhaftw11wd01.sap.corp.asmo.com:44380', '');
              
              return `
                <tr>
                  <td>${timeStr}</td>
                  <td>
                    <span style="font-weight:700; color:var(--primary);">${log.method}</span> 
                    <code style="opacity:0.85; font-size:10px;" title="${escapeHtml(log.url)}">${escapeHtml(cleanUrl)}</code>
                  </td>
                  <td><span class="severity ${statusClass}">${log.status} - ${escapeHtml(log.statusText)}</span></td>
                  <td><strong>${log.latencyMs} ms</strong></td>
                  <td>
                    ${log.attempt > 1 
                      ? `<span class="badge" style="background:var(--high-bg); color:var(--high); font-weight:700;">Retry #${log.attempt}</span>` 
                      : 'Initial call'
                    }
                  </td>
                </tr>
              `;
            }).join('') : '<tr><td colspan="5" class="table-empty">No OData requests logged yet. Connect or logon.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  container.innerHTML = headerHtml + tabsHtml + schemaBody + trafficBody;
  
  // Re-bind close dialog action
  document.getElementById('closeDiagnostics').addEventListener('click', () => container.close());
  
  const tSchema = document.getElementById('diagTabSchema');
  const tTraffic = document.getElementById('diagTabTraffic');
  const cSchema = document.getElementById('diagContentSchema');
  const cTraffic = document.getElementById('diagContentTraffic');
  
  tSchema.addEventListener('click', () => {
    tSchema.classList.add('active');
    tTraffic.classList.remove('active');
    cSchema.style.display = 'block';
    cTraffic.style.display = 'none';
  });
  
  tTraffic.addEventListener('click', () => {
    tTraffic.classList.add('active');
    tSchema.classList.remove('active');
    cSchema.style.display = 'none';
    cTraffic.style.display = 'block';
  });
}
