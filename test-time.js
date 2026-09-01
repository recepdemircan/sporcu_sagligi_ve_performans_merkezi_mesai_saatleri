import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function test() {
  const start = Date.now();
  try {
    const snap = await getDocs(collection(db, 'settings'));
    console.log("Success! size:", snap.size, "Time:", Date.now() - start, "ms");
  } catch(e) {
    console.log("Error:", e.message, "Time:", Date.now() - start, "ms");
  }
  process.exit(0);
}
test();
