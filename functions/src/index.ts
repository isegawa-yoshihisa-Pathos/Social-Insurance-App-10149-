/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
export { registerAdminAndTenant } from './register/register-admin-tenant';
export { registerTenantForExistingUser } from './register/register-tenant-existing-user';
export { startInvitationMailBatch } from './invitation/invitation-mail-batch';
export { deliverInvitationMailTask } from './invitation/invitation-mail-task';
export { saveInvitationTemplate } from './invitation/invitation-functions';
export { validateInvitationToken } from './invitation/invitation-accept-functions';
export { acceptInvitation } from './invitation/invitation-accept-functions';
export { startPremiumCalculationBatch } from './premium-calculation/batch';
export { calculatePremiumTask } from './premium-calculation/task';
export { recalculatePremiumsAfterResign } from './premium-calculation/recalculate-after-resign';
export { approveMayJuneZuijiReview, rejectMayJuneZuijiReview } from './premium-calculation/may-june-zuiji-review';
export { resolveBonusRemunerationMismatchReview } from './premium-calculation/bonus-remuneration-mismatch-review';
export {
  submitRemunerationConsentReview,
  approveRemunerationConsentReview,
  rejectRemunerationConsentReview,
} from './premium-calculation/remuneration-consent-review';
export {
  previewRetroactiveRemunerationRecalc,
  applyRetroactiveRemunerationRecalc,
  skipRetroactiveRemunerationReview,
} from './premium-calculation/retroactive-remuneration-review';
export { checkAgeAttainmentAlerts } from './notification/age-alert';
export { updateEmployeeStatusesDaily } from './notification/check_status';
export { requestEmployeeInput } from './notification/employee-input-request';
export { deliverPaymentStatements } from './payment-statement/deliver-payment-statements';
// import {onRequest} from "firebase-functions/https";
// import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
