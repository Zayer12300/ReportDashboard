export const AUTH_MODE = {
  WINDOWS_SSO: 'windows_sso'
};

export let activeAuth = {
  mode: AUTH_MODE.WINDOWS_SSO,
  probeOk: false
};

export const SERVICES = [
  {
    id: 'purchaseOrderFacts',
    label: 'Purchase Order Facts',
    baseUrl: 'https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/opu/odata/sap/C_PURCHASEORDER_FS_SRV',
    entityHints: ['purchaseorder', 'purchaseorderitem', 'c_purchaseorder'],
    kind: 'purchaseOrder'
  },
  {
    id: 'purchaseOrderMaintenance',
    label: 'PO Maintenance',
    baseUrl: 'https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/opu/odata/sap/MM_PUR_PO_MAINT_V2_SRV',
    entityHints: ['purchaseorder', 'purchaseorderitem', 'poheader', 'poitem'],
    kind: 'purchaseOrder'
  },
  {
    id: 'inboundDelivery',
    label: 'Inbound Delivery / ASN',
    baseUrl: 'https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/opu/odata/sap/LE_SHP_INBOUND_DELIVERY_OBJPG_SRV',
    entityHints: ['inbounddelivery', 'inbdelivery', 'deliveryheader', 'deliveryitem'],
    kind: 'inboundDelivery'
  }
];

export const SETTINGS = {
  pageSize: 500,
  maxPagesPerEntity: 4,
  requestTimeoutMs: 30000,
  ssoProbeTimeout: 8000,
  approvalAgeDays: 5,
  poSendDelayHours: 4,
  confirmationDelayDays: 3,
  criticalValue: 1000000,
  highValue: 250000,
  currency: 'SAR'
};

export const SAP_ENTRY_URL = `${SERVICES[0].baseUrl}/`;
export const SAP_ORIGIN = new URL(SAP_ENTRY_URL).origin;
