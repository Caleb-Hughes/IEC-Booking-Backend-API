const express = require('express');
const {body, validationResult } = require('express-validator');
const router = express.Router();
const prisma = require("../db/prisma");
const {verifyToken, isAdmin} = require('../middleware/authMiddleware');
const sendEmail = require('../utils/sendEmail');

function timeStrngToMnts(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

//Route for creating appointments
router.post(
    '/',
    verifyToken,
    [
        //Validation checks
        body('date').isISO8601().toDate().withMessage('Date is required and must be valid'),
        body('service').notEmpty().withMessage('Service is required'),
        body('stylist').notEmpty().withMessage('Stylist ID is required')
    ],
    async (req, res) => {
        const tz = "America/New_York";
        //Checking for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }
        try {
            //pulling fields from request body
            const {date, service: serviceId, notes, stylist: stylistId} = req.body;
            const clientId = req.user.id;

            //Finding Stylist by ID
            const stylist = await prisma.user.findUnique({
                where: {id: stylistId},
                select: {
                    id: true,
                    name: true,
                    role: true,
                    offDays: true,
                    workingStart: true,
                    workingEnd: true,
                },
            });

            if (!stylist || stylist.role !== 'stylist') {
                return res.status(404).json({message: 'Stylist not found'})
            }
            //Converting date string into date object for validation
            const dateToCheck = new Date(date);

            //Creating day name variable and date string (YYYY-MM-DD) for off-day checking
            const dayName = dateToCheck.toLocaleDateString('en-US', {weekday: 'long', timeZone: tz});
            const dateString = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(dateToCheck); 

            //Making sure requested date isn't an off-day
            if (stylist.offDays.includes(dayName) || stylist.offDays.includes(dateString)) {
                return res.status(400).json({message: 'Stylist is off on this day'})
            }
            //Extracting hour and minute from requested appointment date
            const parts = new Intl.DateTimeFormat("en-US", {
                timeZone: tz,
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            }).formatToParts(dateToCheck);
            //storing stylist working hours in order to do comparison
            const startTime = timeStrngToMnts(stylist.workingStart)
            const endTime = timeStrngToMnts(stylist.workingEnd)
            //converting hours and minutes into total minutes since midnight
            const hour = Number(parts.find(p => p.type === "hour")?.value);
            const minute = Number(parts.find(p => p.type === "minute")?.value);
            const appointmentTime = hour * 60 + minute;
            

            //ensuring requested appointment time is within working hours
            if (appointmentTime < startTime || appointmentTime >= endTime) {
                return res.status(400).json({message: 'Appointment time is outside stylist working hours'});
            }

            //confirming service exist
            const serviceDoc = await prisma.service.findUnique({
                where: {id: serviceId},
                select: {id: true, name: true, duration: true}
            });
            if (!serviceDoc) {
                return res.status(404).json({message: 'Service doesnt exist'})
            }

            //pulling duration of service from requested service
            const durationMinutes = serviceDoc.duration ?? 60;
            //creating appointmentStart variable as requested start time
            const appointmentStart = dateToCheck;
            //converting end time to milliseconds to get the exact end time of the appointment
            const appointmentEnd = new Date(appointmentStart.getTime() + durationMinutes * 60000);

            //Transaction lock for double booking
            const newAppointment = await prisma.$transaction(async (tx) => {
                //Per stylist lock for duration of transaction
                await tx.$executeRaw`
                    SELECT pg_advisory_xact_lock(hashtext(${`stylist:${stylistId}`}))
                `;

                //Checking to see if there is a pre-existing appointment at this time with the stylist
                const conflict = await tx.appointment.findFirst({
                    where: {
                        stylistId,
                        status: {in: ["accepted", "pending"]},
                        date: {lt: appointmentEnd},
                        endDate: {gt: appointmentStart}
                    },
                    select: {id: true}    
                });

                if (conflict) {
                    throw new Error('Time slot already booked')
                }
                return tx.appointment.create({
                    data: {
                        clientId,
                        stylistId,
                        serviceId,
                        date: appointmentStart,
                        endDate: appointmentEnd,
                        duration: durationMinutes,
                        notes,
                        status: "accepted"
                    },
                    include: {
                        service: {select: {name: true}},
                        stylist: {select: {name: true}},
                        client: {select: {name: true, email: true}}
                    }
                })
            }) 
            

        

            //success message
            res.status(201).json({message: 'Appointment created', appointment: newAppointment});

            //Formatting appointment details
            const appointmentDate = appointmentStart.toLocaleString('en-US', {timeZone: 'America/New_York'});
            //Sending booking confirmation email
            await sendEmail({
                to: newAppointment.client.email,
                subject: 'Appointment Confirmation',
                text: `Hello ${newAppointment.client.name},

Your appointment for ${newAppointment.service.name} has been confirmed for ${appointmentDate} with ${newAppointment.stylist.name}.

Thank you for booking with us!

- Your Salon Team`,
                html: `<p>Hello ${newAppointment.client.name},</p>
<p>Your appointment for <strong>${newAppointment.service.name}</strong> has been confirmed for <strong>${appointmentDate}</strong> with <strong>${newAppointment.stylist.name}</strong>.</p>
<p>Thank you for booking with us!</p>
<p>- Your Salon Team</p>`
            });

        } catch (error) {
            if (error.message === 'Time slot already booked') {
                return res.status(409).json({ message: 'Time slot already booked' });            
            }
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }    
});

//Getting all appointments (Admin access only)
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        //finding all appointments
        const appointment = await prisma.appointment.findMany({
            orderBy: {date: "asc"},
            include: {
                client: {select: {id: true, name: true, email: true, role: true}},
                stylist: {select: {id: true, name: true, email: true, role: true}},
                service: true
            }
        })
        res.status(200).json(appointment);
    } catch (error) {
        console.log(error);
        res.status(500).json({message: 'Internal server error while getting appointments', error});
    }
});
//router to get all appointments for currently logged-in user with filtering
router.get('/user', verifyToken, async (req, res) => {

    const {filter} = req.query; //pulling filter constant from request query
    const clientId = req.user.id;

    const today = new Date(); //creating object that will reflect the current date
    today.setHours(0, 0, 0, 0); //Setting time to zero to only focus on date

    //Building prisma where clause
    const where = {clientId}
    //if filter set to past only return appointments before current date
    if (filter === 'past') {
        where.date = {lt: today};
    }
    //if filter set to future return appointments after current date
    else if (filter === 'future') {
        where.date = {gte: today};
    }
    try {
        //finding all appointments linked to specific user
        const appointment = await prisma.appointment.findMany({
            where,
            orderBy: {date: "asc"},
            include: {
                service: true,
                stylist: {select: {id: true, name: true}}
            }
        });
        res.status(200).json(appointment);
    } catch (error) {
        console.error(error);
        res.status(500).json({message: 'Internal server error while getting user appointments', error});
    }
});

