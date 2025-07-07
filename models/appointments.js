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
    stylist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: { //store date and time that appointment wants to be set for
        type: Date,
        required: true
    },
    duration: { //declares how long the appointment will last
        type: Number,
        default: 60,
        required: true
    },
    notes: { //lets user leave optional notes on check in
        type: String
    },
    status: { //tracks status of appointment
        type: String,
        enum: ['pending','accepted', 'declined'],
        default: 'accepted' //when created default will be pending
    },
    createdAt: { //time stamp of when appointment was created
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    }
});

module.exports = mongoose.model('Appointment', appointmentSchema);
