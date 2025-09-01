import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import sgMail from "@sendgrid/mail";

admin.initializeApp();
const db = admin.firestore();

export const submitResult = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid || !context.auth?.token?.email) {
    throw new functions.https.HttpsError("unauthenticated", "Sign-in required");
  }

  const uid = context.auth.uid;
  const email = String(context.auth.token.email);
  const { resultPayload } = data as { resultPayload: unknown };

  const ref = db.collection("results").doc(uid).collection("submissions").doc();
  await ref.set({
    email,
    result: resultPayload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn("SENDGRID_API_KEY missing – skipping email send");
    return { ok: true, id: ref.id, emailSent: false };
  }

  sgMail.setApiKey(apiKey);
  await sgMail.send({
    to: email,
    from: "no-reply@vistaverde.hu",
    subject: "Vezetői potenciál – eredményed",
    html: `<p>Köszönjük a kitöltést!</p><pre>${JSON.stringify(resultPayload, null, 2)}</pre>`,
  });

  return { ok: true, id: ref.id, emailSent: true };
});









