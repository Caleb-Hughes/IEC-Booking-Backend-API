const mongoose = require('mongoose');

//Initializing User schema and defines what fields a user should have
const userSchema = new mongoose.Schema ({
    name: {type: String, required: true},
    password: {type: String, required: true},
    email: {type: String, unique: true, required: true},
    role: {type: String, enum: ['client', 'stylist', 'admin'], default: 'client'},
    googleId: {type: String, unique: true, sparse: true},
    services: [{type: mongoose.Schema.Types.ObjectId, ref: 'Service'}],
    workingHours: {
        start: {type: String, default:'9:00'}, //ensuring time is string type and default at 9:00
        end: {type: String, default:'8:00'},
    },
    offDays: {type: [String], default: []
    },
    verified: {type: Boolean, default: false},
    verificationToken: {type: String}
});
const User = mongoose.model('User', userSchema); //creating class to be used
module.exports = User;
