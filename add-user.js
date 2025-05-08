const { PrismaClient } = require('./prisma/generated/prisma');
const bcrypt = require('bcrypt');

async function main() {
  const prisma = new PrismaClient();
  const hashedPassword = await bcrypt.hash('superadmin123', 12);
  await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'superadmin@cbums.com',
      password: hashedPassword,
      role: 'SUPERADMIN',
      coins: 1000000
    }
  });
  await prisma.$disconnect();
  console.log('User created!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}); 