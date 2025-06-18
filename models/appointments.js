mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    user: { //links appointment to specific user
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    service: { //links to specific appointment
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
    },
    date: { //store date and time that appointment wants to be set for
        type: Date,
        required: true
    },
    duration: { //declares how long the appointment will last
        type: Number,
        default: 60
    },
    notes: { //lets user leave optional notes on check in
        type: String
    },
    status: { //tracks status of appointment
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled'],
        default: 'pending' //when created default will be pending
    },
    createdAt: { //time stamp of when appointment was created
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Appointment', appointmentSchema);
