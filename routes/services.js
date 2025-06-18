// Import required modules and middleware
const express = require('express');
const router = express.Router();
const {body, validationResult } = require('express-validator');
const Service = require('../models/service'); // Service model
const {verifyToken, isAdmin} = require("../middleware/authMiddleware"); // Middleware to protect the route

//Create a new service (only accessible with a valid token)
router.post(
    '/',
    verifyToken,
    isAdmin,
    [
        body('name').notEmpty().withMessage('Service name is required'),
        body('duration').isNumeric().withMessage('Duration must be a number'),
        body('price').isNumeric().withMessage('Price must be a number'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({errors: errors.array()});
        }
        try {
            // Destructure service details from request body
            const { name, duration, price } = req.body;

            // Validate required fields
            if (!name || !duration || !price) {
                return res.status(400).json({ message: 'All fields (name, duration, price) are required' });
            }

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
router.get('/', async (req, res) => {
    try {
        const services = await
        Service.find();
        res.status(200).json(services);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error while getting service' });
    }
});
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const {name, duration, price} = req.body;

        const updatedService = await Service.findByIdAndUpdate(
            req.params.id,
            { name, duration, price },
            {new: true}
        );
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