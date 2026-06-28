// Mock SAP OData records for Demo Mode
export const MOCK_RECORDS = {
  purchaseOrderFacts: [
    {
      EBELN: '4500018901',
      EBELP: '10',
      BSART: 'NB',
      BUKRS: '1000',
      WERKS: '1100',
      LIFNR: '1000201',
      VendorName: 'Al-Bilad Industrial Supplies',
      ERNAM: 'S. Al-Otaibi',
      EKORG: '1000',
      OverallStatus: 'approved',
      ReleaseStatus: 'approved',
      LOEKZ: 'X', // Deleted
      ERDAT: '/Date(1782000000000)/',
      AEDAT: '/Date(1782200000000)/',
      LFDAT: '/Date(1782400000000)/',
      WAERS: 'SAR',
      NETWR: '1500000', // Value >= criticalValue (Critical exception)
      MENGE: '100',
      DeliveredQuantity: '0'
    },
    {
      EBELN: '4500018902',
      EBELP: '20',
      BSART: 'NB',
      BUKRS: '1000',
      WERKS: '1100',
      LIFNR: '1000202',
      VendorName: 'Saudi Metal Castings Ltd',
      ERNAM: 'M. Al-Zahrani',
      EKORG: '1000',
      OverallStatus: 'approved',
      ReleaseStatus: 'approved',
      LOEKZ: 'X', // Deleted
      ERDAT: '/Date(1782000000000)/',
      AEDAT: '/Date(1782200000000)/',
      WAERS: 'SAR',
      NETWR: '450000', // High value (High exception)
      MENGE: '50',
      DeliveredQuantity: '0'
    },
    {
      EBELN: '4500018903',
      EBELP: '10',
      BSART: 'NB',
      BUKRS: '1000',
      WERKS: '1200',
      LIFNR: '1000203',
      VendorName: 'Gulf Pipe & Valve Corp',
      ERNAM: 'A. Al-Dosari',
      EKORG: '1000',
      OverallStatus: 'approved',
      ReleaseStatus: 'approved',
      LOEKZ: '',
      ERDAT: '/Date(1781000000000)/',
      AEDAT: '/Date(1781200000000)/',
      LFDAT: '/Date(1781500000000)/', // Overdue delivery
      WAERS: 'SAR',
      NETWR: '1200000', // Critical value, delay > 14 days (Critical exception)
      MENGE: '200',
      DeliveredQuantity: '50'
    },
    {
      EBELN: '4500018904',
      EBELP: '10',
      BSART: 'NB',
      BUKRS: '2000',
      WERKS: '2100',
      LIFNR: '1000204',
      VendorName: 'Red Sea Logistics',
      ERNAM: 'H. Al-Mutairi',
      EKORG: '2000',
      OverallStatus: 'approved',
      ReleaseStatus: 'approved',
      LOEKZ: '',
      ERDAT: '/Date(1782500000000)/',
      AEDAT: '/Date(1782600000000)/',
      LFDAT: '/Date(1782700000000)/', // Overdue delivery
      WAERS: 'SAR',
      NETWR: '80000',
      MENGE: '10',
      DeliveredQuantity: '2' // Overdue by a few days (Medium/High exception depending on dates)
    },
    {
      EBELN: '4500018905',
      EBELP: '10',
      BSART: 'NB',
      BUKRS: '1000',
      WERKS: '1100',
      LIFNR: '1000205',
      VendorName: 'Riyadh Automation Parts',
      ERNAM: 'Y. Al-Harbi',
      EKORG: '1000',
      OverallStatus: 'approved',
      ReleaseStatus: 'approved',
      LOEKZ: '',
      ERDAT: '/Date(1781500000000)/',
      AEDAT: '/Date(1781500000000)/',
      WAERS: 'SAR',
      NETWR: '150000',
      MENGE: '5',
      DeliveredQuantity: '0',
      // Approved but no Transmission/Sent date (NOT_SENT exception)
      OutputDateTime: null
    },
    {
      EBELN: '4500018906',
      EBELP: '10',
      BSART: 'NB',
      BUKRS: '', // Missing company code (MISSING_MASTER_DATA exception)
      WERKS: '1100',
      LIFNR: '1000206',
      VendorName: 'Dammam Cables Co.',
      ERNAM: 'J. Smith',
      EKORG: '1000',
      OverallStatus: 'approved',
      ReleaseStatus: 'approved',
      LOEKZ: '',
      ERDAT: '/Date(1782500000000)/',
      WAERS: 'SAR',
      NETWR: '30000',
      MENGE: '15',
      DeliveredQuantity: '15'
    }
  ],
  purchaseOrderMaintenance: [
    {
      PurchaseOrder: '4500019201',
      PurchaseOrderItem: '10',
      PurchaseOrderType: 'NB',
      CompanyCode: '1000',
      Plant: '1100',
      Supplier: '1000201',
      SupplierName: 'Al-Bilad Industrial Supplies',
      CreatedByUser: 'S. Al-Otaibi',
      PurchasingOrganization: '1000',
      DocumentStatus: 'error', // Output processing failure (PROCESS_ERROR exception)
      MessageStatus: 'failed',
      IsMarkedForDeletion: false,
      CreationDate: '/Date(1782600000000)/',
      WAERS: 'SAR',
      NetAmount: '85000',
      OrderQuantity: '100',
      GoodsReceiptQuantity: '0'
    },
    {
      PurchaseOrder: '4500019202',
      PurchaseOrderItem: '10',
      CompanyCode: '1000',
      Plant: '', // Missing plant (MISSING_MASTER_DATA exception)
      Supplier: '1000202',
      SupplierName: 'Saudi Metal Castings Ltd',
      CreatedByUser: 'M. Al-Zahrani',
      PurchasingOrganization: '1000',
      DocumentStatus: 'approved',
      IsMarkedForDeletion: false,
      CreationDate: '/Date(1782650000000)/',
      WAERS: 'SAR',
      NetAmount: '12000',
      OrderQuantity: '10',
      GoodsReceiptQuantity: '10'
    },
    {
      PurchaseOrder: '4500019203',
      PurchaseOrderItem: '10',
      CompanyCode: '1000',
      Plant: '1300',
      Supplier: '', // Missing Supplier (MISSING_MASTER_DATA exception - High severity)
      SupplierName: '',
      CreatedByUser: 'A. Al-Dosari',
      PurchasingOrganization: '1000',
      DocumentStatus: 'approved',
      IsMarkedForDeletion: false,
      CreationDate: '/Date(1782400000000)/',
      WAERS: 'SAR',
      NetAmount: '67000',
      OrderQuantity: '20',
      GoodsReceiptQuantity: '0'
    }
  ],
  inboundDelivery: [
    {
      DeliveryDocument: '800012901',
      DeliveryDocumentItem: '10',
      DeliveryDocumentType: 'EL',
      Plant: '1100',
      CreatedByUser: 'K. Al-Ghamdi',
      OverallStatus: 'approved',
      LOEKZ: 'X', // Deleted delivery document
      CreationDate: '/Date(1782500000000)/',
      AEDAT: '/Date(1782550000000)/',
      WAERS: 'SAR',
      NETWR: '350000', // High value deleted object (High exception)
      MENGE: '500',
      DeliveredQuantity: '0',
      PrecedingDocument: '4500018903'
    },
    {
      DeliveryDocument: '800012902',
      DeliveryDocumentItem: '20',
      DeliveryDocumentType: 'EL',
      Plant: '1200',
      CreatedByUser: 'K. Al-Ghamdi',
      OverallStatus: 'approved',
      LOEKZ: '',
      CreationDate: '/Date(1781500000000)/',
      LFDAT: '/Date(1781800000000)/', // Overdue Delivery Document
      WAERS: 'SAR',
      NETWR: '500000',
      MENGE: '1000',
      DeliveredQuantity: '200',
      PrecedingDocument: '4500018903'
    }
  ]
};

