import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "ai-studio-rpcsporcusalmerk-6c56cbb6-6d6a-450d-8037-2fa201a7da0f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const docRef = doc(db, 'settings', 'logo');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.base64) {
        console.log("LOGO_FOUND");
        const fs = await import('fs');
        // Extract base64 part
        const matches = data.base64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const type = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          fs.writeFileSync(`public/logo.${type}`, buffer);
          console.log(`Saved logo as public/logo.${type}`);
        } else {
           fs.writeFileSync(`public/logo_base64.txt`, data.base64);
           console.log("Saved raw base64");
        }
      } else {
        console.log("NO_BASE64_IN_DOC");
      }
    } else {
      console.log("NO_LOGO_DOC");
    }
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
