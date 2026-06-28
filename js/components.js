const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const groupCount = (rows, field) => rows.reduce((map, row) => map.set(row[field] || 'Unknown', (map.get(row[field] || 'Unknown') || 0) + 1), new Map());
const money = (value, currency = 'SAR') => new Intl.NumberFormat('en-SA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);

export function renderKpis(container, exceptions, services) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const failedServices = services.filter(s => s.status === 'error').length;
  const cards = [
    ['Critical now', exceptions.filter(e => e.severity === 'Critical').length, 'Immediate action required', '#c62828'],
    ['Deleted objects', exceptions.filter(e => e.category === 'Deleted').length, money(exceptions.filter(e => e.category === 'Deleted').reduce((sum, e) => sum + e.value, 0)), '#7b1fa2'],
    ['New today', exceptions.filter(e => e.detectedAt >= today).length, 'First seen today', '#0b72b9'],
    ['Missing / quality', exceptions.filter(e => ['Missing', 'Data quality'].includes(e.category)).length, 'Incomplete process or data', '#d7a300'],
    ['Overdue', exceptions.filter(e => e.category === 'Overdue').length, 'Past committed date', '#ea6f1a'],
    ['Service failures', failedServices, failedServices ? 'Connection needs attention' : 'OData services healthy', failedServices ? '#c62828' : '#2e7d32']
  ];

  container.innerHTML = cards.map(([label, value, sub, color]) => `
    <article class="kpi-card" style="--accent:${color}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-sub">${sub}</div>
    </article>
  `).join('');
}

export function renderBars(container, rows, field, { limit = 6, color = '#0b72b9' } = {}) {
  const groups = [...groupCount(rows, field)].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const max = groups[0]?.[1] || 1;
  container.classList.toggle('empty-state', !groups.length);
  container.innerHTML = groups.length
    ? groups.map(([label, value]) => `
        <div class="bar-row">
          <span title="${escapeHtml(label)}">${escapeHtml(label)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${value / max * 100}%;background:${color}"></div></div>
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
    return { day, counts: ['Low', 'Medium', 'High', 'Critical'].map(severity => rows.filter(e => e.severity === severity).length) };
  });
  const max = Math.max(1, ...counts.map(x => x.counts.reduce((a, b) => a + b, 0)));
  container.classList.remove('empty-state');
  container.innerHTML = counts.map(({ day, counts: c }) => `
    <div class="trend-day" title="${day.toLocaleDateString()}: ${c.reduce((a, b) => a + b, 0)}" style="height:${Math.max(3, c.reduce((a, b) => a + b, 0) / max * 100)}%">
      ${c.map((n, i) => `<span class="trend-segment" style="height:${n / (c.reduce((a, b) => a + b, 0) || 1) * 100}%;background:${['#5b7590', '#d7a300', '#ea6f1a', '#c62828'][i]}"></span>`).join('')}
    </div>
  `).join('');
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
  container.innerHTML = states.map(s => `
    <div class="service-row">
      <span class="health-dot ${s.status === 'connected' ? 'ok' : s.status === 'error' ? 'error' : ''}"></span>
      <div>
        <div class="service-name">${escapeHtml(s.label)}</div>
        <div class="service-detail">${escapeHtml(s.detail || 'Not tested')}</div>
      </div>
      <strong>${s.records ?? '—'}</strong>
    </div>
  `).join('');
}

export function renderDrawer(container, e) {
  container.innerHTML = `
    <p class="eyebrow">${escapeHtml(e.category)} exception</p>
    <h2 class="detail-title">${escapeHtml(e.title)}</h2>
    <p><span class="severity severity-${e.severity.toLowerCase()}">${e.severity}</span></p>
    <div class="detail-grid">
      <div class="detail-field"><span>Document</span>${escapeHtml(e.objectId)} ${escapeHtml(e.itemId)}</div>
      <div class="detail-field"><span>Affected value</span>${money(e.value, e.currency)}</div>
      <div class="detail-field"><span>Supplier</span>${escapeHtml(e.supplier)}</div>
      <div class="detail-field"><span>Plant</span>${escapeHtml(e.plant || '—')}</div>
      <div class="detail-field"><span>Company</span>${escapeHtml(e.company || '—')}</div>
      <div class="detail-field"><span>Owner</span>${escapeHtml(e.buyer)}</div>
    </div>
    <section class="detail-section">
      <h3>Why it was raised</h3>
      <p>${escapeHtml(e.reason)}</p>
    </section>
    <section class="detail-section">
      <h3>Recommended action</h3>
      <p>${escapeHtml(e.action)}</p>
    </section>
    <section class="detail-section">
      <h3>Source</h3>
      <p>${escapeHtml(e.record.sourceService)} · ${escapeHtml(e.record.sourceEntity)}</p>
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
