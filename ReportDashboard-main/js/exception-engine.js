import { SETTINGS } from './config.js';

const DAY = 86400000;
const severityRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const daysBetween = (now, date) => date ? Math.max(0, Math.floor((now - date) / DAY)) : 0;
const includes = (value, terms) => terms.some(t => String(value || '').toLowerCase().includes(t));

export function buildExceptions(records, now = new Date()) {
  const exceptions = [];
  const add = (record, rule) => exceptions.push({
    id: `${record.sourceService}-${record.sourceEntity}-${record.objectId}-${record.itemId}-${rule.code}`,
    detectedAt: record.changedAt || record.createdAt || now, ageDays: daysBetween(now, record.changedAt || record.createdAt),
    company: record.company || '', plant: record.plant || '', supplierId: record.supplierId || '', supplier: record.supplierName || record.supplierId || '—',
    buyer: record.buyer || record.purchasingGroup || 'Unassigned', purchasingOrg: record.purchasingOrg || '',
    currency: record.currency || SETTINGS.currency, value: record.value, objectId: record.objectId, itemId: record.itemId,
    objectType: record.objectType, record, ...rule
  });

  records.forEach(record => {
    const approved = includes(record.approvalStatus, ['approved', 'released', 'complete']) || includes(record.status, ['approved', 'released', 'ordered']);
    const highExposure = record.value >= SETTINGS.criticalValue;
    if (record.deleted) add(record, {
      code: 'DELETED', category: 'Deleted',
      severity: approved || highExposure ? 'Critical' : record.value >= SETTINGS.highValue ? 'High' : 'Medium',
      title: `${record.objectType} deleted${record.itemId ? ' at item level' : ''}`,
      reason: approved ? 'Deletion occurred after approval or release.' : 'Object is marked for deletion.',
      action: 'Validate deletion reason and check for confirmations, deliveries, goods receipts and invoices before closure.'
    });

    if (record.deliveryDate && record.deliveryDate < now && record.orderedQty > record.receivedQty && !record.deleted) {
      const delay = daysBetween(now, record.deliveryDate);
      add(record, { code:'OVERDUE_DELIVERY', category:'Overdue', severity: delay > 14 || highExposure ? 'Critical' : delay > 5 ? 'High' : 'Medium', title:`Delivery overdue by ${delay} day${delay === 1 ? '' : 's'}`, reason:`Open quantity: ${Math.max(0, record.orderedQty - record.receivedQty).toLocaleString()}.`, action:'Confirm supplier commitment and validate whether the delivery date or GR status requires correction.' });
    }

    if (approved && !record.sentAt && includes(record.status, ['approved', 'released'])) {
      const age = daysBetween(now, record.changedAt || record.createdAt);
      if (age >= 1) add(record, { code:'NOT_SENT', category:'Missing', severity: age > 2 ? 'High' : 'Medium', title:'Approved PO has no transmission timestamp', reason:'Supplier output may not have been generated or the field is unavailable in this entity.', action:'Check output/message status in SAP before contacting the supplier.' });
    }

    if (includes(record.status, ['error', 'failed']) || includes(record.outputStatus, ['error', 'failed'])) {
      add(record, { code:'PROCESS_ERROR', category:'Failing', severity:'Critical', title:'Document or output processing failed', reason:`SAP status: ${record.outputStatus || record.status}.`, action:'Review SAP application log, output error and integration correlation details.' });
    }

    const missing = [];
    if (!record.company) missing.push('company code'); if (!record.purchasingOrg && record.sourceService !== 'inboundDelivery') missing.push('purchasing organization');
    if (!record.supplierId && record.sourceService !== 'inboundDelivery') missing.push('supplier'); if (!record.plant) missing.push('plant');
    if (missing.length) add(record, { code:'MISSING_MASTER_DATA', category:'Data quality', severity:missing.includes('supplier') ? 'High' : 'Low', title:`Missing ${missing.join(', ')}`, reason:'Mandatory procurement dimensions were blank or were not exposed by the selected OData entity.', action:'Confirm the source document and metadata mapping before correcting master data.' });
  });

  const unique = [...new Map(exceptions.map(e => [e.id, e])).values()];
  return unique.sort((a,b) => severityRank[b.severity] - severityRank[a.severity] || b.value - a.value || b.ageDays - a.ageDays);
}

export function applyFilters(exceptions, filters) {
  return exceptions.filter(e => (!filters.company || e.company === filters.company)
    && (!filters.plant || e.plant === filters.plant) && (!filters.supplier || e.supplierId === filters.supplier)
    && (!filters.buyer || e.buyer === filters.buyer) && (!filters.purchasingOrg || e.purchasingOrg === filters.purchasingOrg)
    && (!filters.severity || e.severity === filters.severity)
    && (!filters.dateFrom || e.detectedAt >= new Date(`${filters.dateFrom}T00:00:00`))
    && (!filters.dateTo || e.detectedAt <= new Date(`${filters.dateTo}T23:59:59`)));
}
