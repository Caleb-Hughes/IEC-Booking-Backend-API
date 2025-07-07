const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Service = require('../models/service');
const Appointment = require('../models/appointments');
const {verifyToken, isAdmin} = require('../middleware/authMiddleware');

//Post router to assign services to stylist
router.post('/:id/services', verifyToken, isAdmin, async (req, res) => {
    try {
        //initializing stylist variable and finding stylists by ID
        const stylist = await User.findById(req.params.id);
       //if no stylist found or if role not equal to stylist return 404 error
        if (!stylist || stylist.role !== 'stylist') {
            return res.status(404).send('Not Found');
        }

        //pulling service ID array from request
        const serviceIds = req.body.serviceIds || [];
        //checking if all services currently exist
        const validServices = await Service.find({_id: {$in: serviceIds}});
        //if one or more services in the request body don't match return error
        if (validServices.length !== serviceIds.length) {
            return res.status(400).json({message: 'One or more service ID do not exist'});
        }
        //linking stylist to services
        stylist.services = serviceIds;
        await stylist.save(); // saving stylist back into database
        res.status(200).json({message: 'Service assigned successfully', stylist});

    } catch (error) { //error handler for unexpected errors
        console.error(error);
        res.status(500).json({message: 'Server error assigning services to stylist'});
    }
});
//get router to fetch stylist that offer specific services
router.get('/by-service/:serviceId', async (req, res) => {
    try {
        //searching for all users with stylist role and services array include the requested service
        const stylists = await User.find({
            role: 'stylist',
            services: req.params.serviceId
        }).select('-password'); //ensures password field isn't returned
        res.status(200).json(stylists);

    } catch (error) { //error handler for unexpected errors
        console.error(error);
        res.status(500).json({message: 'Error fetching stylists for service'});
    }
});

router.put('/:id/schedule', verifyToken, isAdmin, async (req, res) => {
    try {
        // pulling working hours and off days from request body
        const { workingHours, offDays } = req.body;

        // finding stylist by ID
        const stylist = await User.findById(req.params.id);

        // if stylist not found return error
        if (!stylist || stylist.role !== 'stylist') {
            return res.status(404).json({ message: 'Stylist not found' });
        }

        // updating fields if present
        if (workingHours) {
            stylist.workingHours = workingHours;
        }
        if (offDays) {
            stylist.offDays = offDays;
        }

        // saving updated stylist to the database
        await stylist.save();

        res.status(200).json({ message: 'Stylist schedule updated successfully', stylist });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating stylist schedule' });
    }
});

//get route to return available time slots
router.get('/:id/available-slots', async (req, res) => {
    try {
        //find stylist by ID
        const stylist =  await User.findById(req.params.id);
        //if stylist not found return error
        if (!stylist || stylist.role !== 'stylist') {
            return res.status(404).json({message: 'Stylist not found'});
        }
        //unpacking date query parameter from request
        const {date} = req.query;
        //if date not found return error
        if (!date) {
            return res.status(400).json({message: 'Date not found'});
        }
        //creating object for requested date
        const dateToCheck = new Date(date);

        //validating date is valid
        if (isNaN(dateToCheck.getTime())) {
            return res.status(400).json({message: 'Invalid date format'});
        }
        //Getting day name and date string("YYYY-MM-DD")
        const dayName = dateToCheck.toLocaleDateString('en-US', {weekday: 'long'});
        const dateString = dateToCheck.toISOString().slice(0,10);

        //Ensuring requested day isn't an off day
        if (stylist.offDays.includes(dayName) || stylist.offDays.includes(dateString)) {
           return res.status(200).json({availableSlots: [], message: 'Stylist is off on this day'});
        }
        //creating slot within working hours (default 60-minute intervals)
        const generateTimeSlot = (start, end, interval = 60) => {
            //creating empty array to store time slots
            const slots = [];
            //splitting start string, converting to number, and assigning to separate hour and minute values
            let [startHour, startMin] = start.split(':').map(Number);
            let [endHour, endMin] = end.split(':').map(Number);
            //creating current time object starting at workingHours.start
            let current = new Date(date);
            current.setHours(startHour, startMin, 0, 0);
            //creating end time object at workingHours.end
            const endTime = new Date(date);
            endTime.setHours(endHour, endMin, 0, 0);

            //creating while loop to generate slots adding 'interval' minutes each loop until endTime
            while (current < endTime) {
                slots.push(current.toTimeString().slice(0, 5)); // "HH:MM"
                current.setMinutes(current.getMinutes() + interval);
            }
            return slots;
        };
        //generating all slots for the day based on stylist's working hours
        let allSlots = generateTimeSlot(stylist.workingHours.start, stylist.workingHours.end, 60);

        //Get stylist's accepted appointment for requested date
        const acceptedAppointments = await Appointment.find({
            stylist: stylist._id,
            date: {
                $gte: new Date(`${date}T00:00:00.000Z`), //Finding appointments starting on requested day at midnight
                $lt: new Date(`${date}T23:59:59.999Z`) //finding appointments on requested day upto midnight the day before
            },
            status: 'accepted'
        });
        //creating an array of booked slots based on accepted appointments
        const bookedSlots = acceptedAppointments.map(app => {
            return new Date(app.date).toTimeString().slice(0,5);
        });
        //filtering booked slots
        const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

        res.status(200).json({availableSlots});
    } catch (error) {
        console.error('Error generating available slots: ', error.message);
        res.status(500).json({message: 'Error generating available slots', error: error.message});
    }
});

module.exports = router;