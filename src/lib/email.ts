import nodemailer from 'nodemailer';
import logger from './logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendVerificationEmail = async (email: string, otp: string) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@quixhr.com',
      to: email,
      subject: 'Email Verification - QuixHR',
      html: `
        <h1>Welcome to QuixHR!</h1>
        <p>Your verification code is: <strong>${otp}</strong></p>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info('Verification email sent', { email });
  } catch (error) {
    logger.error('Error sending verification email', { error, email });
    throw error;
  }
};

export const sendPasswordResetEmail = async (email: string, otp: string) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@quixhr.com',
      to: email,
      subject: 'Password Reset - QuixHR',
      html: `
        <h1>Password Reset Request</h1>
        <p>Your password reset code is: <strong>${otp}</strong></p>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this password reset, please ignore this email and ensure your account is secure.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info('Password reset email sent', { email });
  } catch (error) {
    logger.error('Error sending password reset email', { error, email });
    throw error;
  }
};

export default transporter;