export const MOCK_DIAGNOSTICS = [
  {
    service: "Purchase Order Facts (DEMO)",
    url: "https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/opu/odata/sap/C_PURCHASEORDER_FS_SRV",
    odataVersion: "2",
    metadataLatencyMs: 142,
    selectedEntities: [
      {
        name: "C_PurchaseOrderFs",
        score: 18,
        rows: 6,
        mappings: {
          objectId: "PurchaseOrder",
          itemId: "PurchaseOrderItem",
          documentType: "PurchaseOrderType",
          company: "CompanyCode",
          plant: "Plant",
          supplierId: "Supplier",
          supplierName: "SupplierName",
          buyer: "CreatedByUser",
          purchasingOrg: "PurchasingOrganization",
          status: "OverallStatus",
          deleted: "LOEKZ",
          createdAt: "CreationDate",
          changedAt: "LastChangeDate",
          value: "NetAmount"
        }
      }
    ],
    allEntitySets: ["C_PurchaseOrderFs", "C_PurchaseOrderItemFs", "SupplierFs"]
  },
  {
    service: "PO Maintenance (DEMO)",
    url: "https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/opu/odata/sap/MM_PUR_PO_MAINT_V2_SRV",
    odataVersion: "2",
    metadataLatencyMs: 198,
    selectedEntities: [
      {
        name: "POHeader",
        score: 15,
        rows: 3,
        mappings: {
          objectId: "PurchaseOrder",
          itemId: "PurchaseOrderItem",
          company: "CompanyCode",
          plant: "Plant",
          supplierId: "Supplier",
          supplierName: "SupplierName",
          buyer: "CreatedByUser",
          purchasingOrg: "PurchasingOrganization",
          status: "DocumentStatus",
          deleted: "IsMarkedForDeletion",
          createdAt: "CreationDate",
          value: "NetAmount"
        }
      }
    ],
    allEntitySets: ["POHeader", "POItem", "POScheduleLine"]
  },
  {
    service: "Inbound Delivery / ASN (DEMO)",
    url: "https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/opu/odata/sap/LE_SHP_INBOUND_DELIVERY_OBJPG_SRV",
    odataVersion: "2",
    metadataLatencyMs: 254,
    selectedEntities: [
      {
        name: "InboundDeliveryHeader",
        score: 12,
        rows: 2,
        mappings: {
          objectId: "DeliveryDocument",
          itemId: "DeliveryDocumentItem",
          plant: "Plant",
          buyer: "CreatedByUser",
          status: "OverallStatus",
          deleted: "LOEKZ",
          createdAt: "CreationDate",
          value: "NETWR"
        }
      }
    ],
    allEntitySets: ["InboundDeliveryHeader", "InboundDeliveryItem"]
  }
];
