const bcrypt = require('bcryptjs');

async function test() {
  const hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
  const isValid = await bcrypt.compare('Admin123!', hash);
  console.log('Is valid:', isValid);
}

test();