//Route for updating appointments
router.put(
    '/:id',
    verifyToken,
    [
        body('date').optional().isISO8601().toDate().withMessage('Date is required and must be valid'),
        body('service').optional().notEmpty().withMessage('Service cannot be empty'),
        body("notes").optional().isString(),
        body("status").optional().isIn(["pending", "accepted", "declined"])
    ],
    async (req, res) => {
       const errors = validationResult(req);
       if (!errors.isEmpty()) {
           return res.status(400).json({errors: errors.array()});
       }
        try {
            const appointmentId = req.params.id; //finding appointments by ID

            const appointment = await prisma.appointment.findUnique({
                where: {id: appointmentId},
                select: {
                    id: true,
                    clientId: true,
                    stylistId: true,
                    date: true,
                    endDate: true
                },
            })

            if (!appointment) {
                return res.status(404).json({message: 'Appointment not found'});
            }
            //checking user permissions
            const isAdminUser = req.user.role === "admin";
            const isStylistUser = req.user.role === "stylist";
            const isOwner = appointment.clientId === req.user.id;

            if (!isAdminUser && !isStylistUser && !isOwner) {
                return res.status(403).json({message: "Unauthorized to update this appointment"})
            }
    
            //updating appointment
            const updateData = {};
            const {date, service, notes, status} = req.body;

            //If service changing, update duration
            if (service) {
                const serviceDoc = await prisma.service.findUnique({
                    where: {id: service},
                    select: {id: true, duration: true}
                });

            if (!serviceDoc) return res.status(404).json({message: "service doesn't exist"});

            updateData.serviceId = serviceDoc.id;

            //if date changing, making sure to change accordingly
            const start = date ? new Date(date) : appointment.date;
            const end = new Date(start.getTime() + (serviceDoc.duration ?? 60) * 60000)

            updateData.date = start;
            updateData.endDate = end;
            updateData.duration = serviceDoc.duration ?? 60;
            } else if (date) {
                //date change but service didn't
                const start = new Date(date);
                const durationMin = Math.round((new Date(appointment.endDate).getTime() - new Date(appointment.date).getTime()) / 60000)
                const end = new Date(start.getTime() + durationMin * 60000);

                updateData.date = start;
                updateData.endDate = end;
            }
            if (notes!== undefined) updateData.notes = notes;
            if (status) updateData.status = status;

            //nothing to update
            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({message:"No valid fields provided to update"})
            }

            //update
            const updatedAppointment = await prisma.$transaction(async (tx) => {
                await tx.$executeRaw`
                    Select pg_advisory_xact_lock(hashtext(${`stylist:${appointment.stylistId}`}))
                `;
                if (updateData.date || updateData.endDate) {
                    const newStart = updateData.date ?? appointment.date;
                    const newEnd = updateData.endDate ?? appointment.endDate;

                    const conflict = await tx.appointment.findFirst({
                        where: {
                            id: {not: appointmentId},
                            stylistId: appointment.stylistId,
                            status: {in: ["accepted", "pending"]},
                            date: {lt: newEnd},
                           endDate: {gt: newStart}
                        },
                        select: {id: true},
                    });
                    if (conflict) {
                        throw new Error("time slot already boooked")
                   }
                }

                return tx.appointment.update({
                    where: {id: appointmentId},
                    data: updateData,
                    include: {
                        service: true,
                        client: {select: {id: true, name: true, email: true}},
                        stylist: {select: {id: true, name: true}},
                    }
               })
            })
            res.status(200).json({message: 'Appointment updated', appointment: updatedAppointment});
        } catch (error) {
            if (error.message === "Time slot already booked") {
                return res.staus(409).json({message: "Time slot already booked"})
            }
            console.error(error);
            res.status(500).json({message: "Server error while updating appointment"})
        }
    });
