const express = require('express');
const {body, validationResult } = require('express-validator');
const router = express.Router();
const Appointment = require('../models/appointments');
const User = require('../models/user');
const Service = require('../models/service');
const {verifyToken, isAdmin} = require('../middleware/authMiddleware');
const sendEmail = require('../utils/sendEmail');


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
        //Checking for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }
        try {
            //pulling fields from request body
            const {date, service, notes, stylist: stylistID} = req.body;

            //Finding Stylist by ID
            const stylist = await User.findById(stylistID);

            if (!stylist || stylist.role !== 'stylist') {
                return res.status(404).json({message: 'Stylist not found'})
            }
            //Converting date string into date object for validation
            const dateToCheck = new Date(date);

            //Creating day name variable and date string (YYYY-MM-DD) for off-day checking
            const dayName = dateToCheck.toLocaleDateString('en-US', {weekday: 'long'});
            const dateString = dateToCheck.toISOString().slice(0,10);

            //Making sure requested date isn't an off-day
            if (stylist.offDays.includes(dayName) || stylist.offDays.includes(dateString)) {
                return res.status(400).json({message: 'Stylist is off on this day'})
            }
            //Extracting hour and minute from requested appointment date
            const appointmentHour = dateToCheck.getUTCHours();
            const appointmentMinutes = dateToCheck.getUTCMinutes();

            //storing stylist working hours in order to do comparison
            const [startHour, startMin] = stylist.workingHours.start.split(':').map(Number);
            const [endHour, endMin] = stylist.workingHours.end.split(':').map(Number);

            //converting hours and minutes into total minutes since midnight
            const appointmentTime = appointmentHour * 60 + appointmentMinutes;
            const startTime = startHour * 60 + startMin;
            const endTime = endHour * 60 + endMin;

            //ensuring requested appointment time is within working hours
            if (appointmentTime < startTime || appointmentTime >= endTime) {
                return res.status(400).json({message: 'Appointment time is outside stylist working hours'});
            }

            //confirming service exist
            const serviceDoc = await Service.findById(service);
            if (!serviceDoc) {
                return res.status(404).json({message: 'Service doesnt exist'})
            }

            //pulling duration of service from requested service
            const durationMinutes = serviceDoc.duration;
            //creating appointmentStart variable as requested start time
            const appointmentStart = dateToCheck;
            //converting end time to milliseconds to get the exact end time of the appointment
            const appointmentEnd = new Date(appointmentStart.getTime() + durationMinutes * 60000);

            //Checking to see if there is a pre-existing appointment at this time with the stylist
            const conflict = await Appointment.findOne({
                stylist: stylist._id,
                status: {$in: ['accepted', 'pending']},
                date: {$lt: appointmentEnd}, //ensuring conflict if existing appointment starts before the requested appointment ends
                endDate: {$gt: appointmentStart} //ensuring conflict if existing appointment ends after the requested appointment start
            });

            if (conflict) {
                return res.status(409).json({message: 'Time slot already booked'})
            }
            //creating new appointment instance
            const newAppointment = new Appointment ({
                user: req.user.id,
                date: dateToCheck,
                service,
                stylist: stylistID,
                notes,
                duration: durationMinutes,
                status: 'accepted',
                endDate: appointmentEnd
            });
            await newAppointment.save(); //saving instance to database
            //success message
            res.status(201).json({message: 'Appointment created', appointment: newAppointment});

            const user = await User.findById(req.user.id);

            //Formatting appointment details
            const appointmentDate = appointmentStart.toLocaleString('en-US', {timeZone: 'America/New_York'});
            const serviceName = serviceDoc.name;
            //Sending booking confirmation email
            await sendEmail({
                to: user.email,
                subject: 'Appointment Confirmation',
                text: `Hello ${user.name},

Your appointment for ${serviceName} has been confirmed for ${appointmentDate} with ${stylist.name}.

Thank you for booking with us!

- Your Salon Team`,
                html: `<p>Hello ${user.name},</p>
<p>Your appointment for <strong>${serviceName}</strong> has been confirmed for <strong>${appointmentDate}</strong> with <strong>${stylist.name}</strong>.</p>
<p>Thank you for booking with us!</p>
<p>- Your Salon Team</p>`
            });

        } catch (error) {
            console.log('Error creating appointment:', error.message);
            res.status(500).json({message: 'Internal server error while creating appointment', error: error.message});
        }
    });

