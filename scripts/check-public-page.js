const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkPublicPage() {
  const pageId = 'SSKvRSPjCyEqwRR1hZaO';
  
  console.log('=== Checking publicPage ===');
  const publicPageDoc = await db.collection('publicPages').doc(pageId).get();
  
  if (!publicPageDoc.exists) {
    console.log('❌ Public page not found!');
    return;
  }
  
  const data = publicPageDoc.data();
  console.log('\n📄 Public Page Data:');
  console.log('- Title:', data.title);
  console.log('- About:', data.about);
  console.log('- Bio:', data.bio);
  console.log('- Memory ID:', data.memoryId);
  console.log('- Media:', JSON.stringify(data.media, null, 2));
  console.log('- Colors:', JSON.stringify(data.colors, null, 2));
  console.log('- Ordering:', data.ordering);
  
  if (data.memoryId) {
    console.log('\n=== Checking Memory ===');
    const memoryDoc = await db.collection('memories').doc(data.memoryId).get();
    
    if (memoryDoc.exists) {
      const memoryData = memoryDoc.data();
      console.log('- Title:', memoryData.title);
      console.log('- Blocks count:', memoryData.blocks?.length || 0);
      console.log('- Cover Image:', memoryData.coverImage);
      console.log('- Profile Image:', memoryData.profileImage);
      console.log('- Ordering:', memoryData.ordering);
      
      if (memoryData.blocks) {
        console.log('\n📦 Blocks:');
        memoryData.blocks.forEach((block, idx) => {
          console.log(`  ${idx + 1}. Type: ${block.type}, ID: ${block.id}, Visibility: ${block.visibility}`);
          if (block.type === 'album') {
            console.log(`     Title: ${block.title}, Items: ${block.albumItems?.length || 0}`);
          } else if (block.url) {
            console.log(`     URL: ${block.url.substring(0, 50)}...`);
          }
        });
      }
    } else {
      console.log('❌ Memory not found!');
    }
  }
  
  process.exit(0);
}

checkPublicPage().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});


