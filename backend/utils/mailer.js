// utils/mailer.js - Email notification utility
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        console.log('SMTP not configured — email notifications disabled');
        return null;
    }

    transporter = nodemailer.createTransport({
        host: host,
        port: parseInt(port) || 587,
        secure: false,
        auth: { user: user, pass: pass }
    });

    return transporter;
}

async function sendNotificationEmail(user, notification) {
    try {
        const t = getTransporter();
        if (!t) return;

        await t.sendMail({
            from: process.env.SMTP_USER,
            to: user.email,
            subject: notification.title || 'Notification',
            text: notification.message || '',
            html: '<h3>' + (notification.title || 'Notification') + '</h3><p>' + (notification.message || '') + '</p>'
        });
    } catch (err) {
        console.error('Email send error:', err.message);
    }
}

// sendEmail is an alias used by notificationController
async function sendEmail(to, subject, text) {
    try {
        const t = getTransporter();
        if (!t) return;
        await t.sendMail({
            from: process.env.SMTP_USER,
            to: to,
            subject: subject || 'Notification',
            text: text || '',
            html: '<h3>' + (subject || 'Notification') + '</h3><p>' + (text || '') + '</p>'
        });
    } catch (err) {
        console.error('Email send error:', err.message);
    }
}

module.exports = { sendNotificationEmail, sendEmail };
