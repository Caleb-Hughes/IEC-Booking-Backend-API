// Import required modules and middleware
const express = require('express');
const router = express.Router();
const {body, validationResult } = require('express-validator');
const Service = require('../models/service'); // Service model
const {verifyToken, isAdmin} = require("../middleware/authMiddleware"); // Middleware to protect the route

//Create a new service
router.post(
    '/',
    verifyToken,
    isAdmin,
    //using express validator to ensure all fields satisfy requirements before adding service
    [
        body('name')
            .notEmpty()
            .withMessage('Service name is required'),
        body('duration')
            .isInt({min: 15})
            .withMessage('Duration must be at least fifteen minutes'),
        body('price')
            .isFloat({gt: 0})
            .withMessage('Price must be a positive number')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }
        try {
            // Destructure service details from request body
            const { name, duration, price } = req.body;

            // Create new service document and save it to the database
            const newService = new Service({ name, duration, price });
            await newService.save();

            // Respond with success message and created service
            res.status(201).json({ message: 'Service created successfully', service: newService });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error while creating service' });
        }
    });
//router to get all services
router.get('/', async (req, res) => {
    try {
        //finding and fetching services
        const services = await Service.find();
        res.status(200).json(services);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error while getting service' });
    }
});

//put router to update a service
router.put(
    '/:id',
    verifyToken,
    isAdmin,
    //using express validator to allow partial updates
    [
        body('name')
            .optional()
            .notEmpty()
            .withMessage('Service name is required'),
        body('duration')
            .optional()
            .isInt({min: 15})
            .withMessage('Duration must be at least fifteen minutes'),
        body('price')
            .optional()
            .isFloat({gt: 0})
            .withMessage('Price must be a positive number')
    ],async (req, res) => {
    try {
        //pulling update fields from request body
        const {name, duration, price} = req.body;
        //finding and updating service by ID
        const updatedService = await Service.findByIdAndUpdate(
            req.params.id,
            { name, duration, price },
            {new: true}
        );
        //if service not found return 404 error
        if (!updatedService) {
            return res.status(404).json({ message: 'Service not found' });
        }
        res.status(200).json({ message: 'Service updated successfully', service: updatedService });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error while updating service' });
    }
});


router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const deletedService = await Service.findByIdAndDelete(req.params.id);
        if (!deletedService) {
            return res.status(404).json({message: 'Service not found'});
        }
        res.status(200).json({message:'Service deleted successfully'});
    } catch (error) {
        res.status(500).json({ message: 'Server error while deleting service' });
    }
});

// Export the router to be used in app.js
module.exports = router;