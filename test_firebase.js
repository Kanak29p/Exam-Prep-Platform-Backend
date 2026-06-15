const admin = require('./src/config/firebaseAdmin');

async function test() {
  console.log("Admin initialized:", !!admin.app);
}

test();
