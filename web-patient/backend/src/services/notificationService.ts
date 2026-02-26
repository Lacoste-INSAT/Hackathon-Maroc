// ─────────────────────────────────────────────────────────────
// TabibNet — Notification Service (pluggable provider)
// ─────────────────────────────────────────────────────────────

import { config } from '../config';

// ── Provider Interface ──────────────────────────────────────

interface NotificationProvider {
  sendSms(to: string, message: string): Promise<void>;
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

// ── Mock Provider (logs to console) ─────────────────────────

class MockProvider implements NotificationProvider {
  async sendSms(to: string, message: string): Promise<void> {
    console.log(`[MOCK SMS] To: ${to} | Message: ${message}`);
  }
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${body}`);
  }
}

// ── Twilio Provider (optional — swap in when ready) ─────────

class TwilioProvider implements NotificationProvider {
  async sendSms(to: string, message: string): Promise<void> {
    // To enable: npm install twilio, then:
    // const twilio = require('twilio')(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    // await twilio.messages.create({ body: message, from: config.TWILIO_PHONE_NUMBER, to });
    console.log(`[TWILIO SMS] To: ${to} | Message: ${message}`);
  }
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log(`[TWILIO EMAIL] To: ${to} | Subject: ${subject}`);
  }
}

// ── Provider Factory ────────────────────────────────────────

function getProvider(): NotificationProvider {
  if (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN) {
    console.log('[Notifications] Using Twilio provider');
    return new TwilioProvider();
  }
  console.log('[Notifications] Using mock provider (console logs)');
  return new MockProvider();
}

const provider = getProvider();

// ── Public API ──────────────────────────────────────────────

export async function sendOtpNotification(to: string, code: string): Promise<void> {
  const message = `Votre code de vérification TabibNet : ${code}. Valide 5 minutes.`;
  if (to.includes('@')) {
    await provider.sendEmail(to, 'Code de vérification TabibNet', message);
  } else {
    await provider.sendSms(to, message);
  }
}

export async function sendAppointmentConfirmation(
  to: string,
  doctorName: string,
  dateTime: string
): Promise<void> {
  const message = `Rendez-vous confirmé avec ${doctorName} le ${dateTime}. — TabibNet`;
  if (to.includes('@')) {
    await provider.sendEmail(to, 'Confirmation de rendez-vous — TabibNet', message);
  } else {
    await provider.sendSms(to, message);
  }
}

export async function sendAppointmentReminder(
  to: string,
  doctorName: string,
  dateTime: string
): Promise<void> {
  const message = `Rappel : Rendez-vous avec ${doctorName} le ${dateTime}. — TabibNet`;
  if (to.includes('@')) {
    await provider.sendEmail(to, 'Rappel de rendez-vous — TabibNet', message);
  } else {
    await provider.sendSms(to, message);
  }
}
