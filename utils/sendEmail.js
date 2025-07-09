const nodemailer = require('nodemailer');

//Using nodemailer to create transporter object to send emails using Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    }
});
//creating async function to send emails
async function sendEmail(options) {
    const mailOptions = {
        from: `"Salon Booking" <${process.env.GMAIL_USERNAME}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
    };
    //attempting to send email
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully', info.response);
    } catch (err) { //error handler
        console.log(err);
    }
}

module.exports = sendEmail;