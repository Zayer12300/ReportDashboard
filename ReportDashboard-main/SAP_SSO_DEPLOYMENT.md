# SAP SSO deployment

## Confirmed cause

The OData services are reachable, but unauthenticated calls redirect to Microsoft Entra ID using SAML. SAP does not permit credentialed browser requests from `http://localhost:8080`. The browser therefore blocks the dashboard before JavaScript can read `$metadata`.

No front-end change can bypass CORS or transfer a SAML/SAP session cookie between unrelated origins. Disabling browser security, embedding credentials, or placing a service password in JavaScript is not acceptable.

## Recommended deployment: same SAP origin

Publish the static dashboard through the same scheme, host and port as the OData services:

```text
https://vhaftw11wd01.sap.corp.asmo.com:44380/<dashboard-path>/
```

The exact origin must be:

```text
https://vhaftw11wd01.sap.corp.asmo.com:44380
```

The dashboard already uses absolute URLs on that origin. When opened there, the user completes the normal Entra ID SAML flow once; the browser then sends the SAP session cookie to the OData paths. No username, password, token or service account is stored by the dashboard.

### Option A — SAP BSP/Fiori application

Ask the SAP development/Basis team to:

1. Create a BSP/static application such as `ZPROC_EXCEPTION_DASHBOARD`.
2. Upload `index.html`, `css/`, and `js/` preserving their relative paths.
3. Activate the corresponding SICF service.
4. Protect the application with the same SAML logon procedure used by the OData services.
5. Assign users the required OData service authorizations.
6. Test the application from the exact SAP HTTPS host and port.

An example resulting URL might be:

```text
https://vhaftw11wd01.sap.corp.asmo.com:44380/sap/bc/bsp/sap/zproc_exception_dashboard/index.html
```

### Option B — SAP Web Dispatcher route

Publish the dashboard as static content or route it through an approved internal web application on the same public origin as SAP. Preserve these paths without changing authentication:

```text
/sap/opu/odata/sap/C_PURCHASEORDER_FS_SRV
/sap/opu/odata/sap/MM_PUR_PO_MAINT_V2_SRV
/sap/opu/odata/sap/LE_SHP_INBOUND_DELIVERY_OBJPG_SRV
```

The Web Dispatcher/reverse proxy must preserve SAML redirects, SAP cookies, query strings and OData response headers.

## Alternative: approved credentialed CORS

If the dashboard must remain on another internal origin, SAP Basis can configure CORS for that exact HTTPS origin. It must return both:

```http
Access-Control-Allow-Origin: https://approved-dashboard.asmo.com
Access-Control-Allow-Credentials: true
```

Do not use `*` with credentialed requests. Microsoft Entra ID SAML redirects may still make a same-origin Web Dispatcher deployment preferable.

## Validation checklist

After deployment, open this URL in the browser while signed in:

```text
/sap/opu/odata/sap/C_PURCHASEORDER_FS_SRV/$metadata
```

The response must be XML containing `edmx:Edmx`, not an HTML Microsoft/SAP sign-in page. Then open the dashboard and select **Connect with SSO**. The diagnostics panel should show OData version, selected entity sets and loaded row counts.
