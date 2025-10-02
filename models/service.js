const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: {type: String, required: true},
    duration: {type: Number},
    price: {type: Number},
    category: {type: String, default : 'Other', index : true },
})

module.exports = mongoose.model('Service', serviceSchema);