//route to accept and deny appointments
/* (Decided to go with automatically accepting appointments but keeping just in case)
router.put('/:id/status', verifyToken, async(req, res) => {
    const {status} = req.body; //pulling status from request body

    //Checking if status value is valid
    if (!['accepted', 'declined'].includes(status)) {
        return res.status(400).json({message: 'Invalid'});
    }

    try {
        //finding appointment by ID
        const appointment = await Appointment.findById(req.params.id);

        if (!appointment) { //error handler for if appointment doesn't exist
            return res.status(403).json({message: 'Unauthorized to update this appointment'});
        }
        //checking credentials to ensure that only admin and stylists can approve and deny appointments
        if (req.user.role !== 'admin' && req.user.role !== 'stylist') {
            return res.status(403).json({message: 'Unauthorized to update this appointment'});
        }
        //checking to see if appointment time is already booked
        if (status === 'accepted') {
            const conflict = await Appointment.findOne({
                _id: {$ne: appointment._id}, //excluding current appointments from search
                date: appointment.date, //checking for same date and time
                status: 'accepted' //only checking through other accepted appointments
            });
            //if time conflict found return error
            if (conflict) {
                return res.status(409).json({message: 'Time slot already booked'});
            }
        }
        appointment.status = status;
        await appointment.save(); //saving appointment to database
        res.status(200).json({message: `Appointment ${status}`, appointment});

    } catch (error) {
        console.error(error);
        res.status(500).json({message: 'Server error while updating appointment'});
    }
})
*/
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const appointmentId = req.params.id;

        const appointment = await prisma.appointment.findUnique({
            where: {id: appointmentId},
            include: {
                client: {select: {id: true, name: true, email: true}},
                stylist: {select: {id: true, name: true}},
                service: {select: {id: true, name: true}}
            }
        })

        if (!appointment) {
            return res.status(404).json({message: 'Appointment not found'});
        }
        //checking for delete permission
        const isOwner = appointment.clientId === req.user.id;
        const isAdminUser = req.user.role === "admin";

        if (!isAdminUser && !isOwner) {
            return res.status(403).json({message: "Unauthorized  delete this appointment"})
        }
        await prisma.appointment.delete({
            where: {id: appointmentId},
        })
        res.status(200).json({message: 'Appointment deleted successfully'});

        const appointmentDate = appointment.date.toLocaleString('en-US', {timeZone: 'America/New_York'});
        //sending email confirming cancellation
        await sendEmail({
            to: appointment.client.email,
            subject: 'Appointment Cancellation',
            text: `Hello ${appointment.client.name},

Your appointment for ${appointment.service.name} on ${appointmentDate} with ${appointment.stylist.name} has been cancelled.

We hope to see you again soon.

- Your Salon Team`,
            html: `<p>Hello ${appointment.client.name},</p>
<p>Your appointment for <strong>${appointment.service.name}</strong> on <strong>${appointmentDate}</strong> with <strong>${appointment.stylist.name}</strong> has been cancelled.</p>
<p>We hope to see you again soon.</p>
<p>- Your Salon Team</p>`
        });
    } catch (error) {
        res.status(500).json({message: 'Server error while deleting appointment'});
    }
});

module.exports = router; //exporting router