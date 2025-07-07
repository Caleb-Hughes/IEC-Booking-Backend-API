const cron = require('node-cron');
const Appointment = require('../models/appointments');
const User = require('../models/user');
const Service = require('../models/service');
const sendEmail = require('../utils/sendEmail');

function setupReminderJob() {
    cron.schedule('0 * * * *', async () => {
        console.log('running reminder job');

        try {
            const now = new Date();
            const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const nextDayEnd = new Date(now.getTime() + 60 * 60 * 1000);

            const appointments = await Appointment.find({
                date: {$gte: nextDay, $lt: nextDayEnd},
                status: {$in: ['accepted', 'pending']}
            });

            console.log(`Found ${appointments.length} appointments for reminders`);

            for (const appointment of appointments) {
                const user = await User.findbyId(appointment.user);
                const service = await Service.findById(appointment.service);
                const appointmentDate = appointment.date.toLocateString('en-US', {timeZone: 'America/New_York'});

                if (!user || !service) continue;

                await sendEmail({
                    to: user.email,
                    subject: 'Appointment Reminder',
                    text: `Hello ${user.name},

This is a reminder for your ${service.name} appointment on ${appointmentDate}.

We look forward to seeing you!

- Your Salon Team`,
                    html: `<p>Hello ${user.name},</p>
<p>This is a reminder for your <strong>${service.name}</strong> appointment on <strong>${appointmentDate}</strong>.</p>
<p>We look forward to seeing you!</p>
<p>- Your Salon Team</p>`
                });

                console.log(`Reminder sent to ${user.email}`);
            }
        } catch (error) {
            console.error('Error in reminder job:', error);
        }
    });
}

module.exports = setupReminderJob;