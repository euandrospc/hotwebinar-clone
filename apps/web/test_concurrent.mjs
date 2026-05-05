// Simulate concurrent submits to check for race condition
import { prisma } from 'db';

async function simulateRace() {
  const w = await prisma.webinar.create({
    data: {
      ownerId: "test-user",
      name: "T",
      title: "T",
      slug: "race-" + Date.now(),
      status: "ACTIVE"
    }
  });

  const email = "race@test.com";
  
  // First submit finds no existing, tries create
  const p1 = prisma.lead.findUnique({ where: { webinarId_email: { webinarId: w.id, email } } })
    .then(existing => {
      if (existing) return existing.id;
      return prisma.lead.create({
        data: { webinarId: w.id, name: "User1", email, phone: null, ip: "1.1.1.1", userAgent: "ua1" }
      }).then(l => l.id);
    });

  // Second submit finds no existing, tries create
  const p2 = prisma.lead.findUnique({ where: { webinarId_email: { webinarId: w.id, email } } })
    .then(existing => {
      if (existing) return existing.id;
      return prisma.lead.create({
        data: { webinarId: w.id, name: "User2", email, phone: null, ip: "2.2.2.2", userAgent: "ua2" }
      }).then(l => l.id);
    });

  try {
    const results = await Promise.all([p1, p2]);
    console.log("Race condition passed without error:", results);
  } catch (err) {
    console.log("Race condition error:", err.code || err.message);
  }

  // Cleanup
  await prisma.lead.deleteMany({ where: { email } });
  await prisma.webinar.deleteMany({ where: { slug: w.slug } });
  await prisma.$disconnect();
}

simulateRace();
