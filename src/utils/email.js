import nodemailer from 'nodemailer';

let transporter;

const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }
    return transporter;
};

export const sendEmail = async (to, subject, html) => {
    await getTransporter().sendMail({
        from: `"Biteyo (No Reply)" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    });
};
