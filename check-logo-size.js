import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  const docRef = doc(db, 'settings', 'logo');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    if (data.base64) {
      console.log('Logo length in bytes:', data.base64.length);
    } else {
      console.log('No base64 field');
    }
  } else {
    console.log('No logo doc');
  }
  process.exit(0);
}
check();
