import nodemailer from 'nodemailer';
import prisma from './prisma';

export const getTransporter = async () => {
  const config = await prisma.appConfig.findFirst();
  
  if (!config || !config.smtp_host) {
    // Fallback to env vars if available, or null
    if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    return null;
  }

  return nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port || 587,
    secure: config.smtp_secure,
    auth: {
      user: config.smtp_user || '',
      pass: config.smtp_pass || '',
    },
  });
};

export const sendEmail = async (to: string, subject: string, html: string) => {
  const transporter = await getTransporter();
  
  if (!transporter) {
    console.warn('Email configuration missing. Email not sent.');
    return false;
  }

  const config = await prisma.appConfig.findFirst();
  const from = config?.smtp_from || process.env.SMTP_FROM || 'noreply@legalassistant.com';

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};
