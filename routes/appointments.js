const express = require('express');
const {body, validationResult } = require('express-validator');
const router = express.Router();
const Appointment = require('../models/appointments');
const {verifyToken, isAdmin} = require('../middleware/authMiddleware');


//Route for creating appointments
router.post(
    '/', verifyToken,
    [
        //Validation checks
        body('date').isISO8601().toDate().withMessage('Date is required and must be valid'),
        body('service').notEmpty().withMessage('Service is required'),
    ],
    async (req, res) => {
        //Checking for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }
        try {

            const {date, service, notes} = req.body;//Destructure fields from request body

            //creating new appointment instance
            const newAppointment = new Appointment ({
                user: req.user.id,
                date,
                service,
                notes
            });
            await newAppointment.save(); //saving instance to database
            res.status(201).json({message: 'Appointment created', appointment: newAppointment});
        } catch (error) {
            console.log(error);
            res.status(500).json({message: 'Internal server error while createing appointment', error});
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
router.get('/user', verifyToken, async (req, res) => {
    try {
        //finding all appointments linked to specific user
        const appointments = await Appointment.find({ user: req.user.id}).populate('service');
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
    } catch (error) {
        res.status(500).json({message: 'Server error while deleting appointtment'});
    }
});
module.exports = router; //exporting router