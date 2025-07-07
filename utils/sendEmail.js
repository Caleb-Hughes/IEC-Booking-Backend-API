const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    }
});

async function sendEmail(options) {
    const mailOptions = {
        from: `"Solon Booking" <${process.env.GMAIL_USERNAME}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully', info.response);
    } catch (err) {
        console.log(err);
    }
}
module.exports = sendEmail;