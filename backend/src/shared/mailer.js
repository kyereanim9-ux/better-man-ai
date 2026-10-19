// Envoi d'emails (mot de passe oublié) via SMTP, sans service payant.
// Avec un compte Gmail : SMTP_USER = l'adresse Gmail, SMTP_PASS = un « mot
// de passe d'application » (compte Google → Sécurité → Validation en deux
// étapes → Mots de passe des applications). Sans SMTP_USER/SMTP_PASS,
// aucun email n'est envoyé (l'admin peut alors générer un lien à la main).
import nodemailer from 'nodemailer';

let transporter = null;

export function isMailConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) throw new Error('Envoi d\'emails non configuré (SMTP_USER / SMTP_PASS).');
  const from = process.env.MAIL_FROM || `Better Man AI <${process.env.SMTP_USER}>`;
  await getTransporter().sendMail({ from, to, subject, text, html });
}