//Getting all appointments (Admin access only)
router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        //finding all appointments
        const appointments = await Appointment.find().populate('user').populate('service');
        res.status(200).json(appointments);
    } catch (error) {
        console.log(error);
        res.status(500).json({message: 'Internal server error while getting appointments', error});
    }
});
//router to get all appointments for currently logged-in user with filtering
router.get('/user', verifyToken, async (req, res) => {

    const {filter} = req.query; //pulling filter constant from request query
    const query = {user: req.user.id}; //Initializing query to only return appointments belonging to logged-in user

    const today = new Date(); //creating object that will reflect the current date
    today.setHours(0, 0, 0, 0); //Setting time to zero to only focus on date

    //if filter set to past only return appointments before current date
    if (filter === 'past') {
        query.date = {$lt: today};
    }
    //if filter set to future return appointments after current date
    else if (filter === 'future') {
        query.date = {$gte: today};
    }
    try {
        //finding all appointments linked to specific user
        const appointments = await Appointment.find(query).populate('service').sort({date: 1});
        res.status(200).json(appointments);
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
        body('service').optional().notEmpty().withMessage('Service cannot be empty')
    ],
    async (req, res) => {
       const errors = validationResult(req);
       if (!errors.isEmpty()) {
           return res.status(400).json({errors: errors.array()});
       }
        try {
            const appointment = await Appointment.findById(req.params.id); //finding appointments by ID

            //Allowing admin, stylist, or user who created appointment to update
            if (!appointment) {
                return res.status(404).json({message: 'Appointment not found'});
            }
            //checking user permissions
            if (req.user.role !== 'admin' && req.user.role !== 'stylist' && appointment.user.toString() !==req.user.id) {
                return res.status(403).json({message: 'Unauthorized to update this appointment'});
            }
            //updating appointment
            const updatedAppointment = await Appointment.findByIdAndUpdate(
                req.params.id,
                req.body,
                {new: true}
            );
            res.status(200).json({message: 'Appointment updated', appointment: updatedAppointment});
        } catch (error) {
            console.error(error);
            res.status(500).json({message: 'Server error while updating appointment'});
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
        const appointment = await Appointment.findById(req.params.id);

        if (!appointment) {
            return res.status(404).json({message: 'Appointment not found'});
        }
        //checking for delete permission
        if (req.user.role !== 'admin' && appointment.user.toString() !==req.user.id) {
            return res.status(403).json({message: 'Unauthorized to delete this appointment'});
        }
        await Appointment.findByIdAndDelete(req.params.id); //deleting appointment
        res.status(200).json({message: 'Appointment deleted successfully'});

        const user = await User.findById(appointment.user);
        const serviceDoc = await Service.findById(appointment.service);
        const appointmentDate = appointment.date.toLocaleString('en-US', {timeZone: 'America/New_York'});
        const stylist = await User.findById(appointment.stylist);
        //sending email confirming cancellation
        await sendEmail({
            to: user.email,
            subject: 'Appointment Cancellation',
            text: `Hello ${user.name},

Your appointment for ${serviceDoc.name} on ${appointmentDate} with ${stylist.name} has been cancelled.

We hope to see you again soon.

- Your Salon Team`,
            html: `<p>Hello ${user.name},</p>
<p>Your appointment for <strong>${serviceDoc.name}</strong> on <strong>${appointmentDate}</strong> with <strong>${stylist.name}</strong> has been cancelled.</p>
<p>We hope to see you again soon.</p>
<p>- Your Salon Team</p>`
        });
    } catch (error) {
        res.status(500).json({message: 'Server error while deleting appointment'});
    }
});

module.exports = router; //exporting router