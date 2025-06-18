const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    name: {type: String, required: true},
    duration: {type: Number},
    price: {type: Number},
})

module.exports = mongoose.model('Service', serviceSchema);