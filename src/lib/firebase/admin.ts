// src/lib/firebase/admin.ts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // مهم: استبدال \n في متغيرات Vercel
-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDuP7y9A680qVBo\nNwf+yERMQDH8nIilPKS/UyuLwVRyLkgjGs7BWmRNokI4J8pLo4Xl6ISADrRTJAPi\n9AaD5GbKNktSu7S/rYLKFB6HHAgp6Cijh63AKgGgnwfE6QxtzwMePa7Hsp2/F6Qn\nDS3VAWJ8tF75tR/aUk9GhohoiacZt+1fCKprkSJk0l6p9vjxbnyQ0kqQboe3O7Tb\n5W2Wx066RlMTpXYNaNZHVbPhnbrpaMcc6q466TsxrtcPI39CKBUJ7Y0h/tAGAsYm\nidosbjMnSGoqvlOT7abjmNWN3E997s5wUl8dSF7EpyT2/xgPOrMjQF9E8bqp3SPH\nKbteHt/5AgMBAAECggEAJWFdsQBDfI02HuvHdtugD6Cg1yQOMnK13Ijlk6tVHwcQ\n7WUW3HJcu2uCXUIs9Lom14AoTdlAxKypaXHlFct/rylenw/xV4OXOjJ26bbltwGE\nYsf2ZGiS0csx0lzIRPBOam++HPny0xkX+cKRFtL9S1iXcDFRWpVAd+3CuDgkvh12\ngsULJi8O+AUJWZYO5vIH4STiaa8DeQer1SCExEBhuSJSdqHf8Ia6nouOG1tWKLCa\nLbsE2hcP0IRMGsLUGtWltNr0PNBwSyUd0QTXvA61ReHqLGH6CAi82eXVWz+1JhVu\nzabgqUZqA3q2z35hDuyvgc1Ctrpiy/NSJVP3qVUEgwKBgQD4XtRAWmNjRPBMR6Dw\n32medH+ZrHkCZz6CR2Pvk1UtY+fB+IjKcz0Uut9p50xJWFszFYbXB9X06p3iFbS+\nx/84E2aOlkp54S+VkMLRbYlzo6NFl7+NBgbFe9YrHZEZ5MrfJaaUyU9w+tkrxBlB\nLHjmB/qUhcKhX7jv3ugBRMitXwKBgQD1kVBJxT0aoVurnrzXtWFTZP1kwTe0ZBbr\nVLMKDo2BnMareP0pa4XXTTH+XmqmrtkMrqpyDdgvRWhnSTQGIk4x1e7/cqENJQ0g\nE0Cyp82l8W9KPEbBBufKxVenT+OhG3KPrIXda4KjObWeBaS1WtcNXXqJAeeR7jUh\nTkSdf2iZpwKBgBdiBiWQ3O6JnP3xeGt0/SKX4TN8k1/wjGgDhJsXidteHoGafnZg\n5w0+kq4LwpjdIqjqi+lOqYwHUpnoZT3Y4mRLH0qpR5W1557zJARHhbtHWqXApZ4H\nRTfucrlYbUK80YS0rLwxP7NpSmzeZ2pFX5R4h9TXyv0aX/TlTX5hFWuNAoGBAI4u\nIZdk3NkjXclDMkGOohg/27rPaGpInUCKHNOP4p/t3tV/Ss0FlUuwRWbq0cNKbx85\nrjQ1MdtEy4spxjZa/H08SZGblAXhUvUkUIxgPeB7pp0Lw0eVsPUlR3f2+GvaUX1A\nPY2S5uOM0Uv6JoBeZS821XCoKqTCj/6Fq5KpJy33AoGBAKW+ovPoQ7Nvs+P9l8Ac\n7JMwBy4bHnvB/+m3SwoA2odTcMCLjiXSslPGGMX6pYojX/ZO0ElfX8qidggxhJvH\nDOJkeRdPS5tjPSg0qpHLoxnLdUMMURuCR9Nz05/oSBObC7fq1j6VFtGrBJVzVHSo\nq3T5x9RuqbuVZ2yLmovNNZ5X\n-----END PRIVATE KEY-----\n    }),
  });
}

adminApp = getAdminApp();

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export { adminApp };
