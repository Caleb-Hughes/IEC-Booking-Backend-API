const cron = require("node-cron");
const prisma = require("../db/prisma");
const sendEmail = require("../utils/sendEmail");

const SALON_TZ = "America/New_York";

// Runs every hour at minute 0
function setupReminderJob() {
  cron.schedule("0 * * * *", async () => {
    console.log("running reminder job");

    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      // Pull upcoming appts in the next hour
      const appointments = await prisma.appointment.findMany({
        where: {
          status: { in: ["accepted", "pending"] },
          date: { gte: now, lt: oneHourFromNow },
        },
        include: {
          client: { select: { name: true, email: true } },
          service: { select: { name: true } },
          stylist: { select: { name: true } },
        },
        orderBy: { date: "asc" },
      });

      console.log(`Found ${appointments.length} appointments for reminders`);

      for (const appt of appointments) {
        const clientEmail = appt.client?.email;
        const clientName = appt.client?.name;
        const serviceName = appt.service?.name;

        if (!clientEmail || !clientName || !serviceName) continue;

        const appointmentDate = appt.date.toLocaleString("en-US", {
          timeZone: SALON_TZ,
        });

        await sendEmail({
          to: clientEmail,
          subject: "Appointment Reminder",
          text: `Hello ${clientName},

This is a reminder for your ${serviceName} appointment on ${appointmentDate}${appt.stylist?.name ? ` with ${appt.stylist.name}` : ""}.

We look forward to seeing you!

- Your Salon Team`,
          html: `<p>Hello ${clientName},</p>
<p>This is a reminder for your <strong>${serviceName}</strong> appointment on <strong>${appointmentDate}</strong>${
            appt.stylist?.name ? ` with <strong>${appt.stylist.name}</strong>` : ""
          }.</p>
<p>We look forward to seeing you!</p>
<p>- Your Salon Team</p>`,
        });

        console.log(`Reminder sent to ${clientEmail}`);
      }
    } catch (error) {
      console.error("Error in reminder job:", error);
    }
  });
}

module.exports = setupReminderJob;