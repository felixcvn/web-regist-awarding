const bcrypt = require('bcryptjs');

const pin = process.argv[2];
if (!pin) {
  console.error('Usage: npm run hash-pin -- <your-pin>');
  process.exit(1);
}

const hash = bcrypt.hashSync(pin, 12);
console.log('\nAdd this to your environment (e.g. .env.local / hosting dashboard):\n');
console.log(`ADMIN_PIN_HASH="${hash}"\n`);
