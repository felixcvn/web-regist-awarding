const bcrypt = require('bcryptjs');

const pin = process.argv[2];
if (!pin) {
  console.error('Usage: npm run hash-pin -- <your-pin>');
  process.exit(1);
}

const hash = bcrypt.hashSync(pin, 12);
const escaped = hash.replace(/\$/g, '\\$');
console.log('\nFor .env.local (escape "$" as "\\$"):\n');
console.log(`ADMIN_PIN_HASH='${escaped}'\n`);
console.log('For Vercel / hosting dashboard (raw, no quotes, no escaping):\n');
console.log(hash + '\n');
