const{PrismaClient} = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main () {
    console.log("Seeding Db");

    /*Services*/
    const servicesData = [
        {name: "Trim", duration: 90, price: 120, category: "other"},
        {name: "Rod Set", duration: 120, price: 85, category: "other"},
        {name: "Silk Press + Treatment Package", duration: 150, price: 100, category: "other"},
        {name: "Women's Haircut", duration: 60, price: 25, category: "other"},
        {name: "Child's Haircut and Style", duration: 60, price: 75, category: "other"},
        {name: "Relaxer - Touch up", duration: 115, price: 120, category: "other"},
        {name: "Design Essentials STS Treatment", duration: 120, price: 115, category: "other"},
        {name: "Hair Detangling", duration: 90, price: 50, category: "other"},
        {name: "Shampoo, Blow Dry, & Trim", duration: 90, price: 120, category: "other"},
        {name: "Medium Knotless", duration: 270, price: 250, category: "Braids"},
        {name: "Large Knotless", duration: 240, price: 200, category: "Braids"},
        {name: "Jumbo Knotless", duration: 240, price: 170, category: "Braids"},
        {name: "Freestyle Tribal Braids", duration: 270, price: 270, category: "Braids"},
        {name: "4 Stitch Braids", duration: 120, price: 115, category: "Braids"},
        {name: "6 Stitch Braids", duration: 190, price: 155, category: "Braids"},
        {name: "8 Stitch Braids", duration: 210, price: 160, category: "Braids"},
        {name: "Small Box Braids", duration: 240, price: 220, category: "Braids"},
        {name: "Medium Box Braids", duration: 180, price: 220, category: "Braids"},
        {name: "Large Box Braids", duration: 150, price: 190, category: "Braids"},
        {name: "Quick Weave", duration: 120, price: 150, category: "Weave Service"},
        {name: "Traditional Weave Installation", duration: 210, price: 300, category: "Weave Service"},
        {name: "Traditional Ponytail", duration: 90, price: 125, category: "Weave Service"},
        {name: "Quick Weave bob", duration: 120, price: 185, category: "Weave Service"},
        {name: "Weave Maintenance", duration: 90, price: 125, category: "Weave Service"},
        {name: "Boho Box Braids on Natural Hair", duration: 120, price: 125, category: "Natural Style"},
        {name: "Natural Box Braids", duration: 120, price: 125, category: "Natural Style"},
        {name: "Mini Twists", duration: 100, price: 180, category: "Natural Style"},
        {name: "Flat Twist Set", duration: 90, price: 85, category: "Natural Style"},
        {name: "Two Strand Twist", duration: 90, price: 100, category: "Natural Style"}
    ]
    const services = [];
    for (const service of servicesData) {
        const existing = await prisma.service.findFirst({
            where: { name: service.name },
            select: { id: true },
        });

    const s = existing ? await prisma.service.update({
        where: { id: existing.id },
        data: {
          duration: service.duration,
          price: service.price,
          category: service.category,
        },
      })
    : await prisma.service.create({
        data: service,
      });

  services.push(s);
}
    console.log(`Seeded ${services.length} services`)

    /*Stylists*/
    const stylistPassword = await bcrypt.hash('password123', 10);


    const stylistsData = [
        {
            name: "Dionne Hughes",
            email: "dionne@salon.com",
            workingStart: "09:00",
            workingEnd: "17:00",
            offDays: ["Sunday"]
        },
        {
            name: "Liz Anderson",
            email: "liz@salon.com",
            workingStart: "09:00",
            workingEnd: "20:00",
            offDays: ["Sunday"]
        },
        {
            name: "Whitley Hughes",
            email: "whitley@salon.com",
            workingStart: "09:00",
            workingEnd: "20:00",
            offDays: ["Wednesday", "Sunday"]
        },
        {
            name: "Alex Moore",
            email: "alex@salon.com",
            workingStart: "09:00",
            workingEnd: "20:00",
            offDays: ["Monday", "Wednesday", "Sunday"]
        },
        {
            name: "Ashley Lace",
            email: "ashley@salon.com",
            workingStart: "09:00",
            workingEnd: "20:00",
            offDays: ["Monday", "Friday"]
        }
    ];

    const stylists = [];
    for (const stylist of stylistsData) {
        const u = await prisma.user.upsert({
            where: { email: stylist.email },
            update: {
            name: stylist.name,
            workingStart: stylist.workingStart,
            workingEnd: stylist.workingEnd,
            offDays: stylist.offDays,
            role: "stylist",
            verified: true,
        },
        create: {
            ...stylist,
            password: stylistPassword,
            role: "stylist",
            verified: true,
        },
    });
        stylists.push(u)
    }
    console.log(`Seeded ${stylists.length} stylists`)

    /*Stylist to Service link*/
    for (let i = 0; i < stylists.length; i++) {
    const stylist = stylists[i];
    
    // Calculate the start and end indices for this specific stylist
    const startIndex = i * 5;
    const endIndex = startIndex + 5;
    
    // Grab the unique set of 5 services for this stylist
    const stylistServices = services.slice(startIndex, endIndex);

    if (stylistServices.length > 0) {
        await prisma.user.update({
            where: { id: stylist.id },
            data: {
                services: {
                    connect: stylistServices.map((s) => ({ id: s.id }))
                }
            }
        });
        console.log(`Linked ${stylistServices.length} services to ${stylist.name}`);
    }
}
}
main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });