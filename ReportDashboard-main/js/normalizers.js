const ALIASES = {
  objectId: ['PurchaseOrder', 'PurchaseOrderID', 'PurchasingDocument', 'EBELN', 'InboundDelivery', 'DeliveryDocument', 'VBELN'],
  itemId: ['PurchaseOrderItem', 'PurchaseOrderItemID', 'PurchasingDocumentItem', 'EBELP', 'InboundDeliveryItem', 'DeliveryDocumentItem', 'POSNR'],
  documentType: ['DocumentType', 'PurchaseOrderType', 'PurchasingDocumentType', 'DeliveryDocumentType'],
  company: ['CompanyCode', 'Company', 'BUKRS'], plant: ['Plant', 'WERKS'], storageLocation: ['StorageLocation', 'LGORT'],
  supplierId: ['Supplier', 'SupplierID', 'Vendor', 'LIFNR'], supplierName: ['SupplierName', 'VendorName', 'OrganizationName'],
  buyer: ['Buyer', 'PurchasingGroupName', 'CreatedByUser', 'CreatedBy', 'ERNAM'],
  purchasingOrg: ['PurchasingOrganization', 'PurchasingOrganisation', 'EKORG'], purchasingGroup: ['PurchasingGroup', 'EKGRP'],
  status: ['PurchasingProcessingStatus', 'ProcessingStatus', 'DocumentStatus', 'OverallStatus', 'Status'],
  approvalStatus: ['PurgReleaseSequenceStatus', 'ReleaseStatus', 'ApprovalStatus', 'WorkflowStatus'],
  outputStatus: ['OutputStatus', 'TransmissionStatus', 'MessageStatus'],
  deleted: ['IsDeleted', 'DeletionIndicator', 'DeletionFlag', 'PurchasingDocumentDeletionCode', 'PurchaseOrderDeletionCode', 'IsMarkedForDeletion', 'LOEKZ'],
  createdAt: ['CreationDate', 'CreatedAt', 'CreatedOn', 'DocumentDate', 'PurchaseOrderDate', 'ERDAT'],
  changedAt: ['LastChangeDateTime', 'ChangedAt', 'LastChangeDate', 'AEDAT'],
  deliveryDate: ['DeliveryDate', 'ScheduleLineDeliveryDate', 'PlannedGoodsReceiptDate', 'ExpectedDeliveryDate', 'LFDAT'],
  sentAt: ['SentAt', 'OutputDateTime', 'TransmissionDateTime'],
  confirmationDate: ['ConfirmationDate', 'SupplierConfirmationDate'],
  currency: ['DocumentCurrency', 'Currency', 'TransactionCurrency', 'WAERS'],
  value: ['NetAmount', 'NetPriceAmount', 'PurchaseOrderNetAmount', 'TotalNetAmount', 'NETWR'],
  orderedQty: ['OrderQuantity', 'OrderedQuantity', 'PurchaseOrderQuantity', 'MENGE'],
  receivedQty: ['GoodsReceiptQuantity', 'ReceivedQuantity', 'DeliveredQuantity'],
  referencePo: ['ReferencePurchaseOrder', 'PurchaseOrderReference', 'PrecedingDocument', 'PurchaseOrder'],
  deletionReason: ['DeletionReason', 'CancellationReason', 'ReasonCode'],
  deletedBy: ['DeletedBy', 'LastChangedByUser', 'ChangedByUser', 'AENAM']
};

function pick(row, aliases) {
  const exact = aliases.find(name => row[name] !== undefined && row[name] !== null);
  if (exact) return row[exact];
  const keys = Object.keys(row); const lower = new Map(keys.map(k => [k.toLowerCase(), k]));
  const match = aliases.map(a => lower.get(a.toLowerCase())).find(Boolean);
  return match ? row[match] : null;
}

function parseDate(value) {
  if (!value) return null;
  const sap = typeof value === 'string' && value.match(/\/Date\((\d+)/);
  const date = sap ? new Date(Number(sap[1])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toBoolean(value) {
  if (value === true) return true;
  if (value === false || value == null || value === '') return false;
  return ['x', '1', 'true', 'deleted', 'd', 'l'].includes(String(value).trim().toLowerCase());
}

export function normalizeRow(row, context) {
  const n = {};
  Object.entries(ALIASES).forEach(([key, aliases]) => { n[key] = pick(row, aliases); });
  const inboundId = pick(row, ['InboundDelivery', 'InboundDeliveryID', 'DeliveryDocument', 'VBELN']);
  const purchaseOrderId = pick(row, ['PurchaseOrder', 'PurchaseOrderID', 'PurchasingDocument', 'EBELN']);
  const inferredType = context.kind === 'inboundDelivery' ? 'ASN / Inbound Delivery' : 'Purchase Order';
  return {
    ...n,
    objectType: inferredType,
    objectId: String((context.kind === 'inboundDelivery' ? inboundId : purchaseOrderId) || n.objectId || 'Unknown'), itemId: n.itemId ? String(n.itemId) : '',
    deleted: toBoolean(n.deleted), createdAt: parseDate(n.createdAt), changedAt: parseDate(n.changedAt),
    deliveryDate: parseDate(n.deliveryDate), sentAt: parseDate(n.sentAt), confirmationDate: parseDate(n.confirmationDate),
    value: Number(n.value) || 0, orderedQty: Number(n.orderedQty) || 0, receivedQty: Number(n.receivedQty) || 0,
    sourceService: context.serviceId, sourceEntity: context.entityName, raw: row
  };
}

export function discoveredMappings(properties) {
  return Object.fromEntries(Object.entries(ALIASES).map(([semantic, aliases]) => [semantic, aliases.find(a => properties.some(p => p.toLowerCase() === a.toLowerCase())) || null]));
}
