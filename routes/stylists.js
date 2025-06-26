const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Service = require('../models/service');
const {verifyToken, isAdmin} = require('../middleware/authMiddleware');

router.post('/:id/services', verifyToken, isAdmin, async (req, res) => {
    try {
        const stylist = await User.findById(req.params.id);
        if (!stylist || stylist.role !== 'stylist') {
            return res.status(404).send('Not Found');
        }

        const serviceIds = req.body.serviceIds || [];
        const validServices = await Service.find({_id: {$in: serviceIds}});

        if (validServices.length !== serviceIds.length) {
            return res.status(400).json({message: 'One or more service ID do not exist'});
        }

        stylist.services = serviceIds;
        await stylist.save();
        res.status(200).json({message: 'Service assigned successfully', stylist});

    } catch (error) {
        console.error(error);
        res.status(500).json({message: 'Server error assigning services to stylist'});
    }
});

router.get('/by-service/:serviceId', async (req, res) => {
    try {
        const stylists = await User.find({
            role: 'stylist',
            services: req.params.serviceId
        }).select('-password');

        res.status(200).json(stylists);
    } catch (error) {
        console.error(error);
        res.status(500).json({message: 'Error fetching stylists for service'});
    }
});

module.exports = router;