# ASMO Procurement Exception Control Tower

Static HTML/CSS/JavaScript dashboard for SAP procurement exception monitoring. It uses the signed-in user's existing corporate SAP session and never collects or stores a username or password.

## Run

For the simplest one-click start on this workstation, double-click `Launch-Dashboard.cmd`.

If you want to start it manually, serve the folder through an approved internal web server. For local development on this workstation:

```powershell
.\serve.ps1
```

Open `http://localhost:8094` for layout and local development. Live OData access requires the production deployment described in [SAP_SSO_DEPLOYMENT.md](SAP_SSO_DEPLOYMENT.md).

Opening `index.html` directly as a `file://` URL is not recommended because browsers give it a restricted/null origin.

If PowerShell execution policy blocks the script, use an approved internal IIS/static web server. Do not weaken corporate execution policy solely for this dashboard.

## SSO and CORS requirements

The app calls OData using:

```js
fetch(url, { credentials: 'include', mode: 'cors' })
```

This reuses the browser's SSO session. Successful browser access requires:

1. The device is on the ASMO corporate network/VPN and can resolve the SAP host.
2. SAP SSO works in the same browser.
3. SAP permits the dashboard's origin through CORS and allows credentialed requests.
4. Browser policy permits the SAP session cookie for this request context.

The current SAP endpoint redirects unauthenticated requests to Microsoft Entra ID through SAML and does not allow credentialed CORS from `http://localhost:8080`. Consequently, opening SAP in another tab does not make cross-origin localhost requests readable by JavaScript. Deploy the dashboard behind the same SAP/Web Dispatcher origin. Do not put SAP credentials, Basic Authentication headers, or service-account secrets in JavaScript.

## Confirmed connectivity diagnosis

- The SAP host is reachable and its TLS endpoint responds.
- Each `$metadata` URL redirects into the Entra ID SAML login flow when no SAP browser session is present.
- The resulting content is HTML rather than OData metadata XML.
- Responses do not include `Access-Control-Allow-Origin` or `Access-Control-Allow-Credentials` for localhost.

This behavior cannot be safely bypassed in front-end JavaScript. See `SAP_SSO_DEPLOYMENT.md` for the supported same-origin configuration.

## Data discovery

At connection time the dashboard:

1. Reads `$metadata` from each configured service.
2. Scores likely PO, PO item and inbound-delivery entity sets.
3. Loads the best matching sets.
4. Maps common SAP property aliases into a normalized exception model.
5. Shows selected entities and property mappings under **OData services → Details**.

Update aliases in `js/normalizers.js` after reviewing diagnostics. Service URLs and thresholds are in `js/config.js`.

## Current exception rules

- Deleted PO/inbound-delivery objects and items
- Deletion after approval/release
- Overdue delivery with open quantity
- Approved/released PO without transmission timestamp
- SAP processing or output error status
- Missing company, supplier, plant or purchasing organization

Some standard SAP OData services stop returning physically deleted records. For complete deletion history, add an approved change-document/event source or persist periodic snapshots outside the browser.
