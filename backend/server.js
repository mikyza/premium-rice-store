/**
 * ====================================================================================
 * PREMIUM RICE & GRAIN STORE - UNIFIED BACKEND ENTERPRISE ARCHITECTURE
 * ====================================================================================
 * System: Mwea Rice Hub Enterprise API Engine
 * Version: 3.6.0-ENTERPRISE-RENDER-VERCEL
 * Platform: Node.js / Express / Socket.IO / Sequelize ORM / PayHero API / Nodemailer
 * Deployment: Render Cloud Infrastructure OR Vercel Serverless (auto-detected via process.env.VERCEL)
 * 
 * Description:
 * Complete, single-file server engine handling real-time WebSocket state synchronization,
 * dynamic location logistics hierarchies (loaded directly from kenya_locations.json),
 * full-stack shopping cart management, M-Pesa STK push & webhooks via PayHero,
 * administrative analytics, account creation OTP verification, password reset OTP,
 * email verification via Nodemailer SMTP, and dynamic hero carousel settings.
 * ====================================================================================
 */

import dns from 'dns';
// Enforce IPv4 lookup resolution order for consistent DNS resolution on cloud environments like Render
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Sequelize, DataTypes, Op } from 'sequelize';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import zlib from 'zlib';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Payment & Webhook Controller Integrations
import { handlePayHeroWebhook } from './controllers/webhookController.js';
import { initiatePayHeroPayment } from './controllers/paymentController.js';

// Initialize environment variables from .env file
dotenv.config();

// Never let a stray async error kill the process: a dead process = Render 502 = browser reports a CORS error.
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err && err.stack ? err.stack : err);
});

/**
 * ==========================================
 * 0. SYSTEM INITIALIZATION, PATHS & CONSTANTS
 * ==========================================
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
// Always bind all interfaces: Render auto-sets HOSTNAME to the container name, which makes the proxy return 502.
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '5000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_RICE_GRAIN_STORE_KEY_2026';
// Vercel serverless detection (Vercel sets VERCEL=1 automatically)
const IS_VERCEL = !!process.env.VERCEL;
const RENDER_BASE_URL = process.env.BASE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
  || 'https://premium-rice-store-7.onrender.com';

console.log('====================================================================');
console.log('🚀 Booting Mwea Rice Hub Enterprise Architecture...');
console.log(`🌍 Environment: ${NODE_ENV.toUpperCase()}`);
console.log(`⚡ Execution Directory: ${__dirname}`);
console.log(`📡 Base Deployment Target URL: ${RENDER_BASE_URL}`);
console.log(`☁️ Runtime: ${IS_VERCEL ? 'VERCEL SERVERLESS' : 'PERSISTENT NODE SERVER'}`);

if (isProduction && !process.env.JWT_SECRET) {
  console.warn('⚠️ WARNING: JWT_SECRET env var is not set. Using the built-in default secret is unsafe in production.');
}
console.log('====================================================================');

/**
 * Built-in copy of all 47 counties and their 290 constituencies (IEBC).
 * Used automatically if kenya_locations.json is missing or unreadable on the host,
 * so the location hierarchy can never come up empty in production.
 */
const KENYA_LOCATIONS_FALLBACK = {
  "Baringo": [
    "Baringo Central",
    "Baringo North",
    "Baringo South",
    "Eldama Ravine",
    "Mogotio",
    "Tiaty"
  ],
  "Bomet": [
    "Bomet Central",
    "Bomet East",
    "Chepalungu",
    "Konoin",
    "Sotik"
  ],
  "Bungoma": [
    "Bumula",
    "Kabuchai",
    "Kanduyi",
    "Kimilili",
    "Mt. Elgon",
    "Sirisia",
    "Tongaren",
    "Webuye East",
    "Webuye West"
  ],
  "Busia": [
    "Budalangi",
    "Butula",
    "Funyula",
    "Matayos",
    "Nambale",
    "Teso North",
    "Teso South"
  ],
  "Elgeyo-Marakwet": [
    "Keiyo North",
    "Keiyo South",
    "Marakwet East",
    "Marakwet West"
  ],
  "Embu": [
    "Manyatta",
    "Mbeere North",
    "Mbeere South",
    "Runyenjes"
  ],
  "Garissa": [
    "Balambala",
    "Dadaab",
    "Fafi",
    "Garissa Township",
    "Ijara",
    "Lagdera"
  ],
  "Homa Bay": [
    "Homa Bay Town",
    "Kabondo Kasipul",
    "Karachuonyo",
    "Kasipul",
    "Ndhiwa",
    "Rangwe",
    "Suba North",
    "Suba South"
  ],
  "Isiolo": [
    "Isiolo North",
    "Isiolo South"
  ],
  "Kajiado": [
    "Kajiado Central",
    "Kajiado East",
    "Kajiado North",
    "Kajiado South",
    "Kajiado West"
  ],
  "Kakamega": [
    "Butere",
    "Ikolomani",
    "Khwisero",
    "Likuyani",
    "Lugari",
    "Lurambi",
    "Malava",
    "Matungu",
    "Mumias East",
    "Mumias West",
    "Navakholo",
    "Shinyalu"
  ],
  "Kericho": [
    "Ainamoi",
    "Belgut",
    "Bureti",
    "Kipkelion East",
    "Kipkelion West",
    "Sigowet/Soin"
  ],
  "Kiambu": [
    "Gatundu North",
    "Gatundu South",
    "Githunguri",
    "Juja",
    "Kabete",
    "Kiambaa",
    "Kiambu",
    "Kikuyu",
    "Lari",
    "Limuru",
    "Ruiru",
    "Thika Town"
  ],
  "Kilifi": [
    "Ganze",
    "Kaloleni",
    "Kilifi North",
    "Kilifi South",
    "Magarini",
    "Malindi",
    "Rabai"
  ],
  "Kirinyaga": [
    "Gichugu",
    "Kirinyaga Central",
    "Mwea",
    "Ndia"
  ],
  "Kisii": [
    "Bobasi",
    "Bomachoge Borabu",
    "Bomachoge Chache",
    "Bonchari",
    "Kitutu Chache North",
    "Kitutu Chache South",
    "Nyaribari Chache",
    "Nyaribari Masaba",
    "South Mugirango"
  ],
  "Kisumu": [
    "Kisumu Central",
    "Kisumu East",
    "Kisumu West",
    "Muhoroni",
    "Nyakach",
    "Nyando",
    "Seme"
  ],
  "Kitui": [
    "Kitui Central",
    "Kitui East",
    "Kitui Rural",
    "Kitui South",
    "Kitui West",
    "Mwingi Central",
    "Mwingi North",
    "Mwingi West"
  ],
  "Kwale": [
    "Kinango",
    "Lunga Lunga",
    "Matuga",
    "Msambweni"
  ],
  "Laikipia": [
    "Laikipia East",
    "Laikipia North",
    "Laikipia West"
  ],
  "Lamu": [
    "Lamu East",
    "Lamu West"
  ],
  "Machakos": [
    "Kangundo",
    "Kathiani",
    "Machakos Town",
    "Masinga",
    "Matungulu",
    "Mavoko",
    "Mwala",
    "Yatta"
  ],
  "Makueni": [
    "Kaiti",
    "Kibwezi East",
    "Kibwezi West",
    "Kilome",
    "Makueni",
    "Mbooni"
  ],
  "Mandera": [
    "Banissa",
    "Lafey",
    "Mandera East",
    "Mandera North",
    "Mandera South",
    "Mandera West"
  ],
  "Marsabit": [
    "Laisamis",
    "Moyale",
    "North Horr",
    "Saku"
  ],
  "Meru": [
    "Buuri",
    "Central Imenti",
    "Igembe Central",
    "Igembe North",
    "Igembe South",
    "North Imenti",
    "South Imenti",
    "Tigania East",
    "Tigania West"
  ],
  "Migori": [
    "Awendo",
    "Kuria East",
    "Kuria West",
    "Nyatike",
    "Rongo",
    "Suna East",
    "Suna West",
    "Uriri"
  ],
  "Mombasa": [
    "Changamwe",
    "Jomvu",
    "Kisauni",
    "Likoni",
    "Mvita",
    "Nyali"
  ],
  "Murang'a": [
    "Gatanga",
    "Kandara",
    "Kangema",
    "Kigumo",
    "Kiharu",
    "Maragwa",
    "Mathioya"
  ],
  "Nairobi": [
    "Dagoretti North",
    "Dagoretti South",
    "Embakasi Central",
    "Embakasi East",
    "Embakasi North",
    "Embakasi South",
    "Embakasi West",
    "Kamukunji",
    "Kasarani",
    "Kibra",
    "Langata",
    "Makadara",
    "Mathare",
    "Roysambu",
    "Ruaraka",
    "Starehe",
    "Westlands"
  ],
  "Nakuru": [
    "Bahati",
    "Gilgil",
    "Kuresoi North",
    "Kuresoi South",
    "Molo",
    "Naivasha",
    "Nakuru Town East",
    "Nakuru Town West",
    "Njoro",
    "Rongai",
    "Subukia"
  ],
  "Nandi": [
    "Aldai",
    "Chesumei",
    "Emgwen",
    "Mosop",
    "Nandi Hills",
    "Tinderet"
  ],
  "Narok": [
    "Emurua Dikirr",
    "Kilgoris",
    "Narok East",
    "Narok North",
    "Narok South",
    "Narok West"
  ],
  "Nyamira": [
    "Borabu",
    "Kitutu Masaba",
    "North Mugirango",
    "West Mugirango"
  ],
  "Nyandarua": [
    "Kinangop",
    "Kipipiri",
    "Ndaragwa",
    "Ol Jorok",
    "Ol Kalou"
  ],
  "Nyeri": [
    "Kieni",
    "Mathira",
    "Mukurweini",
    "Nyeri Town",
    "Othaya",
    "Tetu"
  ],
  "Samburu": [
    "Samburu East",
    "Samburu North",
    "Samburu West"
  ],
  "Siaya": [
    "Alego Usonga",
    "Bondo",
    "Gem",
    "Rarieda",
    "Ugenya",
    "Ugunja"
  ],
  "Taita Taveta": [
    "Mwatate",
    "Taveta",
    "Voi",
    "Wundanyi"
  ],
  "Tana River": [
    "Bura",
    "Galole",
    "Garsen"
  ],
  "Tharaka-Nithi": [
    "Chuka/Igambang'ombe",
    "Maara",
    "Tharaka"
  ],
  "Trans Nzoia": [
    "Cherangany",
    "Endebess",
    "Kiminini",
    "Kwanza",
    "Saboti"
  ],
  "Turkana": [
    "Loima",
    "Turkana Central",
    "Turkana East",
    "Turkana North",
    "Turkana South",
    "Turkana West"
  ],
  "Uasin Gishu": [
    "Ainabkoi",
    "Kapseret",
    "Kesses",
    "Moiben",
    "Soy",
    "Turbo"
  ],
  "Vihiga": [
    "Emuhaya",
    "Hamisi",
    "Luanda",
    "Sabatia",
    "Vihiga"
  ],
  "Wajir": [
    "Eldas",
    "Tarbaj",
    "Wajir East",
    "Wajir North",
    "Wajir South",
    "Wajir West"
  ],
  "West Pokot": [
    "Kacheliba",
    "Kapenguria",
    "Pokot South",
    "Sigor"
  ]
};

/** Default regional transport charge per county (admins can edit these in the database). */
const defaultCountyFees = (tree) => {
  const fees = {};
  Object.keys(tree).forEach((countyName) => {
    const lowerName = countyName.toLowerCase();
    if (lowerName.includes('nairobi') || lowerName.includes('kirinyaga') || lowerName.includes('kiambu')) {
      fees[countyName] = 200;
    } else if (lowerName.includes('mombasa') || lowerName.includes('kwale') || lowerName.includes('kilifi')) {
      fees[countyName] = 500;
    } else if (lowerName.includes('mandera') || lowerName.includes('wajir') || lowerName.includes('turkana')) {
      fees[countyName] = 800;
    } else {
      fees[countyName] = 350;
    }
  });
  return fees;
};

/**
 * Matches a customer-typed place name to the official spelling, ignoring case, spaces,
 * hyphens, apostrophes and a trailing "County" ("murang a county" -> "Murang'a").
 * Returns the canonical name from `candidates`, or null when nothing matches.
 */
const resolveLocationName = (input, candidates) => {
  const norm = (v) => String(v || '').toLowerCase().replace(/\bcounty\b/g, '').replace(/[^a-z0-9]/g, '');
  const wanted = norm(input);
  if (!wanted || !Array.isArray(candidates)) return null;
  return candidates.find((c) => norm(c) === wanted) || null;
};

/**
 * ==========================================
 * DYNAMIC KENYA LOCATIONS LOADER UTILITY
 * ==========================================
 * Safely reads and parses 'kenya_locations.json' generated by convert.js.
 * Eliminates hardcoded location literals while providing safe fallbacks.
 */
function loadKenyaLocationsDataset() {
  const primaryLocationsPath = path.join(__dirname, 'kenya_locations.json');
  const secondaryLocationsPath = path.join(__dirname, 'public', 'kenya_locations.json');
  
  let selectedPath = null;
  if (fs.existsSync(primaryLocationsPath)) {
    selectedPath = primaryLocationsPath;
  } else if (fs.existsSync(secondaryLocationsPath)) {
    selectedPath = secondaryLocationsPath;
  }

  let rawJsonData = null;
  let countyOverrides = {};
  let logisticsHierarchy = {};

  if (selectedPath) {
    try {
      console.log(`📂 Reading Kenya locations dataset directly from: ${selectedPath}`);
      const fileBuffer = fs.readFileSync(selectedPath, 'utf8');
      rawJsonData = JSON.parse(fileBuffer);

      // Structure check: Handles both formatted { counties, hierarchy } and nested county trees
      if (rawJsonData && typeof rawJsonData === 'object') {
        if (rawJsonData.counties && rawJsonData.hierarchy) {
          countyOverrides = rawJsonData.counties;
          logisticsHierarchy = rawJsonData.hierarchy;
        } else if (rawJsonData.counties && !rawJsonData.hierarchy) {
          countyOverrides = rawJsonData.counties;
          logisticsHierarchy = rawJsonData;
        } else {
          // Build hierarchy and county fee map dynamically from top-level keys
          logisticsHierarchy = rawJsonData;
          countyOverrides = defaultCountyFees(rawJsonData);
        }
        console.log(`✅ Successfully loaded location dataset. Total Counties Identified: ${Object.keys(countyOverrides).length}`);
      }
    } catch (readErr) {
      console.error(`❌ Failed to parse kenya_locations.json dataset: ${readErr.message}`);
    }
  } else {
    console.warn('⚠️ WARNING: kenya_locations.json was not found on disk. Initializing basic empty location structures.');
  }

  if (!Object.keys(countyOverrides).length) {
    console.warn('⚠️ Using the built-in Kenya locations dataset (47 counties, 290 constituencies).');
    rawJsonData = KENYA_LOCATIONS_FALLBACK;
    logisticsHierarchy = KENYA_LOCATIONS_FALLBACK;
    countyOverrides = defaultCountyFees(KENYA_LOCATIONS_FALLBACK);
  }

  return { countyOverrides, logisticsHierarchy, rawJsonData };
}

/**
 * ==========================================
 * EMAIL CONFIGURATION (Nodemailer SMTP Transporter)
 * ==========================================
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for 587 / submit
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  tls: {
    rejectUnauthorized: false // Tolerant TLS handshake for cloud hosting environments
  }
});

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@mwearicehub.com';
const SENDER_NAME = 'Mwea Rice Hub Enterprise';

/**
 * Helper function to send email OTP via Nodemailer for Account Creation & Password Reset
 * @param {string} toEmail 
 * @param {string} toName 
 * @param {string} otpCode 
 * @param {string} type - 'reset' | 'signup' | 'account_creation'
 */
const sendOtpEmail = async (toEmail, toName, otpCode, type = 'reset') => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ WARNING: SMTP Email credentials (EMAIL_USER / EMAIL_PASS) are missing in environment variables.');
  }

  const isSignup = type === 'signup' || type === 'account_creation';
  const isAdminLogin = type === 'admin_login';
  const subject = isAdminLogin ? '🔐 Your Admin Sign-in Code - Mwea Rice Hub' : isSignup 
    ? '🔐 Account Verification OTP Code - Mwea Rice Hub' 
    : '🔐 Your Password Reset OTP Code - Mwea Rice Hub';
  const title = isAdminLogin ? 'Admin Sign-in Verification' : isSignup ? 'Account Verification' : 'Password Reset Request';
  const description = isAdminLogin
    ? 'Someone just entered your admin password. To finish signing in, use this 6-digit code. If this was not you, change your password immediately:'
    : isSignup
    ? 'Thank you for signing up with Mwea Rice Hub. Please use the following 6-digit One-Time Password (OTP) to verify and activate your new account:'
    : 'You recently requested to reset your password for your Mwea Rice Hub account. Please use the following 6-digit One-Time Password (OTP) to verify your request:';

  const mailOptions = {
    from: `"${SENDER_NAME}" <${EMAIL_FROM}>`,
    to: toEmail,
    subject: subject,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 28px; color: #2c3e50; max-width: 620px; margin: auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #2e7d32; margin: 0; font-size: 26px; font-weight: 700;">🌾 Mwea Rice Hub</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Direct From Mwea Paddy Fields to Your Doorstep</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">${title}</h2>
        <p style="font-size: 15px; line-height: 1.6;">Hello <strong>${toName || 'Valued Customer'}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6;">${description}</p>
        <div style="background: #f0fdf4; border: 2px dashed #22c55e; color: #15803d; font-size: 36px; font-weight: 800; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 24px 0;">
          ${otpCode}
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">This verification code is strictly valid for <strong>10 minutes</strong>. If you did not initiate this request, please secure your account or disregard this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">&copy; ${new Date().getFullYear()} Mwea Rice Hub Kenya. All Rights Reserved.</p>
      </div>
    `
  };

  return await transporter.sendMail(mailOptions);
};

/**
 * Normalizes any Kenyan phone format (0712..., 0112..., 712..., +254712..., 254712...) to 254XXXXXXXXX.
 * Returns null when the value is not a valid Kenyan mobile number (or is an email address).
 */
const normalizeKenyanPhone = (raw) => {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  if (!str || str.includes('@')) return null;
  let digits = str.replace(/\D/g, '');
  if (digits.startsWith('2540') && digits.length === 13) digits = `254${digits.slice(4)}`;
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return `254${digits}`;
  return null;
};

/** All common spellings of one phone number, so lookups match however the account was originally saved. */
const phoneVariants = (raw) => {
  const normalized = normalizeKenyanPhone(raw);
  if (!normalized) return raw ? [String(raw).trim()] : [];
  const local = normalized.slice(3);
  return Array.from(new Set([normalized, `0${local}`, `+${normalized}`, local]));
};

/**
 * The frontend login box is a single "phone or email" field, so the same text can arrive in both
 * `phoneNumber` and `email`. This splits it into a real email and/or a real normalized phone.
 */
const splitIdentity = (body = {}) => {
  const candidates = [body.email, body.phoneNumber, body.phone, body.identifier]
    .map((v) => (v === undefined || v === null ? '' : String(v).trim()))
    .filter(Boolean);
  let email = null;
  let phone = null;
  for (const c of candidates) {
    if (c.includes('@')) {
      if (!email) email = c;
    } else if (!phone) {
      phone = normalizeKenyanPhone(c);
    }
  }
  return { email, phone };
};

/**
 * Signup OTP issuing: if the person still has an unexpired code (more than a minute left),
 * re-send that SAME code instead of replacing it. This stops the "older SMS stops working
 * after Resend" problem, since every message they received stays valid until it expires.
 */
const issueSignupOtp = (user) => {
  const stillValid = user && user.verificationOtp && user.verificationOtpExpires
    && new Date(user.verificationOtpExpires).getTime() > Date.now() + 60 * 1000;
  if (stillValid) {
    return { otpCode: String(user.verificationOtp), tokenExpiration: new Date(user.verificationOtpExpires) };
  }
  return {
    otpCode: Math.floor(100000 + Math.random() * 900000).toString(),
    tokenExpiration: new Date(Date.now() + 10 * 60 * 1000)
  };
};

/** Sequelize OR-conditions matching an email or any spelling of a phone number. */
const identityConditions = (identifier) => {
  const value = String(identifier || '').trim();
  if (!value) return [];
  if (value.includes('@')) return [{ email: value }];
  return phoneVariants(value).map((p) => ({ phoneNumber: p }));
};

/**
 * Helper function to send SMS OTP via the Ping Africa gateway.
 * Returns true ONLY when the gateway confirms acceptance (HTTP 2xx and no error flag in the body).
 * Required env: PING_AFRICA_API_TOKEN. Optional: PING_AFRICA_API_URL, PING_AFRICA_SENDER_ID.
 * @param {string} phoneNumber 
 * @param {string} otpCode 
 * @param {string} type - 'reset' | 'signup'
 */
const sendOtpSms = async (phoneNumber, otpCode, type = 'reset') => {
  try {
    const formattedPhone = normalizeKenyanPhone(phoneNumber);
    if (!formattedPhone) {
      console.warn(`⚠️ [SMS] Skipped: "${phoneNumber}" is not a valid Kenyan mobile number.`);
      return false;
    }
    if (!process.env.PING_AFRICA_API_TOKEN) {
      console.error('❌ [SMS] PING_AFRICA_API_TOKEN is not set in the environment variables.');
      return false;
    }

    const message = type === 'signup' 
      ? `Your Mwea Rice Hub account verification OTP is ${otpCode}. Valid for 10 mins.`
      : type === 'admin_login'
        ? `Your Mwea Rice Hub admin sign-in code is ${otpCode}. Valid for 5 mins. If this was not you, change your password now.`
        : `Your Mwea Rice Hub password reset OTP is ${otpCode}. Valid for 10 mins.`;

    console.log(`📱 [SMS DISPATCH] Triggering SMS to ${formattedPhone} (type: ${type})`);

    const sendUrl = process.env.PING_AFRICA_API_URL || 'https://bulk.ping.africa/api/v1/sms/send';

    // Ping Africa uses Bearer-token auth with a JSON body.
    const payload = {
      recipient: formattedPhone,
      message,
    };
    if (process.env.PING_AFRICA_SENDER_ID) payload.sender_id = process.env.PING_AFRICA_SENDER_ID;

    const response = await axios.post(sendUrl, payload, {
      headers: {
        Authorization: `Bearer ${process.env.PING_AFRICA_API_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      timeout: 15000
    });

    let data = response.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (_) { /* plain-text reply */ }
    }
    console.log('📨 [PING AFRICA RESPONSE]:', typeof data === 'string' ? data : JSON.stringify(data));
    noteSmsBalance(data);

    if (data && typeof data === 'object') {
      const status = String(data.status || '').toLowerCase();
      if (data.success === false || data.error || ['error', 'failed', 'fail', 'rejected'].includes(status)) {
        console.error(`❌ [SMS] Ping Africa rejected the message: ${data.message || data.error || status}`);
        return false;
      }
      return true;
    }
    if (typeof data === 'string' && /(error|fail|invalid|denied|insufficient|unauthori)/i.test(data)) {
      console.error('❌ [SMS] Ping Africa returned an error response.');
      return false;
    }
    return true;

  } catch (error) {
    console.error(`❌ Failed to send SMS OTP to ${phoneNumber}:`, error.response?.data || error.message);
    return false;
  }
};

/**
 * Sends the OTP on every channel the account has (email + SMS) in parallel.
 * A failing channel (e.g. SMTP blocked on the host) can no longer stop the other one or crash the request.
 */
const dispatchOtp = async (user, otpCode, type = 'reset') => {
  const hasEmail = !!user.email && String(user.email).includes('@');
  const hasPhone = !!normalizeKenyanPhone(user.phoneNumber);
  const [emailResult, smsResult] = await Promise.allSettled([
    hasEmail ? sendOtpEmail(user.email, user.fullName, otpCode, type) : Promise.resolve(false),
    hasPhone ? sendOtpSms(user.phoneNumber, otpCode, type) : Promise.resolve(false)
  ]);
  if (emailResult.status === 'rejected') {
    console.error(`❌ [EMAIL] OTP email to ${user.email} failed:`, emailResult.reason && emailResult.reason.message);
  }
  if (smsResult.status === 'rejected') {
    console.error(`❌ [SMS] OTP SMS to ${user.phoneNumber} failed:`, smsResult.reason && smsResult.reason.message);
  }
  const emailSent = emailResult.status === 'fulfilled' && !!emailResult.value;
  const smsSent = smsResult.status === 'fulfilled' && !!smsResult.value;
  return { emailSent, smsSent, anySent: emailSent || smsSent };
};

const OTP_DELIVERY_FAILED_MESSAGE = 'We could not deliver the verification code right now. Please check your phone number or email and try again.';

/**
 * Helper function to retrieve and construct PayHero Basic Auth Headers cleanly
 */
const getPayHeroAuthHeader = () => {
  if (process.env.PAYHERO_BASIC_AUTH) {
    const cleanAuth = process.env.PAYHERO_BASIC_AUTH.replace(/[\r\n]+/g, '').trim();
    return cleanAuth.startsWith('Basic ') ? cleanAuth : `Basic ${cleanAuth.replace(/^Basic/i, '').trim()}`;
  }
  if (process.env.PAYHERO_API_KEY && process.env.PAYHERO_API_SECRET) {
    const creds = `${process.env.PAYHERO_API_KEY.trim()}:${process.env.PAYHERO_API_SECRET.trim()}`;
    return `Basic ${Buffer.from(creds).toString('base64')}`;
  }
  // SECURITY: the previously hard-coded fallback credential was removed from source code.
  // Set PAYHERO_BASIC_AUTH (or PAYHERO_API_KEY + PAYHERO_API_SECRET) in your environment variables.
  console.warn('⚠️ WARNING: PayHero credentials are missing. Set PAYHERO_BASIC_AUTH or PAYHERO_API_KEY/PAYHERO_API_SECRET.');
  return '';
};

const PAYHERO_CHANNEL_ID = Number(process.env.PAYHERO_CHANNEL_ID || 11668);

/**
 * ==========================================
 * 1. UPLOAD DIRECTORY & ASSET CONFIGURATION
 * ==========================================
 */
const uploadDir = path.join(__dirname, 'public', 'uploads');
const imagesDir = path.join(__dirname, 'public', 'images');

// Vercel's filesystem is read-only (except /tmp) so folders are only created on persistent hosts.
if (!IS_VERCEL) {
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('📁 Created missing upload directory at:', uploadDir);
    }

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log('📁 Created missing images directory at:', imagesDir);
    }
  } catch (fsErr) {
    console.error('❌ Failed to verify or build static public storage directories:', fsErr.message);
  }
}

// Multer Storage Configuration for File Uploads
// - Persistent hosts (Render/local): files are written to public/uploads (original behaviour).
// - Vercel: files are kept in memory, then pushed to Vercel Blob (see persistUploadedFile).
const storage = IS_VERCEL
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      filename: (req, file, cb) => {
        const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${Date.now()}-${cleanFileName}`);
      }
    });

const upload = multer({ 
  storage,
  // Vercel functions reject request bodies larger than ~4.5MB, so cap slightly below that there.
  limits: { fileSize: (IS_VERCEL ? 4 : 15) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only valid image files are permitted for upload.'), false);
    }
  }
});

/**
 * Returns the public URL for an uploaded image.
 * On Vercel the image is stored in Vercel Blob (needs BLOB_READ_WRITE_TOKEN);
 * without that token it falls back to an inline data URL so uploads still work.
 */
async function persistUploadedFile(file) {
  if (!IS_VERCEL) {
    return `/uploads/${file.filename}`;
  }
  const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`uploads/${Date.now()}-${cleanFileName}`, file.buffer, {
      access: 'public',
      contentType: file.mimetype
    });
    return blob.url;
  }
  console.warn('⚠️ BLOB_READ_WRITE_TOKEN missing: returning inline data URL for uploaded image.');
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

/**
 * ==========================================
 * 2. DATABASE SCHEMAS, MODELS & ASSOCIATIONS
 * ==========================================
 */
import { 
  User, 
  RiceProduct, 
  Order, 
  Review, 
  AdminLog, 
  SystemConfig, 
  sequelize 
} from './lib/db.js';

// User Persistent Shopping Cart Database Model Definition
const Cart = sequelize.models.Cart || sequelize.define('Cart', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: RiceProduct,
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
    validate: {
      min: 1
    }
  }
}, {
  timestamps: true,
  tableName: 'Carts'
});

// Define Relational Model Associations
if (Cart && RiceProduct && !Cart.associations.product) {
  Cart.belongsTo(RiceProduct, { foreignKey: 'productId', as: 'product', onDelete: 'CASCADE' });
}
if (Cart && User && !Cart.associations.user) {
  Cart.belongsTo(User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
}

/**
 * ==========================================
 * 3. LIVE FLASH HARVEST SALE ENGINE UTILS
 * ==========================================
 */
let flashSaleState = {
  active: false,
  endTime: null,
  countdownIntervalId: null
};

// LIKE operator: case-insensitive on Postgres (Aiven), plain LIKE elsewhere
const LIKE_OP = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;

/**
 * ==========================================
 * 2b. STAFF ROLES, AGENTS, COMMISSIONS & ACTIVITY TRACKING
 * ==========================================
 * These tables are separate from Users so existing accounts and the Users.role column are never altered.
 * Effective role = admin (Users.role) | support | agent (StaffRole) | customer.
 */
const defineModel = (name, attrs, opts = {}) => sequelize.models[name] || sequelize.define(name, attrs, { timestamps: true, ...opts });

const StaffRole = defineModel('StaffRole', {
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'none' }, // 'support' | 'agent' | 'none'
  referralCode: { type: DataTypes.STRING(20), allowNull: true, unique: true },
  assignedBy: { type: DataTypes.INTEGER, allowNull: true },
  note: { type: DataTypes.STRING(255), allowNull: true },
  dismissedAt: { type: DataTypes.DATE, allowNull: true }
});

const CustomerReferral = defineModel('CustomerReferral', {
  customerId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  agentId: { type: DataTypes.INTEGER, allowNull: false },
  referralCode: { type: DataTypes.STRING(20), allowNull: false },
  source: { type: DataTypes.STRING(20), allowNull: true }
});

const AgentCommission = defineModel('AgentCommission', {
  agentId: { type: DataTypes.INTEGER, allowNull: false },
  orderId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  customerId: { type: DataTypes.INTEGER, allowNull: false },
  orderTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  orderProfit: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  rate: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'REPEAT' }, // NEW_CUSTOMER | REPEAT
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' }, // PENDING | PAID | NO_PROFIT | REVERSED | CLAWBACK_DUE
  payoutId: { type: DataTypes.INTEGER, allowNull: true },
  note: { type: DataTypes.STRING(255), allowNull: true },
  paidAt: { type: DataTypes.DATE, allowNull: true }
});

const AgentPayout = defineModel('AgentPayout', {
  agentId: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  method: { type: DataTypes.STRING(40), allowNull: true },
  reference: { type: DataTypes.STRING(120), allowNull: false },
  note: { type: DataTypes.STRING(255), allowNull: true },
  paidBy: { type: DataTypes.INTEGER, allowNull: true },
  commissionCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
});

const ActivityEvent = defineModel('ActivityEvent', {
  actorId: { type: DataTypes.INTEGER, allowNull: true },
  actorRole: { type: DataTypes.STRING(20), allowNull: true },
  actorName: { type: DataTypes.STRING(120), allowNull: true },
  action: { type: DataTypes.STRING(60), allowNull: false },
  category: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'system' },
  severity: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'info' }, // info | warn | alert
  targetType: { type: DataTypes.STRING(30), allowNull: true },
  targetId: { type: DataTypes.STRING(40), allowNull: true },
  summary: { type: DataTypes.STRING(500), allowNull: true },
  details: { type: DataTypes.JSON, allowNull: true },
  ipAddress: { type: DataTypes.STRING(64), allowNull: true }
}, { indexes: [{ fields: ['createdAt'] }, { fields: ['action'] }, { fields: ['actorId'] }] });

const SupportNote = defineModel('SupportNote', {
  customerId: { type: DataTypes.INTEGER, allowNull: false },
  authorId: { type: DataTypes.INTEGER, allowNull: false },
  authorName: { type: DataTypes.STRING(120), allowNull: true },
  note: { type: DataTypes.TEXT, allowNull: false }
});

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const STAFF_ROLES = ['support', 'agent'];

/** admin | support | agent | <whatever Users.role holds, usually customer> */
async function effectiveRoleFor(user) {
  if (!user) return 'customer';
  if (user.role === 'admin') return 'admin';
  try {
    const row = await StaffRole.findOne({ where: { userId: user.id } });
    if (row && STAFF_ROLES.includes(row.role)) return row.role;
  } catch (e) { /* table not created yet */ }
  return user.role || 'customer';
}

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied for your account type.' });
  }
  next();
};

/** One place to record everything that happens. Never throws. */
async function logEvent({ req = null, actor = null, action, category = 'system', severity = 'info', targetType = null, targetId = null, summary = '', details = null }) {
  try {
    const a = actor || (req && req.user ? { id: req.user.id, role: req.user.role, name: req.user.fullName } : {});
    const ev = await ActivityEvent.create({
      actorId: a.id ?? null,
      actorRole: a.role || null,
      actorName: a.name ? String(a.name).slice(0, 120) : null,
      action: String(action).slice(0, 60),
      category,
      severity,
      targetType,
      targetId: targetId !== null && targetId !== undefined ? String(targetId).slice(0, 40) : null,
      summary: String(summary || '').slice(0, 500),
      details,
      ipAddress: req && req.ip ? String(req.ip).slice(0, 64) : null
    });
    try { io.to('admin-dashboard-room').emit('activityEvent', ev.toJSON()); } catch (_) { /* sockets optional */ }
    return ev;
  } catch (e) {
    console.error('⚠️ Activity log skipped:', e.message);
    return null;
  }
}

const categorizeAction = (action) => {
  const a = String(action || '').toUpperCase();
  if (/LOGIN|LOGOUT|PASSWORD|SIGNUP|ACCOUNT|OTP/.test(a)) return 'auth';
  if (/COMMISSION|PAYOUT|AGENT|REFERRAL/.test(a)) return 'agents';
  if (/PAYMENT|ORDER|STK/.test(a)) return 'orders';
  if (/PRODUCT|STOCK|BUYING|INVENTORY/.test(a)) return 'inventory';
  if (/USER|ROLE|SUSPEND|SUPPORT|NOTE/.test(a)) return 'users';
  if (/FLASH|CONFIG|HERO|COUNTY|CAROUSEL|SETTING/.test(a)) return 'settings';
  return 'admin';
};

// Every existing AdminLog entry (product edits, order updates, flash sale, ...) is mirrored into the activity feed automatically.
if (AdminLog && !AdminLog.__mirrored) {
  const originalAdminLogCreate = AdminLog.create.bind(AdminLog);
  AdminLog.create = async (entry, ...rest) => {
    const record = await originalAdminLogCreate(entry, ...rest);
    (async () => {
      try {
        const u = entry && entry.adminId ? await User.findByPk(entry.adminId, { attributes: ['id', 'fullName', 'role'] }) : null;
        await logEvent({
          actor: u ? { id: u.id, role: u.role, name: u.fullName } : {},
          action: entry.action,
          category: categorizeAction(entry.action),
          targetType: entry.targetType || null,
          targetId: entry.targetId ?? null,
          summary: `${entry.action}${entry.targetType ? ' · ' + entry.targetType : ''}${entry.targetId !== undefined && entry.targetId !== null ? ' #' + entry.targetId : ''}`,
          details: entry.changes ?? null
        });
      } catch (_) { /* mirror is best-effort */ }
    })();
    return record;
  };
  AdminLog.__mirrored = true;
}

// ---------- Login brute-force protection (in memory) ----------
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 6;
const loginFailures = new Map();
const loginKey = (identifier) => String(identifier || '').toLowerCase().replace(/\s+/g, '');
const loginLockedForMs = (key) => {
  const rec = loginFailures.get(key);
  if (!rec) return 0;
  if (Date.now() - rec.first > LOGIN_WINDOW_MS) { loginFailures.delete(key); return 0; }
  return rec.count >= LOGIN_MAX_FAILS ? Math.max(0, rec.first + LOGIN_WINDOW_MS - Date.now()) : 0;
};
const registerLoginFailure = (key) => {
  const now = Date.now();
  const rec = loginFailures.get(key);
  if (!rec || now - rec.first > LOGIN_WINDOW_MS) { loginFailures.set(key, { count: 1, first: now }); return 1; }
  rec.count += 1;
  return rec.count;
};
setInterval(() => { const now = Date.now(); for (const [k, v] of loginFailures) if (now - v.first > LOGIN_WINDOW_MS) loginFailures.delete(k); }, 10 * 60 * 1000).unref?.();

// ---------- Referral codes ----------
const normalizeReferralCode = (raw) => String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = 'MW';
    for (let i = 0; i < 5; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    const clash = await StaffRole.findOne({ where: { referralCode: code } });
    if (!clash) return code;
  }
  throw new Error('Could not generate a unique referral code. Try again.');
}

const maskPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length < 9) return '—';
  const local = `0${d.slice(-9)}`;
  return `${local.slice(0, 4)}***${local.slice(-3)}`;
};

/** Gives a customer to an agent (once, permanently). Returns { attached, reason?, agentName? } and never throws. */
async function attachReferral(customerId, rawCode, source = 'signup', req = null) {
  try {
    const code = normalizeReferralCode(rawCode);
    if (!code || !customerId) return { attached: false, reason: 'no-code' };
    const already = await CustomerReferral.findOne({ where: { customerId } });
    if (already) return { attached: false, reason: 'already-linked' };
    const staff = await StaffRole.findOne({ where: { referralCode: code, role: 'agent' } });
    if (!staff) return { attached: false, reason: 'invalid-code' };
    if (Number(staff.userId) === Number(customerId)) return { attached: false, reason: 'own-code' };
    const agentUser = await User.findByPk(staff.userId, { attributes: ['id', 'fullName', 'isActive'] });
    if (!agentUser || agentUser.isActive === false) return { attached: false, reason: 'agent-inactive' };
    await CustomerReferral.create({ customerId, agentId: staff.userId, referralCode: code, source });
    await logEvent({
      req,
      actor: req && req.user ? undefined : { id: customerId, role: 'customer', name: null },
      action: 'REFERRAL_ATTACHED', category: 'agents', targetType: 'user', targetId: customerId,
      summary: `Customer #${customerId} linked to agent ${agentUser.fullName} (${code}) via ${source}`,
      details: { agentId: staff.userId, code, source }
    });
    return { attached: true, agentName: agentUser.fullName };
  } catch (e) {
    console.error('⚠️ Referral attach skipped:', e.message);
    return { attached: false, reason: 'error' };
  }
}

// ---------- Commission engine ----------
const COMMISSION_DEFAULTS = { newCustomerRate: 0.6, repeatRate: 0.4 };
const clampRate = (v, fallback) => {
  let n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (n > 1) n = n / 100;
  return n < 0 ? 0 : n > 1 ? 1 : n;
};
async function getCommissionRates() {
  try {
    const row = await SystemConfig.findOne({ where: { key: 'agent_commission' } });
    const v = (row && row.value) || {};
    return {
      newCustomerRate: clampRate(v.newCustomerRate, COMMISSION_DEFAULTS.newCustomerRate),
      repeatRate: clampRate(v.repeatRate, COMMISSION_DEFAULTS.repeatRate)
    };
  } catch (e) {
    return { ...COMMISSION_DEFAULTS };
  }
}

const getOrderItems = (order) => {
  let items = order && order.items;
  if (typeof items === 'string') { try { items = JSON.parse(items); } catch (_) { items = []; } }
  return Array.isArray(items) ? items : [];
};

/** Profit = (price paid - buying price) x quantity over every line. Delivery fees are not profit. */
async function computeOrderProfit(order) {
  const items = getOrderItems(order);
  let revenue = 0, cost = 0, missingCost = false;
  const fallbackIds = items.filter(i => !(Number(i.buyingPrice) > 0)).map(i => i.productId).filter(Boolean);
  const costMap = {};
  if (fallbackIds.length) {
    const prods = await RiceProduct.findAll({ where: { id: fallbackIds }, attributes: ['id', 'buyingPrice'] });
    prods.forEach(p => { costMap[p.id] = Number(p.buyingPrice) || 0; });
  }
  items.forEach((i) => {
    const qty = Number(i.quantity) || 0;
    const price = Number(i.priceAtPurchase) || 0;
    let unitCost = Number(i.buyingPrice);
    if (!(unitCost > 0)) unitCost = costMap[i.productId] || 0;
    if (!(unitCost > 0)) { missingCost = true; unitCost = price; } // unknown cost -> no profit credited for that line
    revenue += price * qty;
    cost += unitCost * qty;
  });
  return { revenue: round2(revenue), cost: round2(cost), profit: Math.max(0, round2(revenue - cost)), missingCost };
}

/** Called once an order is confirmed paid. Safe to call repeatedly. */
async function accrueAgentCommission(order, source = 'payment') {
  try {
    if (!order || !order.paymentDetails || order.paymentDetails.isPaid !== true) return null;
    const existing = await AgentCommission.findOne({ where: { orderId: order.id } });
    if (existing) {
      if (existing.status === 'REVERSED') {
        existing.status = Number(existing.amount) > 0 ? 'PENDING' : 'NO_PROFIT';
        existing.note = 'Reinstated after payment was confirmed again.';
        await existing.save();
        await logEvent({ action: 'COMMISSION_REINSTATED', category: 'agents', targetType: 'order', targetId: order.id, summary: `Commission for order #${order.id} reinstated`, details: { source } });
      }
      return existing;
    }
    const referral = await CustomerReferral.findOne({ where: { customerId: order.userId } });
    if (!referral) return null;
    if (Number(referral.agentId) === Number(order.userId)) return null;

    const staff = await StaffRole.findOne({ where: { userId: referral.agentId } });
    const agentUser = await User.findByPk(referral.agentId, { attributes: ['id', 'fullName', 'isActive'] });
    if (!staff || staff.role !== 'agent' || !agentUser || agentUser.isActive === false) {
      await logEvent({ action: 'COMMISSION_SKIPPED', category: 'agents', severity: 'warn', targetType: 'order', targetId: order.id,
        summary: `No commission for order #${order.id}: agent #${referral.agentId} is not an active agent`, details: { agentId: referral.agentId } });
      return null;
    }

    const earlier = await Order.findAll({ where: { userId: order.userId, id: { [Op.ne]: order.id } }, attributes: ['id', 'paymentDetails'] });
    const hadPaidBefore = earlier.some(o => o.paymentDetails && o.paymentDetails.isPaid === true);
    const isNewCustomer = !hadPaidBefore;

    const rates = await getCommissionRates();
    const rate = isNewCustomer ? rates.newCustomerRate : rates.repeatRate;
    const { profit, missingCost } = await computeOrderProfit(order);
    const amount = round2(profit * rate);

    const row = await AgentCommission.create({
      agentId: referral.agentId,
      orderId: order.id,
      customerId: order.userId,
      orderTotal: Number(order.grandTotal) || 0,
      orderProfit: profit,
      rate,
      amount,
      type: isNewCustomer ? 'NEW_CUSTOMER' : 'REPEAT',
      status: amount > 0 ? 'PENDING' : 'NO_PROFIT',
      note: missingCost ? 'Some items had no buying price, so profit may be understated.' : null
    });
    await logEvent({
      action: 'COMMISSION_EARNED', category: 'agents', targetType: 'order', targetId: order.id,
      summary: `${agentUser.fullName} earned KES ${amount} (${Math.round(rate * 100)}% of KES ${profit} profit, ${isNewCustomer ? 'new customer' : 'repeat order'}) on order #${order.id}`,
      details: { agentId: referral.agentId, customerId: order.userId, profit, rate, amount, source }
    });
    return row;
  } catch (e) {
    console.error('⚠️ Commission accrual failed:', e.message);
    return null;
  }
}

async function reverseAgentCommission(order, reason) {
  try {
    const c = await AgentCommission.findOne({ where: { orderId: order.id } });
    if (!c || c.status === 'REVERSED' || c.status === 'CLAWBACK_DUE') return null;
    const wasPaid = c.status === 'PAID';
    c.status = wasPaid ? 'CLAWBACK_DUE' : 'REVERSED';
    c.note = String(reason || 'Order payment reversed').slice(0, 255);
    await c.save();
    await logEvent({
      action: wasPaid ? 'COMMISSION_CLAWBACK_DUE' : 'COMMISSION_REVERSED', category: 'agents', severity: wasPaid ? 'alert' : 'warn',
      targetType: 'order', targetId: order.id,
      summary: `Commission for order #${order.id} ${wasPaid ? 'was already paid out and must be recovered' : 'reversed'}: ${reason}`,
      details: { agentId: c.agentId, amount: Number(c.amount) }
    });
    return c;
  } catch (e) {
    console.error('⚠️ Commission reversal failed:', e.message);
    return null;
  }
}

/** Runs after any confirmed payment: records it and credits the agent. */
async function onOrderPaid(order, source) {
  await logEvent({
    action: 'PAYMENT_CONFIRMED', category: 'orders', targetType: 'order', targetId: order.id,
    summary: `Order #${order.id} paid (KES ${Number(order.grandTotal) || 0}) via ${source}`,
    details: { receipt: order.paymentDetails && order.paymentDetails.mpesaReceipt, userId: order.userId }
  });
  await accrueAgentCommission(order, source);
}

/** Full numbers for one agent: sales, rice sold, customers, commissions, payouts, monthly trend. */
async function buildAgentSnapshot(agentId, year) {
  const [commissions, referrals, payouts] = await Promise.all([
    AgentCommission.findAll({ where: { agentId }, order: [['createdAt', 'DESC']] }),
    CustomerReferral.findAll({ where: { agentId } }),
    AgentPayout.findAll({ where: { agentId }, order: [['createdAt', 'DESC']] })
  ]);
  const live = commissions.filter(c => c.status !== 'REVERSED');
  const orderIds = live.map(c => c.orderId);
  const orders = orderIds.length ? await Order.findAll({ where: { id: orderIds } }) : [];
  const orderMap = {};
  orders.forEach(o => { orderMap[o.id] = o; });

  const customerIds = referrals.map(r => r.customerId);
  const users = customerIds.length
    ? await User.findAll({ where: { id: customerIds }, attributes: ['id', 'fullName', 'phoneNumber', 'createdAt', 'isVerified', 'isActive'] })
    : [];
  const userMap = {};
  users.forEach(u => { userMap[u.id] = u; });

  const sum = (arr, fn) => round2(arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0));
  const pendingAmount = sum(commissions.filter(c => c.status === 'PENDING'), c => c.amount);
  const paidAmount = sum(commissions.filter(c => c.status === 'PAID'), c => c.amount);
  const clawbackAmount = sum(commissions.filter(c => c.status === 'CLAWBACK_DUE'), c => c.amount);

  let kgSold = 0, salesValue = 0;
  const productMap = {};
  live.forEach((c) => {
    const o = orderMap[c.orderId];
    if (!o) return;
    kgSold += Number(o.totalWeightKg) || 0;
    salesValue += Number(o.subTotal) || 0;
    getOrderItems(o).forEach((i) => {
      const key = String(i.productId || i.name);
      const qty = Number(i.quantity) || 0;
      if (!productMap[key]) productMap[key] = { name: i.name || i.brandName || 'Rice', quantity: 0, kg: 0, revenue: 0 };
      productMap[key].quantity += qty;
      productMap[key].kg += (Number(i.weightKg) || 0) * qty;
      productMap[key].revenue += (Number(i.priceAtPurchase) || 0) * qty;
    });
  });

  const selectedYear = Number(year) || new Date().getFullYear();
  const monthly = Array.from({ length: 12 }, (_, i) => ({ monthIndex: i, month: new Date(2000, i, 1).toLocaleString('en-US', { month: 'short' }), orders: 0, kg: 0, sales: 0, commission: 0 }));
  const years = new Set([new Date().getFullYear()]);
  live.forEach((c) => {
    const d = new Date(c.createdAt);
    years.add(d.getFullYear());
    if (d.getFullYear() !== selectedYear) return;
    const o = orderMap[c.orderId];
    const m = monthly[d.getMonth()];
    m.orders += 1;
    m.kg = round2(m.kg + (o ? Number(o.totalWeightKg) || 0 : 0));
    m.sales = round2(m.sales + (o ? Number(o.subTotal) || 0 : 0));
    m.commission = round2(m.commission + (Number(c.amount) || 0));
  });

  const perCustomer = {};
  live.forEach((c) => {
    const k = c.customerId;
    if (!perCustomer[k]) perCustomer[k] = { orders: 0, spent: 0, commission: 0, lastOrderAt: null };
    const o = orderMap[c.orderId];
    perCustomer[k].orders += 1;
    perCustomer[k].spent += o ? Number(o.subTotal) || 0 : 0;
    perCustomer[k].commission += Number(c.amount) || 0;
    if (!perCustomer[k].lastOrderAt || new Date(c.createdAt) > new Date(perCustomer[k].lastOrderAt)) perCustomer[k].lastOrderAt = c.createdAt;
  });

  const customers = referrals
    .filter(r => userMap[r.customerId] && userMap[r.customerId].isVerified !== false)
    .map((r) => {
      const u = userMap[r.customerId];
      const s = perCustomer[r.customerId] || { orders: 0, spent: 0, commission: 0, lastOrderAt: null };
      return {
        id: u.id, fullName: u.fullName, phone: maskPhone(u.phoneNumber), joinedAt: r.createdAt,
        orders: s.orders, totalSpent: round2(s.spent), commissionEarned: round2(s.commission), lastOrderAt: s.lastOrderAt
      };
    })
    .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));

  const recent = commissions.slice(0, 200).map((c) => {
    const o = orderMap[c.orderId];
    const cu = userMap[c.customerId];
    return {
      id: c.id, orderId: c.orderId, date: c.createdAt, customer: cu ? cu.fullName : `Customer #${c.customerId}`,
      type: c.type, rate: Number(c.rate), orderTotal: Number(c.orderTotal), profit: Number(c.orderProfit), amount: Number(c.amount),
      status: c.status, paidAt: c.paidAt, note: c.note,
      items: o ? getOrderItems(o).map(i => `${i.quantity}× ${i.name || i.brandName}`).join(', ') : ''
    };
  });

  return {
    summary: {
      customers: customers.length,
      orders: live.length,
      newCustomerOrders: live.filter(c => c.type === 'NEW_CUSTOMER').length,
      repeatOrders: live.filter(c => c.type === 'REPEAT').length,
      kgSold: round2(kgSold),
      salesValue: round2(salesValue),
      profitGenerated: sum(live, c => c.orderProfit),
      commissionPending: pendingAmount,
      commissionPaid: paidAmount,
      commissionTotal: round2(pendingAmount + paidAmount),
      clawbackDue: clawbackAmount
    },
    year: selectedYear,
    availableYears: Array.from(years).sort((a, b) => b - a),
    monthly,
    products: Object.values(productMap).map(p => ({ ...p, kg: round2(p.kg), revenue: round2(p.revenue) })).sort((a, b) => b.kg - a.kg),
    customers,
    commissions: recent,
    payouts: payouts.map(p => ({ id: p.id, amount: Number(p.amount), method: p.method, reference: p.reference, note: p.note, commissionCount: p.commissionCount, date: p.createdAt }))
  };
}

/** Staff role assignment shared by every admin screen. Throws errors with a .status for the caller to return. */
const httpError = (status, message) => { const e = new Error(message); e.status = status; return e; };
async function assignStaffRole(req, target, newRole, note) {
  if (!['customer', 'support', 'agent'].includes(newRole)) throw httpError(400, 'Role must be customer, support or agent.');
  if (target.role === 'admin') throw httpError(403, 'Administrator accounts cannot be changed here.');
  if (req && req.user && Number(target.id) === Number(req.user.id)) throw httpError(403, 'You cannot change your own role.');
  if (target.isActive === false && newRole !== 'customer') throw httpError(400, 'Reactivate this account before giving it a staff role.');
  if (target.isVerified === false) throw httpError(400, 'This account has not been verified yet.');

  let row = await StaffRole.findOne({ where: { userId: target.id } });
  const oldRole = row && STAFF_ROLES.includes(row.role) ? row.role : 'customer';
  if (oldRole === newRole) return { changed: false, role: newRole, referralCode: row ? row.referralCode : null };

  if (newRole === 'customer') {
    row.role = 'none';
    row.dismissedAt = new Date();
    row.note = note ? String(note).slice(0, 255) : row.note;
    await row.save();
  } else {
    if (!row) row = await StaffRole.create({ userId: target.id, role: newRole, assignedBy: req && req.user ? req.user.id : null });
    row.role = newRole;
    row.dismissedAt = null;
    row.assignedBy = req && req.user ? req.user.id : row.assignedBy;
    row.note = note ? String(note).slice(0, 255) : row.note;
    if (newRole === 'agent' && !row.referralCode) row.referralCode = await generateUniqueReferralCode();
    await row.save();
  }

  await logEvent({
    req, action: newRole === 'customer' ? (oldRole === 'agent' ? 'AGENT_DISMISSED' : 'STAFF_DISMISSED') : (newRole === 'agent' ? 'AGENT_APPOINTED' : 'SUPPORT_APPOINTED'),
    category: 'users', severity: 'warn', targetType: 'user', targetId: target.id,
    summary: `${target.fullName} (#${target.id}) changed from ${oldRole} to ${newRole}`,
    details: { from: oldRole, to: newRole, referralCode: row ? row.referralCode : null, note: note || null }
  });
  return { changed: true, role: newRole, referralCode: row ? row.referralCode : null };
}

/** Lets old admin forms (which send a role) still work for the new roles. Returns true when it handled the change. */
async function applyRoleChange(req, user, role) {
  if (role === undefined || role === null) return false;
  if (STAFF_ROLES.includes(role)) { await assignStaffRole(req, user, role); return true; }
  const sr = await StaffRole.findOne({ where: { userId: user.id } });
  if (sr && STAFF_ROLES.includes(sr.role) && (role === 'customer' || role === 'user')) { await assignStaffRole(req, user, 'customer'); return true; }
  return false;
}

const TERMS_VERSION = '2026-11';
const TermsAcceptance = defineModel('TermsAcceptance', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  version: { type: DataTypes.STRING(20), allowNull: false },
  ipAddress: { type: DataTypes.STRING(64), allowNull: true }
});
const termsAccepted = (body) => !!body && (body.acceptedTerms === true || body.acceptedTerms === 'true');
const TERMS_REQUIRED_MESSAGE = 'You must read and accept the Terms and Conditions to create an account.';
async function recordTermsAcceptance(userId, req) {
  try {
    const already = await TermsAcceptance.findOne({ where: { userId, version: TERMS_VERSION } });
    if (already) return;
    await TermsAcceptance.create({ userId, version: TERMS_VERSION, ipAddress: req && req.ip ? String(req.ip).slice(0, 64) : null });
    await logEvent({ req, actor: { id: userId, role: 'customer', name: null }, action: 'TERMS_ACCEPTED', category: 'auth', targetType: 'user', targetId: userId,
      summary: `User #${userId} accepted Terms and Conditions version ${TERMS_VERSION}` });
  } catch (e) { console.error('⚠️ Terms record skipped:', e.message); }
}

/** Minimum 8 characters; weak-but-long passwords are allowed (the app only advises). bcrypt ignores bytes past 72, so cap there. */
const validateNewPassword = (pw) => {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters long.';
  if (Buffer.byteLength(pw, 'utf8') > 72) return 'Password is too long (maximum 72 characters).';
  return null;
};

// Wrong OTP guesses per account: after 5, the code is thrown away so a 6-digit code cannot be brute-forced.
const OTP_MAX_WRONG = 5;
const otpWrongGuesses = new Map();

/** Looks a payment up on PayHero (read only). Never throws. */
async function lookupPayHeroStatus(orderId) {
  try {
    const response = await axios.get(
      `https://backend.payhero.co.ke/api/v2/payments?external_reference=ORD-${orderId}`,
      { headers: { 'Authorization': getPayHeroAuthHeader() }, timeout: 15000 }
    );
    const data = response.data;
    const p = Array.isArray(data) ? data[0] : (data && (data.response || data));
    if (!p) return { reachable: true, status: 'NOT_FOUND' };
    return {
      reachable: true,
      status: String(p.status || p.Status || 'UNKNOWN').toUpperCase(),
      amount: p.amount !== undefined ? Number(p.amount) : null,
      receipt: p.provider_reference || p.mpesa_receipt_number || p.MpesaReceiptNumber || p.receipt_number || null,
      failureReason: p.failure_reason || p.message || p.ResultDesc || null
    };
  } catch (e) {
    return { reachable: false, status: null, error: e.message };
  }
}

/** Looks the payment up on PayHero itself, so a forged callback cannot mark an order paid. */
async function verifyPayHeroPayment(orderId) {
  const r = await lookupPayHeroStatus(orderId);
  return r.reachable && (r.status === 'SUCCESS' || r.status === 'PAID');
}

/**
 * ==========================================
 * 2c. OPERATIONS LAYER: settings, permissions, suppliers & purchases, expenses, reviews,
 *     wholesale pricing, campaigns, reports, Excel export, SMS credit, background jobs
 * ==========================================
 */
const Supplier = defineModel('Supplier', {
  name: { type: DataTypes.STRING(120), allowNull: false },
  phone: { type: DataTypes.STRING(40), allowNull: true },
  location: { type: DataTypes.STRING(120), allowNull: true },
  type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'farmer' }, // farmer | miller | transporter | other
  notes: { type: DataTypes.STRING(500), allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
});

const Purchase = defineModel('Purchase', {
  supplierId: { type: DataTypes.INTEGER, allowNull: true },
  productId: { type: DataTypes.INTEGER, allowNull: true },
  itemName: { type: DataTypes.STRING(160), allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  unitCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  totalCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  amountPaid: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  paymentMethod: { type: DataTypes.STRING(30), allowNull: true },
  reference: { type: DataTypes.STRING(120), allowNull: true },
  purchaseDate: { type: DataTypes.DATEONLY, allowNull: false },
  notes: { type: DataTypes.STRING(500), allowNull: true },
  addedToStock: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  createdBy: { type: DataTypes.INTEGER, allowNull: true }
});

const Expense = defineModel('Expense', {
  category: { type: DataTypes.STRING(30), allowNull: false },
  description: { type: DataTypes.STRING(300), allowNull: true },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  expenseDate: { type: DataTypes.DATEONLY, allowNull: false },
  reference: { type: DataTypes.STRING(120), allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: true }
});
const EXPENSE_CATEGORIES = ['transport', 'packaging', 'salaries', 'rent', 'utilities', 'marketing', 'sms_airtime', 'licences_taxes', 'repairs', 'other'];

const Review = defineModel('Review', {
  productId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  orderId: { type: DataTypes.INTEGER, allowNull: true },
  rating: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(120), allowNull: true },
  comment: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'published' }, // published | hidden
  adminReply: { type: DataTypes.STRING(600), allowNull: true }
}, { indexes: [{ unique: true, fields: ['productId', 'userId'] }] });

const Campaign = defineModel('Campaign', {
  name: { type: DataTypes.STRING(120), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  filters: { type: DataTypes.JSON, allowNull: true },
  status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'sending' }, // sending | sent | failed | stopped
  totalRecipients: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  sentCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  failedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  optedOutSkipped: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  smsParts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
  startedAt: { type: DataTypes.DATE, allowNull: true },
  finishedAt: { type: DataTypes.DATE, allowNull: true }
});

const MarketingPref = defineModel('MarketingPref', {
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  optedOut: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  source: { type: DataTypes.STRING(20), allowNull: true }
});

// ---------- Operations settings (one JSON document, editable by the admin) ----------
const OPS_DEFAULTS = {
  orderExpiryMinutes: 45,
  lowStockDefault: 20,
  lowStockPerProduct: {},
  smsLowThreshold: 10,
  smsCostPerPart: 0.2,
  adminTwoFactor: true,
  autoReconcile: true,
  dailySummary: { enabled: true, time: '20:00', sms: true, email: true, extraPhones: [], extraEmails: [] }
};
let opsCache = { at: 0, value: null };
async function getOps(force = false) {
  if (!force && opsCache.value && Date.now() - opsCache.at < 20000) return opsCache.value;
  let stored = {};
  try { const row = await SystemConfig.findOne({ where: { key: 'ops_settings' } }); stored = (row && row.value) || {}; } catch (_) { /* table not ready */ }
  const merged = { ...OPS_DEFAULTS, ...stored, dailySummary: { ...OPS_DEFAULTS.dailySummary, ...(stored.dailySummary || {}) } };
  opsCache = { at: Date.now(), value: merged };
  return merged;
}
async function saveOps(patch) {
  const current = await getOps(true);
  const next = { ...current, ...patch, dailySummary: { ...current.dailySummary, ...(patch.dailySummary || {}) } };
  const [row] = await SystemConfig.findOrCreate({ where: { key: 'ops_settings' }, defaults: { value: next } });
  row.value = next; row.changed('value', true); await row.save();
  opsCache = { at: Date.now(), value: next };
  return next;
}

// ---------- Permission editor ----------
const PERMISSION_CATALOG = {
  support: [
    { key: 'users.view', label: 'View customer accounts' },
    { key: 'users.rename', label: 'Correct a customer\'s name' },
    { key: 'users.unsuspend', label: 'Reactivate suspended accounts' },
    { key: 'users.notes', label: 'Add case notes' },
    { key: 'orders.view', label: 'View all orders and delivery details' },
    { key: 'payments.view', label: 'View payments and M-Pesa receipts' },
    { key: 'payments.check', label: 'Check a payment with PayHero' },
    { key: 'reviews.moderate', label: 'Hide or restore product reviews' }
  ],
  agent: [
    { key: 'agent.customers', label: 'See the customers they referred' },
    { key: 'agent.profit', label: 'See the profit figure behind each commission' }
  ]
};
const PERMISSION_DEFAULTS = {
  support: { 'users.view': true, 'users.rename': true, 'users.unsuspend': true, 'users.notes': true, 'orders.view': true, 'payments.view': true, 'payments.check': true, 'reviews.moderate': false },
  agent: { 'agent.customers': true, 'agent.profit': true }
};
let permCache = { at: 0, value: null };
async function getPermissions(force = false) {
  if (!force && permCache.value && Date.now() - permCache.at < 20000) return permCache.value;
  let stored = {};
  try { const row = await SystemConfig.findOne({ where: { key: 'role_permissions' } }); stored = (row && row.value) || {}; } catch (_) { /* ignore */ }
  const merged = {};
  Object.keys(PERMISSION_DEFAULTS).forEach((role) => { merged[role] = { ...PERMISSION_DEFAULTS[role], ...(stored[role] || {}) }; });
  permCache = { at: Date.now(), value: merged };
  return merged;
}
async function savePermissions(role, changes) {
  if (!PERMISSION_DEFAULTS[role]) throw httpError(400, 'Only customer care and agent permissions can be edited.');
  const allowed = PERMISSION_CATALOG[role].map(p => p.key);
  const current = await getPermissions(true);
  const next = { ...current, [role]: { ...current[role] } };
  Object.keys(changes || {}).forEach((k) => { if (allowed.includes(k)) next[role][k] = !!changes[k]; });
  const [row] = await SystemConfig.findOrCreate({ where: { key: 'role_permissions' }, defaults: { value: next } });
  row.value = next; row.changed('value', true); await row.save();
  permCache = { at: Date.now(), value: next };
  return next;
}
const hasPermission = async (role, key) => {
  if (role === 'admin') return true;
  const perms = await getPermissions();
  return !!(perms[role] && perms[role][key]);
};
/** Allows an admin always; support/agent only when the permission is switched on. Pass several keys to mean "any of". */
const requirePerm = (...keys) => async (req, res, next) => {
  try {
    for (const k of keys) { if (await hasPermission(req.user && req.user.role, k)) return next(); }
    return res.status(403).json({ error: 'Your account has not been given access to this. Ask an administrator.' });
  } catch (e) { return res.status(500).json({ error: 'Could not check permissions.' }); }
};

// ---------- Time helpers (the business runs on East Africa Time, UTC+3) ----------
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const eatNow = () => new Date(Date.now() + EAT_OFFSET_MS);
const eatDateString = (d = new Date()) => new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);
/** UTC start/end of a calendar day in EAT, given 'YYYY-MM-DD'. */
const eatDayRange = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - EAT_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1) };
};
const parseRange = (q) => {
  const toStr = /^\d{4}-\d{2}-\d{2}$/.test(String(q.to || '')) ? q.to : eatDateString();
  const defaultFrom = new Date(Date.now() - 29 * 86400000);
  const fromStr = /^\d{4}-\d{2}-\d{2}$/.test(String(q.from || '')) ? q.from : eatDateString(defaultFrom);
  return { fromStr, toStr, from: eatDayRange(fromStr).start, to: eatDayRange(toStr).end };
};

// ---------- Wholesale (quantity) pricing ----------
let tierCache = { at: 0, value: {} };
async function getWholesaleTiers(force = false) {
  if (!force && Date.now() - tierCache.at < 20000) return tierCache.value;
  let value = {};
  try { const row = await SystemConfig.findOne({ where: { key: 'wholesale_tiers' } }); value = (row && row.value) || {}; } catch (_) { /* ignore */ }
  tierCache = { at: Date.now(), value };
  return value;
}
const bestTier = (tiers, qty) => {
  if (!Array.isArray(tiers)) return null;
  return [...tiers].filter(t => Number(t.minQty) > 1 && Number(t.price) > 0 && qty >= Number(t.minQty)).sort((a, b) => Number(b.minQty) - Number(a.minQty))[0] || null;
};
const sanitizeTiers = (raw) => {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : [])
    .map(t => ({ minQty: Math.round(Number(t.minQty)), price: Math.round(Number(t.price) * 100) / 100 }))
    .filter(t => Number.isFinite(t.minQty) && t.minQty >= 2 && t.minQty <= 100000 && Number.isFinite(t.price) && t.price > 0)
    .filter(t => (seen.has(t.minQty) ? false : seen.add(t.minQty)))
    .sort((a, b) => a.minQty - b.minQty)
    .slice(0, 5);
};

/** Adds star ratings and bulk-price tiers to product objects for the storefront. */
async function decorateProducts(list) {
  try {
    const ids = list.map(p => p.id);
    const tiers = await getWholesaleTiers();
    const ratingRows = ids.length ? await Review.findAll({ where: { productId: ids, status: 'published' }, attributes: ['productId', 'rating'] }) : [];
    const agg = {};
    ratingRows.forEach((r) => { const a = agg[r.productId] || (agg[r.productId] = { sum: 0, n: 0 }); a.sum += r.rating; a.n += 1; });
    return list.map(p => ({
      ...p,
      ratingAvg: agg[p.id] ? Math.round((agg[p.id].sum / agg[p.id].n) * 10) / 10 : 0,
      ratingCount: agg[p.id] ? agg[p.id].n : 0,
      wholesaleTiers: Array.isArray(tiers[p.id]) ? tiers[p.id] : []
    }));
  } catch (e) { return list; }
}

// ---------- Low stock ----------
const lowStockNotified = new Map();
const lowStockThresholdFor = async (productId) => {
  const ops = await getOps();
  const own = ops.lowStockPerProduct && ops.lowStockPerProduct[productId];
  return Number.isFinite(Number(own)) && Number(own) >= 0 && own !== undefined ? Number(own) : Number(ops.lowStockDefault) || 20;
};
async function notifyLowStock(product) {
  try {
    const last = lowStockNotified.get(product.id) || 0;
    if (Date.now() - last < 12 * 60 * 60 * 1000) return;
    lowStockNotified.set(product.id, Date.now());
    await logEvent({ action: 'LOW_STOCK', category: 'inventory', severity: 'warn', targetType: 'product', targetId: product.id,
      summary: `Low stock: ${product.brandName} has only ${product.stockQuantity} left`, details: { stock: product.stockQuantity } });
    io.to('admin-dashboard-room').emit('lowStockAlert', { productId: product.id, name: product.brandName, remainingStock: product.stockQuantity });
  } catch (_) { /* never block an order */ }
}

// ---------- SMS (campaigns, summaries) and SMS credit tracking ----------
const smsState = { balance: null, at: null, lastAlertAt: 0, lastPersistAt: 0 };
async function checkSmsLow() {
  try {
    const ops = await getOps();
    if (smsState.balance === null || smsState.balance > Number(ops.smsLowThreshold)) return;
    if (Date.now() - smsState.lastAlertAt < 6 * 60 * 60 * 1000) return;
    smsState.lastAlertAt = Date.now();
    await logEvent({ action: 'SMS_CREDIT_LOW', category: 'system', severity: 'alert',
      summary: `SMS credit is low: ${smsState.balance} left (alert level ${ops.smsLowThreshold}). OTP codes will stop working at zero. Top up Ping Africa.`, details: { balance: smsState.balance } });
    io.to('admin-dashboard-room').emit('smsCreditLow', { balance: smsState.balance });
    const contacts = await getAdminContacts();
    if (contacts.emails.length && process.env.EMAIL_USER) {
      transporter.sendMail({ from: `"${SENDER_NAME}" <${EMAIL_FROM}>`, to: contacts.emails.join(','), subject: '⚠️ SMS credit is running low - Mwea Rice Hub',
        text: `Your Ping Africa SMS credit is down to ${smsState.balance}. Customers will not receive OTP codes when it reaches zero. Please top up.` }).catch(() => {});
    }
  } catch (_) { /* best effort */ }
}
function noteSmsBalance(data) {
  try {
    if (!data || typeof data !== 'object' || data.new_balance === undefined) return;
    const b = Number(data.new_balance);
    if (!Number.isFinite(b)) return;
    smsState.balance = b; smsState.at = Date.now();
    if (Date.now() - smsState.lastPersistAt > 10 * 60 * 1000) {
      smsState.lastPersistAt = Date.now();
      SystemConfig.findOrCreate({ where: { key: 'sms_balance' }, defaults: { value: { balance: b, at: new Date() } } })
        .then(([row, created]) => { if (!created) { row.value = { balance: b, at: new Date() }; row.changed('value', true); return row.save(); } }).catch(() => {});
    }
    checkSmsLow();
  } catch (_) { /* ignore */ }
}
async function loadSmsBalanceFromDb() {
  try {
    const row = await SystemConfig.findOne({ where: { key: 'sms_balance' } });
    if (row && row.value && smsState.balance === null) { smsState.balance = Number(row.value.balance); smsState.at = new Date(row.value.at).getTime(); }
  } catch (_) { /* ignore */ }
}

/** Sends one plain SMS through Ping Africa. Returns { ok, error }. */
async function sendSmsRaw(phone, message) {
  try {
    const to = normalizeKenyanPhone(phone);
    if (!to) return { ok: false, error: 'invalid number' };
    if (!process.env.PING_AFRICA_API_TOKEN) return { ok: false, error: 'SMS token not configured' };
    const payload = { recipient: to, message };
    if (process.env.PING_AFRICA_SENDER_ID) payload.sender_id = process.env.PING_AFRICA_SENDER_ID;
    const response = await axios.post(process.env.PING_AFRICA_API_URL || 'https://bulk.ping.africa/api/v1/sms/send', payload, {
      headers: { Authorization: `Bearer ${process.env.PING_AFRICA_API_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000
    });
    let data = response.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { /* text */ } }
    noteSmsBalance(data);
    if (data && typeof data === 'object' && (data.success === false || data.error)) return { ok: false, error: String(data.message || data.error).slice(0, 120) };
    return { ok: true };
  } catch (e) {
    const d = e.response && e.response.data;
    return { ok: false, error: String((d && (d.message || d.error)) || e.message).slice(0, 120) };
  }
}
const smsPartsFor = (text) => { const len = String(text).length; return len <= 160 ? 1 : Math.ceil(len / 153); };

async function getAdminContacts() {
  const ops = await getOps();
  const admins = await User.findAll({ where: { role: 'admin', isActive: true }, attributes: ['phoneNumber', 'email'] });
  const phones = new Set(), emails = new Set();
  admins.forEach((a) => { const p = normalizeKenyanPhone(a.phoneNumber); if (p) phones.add(p); if (a.email && String(a.email).includes('@')) emails.add(String(a.email).toLowerCase()); });
  (ops.dailySummary.extraPhones || []).forEach((p) => { const n = normalizeKenyanPhone(p); if (n) phones.add(n); });
  (ops.dailySummary.extraEmails || []).forEach((e) => { if (String(e).includes('@')) emails.add(String(e).toLowerCase()); });
  return { phones: [...phones], emails: [...emails] };
}

// ---------- Marketing opt-out ----------
const optOutSignature = (userId) => crypto.createHmac('sha256', JWT_SECRET).update(`optout:${userId}`).digest('hex').slice(0, 12);
const optOutLink = (userId) => `${RENDER_BASE_URL}/api/optout/${userId}.${optOutSignature(userId)}`;

// ---------- Profit engine (used by reports, exports, daily summary) ----------
async function loadPaidOrdersInRange(from, to) {
  const candidates = await Order.findAll({ where: { createdAt: { [Op.gte]: new Date(from.getTime() - 30 * 86400000) } }, order: [['createdAt', 'DESC']], limit: 20000 });
  return candidates.filter((o) => {
    const pd = o.paymentDetails || {};
    if (pd.isPaid !== true) return false;
    if (/cancel|refund|reject/i.test(String(o.status || ''))) return false;
    const when = new Date(pd.paidAt || o.createdAt);
    return when >= from && when <= to;
  });
}
async function buildProfitReport(from, to, fromStr, toStr) {
  const orders = await loadPaidOrdersInRange(from, to);
  const orderIds = orders.map(o => o.id);
  const [referrals, commissions, expenses] = await Promise.all([
    CustomerReferral.findAll(),
    orderIds.length ? AgentCommission.findAll({ where: { orderId: orderIds } }) : [],
    Expense.findAll({ where: { expenseDate: { [Op.gte]: fromStr, [Op.lte]: toStr } }, order: [['expenseDate', 'DESC']] })
  ]);
  const refMap = {}; referrals.forEach(r => { refMap[r.customerId] = r.agentId; });
  const comMap = {}; commissions.filter(c => c.status !== 'REVERSED').forEach(c => { comMap[c.orderId] = Number(c.amount) || 0; });
  const agentIds = [...new Set(Object.values(refMap))];
  const agentUsers = agentIds.length ? await User.findAll({ where: { id: agentIds }, attributes: ['id', 'fullName'] }) : [];
  const agentName = {}; agentUsers.forEach(u => { agentName[u.id] = u.fullName; });
  const productCostFallback = {};
  const missingIds = new Set();
  orders.forEach(o => getOrderItems(o).forEach(i => { if (!(Number(i.buyingPrice) > 0) && i.productId) missingIds.add(i.productId); }));
  if (missingIds.size) (await RiceProduct.findAll({ where: { id: [...missingIds] }, attributes: ['id', 'buyingPrice'] })).forEach(p => { productCostFallback[p.id] = Number(p.buyingPrice) || 0; });

  const totals = { orders: 0, kg: 0, riceRevenue: 0, deliveryIncome: 0, costOfGoods: 0, grossProfit: 0, commissions: 0, expenses: 0, netProfit: 0 };
  const byProduct = {}, byCounty = {}, byAgent = {}, byMonth = {}, byDay = {};
  const bump = (map, key, label, v) => {
    const r = map[key] || (map[key] = { key, label, orders: 0, units: 0, kg: 0, revenue: 0, cost: 0, profit: 0, commission: 0 });
    r.orders += v.orders || 0; r.units += v.units || 0; r.kg += v.kg || 0; r.revenue += v.revenue || 0; r.cost += v.cost || 0; r.profit += v.profit || 0; r.commission += v.commission || 0;
  };
  orders.forEach((o) => {
    const items = getOrderItems(o);
    let rev = 0, cost = 0;
    items.forEach((i) => {
      const qty = Number(i.quantity) || 0, price = Number(i.priceAtPurchase) || 0;
      const unitCost = Number(i.buyingPrice) > 0 ? Number(i.buyingPrice) : (productCostFallback[i.productId] > 0 ? productCostFallback[i.productId] : price * 0.75);
      rev += price * qty; cost += unitCost * qty;
      const kg = (Number(i.weightKg) || 0) * qty;
      bump(byProduct, String(i.productId || i.name), i.name || i.brandName || 'Rice', { units: qty, kg, revenue: price * qty, cost: unitCost * qty, profit: price * qty - unitCost * qty });
    });
    const profit = rev - cost;
    const commission = comMap[o.id] || 0;
    const kg = Number(o.totalWeightKg) || 0;
    const delivery = Number(o.transportFee) || 0;
    const pd = o.paymentDetails || {};
    const when = new Date(pd.paidAt || o.createdAt);
    const eat = new Date(when.getTime() + EAT_OFFSET_MS).toISOString();
    totals.orders += 1; totals.kg += kg; totals.riceRevenue += rev; totals.deliveryIncome += delivery; totals.costOfGoods += cost; totals.commissions += commission;
    const base = { orders: 1, kg, revenue: rev, cost, profit, commission };
    bump(byCounty, o.county || 'Unknown', o.county || 'Unknown', base);
    const aid = refMap[o.userId];
    bump(byAgent, aid ? String(aid) : 'direct', aid ? (agentName[aid] || `Agent #${aid}`) : 'Direct (no agent)', base);
    bump(byMonth, eat.slice(0, 7), eat.slice(0, 7), base);
    bump(byDay, eat.slice(0, 10), eat.slice(0, 10), base);
  });
  totals.grossProfit = totals.riceRevenue - totals.costOfGoods;
  totals.expenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  totals.netProfit = totals.grossProfit + totals.deliveryIncome - totals.commissions - totals.expenses;
  const fin = (r) => ({ ...r, kg: round2(r.kg), revenue: round2(r.revenue), cost: round2(r.cost), profit: round2(r.profit), commission: round2(r.commission), net: round2(r.profit - r.commission), margin: r.revenue > 0 ? Math.round((r.profit / r.revenue) * 1000) / 10 : 0 });
  const list = (m, sortKey = 'profit') => Object.values(m).map(fin).sort((a, b) => sortKey === 'key' ? String(a.key).localeCompare(String(b.key)) : b[sortKey] - a[sortKey]);
  const expenseByCategory = {};
  expenses.forEach(e => { expenseByCategory[e.category] = round2((expenseByCategory[e.category] || 0) + Number(e.amount)); });
  Object.keys(totals).forEach(k => { totals[k] = round2(totals[k]); });
  return {
    range: { from: fromStr, to: toStr }, totals,
    margin: totals.riceRevenue > 0 ? Math.round((totals.grossProfit / totals.riceRevenue) * 1000) / 10 : 0,
    byProduct: list(byProduct), byCounty: list(byCounty), byAgent: list(byAgent), byMonth: list(byMonth, 'key'), byDay: list(byDay, 'key'),
    expenseByCategory, expenses: expenses.slice(0, 200).map(e => ({ id: e.id, category: e.category, description: e.description, amount: Number(e.amount), date: e.expenseDate }))
  };
}

// ---------- Minimal dependency-free .xlsx writer (so no npm package has to be installed) ----------
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipBuffer(files) {
  const parts = [], central = []; let offset = 0;
  files.forEach((f) => {
    const name = Buffer.from(f.name, 'utf8'), raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const comp = zlib.deflateRawSync(raw), crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, name, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10); cen.writeUInt16LE(0, 12); cen.writeUInt16LE(0x21, 14);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(raw.length, 24); cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += 30 + name.length + comp.length;
  });
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
const xmlEsc = (v) => String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colLetter = (n) => { let s = ''; n += 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
/** sheets: [{ name, columns: [{ header, key, type?: 'text'|'number'|'money' }], rows: [{...}] }] */
function buildXlsx(sheets) {
  const sheetXml = sheets.map((sh) => {
    const widths = sh.columns.map(c => Math.max(String(c.header).length + 2, 10));
    const rowsXml = [];
    rowsXml.push(`<row r="1">${sh.columns.map((c, ci) => `<c r="${colLetter(ci)}1" s="1" t="inlineStr"><is><t>${xmlEsc(c.header)}</t></is></c>`).join('')}</row>`);
    sh.rows.forEach((row, ri) => {
      const r = ri + 2;
      rowsXml.push(`<row r="${r}">${sh.columns.map((c, ci) => {
        const v = row[c.key]; const ref = `${colLetter(ci)}${r}`;
        if (v === null || v === undefined || v === '') return '';
        if ((c.type === 'number' || c.type === 'money') && Number.isFinite(Number(v))) {
          return `<c r="${ref}"${c.type === 'money' ? ' s="2"' : ''}><v>${Number(v)}</v></c>`;
        }
        const t = String(v); widths[ci] = Math.min(60, Math.max(widths[ci], t.length + 2));
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(t)}</t></is></c>`;
      }).join('')}</row>`);
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rowsXml.join('')}</sheetData></worksheet>`;
  });
  const safeName = (n, i) => String(n || `Sheet${i + 1}`).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31);
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(safeName(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF166534"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...sheetXml.map((x, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: x }))
  ];
  return zipBuffer(files);
}

// ---------- Payment confirmation shared by the status poll, callback and background job ----------
const paymentLocks = new Set();
async function confirmOrderPaid(order, source, receipt = null, rawCallback = null) {
  if (paymentLocks.has(order.id)) return { confirmed: false, reason: 'busy' };
  paymentLocks.add(order.id);
  try {
    const fresh = await Order.findByPk(order.id);
    if (!fresh) return { confirmed: false, reason: 'missing' };
    const pd = fresh.paymentDetails || {};
    if (pd.isPaid === true) {
      if (receipt && !pd.mpesaReceipt) { fresh.paymentDetails = { ...pd, mpesaReceipt: receipt }; await fresh.save(); }
      return { confirmed: false, reason: 'already-paid', order: fresh };
    }
    // A payment that arrives after the order expired needs its stock taken back out again.
    if (fresh.status === 'cancelled' && pd.expiredAt) {
      let short = false;
      const items = getOrderItems(fresh);
      for (const i of items) {
        const p = await RiceProduct.findByPk(i.productId);
        if (!p || p.stockQuantity < i.quantity) { short = true; continue; }
        p.stockQuantity -= i.quantity; await p.save();
        io.emit('stockUpdated', { productId: p.id, newStockQuantity: p.stockQuantity });
      }
      if (short) {
        await logEvent({ action: 'LATE_PAYMENT_STOCK_SHORT', category: 'orders', severity: 'alert', targetType: 'order', targetId: fresh.id,
          summary: `Order #${fresh.id} was paid after it expired and some stock is no longer available. Fulfil it manually or refund the customer.` });
      }
    }
    fresh.paymentDetails = { ...pd, isPaid: true, paidTag: 'PAID', paidAt: new Date(), mpesaReceipt: receipt || pd.mpesaReceipt || null, failureReason: null, expiredAt: null, ...(rawCallback ? { rawCallback } : {}) };
    if (fresh.status === 'payment_failed' || fresh.status === 'cancelled') fresh.status = 'pending';
    const points = Number(((Number(fresh.totalWeightKg) || 0) * 0.2).toFixed(2));
    if (points > 0) {
      const u = await User.findByPk(fresh.userId);
      if (u) { u.rewardPoints = Number(((u.rewardPoints || 0) + points).toFixed(2)); await u.save(); }
    }
    await fresh.save();
    await onOrderPaid(fresh, source);
    io.to('admin-dashboard-room').emit('paymentReceived', { orderId: fresh.id, status: fresh.status, isPaid: true, mpesaReceipt: fresh.paymentDetails.mpesaReceipt, paymentDetails: fresh.paymentDetails });
    io.emit('orderStatusUpdated', fresh);
    return { confirmed: true, order: fresh };
  } finally {
    paymentLocks.delete(order.id);
  }
}

/** Gives the reserved stock back and closes an order that was never paid. */
async function expireUnpaidOrder(order, minutes) {
  const fresh = await Order.findByPk(order.id);
  if (!fresh || (fresh.paymentDetails || {}).isPaid === true || fresh.status === 'cancelled') return false;
  for (const i of getOrderItems(fresh)) {
    const p = await RiceProduct.findByPk(i.productId);
    if (p) { p.stockQuantity += Number(i.quantity) || 0; await p.save(); io.emit('stockUpdated', { productId: p.id, newStockQuantity: p.stockQuantity }); }
  }
  fresh.status = 'cancelled';
  fresh.paymentDetails = { ...(fresh.paymentDetails || {}), isPaid: false, paidTag: 'EXPIRED', failureReason: `Payment not received within ${minutes} minutes`, expiredAt: new Date() };
  await fresh.save();
  await logEvent({ action: 'ORDER_EXPIRED', category: 'orders', severity: 'warn', targetType: 'order', targetId: fresh.id,
    summary: `Order #${fresh.id} expired unpaid after ${minutes} minutes; stock released`, details: { userId: fresh.userId } });
  io.emit('orderStatusUpdated', fresh);
  return true;
}

// ---------- Background jobs ----------
const jobStatus = { paymentReconcile: { lastRun: null, checked: 0, confirmed: 0, failed: 0, expired: 0, error: null }, dailySummary: { lastRun: null, lastSentDate: null, error: null } };
let reconcileRunning = false;
async function runPaymentReconcile() {
  if (reconcileRunning) return;
  reconcileRunning = true;
  const stat = { lastRun: new Date(), checked: 0, confirmed: 0, failed: 0, expired: 0, error: null };
  try {
    const ops = await getOps();
    if (ops.autoReconcile === false) { jobStatus.paymentReconcile = { ...stat, error: 'switched off' }; return; }
    const minutes = Math.max(10, Number(ops.orderExpiryMinutes) || 45);
    const recent = await Order.findAll({ where: { createdAt: { [Op.gte]: new Date(Date.now() - 72 * 3600 * 1000) }, status: { [Op.in]: ['pending', 'payment_failed'] } }, order: [['createdAt', 'ASC']], limit: 200 });
    const unpaid = recent.filter(o => (o.paymentDetails || {}).isPaid !== true && Date.now() - new Date(o.createdAt).getTime() > 90 * 1000).slice(0, 25);
    for (const o of unpaid) {
      stat.checked += 1;
      const live = await lookupPayHeroStatus(o.id);
      if (!live.reachable) continue;
      if (live.status === 'SUCCESS' || live.status === 'PAID') {
        const r = await confirmOrderPaid(o, 'background payment check', live.receipt || null);
        if (r.confirmed) stat.confirmed += 1;
        continue;
      }
      const ageMin = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
      if (['FAILED', 'CANCELLED', 'REJECTED'].includes(live.status) && o.status !== 'payment_failed') {
        o.status = 'payment_failed';
        o.paymentDetails = { ...(o.paymentDetails || {}), isPaid: false, paidTag: 'FAILED', failureReason: live.failureReason || 'Payment failed or was cancelled by the customer.' };
        await o.save(); stat.failed += 1;
        io.emit('orderStatusUpdated', o);
      }
      if (ageMin > minutes) { if (await expireUnpaidOrder(o, minutes)) stat.expired += 1; }
    }
  } catch (e) {
    stat.error = e.message;
    console.error('⚠️ Payment reconcile job error:', e.message);
  } finally {
    jobStatus.paymentReconcile = stat;
    reconcileRunning = false;
  }
}

async function buildDailySummary(dateStr) {
  const { start, end } = eatDayRange(dateStr);
  const [report, createdToday, newCustomers, lowStock, owedRows] = await Promise.all([
    buildProfitReport(start, end, dateStr, dateStr),
    Order.findAll({ where: { createdAt: { [Op.gte]: start, [Op.lte]: end } } }),
    User.count({ where: { createdAt: { [Op.gte]: start, [Op.lte]: end }, isVerified: true } }),
    RiceProduct.findAll({ where: { isAvailable: true }, attributes: ['id', 'brandName', 'stockQuantity'] }),
    AgentCommission.findAll({ where: { status: 'PENDING' }, attributes: ['amount'] })
  ]);
  const ops = await getOps();
  const low = [];
  for (const p of lowStock) { if (p.stockQuantity <= (await lowStockThresholdFor(p.id))) low.push(`${p.brandName} (${p.stockQuantity})`); }
  const pendingNow = createdToday.filter(o => (o.paymentDetails || {}).isPaid !== true && o.status === 'pending').length;
  const failedNow = createdToday.filter(o => o.status === 'payment_failed').length;
  const errorsToday = await ActivityEvent.count({ where: { category: 'system', severity: 'alert', createdAt: { [Op.gte]: start, [Op.lte]: end } } });
  const owed = round2(owedRows.reduce((s, r) => s + Number(r.amount), 0));
  const t = report.totals;
  const topProducts = report.byProduct.slice(0, 3).map(p => `${p.label} ${p.kg}kg`);
  const kes = (n) => `KES ${Math.round(Number(n) || 0).toLocaleString('en-KE')}`;
  const sms = `Mwea Rice Hub ${dateStr}: ${t.orders} paid order(s), sales ${kes(t.riceRevenue + t.deliveryIncome)}, est. net profit ${kes(t.netProfit)}. Pending ${pendingNow}, failed ${failedNow}. New customers ${newCustomers}.${low.length ? ` LOW STOCK: ${low.slice(0, 3).join(', ')}.` : ''} Agent commission owed ${kes(owed)}.${smsState.balance !== null ? ` SMS credit ${smsState.balance}.` : ''}${errorsToday ? ` ${errorsToday} system alert(s).` : ''}`.slice(0, 450);
  const rowsHtml = [
    ['Paid orders', t.orders], ['Rice sales', kes(t.riceRevenue)], ['Delivery fees collected', kes(t.deliveryIncome)], ['Cost of rice sold', kes(t.costOfGoods)], ['Gross profit', kes(t.grossProfit)],
    ['Agent commission earned', kes(t.commissions)], ['Expenses recorded', kes(t.expenses)], ['Estimated net profit', kes(t.netProfit)], ['Kg sold', t.kg],
    ['Orders awaiting payment', pendingNow], ['Failed payments', failedNow], ['New customers', newCustomers], ['Agent commission still owed', kes(owed)],
    ['SMS credit', smsState.balance !== null ? smsState.balance : 'unknown'], ['System alerts today', errorsToday], ['Top products', topProducts.join(', ') || '—'], ['Low stock', low.join(', ') || 'None']
  ].map(([a, b]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#475569">${a}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a;text-align:right">${b}</td></tr>`).join('');
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto"><h2 style="color:#166534">🌾 Mwea Rice Hub — daily summary</h2><p style="color:#64748b">${dateStr}</p><table style="width:100%;border-collapse:collapse;font-size:14px">${rowsHtml}</table><p style="font-size:12px;color:#94a3b8;margin-top:16px">Profit is estimated from your recorded buying prices and expenses.</p></div>`;
  return { sms, html, subject: `Daily summary ${dateStr}: ${t.orders} orders, net ${kes(t.netProfit)}`, data: { ...t, pendingNow, failedNow, newCustomers, owed, low, errorsToday } };
}
async function sendDailySummary(dateStr, { force = false } = {}) {
  const ops = await getOps();
  const cfg = ops.dailySummary;
  const summary = await buildDailySummary(dateStr);
  const contacts = await getAdminContacts();
  const result = { sms: 0, email: 0, errors: [] };
  if (cfg.sms !== false) {
    for (const p of contacts.phones) { const r = await sendSmsRaw(p, summary.sms); if (r.ok) result.sms += 1; else result.errors.push(`SMS ${p}: ${r.error}`); }
  }
  if (cfg.email !== false && contacts.emails.length && process.env.EMAIL_USER) {
    try { await transporter.sendMail({ from: `"${SENDER_NAME}" <${EMAIL_FROM}>`, to: contacts.emails.join(','), subject: summary.subject, html: summary.html }); result.email = contacts.emails.length; }
    catch (e) { result.errors.push(`Email: ${e.message}`); }
  }
  await logEvent({ action: 'DAILY_SUMMARY_SENT', category: 'system', severity: result.errors.length ? 'warn' : 'info', summary: `Daily summary ${dateStr} sent (${result.sms} SMS, ${result.email} email)${result.errors.length ? ' with problems: ' + result.errors.join('; ') : ''}`, details: result });
  return { ...result, preview: summary.sms };
}
async function dailySummaryTick() {
  try {
    const ops = await getOps();
    const cfg = ops.dailySummary;
    if (!cfg.enabled) return;
    const now = eatNow();
    const today = now.toISOString().slice(0, 10);
    const [hh, mm] = String(cfg.time || '20:00').split(':').map(Number);
    if (now.getUTCHours() * 60 + now.getUTCMinutes() < (hh || 0) * 60 + (mm || 0)) return;
    const [row] = await SystemConfig.findOrCreate({ where: { key: 'daily_summary_state' }, defaults: { value: { lastSentDate: null } } });
    if ((row.value || {}).lastSentDate === today) return;
    row.value = { lastSentDate: today }; row.changed('value', true); await row.save(); // claim the day first so it can never send twice
    const r = await sendDailySummary(today);
    jobStatus.dailySummary = { lastRun: new Date(), lastSentDate: today, error: r.errors.length ? r.errors.join('; ') : null };
  } catch (e) {
    jobStatus.dailySummary = { ...jobStatus.dailySummary, lastRun: new Date(), error: e.message };
    console.error('⚠️ Daily summary job error:', e.message);
  }
}

let jobsStarted = false;
function startBackgroundJobs() {
  if (jobsStarted || IS_VERCEL) return;
  jobsStarted = true;
  loadSmsBalanceFromDb();
  Campaign.update({ status: 'stopped', finishedAt: new Date() }, { where: { status: 'sending' } }).catch(() => {});
  setTimeout(runPaymentReconcile, 45 * 1000);
  setInterval(runPaymentReconcile, 3 * 60 * 1000).unref?.();
  setInterval(dailySummaryTick, 60 * 1000).unref?.();
  console.log('⏱️ Background jobs started: payment re-check (every 3 min), unpaid-order expiry, daily summary.');
}

// ---------- Rate limiting & error capture helpers ----------
const rateStores = [];
function makeRateLimiter({ name, windowMs, max, keyFn, message }) {
  const hits = new Map();
  rateStores.push(hits);
  let lastLog = 0;
  return (req, res, next) => {
    let key;
    try { key = keyFn(req); } catch (_) { key = null; }
    if (!key) return next();
    const now = Date.now();
    let rec = hits.get(key);
    if (!rec || now - rec.start > windowMs) { rec = { start: now, count: 0 }; hits.set(key, rec); }
    rec.count += 1;
    if (rec.count > max) {
      const retry = Math.max(1, Math.ceil((rec.start + windowMs - now) / 1000));
      res.set('Retry-After', String(retry));
      if (now - lastLog > 60 * 1000) {
        lastLog = now;
        logEvent({ req, actor: { id: null, role: 'anonymous', name: null }, action: 'RATE_LIMITED', category: 'auth', severity: 'warn', summary: `Too many ${name} requests from ${req.ip || 'unknown'}` });
      }
      return res.status(429).json({ error: message || 'Too many requests. Please wait a few minutes and try again.', retryAfterSeconds: retry });
    }
    next();
  };
}
setInterval(() => { const now = Date.now(); rateStores.forEach(m => { for (const [k, v] of m) if (now - v.start > 2 * 60 * 60 * 1000) m.delete(k); }); }, 10 * 60 * 1000).unref?.();
const bodyIdentity = (req) => {
  const b = req.body || {};
  const raw = b.phoneNumber || b.phone || b.identifier || b.email || '';
  const phone = normalizeKenyanPhone(raw);
  return phone || String(raw).toLowerCase().trim().slice(0, 80) || null;
};

const recentErrors = new Map();
async function recordServerError(source, message, extra = {}) {
  try {
    const key = `${source}:${String(message).slice(0, 80)}`;
    const last = recentErrors.get(key) || 0;
    if (Date.now() - last < 60 * 1000) return; // same error at most once a minute
    recentErrors.set(key, Date.now());
    if (recentErrors.size > 500) recentErrors.clear();
    await logEvent({ actor: { id: null, role: 'system', name: 'Server' }, action: 'SERVER_ERROR', category: 'system', severity: 'alert',
      summary: `${source}: ${String(message).slice(0, 300)}`, details: extra });
    if (sentryClient) { try { sentryClient.captureException(extra.error || new Error(String(message))); } catch (_) { /* ignore */ } }
  } catch (_) { /* never throw from the error reporter */ }
}
let sentryClient = null;
(async () => {
  if (!process.env.SENTRY_DSN) return;
  try {
    const mod = await import('@sentry/node');
    mod.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'production', tracesSampleRate: 0 });
    sentryClient = mod;
    console.log('🛰️ Sentry error monitoring is active.');
  } catch (e) {
    console.warn('⚠️ SENTRY_DSN is set but @sentry/node is not installed. Run "npm install @sentry/node" to enable it. Errors are still recorded in the Live Activity feed.');
  }
})();
process.on('unhandledRejection', (reason) => { console.error('❌ Unhandled rejection:', reason); recordServerError('Unhandled promise rejection', reason && reason.message ? reason.message : reason, { error: reason instanceof Error ? reason : undefined }); });
process.on('uncaughtException', (err) => { console.error('❌ Uncaught exception:', err); recordServerError('Uncaught exception', err.message, { stack: String(err.stack || '').split('\n').slice(0, 6).join('\n'), error: err }); });

// ---------- Admin two-step sign-in ----------
const twoFactorChallenges = new Map();
setInterval(() => { const now = Date.now(); for (const [k, v] of twoFactorChallenges) if (v.expires < now) twoFactorChallenges.delete(k); }, 60 * 1000).unref?.();
const twoFactorEnabled = async () => {
  if (String(process.env.DISABLE_ADMIN_2FA || '').toLowerCase() === 'true') return false;
  const ops = await getOps();
  return ops.adminTwoFactor !== false;
};


// Serverless-safe flash sale sync: no timers, state is derived from the DB (cached for 5s).
let lastFlashSaleSync = 0;
async function syncFlashSaleFromDb(force = false) {
  if (!force && Date.now() - lastFlashSaleSync < 5000) return;
  lastFlashSaleSync = Date.now();
  try {
    const config = await SystemConfig.findOne({ where: { key: 'black_friday' } });
    const v = config && config.value;
    const running = !!(v && v.active && v.endTime && new Date(v.endTime).getTime() > Date.now());
    flashSaleState.active = running;
    flashSaleState.endTime = running ? v.endTime : null;
  } catch (err) {
    console.error('❌ Failed to sync Flash Sale state:', err.message);
  }
}

function initializeFlashSaleEngine(io) {
  SystemConfig.findOne({ where: { key: 'black_friday' } }).then((config) => {
    if (config && config.value && config.value.active) {
      const remainingTime = new Date(config.value.endTime).getTime() - Date.now();
      if (remainingTime > 0) {
        flashSaleState.active = true;
        flashSaleState.endTime = config.value.endTime;
        startFlashSaleCountdown(io);
        console.log(`🔥 Flash Harvest Sale Engine Restored! Active until: ${flashSaleState.endTime}`);
      } else {
        config.value = { ...config.value, active: false };
        config.changed('value', true);
        config.save().catch(saveErr => console.error('❌ Failed to persist expired flash sale state:', saveErr.message));
        console.log('🏁 Expired Flash Harvest Sale state automatically deactivated in DB.');
      }
    }
  }).catch(err => console.error('❌ Failed to boot Flash Sale Engine state:', err.message));
}

function startFlashSaleCountdown(io) {
  if (flashSaleState.countdownIntervalId) {
    clearInterval(flashSaleState.countdownIntervalId);
  }
  
  flashSaleState.countdownIntervalId = setInterval(() => {
    const totalRemaining = new Date(flashSaleState.endTime).getTime() - Date.now();
    if (totalRemaining <= 0) {
      clearInterval(flashSaleState.countdownIntervalId);
      flashSaleState.active = false;
      flashSaleState.endTime = null;
      io.emit('blackFridayEnded', { active: false });
      
      SystemConfig.findOne({ where: { key: 'black_friday' } }).then(config => {
        if (config) {
          config.value = { ...config.value, active: false };
          config.changed('value', true);
          return config.save();
        }
      }).catch(saveErr => console.error('❌ Failed to close flash sale in DB:', saveErr.message));
      console.log('🏁 Flash Harvest Sale window has officially closed.');
    } else {
      io.emit('blackFridayTick', {
        active: true,
        endTime: flashSaleState.endTime,
        msRemaining: totalRemaining
      });
    }
  }, 1000);
}

/**
 * ==========================================
 * 4. AUTHENTICATION & SECURITY MIDDLEWARES
 * ==========================================
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }
  
  if (token) {
    token = token.trim().replace(/^["']|["']$/g, '');
  }

  if (!token || token === 'null' || token === 'undefined' || token === '') {
    return res.status(401).json({ error: 'Authentication token is required to access this resource.' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decodedUser) => {
    if (err) {
      console.log(`DEBUG: Auth Token Verification Failed - ${err.message}`);
      return res.status(403).json({ error: 'Token is invalid or expired. Please sign in again.' });
    }
    try {
      // Always trust the database, not the token: suspended accounts are cut off at once and role changes apply immediately.
      const dbUser = await User.findByPk(decodedUser.id, { attributes: ['id', 'fullName', 'role', 'isActive', 'phoneNumber', 'email'] });
      if (!dbUser) {
        return res.status(401).json({ error: 'This account no longer exists. Please sign in again.' });
      }
      if (dbUser.isActive === false) {
        return res.status(403).json({ error: 'Your account is suspended. Please contact customer care.' });
      }
      req.user = {
        ...decodedUser,
        id: dbUser.id,
        fullName: dbUser.fullName,
        phoneNumber: dbUser.phoneNumber,
        email: dbUser.email,
        role: await effectiveRoleFor(dbUser)
      };
      next();
    } catch (dbErr) {
      console.error('DEBUG: Auth user lookup failed:', dbErr.message);
      return res.status(500).json({ error: 'Could not verify your session. Please try again.' });
    }
  });
};

const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User identification details missing from session token.' });
    }
    const userInstance = await User.findByPk(req.user.id);
    if (!userInstance || userInstance.role !== 'admin') {
      console.log(`DEBUG: Unauthorized Administrative Access Attempted by User ID: ${req.user.id}`);
      return res.status(403).json({ error: 'Access Denied. Elevated Administrator privileges are required.' });
    }
    if (!userInstance.isActive) {
      return res.status(403).json({ error: 'Access Denied. Your administrator account is suspended or disabled.' });
    }
    req.adminUser = userInstance;
    next();
  } catch (error) {
    console.error('DEBUG: Administrative Role Evaluation Error:', error);
    res.status(500).json({ error: 'Internal administrative role security evaluation failure.' });
  }
};

/**
 * ==========================================
 * 5. CORE SERVER & DATABASE BOOTSTRAP ENGINE
 * ==========================================
 */

// Express app is created at module level so Vercel can import and export it as the request handler.
const expressApp = express();
expressApp.set('trust proxy', true);

// HTTP server + WebSockets only exist on persistent hosts. Vercel serverless cannot hold WebSocket connections.
const server = IS_VERCEL ? null : createServer(expressApp);

// Dynamic CORS configuration optimized for Render/Vercel production and mobile wrappers
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl, server-to-server webhooks)
    // OR any origin ending with .onrender.com / .vercel.app or custom production domains
    if (!origin || origin.endsWith('.onrender.com') || origin.includes('onrender.com') || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      // Dynamically allow all other valid web/mobile origins or restrict as needed
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control'],
  exposedHeaders: ['Content-Disposition'],
  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: 86400
};

expressApp.use(cors(corsOptions));
expressApp.use(express.json({ limit: '50mb' }));
expressApp.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from public, uploads, and images directories
expressApp.use(express.static(path.join(__dirname, 'public')));
expressApp.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
expressApp.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Socket.IO placeholder: replaced by a real SocketIOServer on persistent hosts.
// On Vercel every io.emit / io.to().emit call becomes a safe no-op instead of crashing.
let io = {
  emit: () => false,
  to: () => ({ emit: () => false }),
  on: () => {}
};

// Socket.IO is attached immediately (same CORS rules) so the browser never sees a bare 502 on /socket.io.
if (!IS_VERCEL && server) {
  io = new SocketIOServer(server, { cors: corsOptions });
}

// Health endpoints answer instantly (before the DB gate) so Render marks the service live.
expressApp.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), ready: !!bootstrapReady });
});

// Readiness gate: every request waits for DB + route bootstrap (runs once per warm instance).
let bootstrapPromise = null;
let bootstrapReady = false;
let bootstrapRetryTimer = null;
function ensureBootstrapped() {
  if (!bootstrapPromise) {
    bootstrapPromise = startServer().then((result) => {
      bootstrapReady = true;
      return result;
    }).catch((err) => {
      bootstrapPromise = null; // allow a retry on the next request
      // Persistent host: keep the process alive and keep retrying the database instead of crashing into a 502.
      if (!IS_VERCEL && !bootstrapRetryTimer) {
        bootstrapRetryTimer = setTimeout(() => {
          bootstrapRetryTimer = null;
          ensureBootstrapped().catch(() => {});
        }, 10000);
      }
      throw err;
    });
  }
  return bootstrapPromise;
}

// Bind the port RIGHT AWAY (before the database is ready) so Render never answers 502 while booting.
if (!IS_VERCEL && server) {
  server.listen(port, hostname, () => {
    console.log(`✅ HTTP listener bound on http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port} (database bootstrap continues in background)`);
  });
}

expressApp.use(async (req, res, next) => {
  try {
    await ensureBootstrapped();
    if (IS_VERCEL && req.path.startsWith('/api/')) {
      await syncFlashSaleFromDb();
    }
    next();
  } catch (bootErr) {
    console.error('❌ Bootstrap failure while handling request:', bootErr.message);
    res.status(503).json({ error: 'Service is starting up or the database is unreachable. Please retry shortly.' });
  }
});


// ---------- Rate limits on public routes (protects your SMS credit and accounts) ----------
const limitByIp = (req) => req.ip || 'unknown';
const rl = (opts) => makeRateLimiter(opts);
expressApp.post('/api/user/signup', rl({ name: 'signup', windowMs: 60 * 60 * 1000, max: 12, keyFn: limitByIp, message: 'Too many sign-up attempts from your network. Please try again in an hour.' }));
expressApp.post('/api/user/signup', rl({ name: 'signup (per number)', windowMs: 60 * 60 * 1000, max: 6, keyFn: (r) => { const k = bodyIdentity(r); return k ? `signup:${k}` : null; }, message: 'Too many attempts for this phone number or email. Please wait an hour.' }));
['/api/user/signup/request-otp', '/api/user/request-signup-otp', '/api/user/signup/resend-otp', '/api/user/resend-signup-otp'].forEach((p) => {
  expressApp.post(p, rl({ name: 'OTP request', windowMs: 60 * 60 * 1000, max: 25, keyFn: limitByIp, message: 'Too many code requests from your network. Please try again later.' }));
  expressApp.post(p, rl({ name: 'OTP request (per number)', windowMs: 30 * 60 * 1000, max: 4, keyFn: (r) => { const k = bodyIdentity(r); return k ? `otp:${k}` : null; }, message: 'We already sent several codes to this number. Please wait about 30 minutes before asking again.' }));
});
['/api/user/forgot-password', '/api/user/request-reset-otp'].forEach((p) => {
  expressApp.post(p, rl({ name: 'password reset', windowMs: 60 * 60 * 1000, max: 20, keyFn: limitByIp, message: 'Too many password reset requests from your network. Try again later.' }));
  expressApp.post(p, rl({ name: 'password reset (per number)', windowMs: 60 * 60 * 1000, max: 4, keyFn: (r) => { const k = bodyIdentity(r); return k ? `reset:${k}` : null; }, message: 'Too many reset codes requested for this account. Please wait an hour.' }));
});
['/api/user/signup/verify-otp', '/api/user/verify-signup-otp', '/api/user/verify-signup', '/api/user/reset-password', '/api/user/login/verify-2fa'].forEach((p) => {
  expressApp.post(p, rl({ name: 'code check', windowMs: 15 * 60 * 1000, max: 40, keyFn: limitByIp, message: 'Too many attempts. Please wait a few minutes.' }));
});
expressApp.post('/api/user/login', rl({ name: 'login', windowMs: 15 * 60 * 1000, max: 60, keyFn: limitByIp, message: 'Too many sign-in attempts from your network. Please wait a few minutes.' }));
expressApp.get('/api/referral/validate', rl({ name: 'referral check', windowMs: 60 * 1000, max: 40, keyFn: limitByIp, message: 'Slow down a little.' }));
expressApp.post('/api/products/:id/reviews', rl({ name: 'review', windowMs: 60 * 60 * 1000, max: 20, keyFn: limitByIp, message: 'Too many reviews submitted. Please try again later.' }));

// ---------- Server-side failures are recorded (and sent to Sentry when configured) ----------
expressApp.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    try {
      if (res.statusCode >= 500 && req.path.startsWith('/api/')) {
        recordServerError(`${req.method} ${req.path} returned ${res.statusCode}`, (body && body.error) || 'Server error', { route: req.path, method: req.method, status: res.statusCode, userId: req.user ? req.user.id : null });
      }
    } catch (_) { /* never block the response */ }
    return originalJson(body);
  };
  next();
});

expressApp.get('/api/health', async (req, res) => {
  try { await sequelize.query('SELECT 1'); res.json({ ok: true, time: new Date().toISOString() }); }
  catch (e) { res.status(503).json({ ok: false }); }
});

async function startServer() {
  try {
    // Authenticate database connectivity
    await sequelize.authenticate();
    
    // Auto migration checks for dynamic reward points, buying prices & account verification columns
    try {
      const queryInterface = sequelize.getQueryInterface();
      const userTable = await queryInterface.describeTable(User.getTableName());
      if (!userTable.rewardPoints) {
        await queryInterface.addColumn(User.getTableName(), 'rewardPoints', {
          type: DataTypes.FLOAT,
          defaultValue: 0,
          allowNull: false
        });
        console.log('✅ Synchronized database column: Users.rewardPoints');
      }

      if (!userTable.isVerified) {
        await queryInterface.addColumn(User.getTableName(), 'isVerified', {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
          allowNull: false
        });
        console.log('✅ Synchronized database column: Users.isVerified');
      }

      if (!userTable.verificationOtp) {
        await queryInterface.addColumn(User.getTableName(), 'verificationOtp', {
          type: DataTypes.STRING,
          allowNull: true
        });
        console.log('✅ Synchronized database column: Users.verificationOtp');
      }

      if (!userTable.verificationOtpExpires) {
        await queryInterface.addColumn(User.getTableName(), 'verificationOtpExpires', {
          type: DataTypes.DATE,
          allowNull: true
        });
        console.log('✅ Synchronized database column: Users.verificationOtpExpires');
      }
      
      if (!userTable.resetToken) {
        await queryInterface.addColumn(User.getTableName(), 'resetToken', {
          type: DataTypes.STRING,
          allowNull: true
        });
        console.log('✅ Synchronized database column: Users.resetToken');
      }

      // Repair columns created with a wrong type (causes WARN_DATA_TRUNCATED on save)
      for (const col of ['resetTokenExpires', 'verificationOtpExpires']) {
        const info = userTable[col];
        if (info && !/DATETIME|TIMESTAMP/i.test(String(info.type))) {
          await queryInterface.changeColumn(User.getTableName(), col, { type: DataTypes.DATE, allowNull: true });
          console.log(`✅ Repaired column type: Users.${col} -> DATETIME`);
        }
      }

      if (!userTable.resetTokenExpires) {
        await queryInterface.addColumn(User.getTableName(), 'resetTokenExpires', {
          type: DataTypes.DATE,
          allowNull: true
        });
        console.log('✅ Synchronized database column: Users.resetTokenExpires');
      }

      const productTable = await queryInterface.describeTable(RiceProduct.getTableName());
      if (!productTable.buyingPrice) {
        await queryInterface.addColumn(RiceProduct.getTableName(), 'buyingPrice', {
          type: DataTypes.FLOAT,
          defaultValue: 0,
          allowNull: true
        });
        console.log('✅ Synchronized database column: RiceProducts.buyingPrice');
      }
    } catch (colErr) {
      console.error('⚠️ Column auto-migration problem:', colErr.message);
    }

    await sequelize.sync();
    
    const currentMode = process.env.DB_MODE === 'cloud' ? '☁️ AIVEN / CLOUD POSTGRES' : '🏠 RENDER / LOCAL DB';
    console.log(`🍃 Database Connected Successfully! Running Mode: [ ${currentMode} ]`);

    // Initialize Default System Configuration Entries
    await SystemConfig.findOrCreate({ where: { key: 'transport_fee' }, defaults: { value: 250 } });
    await SystemConfig.findOrCreate({ where: { key: 'black_friday' }, defaults: { value: { active: false, endTime: null } } });
    
    await SystemConfig.findOrCreate({
      where: { key: 'mpesa_config' },
      defaults: {
        value: {
          paybillNumber: '522522',
          paybillAccount: 'MWEARICE',
          tillNumber: '889900',
          stkEnabled: true
        }
      }
    });

    // =========================================================================
    // LOAD REAL KENYA LOCATIONS DATASET DYNAMICALLY FROM JSON FILE
    // =========================================================================
    const { countyOverrides, logisticsHierarchy, rawJsonData } = loadKenyaLocationsDataset();

    // County shipping fees: keep any fees an admin already edited, but add every
    // county from the dataset that is missing from the database.
    {
      const [overridesRow, overridesCreated] = await SystemConfig.findOrCreate({
        where: { key: 'county_overrides' },
        defaults: { value: countyOverrides }
      });
      if (!overridesCreated && countyOverrides && Object.keys(countyOverrides).length) {
        const merged = { ...countyOverrides, ...(overridesRow.value || {}) };
        if (Object.keys(merged).length !== Object.keys(overridesRow.value || {}).length) {
          overridesRow.value = merged;
          overridesRow.changed('value', true);
          await overridesRow.save();
          console.log('✅ County shipping fees synced with kenya_locations.json (new counties added).');
        }
      }
    }

    // The location hierarchy comes straight from kenya_locations.json, so refresh it
    // on every boot. (findOrCreate left the first-ever copy in the DB forever.)
    if (logisticsHierarchy && Object.keys(logisticsHierarchy).length) {
      const [hierarchyRow, hierarchyCreated] = await SystemConfig.findOrCreate({
        where: { key: 'logistics_hierarchy' },
        defaults: { value: logisticsHierarchy }
      });
      if (!hierarchyCreated) {
        hierarchyRow.value = logisticsHierarchy;
        hierarchyRow.changed('value', true);
        await hierarchyRow.save();
      }
    }

    if (rawJsonData) {
      const [fullRow, fullCreated] = await SystemConfig.findOrCreate({
        where: { key: 'kenya_locations_full' },
        defaults: { value: rawJsonData }
      });
      if (!fullCreated) {
        fullRow.value = rawJsonData;
        fullRow.changed('value', true);
        await fullRow.save();
      }
    }

    // --- EXPANDED 10-FIELD HERO CONFIGURATION DEFAULT ---
    await SystemConfig.findOrCreate({
      where: { key: 'hero_settings' },
      defaults: {
        value: {
          type: 'video',
          url: 'https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI',
          title: 'Direct From Mwea Paddy Fields',
          subtitle: '100% Pure Aromatic Pishori Rice harvested and delivered straight to your doorstep.',
          badgeText: '🌾 100% Authentic Mwea Harvest',
          buttonText: 'Shop Fresh Harvest Now',
          buttonLink: '/catalog',
          secondaryButtonText: 'View Flash Deals',
          secondaryButtonLink: '#flash-sales',
          overlayOpacity: 0.4,
          alignment: 'center',
          autoPlay: true,
          videoDuration: 5,
          imageDuration: 4
        }
      }
    });

    await SystemConfig.findOrCreate({
      where: { key: 'homepage_carousel' },
      defaults: {
        value: [
          { 
            id: "1", 
            type: 'video', 
            url: 'https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI', 
            title: 'Mwea Paddy Harvest Live', 
            subtitle: 'Direct from rich Kenyan soil into your kitchen.',
            duration: 5
          },
          { 
            id: "2", 
            type: 'image', 
            url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1200&q=80', 
            title: 'Pure Mwea Pishori Grade 1', 
            subtitle: 'Unmatched aroma and long-grain perfection.',
            duration: 4
          },
          { 
            id: "3", 
            type: 'image', 
            url: 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=1200&q=80', 
            title: 'Wholesale & Bulk Sack Delivery', 
            subtitle: 'Available in 5kg, 10kg, 25kg, and 50kg sacks with discounted transport.',
            duration: 3
          },
          { 
            id: "4", 
            type: 'image', 
            url: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=1200&q=80', 
            title: 'Premium Imported Basmati', 
            subtitle: 'Aged to perfection for fluffy, non-sticky ceremonial cooking.',
            duration: 4
          }
        ]
      }
    });

    // Seed Default Rice Products Catalog if empty
    const existingFeaturedCount = await RiceProduct.count();
    if (existingFeaturedCount === 0) {
      await RiceProduct.bulkCreate([
        {
          brandName: 'Pure Mwea Pishori Grade 1',
          variety: 'Aromatic Pishori',
          weightKg: 5,
          basePrice: 1250,
          buyingPrice: 950,
          flashSalePrice: 1100,
          stockQuantity: 150,
          imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
          isAvailable: true
        },
        {
          brandName: 'Super Aromatic Basmati',
          variety: 'Long Grain Basmati',
          weightKg: 10,
          basePrice: 2400,
          buyingPrice: 1800,
          flashSalePrice: 2150,
          stockQuantity: 80,
          imageUrl: 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=800&q=80',
          isAvailable: true
        },
        {
          brandName: 'Biryani Special Feast Grain',
          variety: 'Kaisari Long Grain',
          weightKg: 25,
          basePrice: 5200,
          buyingPrice: 4000,
          flashSalePrice: 4800,
          stockQuantity: 40,
          imageUrl: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=800&q=80',
          isAvailable: true
        },
        {
          brandName: 'Whole Grain Brown Pishori',
          variety: 'Brown Nutritious Rice',
          weightKg: 5,
          basePrice: 1400,
          buyingPrice: 1050,
          flashSalePrice: 1250,
          stockQuantity: 60,
          imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
          isAvailable: true
        }
      ]);
      console.log('🌾 Seeded default 4 Featured Grain selection products into database catalog.');
    }

    // Google Sign-In Account Synchronization Endpoint
    expressApp.post('/api/sync/google', async (req, res) => {
      const { googleId, fullName, email } = req.body || {};
      
      if (!googleId) {
        console.error("DEBUG: google-sync received an empty payload");
        return res.status(400).json({ error: "Missing identity credentials" });
      }

      try {
        let user = await User.findOne({ where: { googleId } });
        if (!user) {
          user = await User.create({ 
            googleId, 
            fullName: fullName || 'Google User', 
            email, 
            role: 'user',
            isVerified: true,
            isActive: true
          });
          console.log(`✨ Created fresh database profile for Google user: ${fullName}`);
        } else {
          console.log(`🔐 Verified existing database profile for Google user: ${fullName}`);
        }
        res.status(200).json({ message: "User profile synchronized", user });
      } catch (error) {
        console.error("Database Sync Error:", error);
        res.status(500).json({ error: "Database Synchronization Failed" });
      }
    });

    // Real-Time Socket.IO Server Setup (persistent hosts only)
    if (!IS_VERCEL) {
      initializeFlashSaleEngine(io);

      io.on('connection', (socket) => {
        if (flashSaleState.active) {
          socket.emit('blackFridayTick', { active: true, endTime: flashSaleState.endTime });
        }
        
        socket.on('joinAdminChannel', (token) => {
          jwt.verify(token, JWT_SECRET, async (err, decoded) => {
            if (!err && decoded && decoded.role === 'admin') {
              socket.join('admin-dashboard-room');
              console.log(`DEBUG: Admin connected to real-time broadcast room. User ID: ${decoded.id}`);
            }
          });
        });
      });
    } else {
      // Serverless: no timers or sockets. Flash sale state is refreshed from the DB per request.
      await syncFlashSaleFromDb(true);
      console.log('ℹ️ Vercel mode: Socket.IO disabled, clients should poll /api/config/flash-sale and order status endpoints.');
    }

    // Flash sale polling endpoint (used by Vercel deployments in place of WebSocket ticks)
    expressApp.get('/api/config/flash-sale', async (req, res) => {
      try {
        await syncFlashSaleFromDb(true);
        const msRemaining = flashSaleState.endTime ? Math.max(0, new Date(flashSaleState.endTime).getTime() - Date.now()) : 0;
        res.json({ active: flashSaleState.active, endTime: flashSaleState.endTime, msRemaining });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    /**
     * ==========================================
     * 6. PUBLIC & CUSTOMER REST API CONTROLLERS
     * ==========================================
     */

    // 1. PayHero STK Payment Trigger Endpoint
    expressApp.post('/api/payments/payhero/initiate', initiatePayHeroPayment);

    // 2. PayHero Automated Server Callback Webhook
    expressApp.post('/api/payments/payhero/webhook', handlePayHeroWebhook);

    // --- USER SIGNUP / REGISTER (SUPPORTS DIRECT & OTP VERIFICATION FLOW) ---
    expressApp.post('/api/user/signup', async (req, res) => {
      try {
        const { password, fullName, requireOtp, sendOtp, otp, code } = req.body || {};
        const { email, phone: phoneNumber } = splitIdentity(req.body);
        const inputOtp = otp || code;
        
        if (!password || !fullName || (!phoneNumber && !email)) {
          return res.status(400).json({ error: 'Full name, password, and at least a phone number or email are required.' });
        }
        if (!(inputOtp && req.body && req.body.verifyOnly)) {
          const pwProblem = validateNewPassword(password);
          if (pwProblem) return res.status(400).json({ error: pwProblem });
        }

        const searchCondition = [...identityConditions(email), ...identityConditions(phoneNumber)];

        const existingUser = await User.findOne({ where: { [Op.or]: searchCondition } });

        // If OTP code is submitted alongside signup payload, verify it
        if (inputOtp && existingUser && existingUser.verificationOtp) {
          if (existingUser.verificationOtp !== String(inputOtp).trim() || new Date(existingUser.verificationOtpExpires).getTime() < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired account verification OTP.' });
          }

          const hashedPassword = await bcrypt.hash(password, 12);
          existingUser.password = hashedPassword;
          existingUser.fullName = fullName;
          existingUser.isVerified = true;
          existingUser.isActive = true;
          existingUser.verificationOtp = null;
          existingUser.verificationOtpExpires = null;
          await existingUser.save();

          const token = jwt.sign({ id: existingUser.id, role: await effectiveRoleFor(existingUser) }, JWT_SECRET, { expiresIn: '7d' });
          return res.status(200).json({
            message: 'Account verified and created successfully.',
            token,
            user: {
              id: existingUser.id,
              fullName: existingUser.fullName,
              email: existingUser.email,
              phoneNumber: existingUser.phoneNumber,
              role: await effectiveRoleFor(existingUser),
              rewardPoints: existingUser.rewardPoints || 0
            }
          });
        }

        // If user already exists and is fully verified/active
        if (existingUser && existingUser.isVerified !== false && existingUser.password) {
          return res.status(409).json({ error: 'An account with this phone number or email address already exists.' });
        }
        if (!termsAccepted(req.body)) {
          return res.status(400).json({ error: TERMS_REQUIRED_MESSAGE, requiresTerms: true });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // If explicitly requested to send OTP during signup step
        if (requireOtp || sendOtp) {
          const { otpCode, tokenExpiration } = issueSignupOtp(existingUser);

          let targetUser = existingUser;
          if (!targetUser) {
            targetUser = await User.create({
              phoneNumber,
              email,
              password: hashedPassword,
              fullName,
              isVerified: false,
              isActive: true,
              verificationOtp: otpCode,
              verificationOtpExpires: tokenExpiration
            });
          } else {
            targetUser.fullName = fullName;
            targetUser.password = hashedPassword;
            targetUser.verificationOtp = otpCode;
            targetUser.verificationOtpExpires = tokenExpiration;
            await targetUser.save();
          }

          await recordTermsAcceptance(targetUser.id, req);
          if (req.body && req.body.referralCode) await attachReferral(targetUser.id, req.body.referralCode, 'signup', req);
          const delivery = await dispatchOtp(targetUser, otpCode, 'signup');
          if (!delivery.anySent) {
            return res.status(502).json({ error: OTP_DELIVERY_FAILED_MESSAGE });
          }

          return res.status(200).json({
            requiresOtp: true,
            smsSent: delivery.smsSent,
            emailSent: delivery.emailSent,
            message: 'Account creation OTP code has been dispatched to your email/phone.',
            email: targetUser.email,
            phoneNumber: targetUser.phoneNumber
          });
        }

        // Standard direct signup creation (backward compatible)
        let newUser;
        if (existingUser) {
          existingUser.password = hashedPassword;
          existingUser.fullName = fullName;
          existingUser.isVerified = true;
          existingUser.isActive = true;
          await existingUser.save();
          newUser = existingUser;
        } else {
          newUser = await User.create({ 
            phoneNumber, 
            email, 
            password: hashedPassword, 
            fullName, 
            isVerified: true, 
            isActive: true 
          });
        }
        
        await recordTermsAcceptance(newUser.id, req);
        if (req.body && req.body.referralCode) await attachReferral(newUser.id, req.body.referralCode, 'signup', req);
        await logEvent({ req, actor: { id: newUser.id, role: 'customer', name: newUser.fullName }, action: 'ACCOUNT_CREATED', category: 'auth', targetType: 'user', targetId: newUser.id, summary: `${newUser.fullName} created an account` });
        const token = jwt.sign({ id: newUser.id, role: await effectiveRoleFor(newUser) }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ 
          token, 
          user: { 
            id: newUser.id, 
            fullName: newUser.fullName, 
            role: await effectiveRoleFor(newUser), 
            rewardPoints: newUser.rewardPoints || 0 
          } 
        });
      } catch (err) { 
        console.error("Signup Processing Error:", err);
        res.status(500).json({ error: err.message || 'Internal server signup failure.' }); 
      }
    });
    // --- ACCOUNT CREATION OTP REQUEST ENDPOINTS ---
    const handleSignupOtpRequest = async (req, res) => {
      try {
        const { password, fullName } = req.body || {};
        const { email, phone: phoneNumber } = splitIdentity(req.body);
        
        if (!fullName || (!phoneNumber && !email)) {
          return res.status(400).json({ error: 'Full name and at least an email or phone number are required.' });
        }

        const searchCondition = [...identityConditions(email), ...identityConditions(phoneNumber)];

        const existingUser = await User.findOne({ where: { [Op.or]: searchCondition } });

        if (existingUser && existingUser.isVerified !== false && existingUser.password) {
          return res.status(409).json({ error: 'An account with this phone number or email address already exists.' });
        }
        if (!termsAccepted(req.body)) {
          return res.status(400).json({ error: TERMS_REQUIRED_MESSAGE, requiresTerms: true });
        }
        if (password) {
          const pwProblem = validateNewPassword(password);
          if (pwProblem) return res.status(400).json({ error: pwProblem });
        }

        const { otpCode, tokenExpiration } = issueSignupOtp(existingUser);
        let hashedPassword = existingUser ? existingUser.password : null;
        if (password) {
          hashedPassword = await bcrypt.hash(password, 12);
        }

        let userRecord = existingUser;
        if (!userRecord) {
          userRecord = await User.create({
            phoneNumber: phoneNumber || null,
            email: email || null,
            password: hashedPassword,
            fullName: fullName,
            isVerified: false,
            isActive: true,
            verificationOtp: otpCode,
            verificationOtpExpires: tokenExpiration
          });
        } else {
          userRecord.fullName = fullName;
          if (hashedPassword) userRecord.password = hashedPassword;
          userRecord.verificationOtp = otpCode;
          userRecord.verificationOtpExpires = tokenExpiration;
          userRecord.isVerified = false;
          await userRecord.save();
        }

        await recordTermsAcceptance(userRecord.id, req);
        if (req.body && req.body.referralCode) await attachReferral(userRecord.id, req.body.referralCode, 'signup', req);
        const delivery = await dispatchOtp(userRecord, otpCode, 'signup');
        if (!delivery.anySent) {
          return res.status(502).json({ error: OTP_DELIVERY_FAILED_MESSAGE });
        }

        res.status(200).json({
          success: true,
          smsSent: delivery.smsSent,
          emailSent: delivery.emailSent,
          message: 'Account creation OTP has been sent.',
          email: userRecord.email,
          phoneNumber: userRecord.phoneNumber,
          requiresOtp: true
        });
      } catch (err) {
        console.error('❌ Signup OTP Request Error:', err);
        res.status(500).json({ error: err.message || 'Failed to generate signup OTP.' });
      }
    };

    expressApp.post('/api/user/signup/request-otp', handleSignupOtpRequest);
    expressApp.post('/api/user/send-signup-otp', handleSignupOtpRequest);
    expressApp.post('/api/user/signup-otp', handleSignupOtpRequest);

    // --- ACCOUNT CREATION OTP VERIFICATION ENDPOINTS ---
    const handleSignupOtpVerification = async (req, res) => {
      try {
        const body = req.body || {};
        const { email: idEmail, phone: idPhone } = splitIdentity(body);
        const inputOtp = String(body.otp || body.code || body.otpCode || body.verificationCode || '').replace(/\s+/g, '');
        const searchIdentifier = idEmail || idPhone || body.email || body.phoneNumber;

        if (!searchIdentifier || !inputOtp) {
          console.warn(`⚠️ [VERIFY OTP] 400 missing field. Received keys: ${Object.keys(body).join(', ') || '(none)'}; identity found: ${!!searchIdentifier}; code found: ${!!inputOtp}`);
          return res.status(400).json({ error: 'Email or phone number and OTP verification code are required.' });
        }

        // Several records can match one phone/email spelling (old duplicates), so look at all of them: pending signups first.
        const candidates = await User.findAll({ where: { [Op.or]: identityConditions(searchIdentifier) } });
        candidates.sort((x, y) => (x.isVerified === false ? 0 : 1) - (y.isVerified === false ? 0 : 1));
        if (!candidates.length) {
          console.warn(`⚠️ [VERIFY OTP] 400 no account matches "${searchIdentifier}".`);
          return res.status(400).json({ error: 'No pending signup found for this phone number or email. Please register again.' });
        }
        const digitsOnly = inputOtp.replace(/\D/g, '');
        const codeMatches = (u) => u.verificationOtp && String(u.verificationOtp).trim() === digitsOnly;
        const candidate = candidates.find(codeMatches);

        if (!candidate) {
          const pending = candidates.find(u => u.verificationOtp) || candidates[0];
          if (pending.isVerified !== false && !pending.verificationOtp) {
            return res.status(400).json({ error: 'This account is already verified. Please sign in.' });
          }
          const wrong = (otpWrongGuesses.get(pending.id) || 0) + 1;
          otpWrongGuesses.set(pending.id, wrong);
          console.warn(`⚠️ [VERIFY OTP] 400 code mismatch for user ${pending.id} (phone ${pending.phoneNumber || '-'}, identity "${searchIdentifier}", guess ${wrong}/${OTP_MAX_WRONG}).`);
          if (wrong >= OTP_MAX_WRONG) {
            pending.verificationOtp = null;
            pending.verificationOtpExpires = null;
            await pending.save();
            otpWrongGuesses.delete(pending.id);
            await logEvent({ req, actor: { id: pending.id, role: 'anonymous', name: pending.fullName }, action: 'OTP_LOCKED', category: 'auth', severity: 'warn', targetType: 'user', targetId: pending.id,
              summary: `Signup code for ${pending.fullName} discarded after ${OTP_MAX_WRONG} wrong guesses` });
            return res.status(400).json({ error: 'Too many incorrect codes. Please request a new code.' });
          }
          return res.status(400).json({ error: `That code is not correct. Use the code from your latest SMS (${OTP_MAX_WRONG - wrong} attempt(s) left).` });
        }
        if (!candidate.verificationOtpExpires || new Date(candidate.verificationOtpExpires).getTime() <= Date.now()) {
          console.warn(`⚠️ [VERIFY OTP] 400 code expired for user ${candidate.id}.`);
          return res.status(400).json({ error: 'This verification code has expired. Please request a new one.' });
        }
        otpWrongGuesses.delete(candidate.id);
        const user = candidate;

        user.isVerified = true;
        user.isActive = true;
        user.verificationOtp = null;
        user.verificationOtpExpires = null;
        await user.save();

        if (body.referralCode) await attachReferral(user.id, body.referralCode, 'signup', req);
        await logEvent({ req, actor: { id: user.id, role: 'customer', name: user.fullName }, action: 'ACCOUNT_VERIFIED', category: 'auth', targetType: 'user', targetId: user.id, summary: `${user.fullName} verified their account` });

        const token = jwt.sign({ id: user.id, role: await effectiveRoleFor(user) }, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
          success: true,
          message: 'Account verified and created successfully!',
          token,
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: await effectiveRoleFor(user),
            rewardPoints: user.rewardPoints || 0
          }
        });
      } catch (err) {
        console.error('❌ Signup OTP Verification Error:', err);
        res.status(500).json({ error: err.message || 'Failed to verify account creation OTP.' });
      }
    };

    expressApp.post('/api/user/signup/verify-otp', handleSignupOtpVerification);
    expressApp.post('/api/user/verify-signup-otp', handleSignupOtpVerification);
    expressApp.post('/api/user/verify-signup', handleSignupOtpVerification);

    // --- RESEND SIGNUP OTP ENDPOINT ---
    const handleResendSignupOtp = async (req, res) => {
      try {
        const { email: idEmail, phone: idPhone } = splitIdentity(req.body || {});
        const searchIdentifier = idEmail || idPhone || (req.body || {}).email || (req.body || {}).phoneNumber;

        if (!searchIdentifier) {
          return res.status(400).json({ error: 'Email address or phone number is required.' });
        }

        const user = await User.findOne({
          where: {
            [Op.or]: identityConditions(searchIdentifier)
          }
        });

        if (!user) {
          return res.status(404).json({ error: 'No account registration found for this email/phone.' });
        }

        if (user.isVerified && user.password) {
          return res.status(400).json({ error: 'Account is already verified. Please sign in.' });
        }

        const { otpCode, tokenExpiration } = issueSignupOtp(user);

        user.verificationOtp = otpCode;
        user.verificationOtpExpires = tokenExpiration;
        await user.save();

        const delivery = await dispatchOtp(user, otpCode, 'signup');
        if (!delivery.anySent) {
          return res.status(502).json({ error: OTP_DELIVERY_FAILED_MESSAGE });
        }

        res.status(200).json({
          success: true,
          smsSent: delivery.smsSent,
          emailSent: delivery.emailSent,
          message: 'A fresh account verification OTP has been sent.'
        });
      } catch (err) {
        console.error('❌ Resend Signup OTP Error:', err);
        res.status(500).json({ error: err.message || 'Failed to resend signup OTP.' });
      }
    };

    expressApp.post('/api/user/signup/resend-otp', handleResendSignupOtp);
    expressApp.post('/api/user/resend-signup-otp', handleResendSignupOtp);

    // --- USER LOGIN ---
    expressApp.post('/api/user/login', async (req, res) => {
      try {
        const { phoneNumber, email, identifier, password } = req.body || {};
        const loginIdentifier = phoneNumber || email || identifier;
        
        if (!loginIdentifier || !password) {
          return res.status(400).json({ error: 'Phone number or email address and password are required.' });
        }

        const throttleKey = loginKey(normalizeKenyanPhone(loginIdentifier) || loginIdentifier);
        const lockedMs = loginLockedForMs(throttleKey);
        if (lockedMs > 0) {
          await logEvent({ req, actor: { id: null, role: 'anonymous', name: String(loginIdentifier).slice(0, 80) }, action: 'LOGIN_BLOCKED', category: 'auth', severity: 'alert',
            summary: `Login blocked for "${String(loginIdentifier).slice(0, 80)}" after repeated failures`, details: { retryInMinutes: Math.ceil(lockedMs / 60000) } });
          return res.status(429).json({ error: `Too many failed attempts. Try again in ${Math.ceil(lockedMs / 60000)} minute(s) or reset your password.` });
        }
        const failLogin = async (status, message, why, knownUser) => {
          const fails = registerLoginFailure(throttleKey);
          await logEvent({ req, actor: { id: knownUser ? knownUser.id : null, role: 'anonymous', name: knownUser ? knownUser.fullName : String(loginIdentifier).slice(0, 80) },
            action: fails >= LOGIN_MAX_FAILS ? 'LOGIN_LOCKOUT' : 'LOGIN_FAILED', category: 'auth', severity: fails >= LOGIN_MAX_FAILS ? 'alert' : 'warn',
            targetType: knownUser ? 'user' : null, targetId: knownUser ? knownUser.id : null,
            summary: `Failed login for "${String(loginIdentifier).slice(0, 80)}" (${why}), attempt ${fails}`, details: { reason: why, attempts: fails } });
          return res.status(status).json({ error: message });
        };

        const user = await User.findOne({ 
          where: { 
            [Op.or]: identityConditions(loginIdentifier)
          } 
        });

        if (!user) {
          return failLogin(401, 'Invalid login credentials or account has been suspended.', 'unknown account', null);
        }
        if (!user.isActive) {
          return failLogin(401, 'Invalid login credentials or account has been suspended.', 'suspended account', user);
        }

        if (!user.password) {
          return res.status(401).json({ error: 'This account was created via Google Sign-In. Please sign in with Google.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return failLogin(401, 'Invalid credentials or account disabled.', 'wrong password', user);
        }
        if (user.isVerified === false) {
          // Right password but the signup was never completed: send (or re-send) the code and let the page continue verification.
          const { otpCode, tokenExpiration } = issueSignupOtp(user);
          user.verificationOtp = otpCode;
          user.verificationOtpExpires = tokenExpiration;
          await user.save();
          const delivery = await dispatchOtp(user, otpCode, 'signup');
          await logEvent({ req, actor: { id: user.id, role: 'anonymous', name: user.fullName }, action: 'LOGIN_UNVERIFIED', category: 'auth', severity: 'warn', targetType: 'user', targetId: user.id,
            summary: `${user.fullName} tried to sign in before verifying; a code was ${delivery.anySent ? 'sent' : 'NOT delivered'}` });
          return res.status(403).json({
            error: 'Your account is not verified yet. We sent you a verification code. Enter it to finish creating your account.',
            requiresVerification: true,
            smsSent: delivery.smsSent,
            emailSent: delivery.emailSent
          });
        }
        loginFailures.delete(throttleKey);

        // Administrators sign in in two steps: password, then a code sent to their phone/email.
        if ((await effectiveRoleFor(user)) === 'admin' && (await twoFactorEnabled())) {
          const hasChannel = !!normalizeKenyanPhone(user.phoneNumber) || (user.email && String(user.email).includes('@'));
          if (hasChannel) {
            const code = String(crypto.randomInt(100000, 1000000));
            const challengeId = crypto.randomBytes(18).toString('hex');
            const delivery = await dispatchOtp(user, code, 'admin_login');
            if (!delivery.anySent) {
              await logEvent({ req, actor: { id: user.id, role: 'admin', name: user.fullName }, action: 'ADMIN_2FA_DELIVERY_FAILED', category: 'auth', severity: 'alert', targetType: 'user', targetId: user.id,
                summary: `Could not deliver the admin sign-in code to ${user.fullName}. Check SMS credit and email settings, or set DISABLE_ADMIN_2FA=true temporarily.` });
              return res.status(502).json({ error: 'We could not send your sign-in code (SMS or email). Check your SMS credit/email settings.' });
            }
            twoFactorChallenges.set(challengeId, { userId: user.id, code: crypto.createHash('sha256').update(code).digest('hex'), expires: Date.now() + 5 * 60 * 1000, attempts: 0, resends: 0 });
            await logEvent({ req, actor: { id: user.id, role: 'admin', name: user.fullName }, action: 'ADMIN_2FA_SENT', category: 'auth', targetType: 'user', targetId: user.id, summary: `Sign-in code sent to administrator ${user.fullName}` });
            return res.status(200).json({ requiresTwoFactor: true, challengeId, smsSent: delivery.smsSent, emailSent: delivery.emailSent,
              message: `Enter the 6-digit code we sent to your ${delivery.smsSent ? 'phone' : 'email'}.` });
          }
        }

        const token = jwt.sign({ id: user.id, role: await effectiveRoleFor(user) }, JWT_SECRET, { expiresIn: '7d' });
        await logEvent({ req, actor: { id: user.id, role: await effectiveRoleFor(user), name: user.fullName }, action: 'LOGIN_SUCCESS', category: 'auth', targetType: 'user', targetId: user.id, summary: `${user.fullName} signed in` });
        res.json({ 
          token, 
          user: { 
            id: user.id, 
            fullName: user.fullName, 
            role: await effectiveRoleFor(user), 
            phoneNumber: user.phoneNumber, 
            email: user.email, 
            rewardPoints: user.rewardPoints || 0 
          } 
        });
      } catch (err) { 
        console.error("Login Processing Error:", err);
        res.status(500).json({ error: err.message || 'Internal server authentication failure.' }); 
      }
    });

    // --- USER PROFILE MANAGEMENT ---
    expressApp.get('/api/user/profile', authenticateToken, async (req, res) => {
      try {
        const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password', 'resetToken', 'resetTokenExpires', 'verificationOtp', 'verificationOtpExpires'] } });
        if (!user) return res.status(404).json({ error: 'User profile not found.' });
        const staffRow = await StaffRole.findOne({ where: { userId: user.id } });
        res.json({ ...user.toJSON(), role: await effectiveRoleFor(user), referralCode: staffRow && staffRow.role === 'agent' ? staffRow.referralCode : undefined });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.put('/api/user/profile', authenticateToken, async (req, res) => {
      try {
        const { fullName, email, phoneNumber, currentPassword, newPassword } = req.body || {};
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User account not found.' });

        if (fullName !== undefined) user.fullName = fullName;
        if (email !== undefined) user.email = email;
        if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;

        if (newPassword && newPassword.trim() !== '') {
          if (user.password) {
            if (!currentPassword) {
              return res.status(400).json({ error: 'Current password is required to update your password.' });
            }
            const match = await bcrypt.compare(currentPassword, user.password);
            if (!match) {
              return res.status(400).json({ error: 'Current password provided is incorrect.' });
            }
          }
          const newPwProblem = validateNewPassword(newPassword);
          if (newPwProblem) {
            return res.status(400).json({ error: newPwProblem });
          }
          user.password = await bcrypt.hash(newPassword, 12);
        }

        await user.save();
        res.json({ 
          message: 'Profile details updated successfully.', 
          user: { 
            id: user.id, 
            fullName: user.fullName, 
            email: user.email, 
            phoneNumber: user.phoneNumber, 
            role: await effectiveRoleFor(user), 
            rewardPoints: user.rewardPoints || 0 
          } 
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- ACCOUNT SELF-SUSPENSION ---
    expressApp.post('/api/user/suspend', authenticateToken, async (req, res) => {
      try {
        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        user.isActive = false;
        await user.save();

        res.json({ message: 'Account suspended successfully. Contact customer support if you need to reactivate.' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- FORGOT PASSWORD (OTP GENERATION & SMTP/SMS DISPATCH) ---
    const handleForgotPasswordRequest = async (req, res) => {
      try {
        const { email, phoneNumber } = req.body || {};
        const searchIdentifier = email || phoneNumber;

        if (!searchIdentifier) {
          return res.status(400).json({ error: 'Email address or phone number is required.' });
        }

        const user = await User.findOne({
          where: {
            [Op.or]: identityConditions(searchIdentifier)
          }
        });
        
        if (!user) {
          return res.status(200).json({ 
            message: 'If an account with that email or phone exists, a password reset OTP code has been dispatched.' 
          });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const tokenExpiration = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

        user.resetToken = otpCode;
        user.resetTokenExpires = tokenExpiration;
        await user.save();

        const delivery = await dispatchOtp(user, otpCode, 'reset');
        if (!delivery.anySent) {
          return res.status(502).json({ error: OTP_DELIVERY_FAILED_MESSAGE });
        }

        res.status(200).json({ message: 'If an account exists, a password reset OTP code has been dispatched.' });
      } catch (err) {
        console.error('❌ Forgot Password OTP Error:', err);
        res.status(500).json({ error: 'Failed to dispatch password reset OTP.', detail: err.message });
      }
    };

    expressApp.post('/api/user/forgot-password', handleForgotPasswordRequest);
    expressApp.post('/api/user/send-reset-otp', handleForgotPasswordRequest);
    expressApp.post('/api/user/forgot-password/request-otp', handleForgotPasswordRequest);

    // --- VERIFY FORGOT PASSWORD OTP ENDPOINT ---
    const handleVerifyResetOtp = async (req, res) => {
      try {
        const { email, phoneNumber, otp, code, resetToken } = req.body || {};
        const inputOtp = String(otp || code || resetToken || '').trim();
        const searchIdentifier = email || phoneNumber;

        if (!searchIdentifier || !inputOtp) {
          return res.status(400).json({ error: 'Email address and OTP code are required.' });
        }

        const user = await User.findOne({
          where: {
            [Op.or]: identityConditions(searchIdentifier),
            resetToken: inputOtp,
            resetTokenExpires: { [Op.gt]: new Date() }
          }
        });

        if (!user) {
          return res.status(400).json({ error: 'Invalid or expired password reset OTP code.' });
        }

        res.status(200).json({
          success: true,
          valid: true,
          message: 'Password reset OTP code is valid.'
        });
      } catch (err) {
        console.error('❌ Verify Reset OTP Error:', err);
        res.status(500).json({ error: err.message || 'Failed to verify password reset OTP.' });
      }
    };

    expressApp.post('/api/user/verify-reset-otp', handleVerifyResetOtp);
    expressApp.post('/api/user/forgot-password/verify-otp', handleVerifyResetOtp);

    // --- RESET PASSWORD WITH OTP ---
    expressApp.post('/api/user/reset-password', async (req, res) => {
      try {
        const { email, phoneNumber, otp, token, code, resetToken, newPassword, password } = req.body || {};
        const verificationCode = otp || token || code || resetToken;
        const targetPassword = newPassword || password;
        const searchIdentifier = email || phoneNumber;

        if (!searchIdentifier || !verificationCode || !targetPassword) {
          return res.status(400).json({ error: 'Email or phone number, OTP code, and new password are required.' });
        }

        const resetPwProblem = validateNewPassword(targetPassword);
        if (resetPwProblem) {
          return res.status(400).json({ error: resetPwProblem });
        }

        const user = await User.findOne({ 
          where: { 
            [Op.or]: identityConditions(searchIdentifier),
            resetToken: String(verificationCode).trim(),
            resetTokenExpires: { [Op.gt]: new Date() } 
          } 
        });

        if (!user) {
          return res.status(400).json({ error: 'Invalid or expired OTP verification code.' });
        }

        const hashedPassword = await bcrypt.hash(targetPassword, 12);

        user.password = hashedPassword;
        user.resetToken = null;
        user.resetTokenExpires = null;
        await user.save();

        res.status(200).json({ message: 'Password has been reset successfully. You can now login with your new password.' });
      } catch (err) {
        console.error('❌ Reset Password OTP Error:', err);
        res.status(500).json({ error: 'Internal server error while resetting password.' });
      }
    });

    // --- REWARD POINTS TRACKING ---
    expressApp.get('/api/user/points', authenticateToken, async (req, res) => {
      try {
        const user = await User.findByPk(req.user.id, { attributes: ['id', 'fullName', 'rewardPoints'] });
        res.json({
          rewardPoints: user ? user.rewardPoints || 0 : 0,
          ratePerKg: 0.2
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    /**
     * ==========================================
     * USER PERSISTENT CART MANAGEMENT APIs
     * ==========================================
     */
    expressApp.get('/api/cart', authenticateToken, async (req, res) => {
      try {
        const items = await Cart.findAll({
          where: { userId: req.user.id },
          include: [{ model: RiceProduct, as: 'product' }]
        });
        
        let totalKg = 0;
        const formattedItems = items.map(item => {
          const p = item.product ? item.product.toJSON() : {};
          const weight = p.weightKg || 0;
          const qty = item.quantity || 1;
          totalKg += weight * qty;
          let effectivePrice = p.basePrice || p.price || 0;
          if (flashSaleState && flashSaleState.active && p.flashSalePrice) {
            effectivePrice = p.flashSalePrice;
          }
          return {
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            product: {
              ...p,
              price: effectivePrice
            }
          };
        });

        const expectedPoints = Number((totalKg * 0.2).toFixed(2));
        res.json({ items: formattedItems, totalKg, expectedPoints });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.post('/api/cart/add', authenticateToken, async (req, res) => {
      try {
        const { productId, quantity } = req.body || {};
        const qty = Number(quantity || 1);
        
        let cartItem = await Cart.findOne({ where: { userId: req.user.id, productId } });
        if (cartItem) {
          cartItem.quantity += qty;
          await cartItem.save();
        } else {
          cartItem = await Cart.create({ userId: req.user.id, productId, quantity: qty });
        }
        
        res.status(201).json({ message: 'Item added to shopping cart successfully.', cartItem });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.put('/api/cart/item/:id', authenticateToken, async (req, res) => {
      try {
        const { quantity } = req.body || {};
        const cartItem = await Cart.findOne({ where: { id: req.params.id, userId: req.user.id } });
        if (!cartItem) return res.status(404).json({ error: 'Cart item not found.' });
        
        if (Number(quantity) <= 0) {
          await cartItem.destroy();
          return res.json({ message: 'Cart item removed.' });
        }
        
        cartItem.quantity = Number(quantity);
        await cartItem.save();
        res.json({ message: 'Cart item quantity updated.', cartItem });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.delete('/api/cart/item/:id', authenticateToken, async (req, res) => {
      try {
        const deleted = await Cart.destroy({ where: { id: req.params.id, userId: req.user.id } });
        if (!deleted) return res.status(404).json({ error: 'Cart item not found.' });
        res.json({ message: 'Item deleted from shopping cart.' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.delete('/api/cart', authenticateToken, async (req, res) => {
      try {
        await Cart.destroy({ where: { userId: req.user.id } });
        res.json({ message: 'User shopping cart cleared successfully.' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- PRODUCTS CATALOG & FEATURED PRODUCTS APIs ---
    expressApp.get('/api/products/catalog', async (req, res) => {
      try {
        const { variety, minWeight, maxWeight, maxPrice, search } = req.query;
        let whereCondition = { isAvailable: true };

        if (variety) whereCondition.variety = variety;
        if (minWeight || maxWeight) {
          whereCondition.weightKg = {};
          if (minWeight) whereCondition.weightKg[Op.gte] = Number(minWeight);
          if (maxWeight) whereCondition.weightKg[Op.lte] = Number(maxWeight);
        }
        if (search) {
          whereCondition[Op.or] = [
            { brandName: { [LIKE_OP]: `%${search}%` } },
            { variety: { [LIKE_OP]: `%${search}%` } }
          ];
        }

        const products = await RiceProduct.findAll({ where: whereCondition });
        
        const optimizedCatalog = products.map(product => {
          const productObj = product.toJSON();
          let currentEffectivePrice = productObj.basePrice || productObj.price || 0;
          if (flashSaleState && flashSaleState.active && productObj.flashSalePrice !== null && productObj.flashSalePrice !== undefined) {
            currentEffectivePrice = productObj.flashSalePrice;
          }
          return {
            ...productObj,
            price: currentEffectivePrice,
            imageUrl: productObj.imageUrl || productObj.image || productObj.url || null,
            isBlackFridayApplied: (flashSaleState && flashSaleState.active && productObj.flashSalePrice !== null && productObj.flashSalePrice !== undefined)
          };
        }).filter(item => !maxPrice || item.price <= Number(maxPrice));

        res.json(await decorateProducts(optimizedCatalog));
      } catch (err) { 
        res.status(500).json({ error: err.message }); 
      }
    });

    expressApp.get('/api/products/featured', async (req, res) => {
      try {
        const featuredProducts = await RiceProduct.findAll({
          where: { isAvailable: true },
          limit: 4,
          order: [['id', 'ASC']]
        });

        const formatted = featuredProducts.map(p => {
          const pObj = p.toJSON();
          let currentPrice = pObj.basePrice || pObj.price || 0;
          if (flashSaleState && flashSaleState.active && pObj.flashSalePrice) {
            currentPrice = pObj.flashSalePrice;
          }
          return {
            ...pObj,
            price: currentPrice,
            imageUrl: pObj.imageUrl || pObj.image || null
          };
        });

        res.json(await decorateProducts(formatted));
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- CONFIGURATION RETRIEVAL ENDPOINTS ---
    expressApp.get('/api/config/carousel', async (req, res) => {
      try {
        const config = await SystemConfig.findOne({ where: { key: 'homepage_carousel' } });
        res.json(config ? config.value : []);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.get('/api/config/hero', async (req, res) => {
      try {
        const config = await SystemConfig.findOne({ where: { key: 'hero_settings' } });
        res.json(config ? config.value : {});
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Dynamic County Shipping Overrides API (Backed by kenya_locations.json)
    expressApp.get('/api/config/counties', async (req, res) => {
      try {
        const config = await SystemConfig.findOne({ where: { key: 'county_overrides' } });
        res.json(config ? config.value : countyOverrides);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Dynamic Logistics Locations Hierarchy API (Backed by kenya_locations.json)
    expressApp.get('/api/config/locations', async (req, res) => {
      try {
        const config = await SystemConfig.findOne({ where: { key: 'logistics_hierarchy' } });
        res.json(config ? config.value : logisticsHierarchy);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Full Raw Location Dataset Endpoint for Advanced Frontend Multi-Select UI
    expressApp.get('/api/config/locations-full', async (req, res) => {
      try {
        const config = await SystemConfig.findOne({ where: { key: 'kenya_locations_full' } });
        if (config && config.value) {
          return res.json(config.value);
        }
        res.json({ counties: countyOverrides, hierarchy: logisticsHierarchy });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.get('/api/config/payment-methods', async (req, res) => {
      try {
        const config = await SystemConfig.findOne({ where: { key: 'mpesa_config' } });
        res.json(config ? config.value : {
          paybillNumber: '522522',
          paybillAccount: 'MWEARICE',
          tillNumber: '889900',
          stkEnabled: true
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- USER ORDERS RETRIEVAL ---
    expressApp.get('/api/orders/my-orders', authenticateToken, async (req, res) => {
      try {
        const orders = await Order.findAll({
          where: { userId: req.user.id },
          order: [['createdAt', 'DESC']]
        });
        res.json(orders);
      } catch (err) { 
        res.status(500).json({ error: err.message }); 
      }
    });

    expressApp.get('/api/orders/:id', authenticateToken, async (req, res) => {
      try {
        const order = await Order.findByPk(req.params.id, {
          include: [{ model: User, attributes: ['id', 'fullName', 'phoneNumber', 'email'] }]
        });
        if (!order) return res.status(404).json({ error: 'Order not found.' });

        if (order.userId !== req.user.id && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Access denied.' });
        }

        res.json(order);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- DIRECT M-PESA STK PUSH ROUTE ---
    const handleStkPushRequest = async (req, res) => {
      try {
        const { phoneNumber, phone, amount, orderId, external_reference } = req.body || {};
        const targetPhone = phoneNumber || phone;
        const targetAmount = amount || 10;
        const ref = external_reference || (orderId ? `ORD-${orderId}` : `STK-${Date.now()}`);

        if (!targetPhone) {
          return res.status(400).json({ error: 'Phone number parameter is required for M-Pesa STK push.' });
        }

        const callbackEndpoint = `${RENDER_BASE_URL}/api/payments/payhero/callback`;

        console.log(`📱 Dispatching Direct PayHero STK Push to ${targetPhone}, Amount: KES ${targetAmount}, Ref: ${ref}`);

        const payheroResponse = await axios.post(
          'https://backend.payhero.co.ke/api/v2/payments',
          {
            amount: Number(targetAmount),
            phone_number: targetPhone,
            channel_id: PAYHERO_CHANNEL_ID,
            provider: 'm-pesa',
            external_reference: ref,
            callback_url: callbackEndpoint
          },
          {
            headers: {
              'Authorization': getPayHeroAuthHeader(),
              'Content-Type': 'application/json'
            }
          }
        );

        res.status(200).json({
          success: true,
          message: 'STK push prompt dispatched successfully to handset.',
          data: payheroResponse.data
        });
      } catch (stkError) {
        console.error('❌ Direct STK Push Processing Failure:', stkError.response ? stkError.response.data : stkError.message);
        res.status(500).json({
          success: false,
          error: stkError.response?.data?.message || stkError.message || 'Failed to dispatch M-Pesa STK Push.'
        });
      }
    };

    expressApp.post('/api/payments/stkpush', handleStkPushRequest);
    expressApp.post('/api/payments/stk-push', handleStkPushRequest);
    expressApp.post('/api/payment/stkpush', handleStkPushRequest);

    // --- CREATE ORDER, CALCULATE WEIGHT/POINTS & TRIGGER PAYHERO STK PUSH ---
    expressApp.post('/api/orders/create', authenticateToken, async (req, res) => {
      try {
        let { 
          cartItems, 
          paymentMethod, 
          mpesaPhoneNumber,
          county, 
          town, 
          location, 
          sublocation, 
          streetAddress,
          shippingAddress, 
          shippingFee, 
          grandTotal 
        } = req.body || {};
        
        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
          return res.status(400).json({ error: 'Shopping cart items cannot be empty.' });
        }

        // Pre-validate every line BEFORE any stock is deducted, so a failing line cannot leave earlier lines half-processed.
        for (const preItem of cartItems) {
          const preId = preItem.productId || preItem.laptopId || preItem.id;
          const preQty = Number(preItem.quantity);
          if (!Number.isFinite(preQty) || preQty <= 0) {
            return res.status(400).json({ error: `Invalid quantity supplied for product ID: ${preId}.` });
          }
          const preProduct = await RiceProduct.findByPk(preId);
          if (!preProduct || preProduct.stockQuantity < preQty) {
            return res.status(422).json({ error: `Insufficient stock for product ID: ${preId} (${preProduct ? preProduct.brandName : 'Unknown Item'}).` });
          }
        }

        // Resolve the delivery county/constituency against the official dataset BEFORE any stock is deducted.
        let activeCountyMap = countyOverrides;
        if (!county || !String(county).trim() || !town || !String(town).trim()) {
          return res.status(400).json({ error: 'Please choose your delivery county and town before placing the order.' });
        }
        if (county) {
          const countyConfig = await SystemConfig.findOne({ where: { key: 'county_overrides' } });
          if (countyConfig && countyConfig.value) activeCountyMap = { ...countyOverrides, ...countyConfig.value };
          const canonicalCounty = resolveLocationName(county, Object.keys(activeCountyMap || {}));
          if (!canonicalCounty) {
            return res.status(400).json({ error: `Unknown county "${county}". Please select a valid Kenyan county.` });
          }
          county = canonicalCounty;
          const countyAreas = Array.isArray(logisticsHierarchy && logisticsHierarchy[canonicalCounty]) ? logisticsHierarchy[canonicalCounty] : [];
          const canonicalTown = town ? resolveLocationName(town, countyAreas) : null;
          if (canonicalTown) town = canonicalTown;
        }

        let calculatedSubtotal = 0;
        let totalWeightKg = 0;
        const builtOrderLineItems = [];
        const wholesaleTiers = await getWholesaleTiers();

        for (const item of cartItems) {
          const targetId = item.productId || item.laptopId || item.id;
          const product = await RiceProduct.findByPk(targetId);
          
          if (!product || product.stockQuantity < item.quantity) {
            return res.status(422).json({ error: `Insufficient stock for product ID: ${targetId} (${product ? product.brandName : 'Unknown Item'}).` });
          }

          let purchasePrice = product.basePrice || product.price || 0;
          if (flashSaleState.active && product.flashSalePrice !== null && product.flashSalePrice !== undefined) {
            purchasePrice = product.flashSalePrice;
          }

          // Bulk pricing: the best price wins between the normal/flash price and the quantity tier
          const tier = bestTier(wholesaleTiers[product.id], Number(item.quantity));
          let wholesaleApplied = false;
          if (tier && Number(tier.price) < Number(purchasePrice)) { purchasePrice = Number(tier.price); wholesaleApplied = true; }

          const itemKg = (product.weightKg || 0) * item.quantity;
          totalWeightKg += itemKg;

          calculatedSubtotal += (purchasePrice * item.quantity);
          product.stockQuantity -= item.quantity; 
          await product.save();

          builtOrderLineItems.push({ 
            productId: product.id, 
            name: `${product.brandName} ${product.variety || ''} (${product.weightKg || 0}kg)`,
            variety: product.variety || 'Aromatic Rice',
            brandName: product.brandName,
            weightKg: product.weightKg || 0,
            quantity: item.quantity, 
            priceAtPurchase: purchasePrice,
            wholesaleApplied,
            buyingPrice: product.buyingPrice || (purchasePrice * 0.75),
            imageUrl: product.imageUrl || product.image || null
          });
          
          io.emit('stockUpdated', { productId: product.id, newStockQuantity: product.stockQuantity });
          
          if (product.stockQuantity <= await lowStockThresholdFor(product.id)) {
            await notifyLowStock(product);
          }
        }

        let activeTransportCharge = shippingFee !== undefined ? Number(shippingFee) : 250;
        if (county && activeCountyMap && activeCountyMap[county] !== undefined) {
          activeTransportCharge = Number(activeCountyMap[county]);
        }

        const fullDeliveryAddress = {
          county: county || 'Not Specified',
          town: town || 'Not Specified',
          location: location || 'Not Specified',
          sublocation: sublocation || 'Not Specified',
          streetAddress: streetAddress || 'Not Specified',
          details: shippingAddress || `${streetAddress || ''}, ${sublocation || ''}, ${location || ''}, ${town || ''}, ${county || ''}`
        };

        const finalOrderTotal = Number((calculatedSubtotal + activeTransportCharge).toFixed(2)); // always computed server-side
        const earnedPoints = Number((totalWeightKg * 0.2).toFixed(2));

        const generatedOrder = await Order.create({
          userId: req.user.id,
          items: builtOrderLineItems,
          transportFee: activeTransportCharge,
          subTotal: calculatedSubtotal,
          grandTotal: finalOrderTotal,
          totalWeightKg: totalWeightKg,
          pointsEarned: earnedPoints,
          paymentDetails: { 
            method: paymentMethod || 'mpesa_stk', 
            isPaid: false,
            paidTag: 'PENDING',
            mpesaNumber: mpesaPhoneNumber || null,
            amount: finalOrderTotal,
            paidAt: null,
            mpesaReceipt: null,
            failureReason: null
          },
          county: county || 'Not Specified', 
          town: town || '',
          location: location || '',
          sublocation: sublocation || '',
          shippingAddress: fullDeliveryAddress,
          status: 'pending' 
        });

        // Clear user shopping cart after successful order creation
        await Cart.destroy({ where: { userId: req.user.id } });

        // Referral code typed at checkout (only links customers that do not already belong to an agent)
        let referralResult = { attached: false };
        if (req.body && req.body.referralCode) referralResult = await attachReferral(req.user.id, req.body.referralCode, 'checkout', req);
        await logEvent({ req, action: 'ORDER_CREATED', category: 'orders', targetType: 'order', targetId: generatedOrder.id,
          summary: `Order #${generatedOrder.id} placed for KES ${finalOrderTotal} (${county || 'no county'}, ${paymentMethod || 'mpesa_stk'})`,
          details: { items: builtOrderLineItems.length, kg: totalWeightKg, referralLinked: !!referralResult.attached } });

        let stkInitiated = false;
        let stkMessage = '';

        if (paymentMethod === 'mpesa_stk') {
          const targetPhone = mpesaPhoneNumber || req.user.phoneNumber;
          const callbackEndpoint = `${RENDER_BASE_URL}/api/payments/payhero/callback`;

          try {
            console.log(`📱 Triggering PayHero STK Push for Order #${generatedOrder.id} to ${targetPhone}...`);
            
            const payheroResponse = await axios.post(
              'https://backend.payhero.co.ke/api/v2/payments',
              {
                amount: finalOrderTotal,
                phone_number: targetPhone,
                channel_id: PAYHERO_CHANNEL_ID,
                provider: 'm-pesa',
                external_reference: `ORD-${generatedOrder.id}`,
                callback_url: callbackEndpoint
              },
              {
                headers: {
                  'Authorization': getPayHeroAuthHeader(),
                  'Content-Type': 'application/json'
                }
              }
            );

            stkInitiated = true;
            stkMessage = 'STK Push payment prompt sent to handset successfully.';
            console.log(`✅ PayHero Response for Order #${generatedOrder.id}:`, payheroResponse.data);
          } catch (stkError) {
            stkMessage = 'Failed to trigger M-Pesa prompt automatically. You can retry from your order dashboard.';
            console.error(`❌ PayHero STK Push Error for Order #${generatedOrder.id}:`, stkError.response ? stkError.response.data : stkError.message);
          }
        }

        io.to('admin-dashboard-room').emit('newOrderAlert', generatedOrder);
        res.status(201).json({
          ...generatedOrder.toJSON(),
          stkPromptSent: stkInitiated,
          stkStatusMessage: stkMessage
        });

      } catch (err) { 
        console.error("Order Creation Error:", err);
        res.status(500).json({ error: err.message }); 
      }
    });

    // --- PAYHERO PAYMENT STATUS POLLING API ---
    const handlePayHeroStatusCheck = async (req, res) => {
      try {
        const order = await Order.findByPk(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found.' });

        const ref = `ORD-${order.id}`;
        let heroStatusData = null;
        let failureReason = null;
        let isSuccess = false;
        let receiptFromHero = null;

        try {
          const response = await axios.get(
            `https://backend.payhero.co.ke/api/v2/payments?external_reference=${ref}`,
            { headers: { 'Authorization': getPayHeroAuthHeader() } }
          );
          heroStatusData = response.data;
          
          const paymentObj = Array.isArray(heroStatusData) ? heroStatusData[0] : (heroStatusData.response || heroStatusData);
          if (paymentObj) {
            const rawStatus = String(paymentObj.status || paymentObj.Status || '').toUpperCase();
            if (rawStatus === 'SUCCESS' || rawStatus === 'PAID') {
              isSuccess = true;
              receiptFromHero = paymentObj.provider_reference || paymentObj.mpesa_receipt_number || paymentObj.MpesaReceiptNumber || paymentObj.receipt_number || null;
            } else if (rawStatus === 'FAILED' || rawStatus === 'CANCELLED' || rawStatus === 'REJECTED') {
              failureReason = paymentObj.failure_reason || paymentObj.message || paymentObj.ResultDesc || 'Payment failed or was cancelled by user.';
            }
          }
        } catch (apiErr) {
          console.warn(`PayHero live status poll warning for Order #${order.id}:`, apiErr.message);
        }

        if (isSuccess && !order.paymentDetails?.isPaid) {
          await confirmOrderPaid(order, 'payment status check', receiptFromHero);
        } else if (failureReason) {
          order.paymentDetails = {
            ...order.paymentDetails,
            isPaid: false,
            paidTag: 'FAILED',
            failureReason: failureReason
          };
          order.status = 'payment_failed';
          await order.save();
          await logEvent({ action: 'PAYMENT_FAILED', category: 'orders', severity: 'warn', targetType: 'order', targetId: order.id,
            summary: `Payment failed for order #${order.id}: ${failureReason}`, details: { userId: order.userId } });
          io.emit('orderStatusUpdated', order);
        }

        const shown = (await Order.findByPk(order.id)) || order;
        res.json({
          orderId: shown.id,
          status: shown.status,
          paymentStatus: shown.paymentDetails?.paidTag || (shown.paymentDetails?.isPaid ? 'PAID' : 'PENDING'),
          paymentDetails: shown.paymentDetails,
          totalWeightKg: shown.totalWeightKg || 0,
          pointsEarned: shown.pointsEarned || 0,
          heroData: heroStatusData
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    };

    expressApp.get('/api/payments/payhero/status/:orderId', authenticateToken, handlePayHeroStatusCheck);
    expressApp.get('/api/payment-status/:orderId', authenticateToken, handlePayHeroStatusCheck);

    // --- PAYHERO PAYMENT WEBHOOK CALLBACK RECEIVER ---
    expressApp.post('/api/payments/payhero/callback', async (req, res) => {
      try {
        console.log('🔔 PayHero Callback Notification Received:', JSON.stringify(req.body, null, 2));

        const body = req.body || {};
        const responseObj = body.response || body;

        const externalRef = responseObj.external_reference || responseObj.ExternalReference || body.external_reference || body.ExternalReference;
        const statusStr = responseObj.status || responseObj.Status || body.status || body.Status;
        const mpesaReceipt = responseObj.mpesa_code || responseObj.MpesaReceiptNumber || body.mpesa_code || body.MpesaReceiptNumber || null;

        if (externalRef && String(externalRef).startsWith('ORD-')) {
          const orderId = String(externalRef).replace('ORD-', '');
          const order = await Order.findByPk(orderId);

          if (order) {
            const isPaymentSuccessful = String(statusStr).toUpperCase() === 'SUCCESS' || body.success === true;
            const existingPaymentDetails = order.paymentDetails || {};

            // A callback is just a web request anyone could forge, so confirm the payment with PayHero before crediting anything.
            if (isPaymentSuccessful && existingPaymentDetails.isPaid !== true) {
              const reallyPaid = await verifyPayHeroPayment(order.id);
              if (!reallyPaid) {
                await logEvent({ action: 'PAYMENT_CALLBACK_UNVERIFIED', category: 'orders', severity: 'alert', targetType: 'order', targetId: order.id,
                  summary: `Callback claimed order #${order.id} was paid but PayHero could not confirm it`, details: { receipt: mpesaReceipt } });
                return res.status(200).json({ status: 'PENDING_VERIFICATION', message: 'Payment will be confirmed by the status check.' });
              }
            }
            
            if (isPaymentSuccessful) {
              const confirmation = await confirmOrderPaid(order, 'M-Pesa callback', mpesaReceipt, body);
              console.log(`🎉 Payment VERIFIED for Order #${order.id}. M-Pesa Receipt: ${mpesaReceipt} (${confirmation.confirmed ? 'newly confirmed' : confirmation.reason})`);
              return res.status(200).json({ status: 'SUCCESS', message: 'Callback received and processed successfully.' });
            } else {
              if (existingPaymentDetails.isPaid === true) {
                return res.status(200).json({ status: 'SUCCESS', message: 'Ignored: this order is already paid.' });
              }
              const reason = responseObj.message || responseObj.failure_reason || responseObj.ResultDesc || 'Insufficient M-Pesa balance or user cancelled transaction.';
              order.status = 'payment_failed';
              order.paymentDetails = {
                ...existingPaymentDetails,
                isPaid: false,
                paidTag: 'FAILED',
                failureReason: reason,
                rawCallback: body
              };
              console.log(`⚠️ Payment FAILED/CANCELLED for Order #${order.id}. Reason: ${reason}`);
            }

            await order.save();

            if (isPaymentSuccessful && existingPaymentDetails.isPaid !== true) {
              await onOrderPaid(order, 'M-Pesa callback');
            } else if (!isPaymentSuccessful) {
              await logEvent({ action: 'PAYMENT_FAILED', category: 'orders', severity: 'warn', targetType: 'order', targetId: order.id,
                summary: `Payment failed for order #${order.id}`, details: { userId: order.userId } });
            }

            io.to('admin-dashboard-room').emit('paymentReceived', {
              orderId: order.id,
              status: order.status,
              isPaid: isPaymentSuccessful,
              mpesaReceipt: mpesaReceipt,
              paymentDetails: order.paymentDetails
            });

            io.emit('orderStatusUpdated', order);
          } else {
            console.warn(`⚠️ Received callback for non-existent Order ID: ${orderId}`);
          }
        }

        res.status(200).json({ status: 'SUCCESS', message: 'Callback received and processed successfully.' });
      } catch (err) {
        console.error('❌ Error processing PayHero Callback:', err);
        res.status(200).json({ status: 'ERROR', message: err.message });
      }
    });

    /**
     * ==========================================
     * 7. SECURE ADMINISTRATIVE ENGINE & ANALYTICS
     * ==========================================
     */
    
    // --- ADMIN FINANCIAL ANALYTICS DASHBOARD ---
    expressApp.get('/api/admin/analytics/finances', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const selectedYear = Number(req.query.year || new Date().getFullYear());
        
        const allOrders = await Order.findAll({
          include: [{ model: User, attributes: ['id', 'fullName', 'phoneNumber', 'email'] }],
          order: [['createdAt', 'DESC']]
        });

        const products = await RiceProduct.findAll();
        const productMap = {};
        products.forEach(p => {
          productMap[p.id] = p;
        });

        let totalReceivedMoney = 0;
        let totalBuyingCost = 0;
        let totalNetProfit = 0;
        let totalKgSold = 0;
        let totalPointsAwarded = 0;

        const yearsSet = new Set([new Date().getFullYear()]);
        const categorySalesMap = {};

        const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
          monthIndex: i,
          month: new Date(2000, i, 1).toLocaleString('en-US', { month: 'short' }),
          totalReceivedSales: 0,
          totalBuyingCost: 0,
          totalProfit: 0,
          totalKgSold: 0,
          paidOrderCount: 0
        }));

        allOrders.forEach(order => {
          const createdAt = new Date(order.createdAt);
          const orderYear = createdAt.getFullYear();
          yearsSet.add(orderYear);

          // RECEIVED MONEY CONDITION: ONLY SUCCEEDED/PAID TRANSACTIONS
          const isPaid = order.paymentDetails && (order.paymentDetails.isPaid === true || order.paymentDetails.paidTag === 'PAID' || order.status === 'paid' || order.status === 'completed' || order.status === 'delivered');

          if (isPaid) {
            const orderMoneyReceived = Number(order.grandTotal || 0);
            totalReceivedMoney += orderMoneyReceived;

            let orderCost = 0;
            let orderRevenueFromItems = 0;
            let orderKg = order.totalWeightKg || 0;

            if (Array.isArray(order.items)) {
              order.items.forEach(item => {
                const prod = productMap[item.productId];
                const qty = item.quantity || 1;
                const sellPrice = item.priceAtPurchase || (prod ? prod.basePrice : 0);
                const buyPrice = (prod && prod.buyingPrice !== undefined && prod.buyingPrice !== null) 
                  ? prod.buyingPrice 
                  : (item.buyingPrice || (sellPrice * 0.75));
                
                const itemRevenue = sellPrice * qty;
                const itemCost = buyPrice * qty;
                const itemProfit = itemRevenue - itemCost;

                orderRevenueFromItems += itemRevenue;
                orderCost += itemCost;

                const catName = (prod && prod.variety) ? prod.variety : (item.variety || prod?.brandName || 'Standard Rice');
                if (!categorySalesMap[catName]) {
                  categorySalesMap[catName] = {
                    category: catName,
                    brandName: prod?.brandName || item.name || catName,
                    quantitySold: 0,
                    totalRevenue: 0,
                    totalBuyingCost: 0,
                    totalProfit: 0,
                    buyingPricePerUnit: buyPrice,
                    sellingPricePerUnit: sellPrice
                  };
                }

                categorySalesMap[catName].quantitySold += qty;
                categorySalesMap[catName].totalRevenue += itemRevenue;
                categorySalesMap[catName].totalBuyingCost += itemCost;
                categorySalesMap[catName].totalProfit += itemProfit;

                if (!order.totalWeightKg && prod) {
                  orderKg += (prod.weightKg || 0) * qty;
                }
              });
            }

            const orderProfit = orderMoneyReceived - orderCost;
            totalBuyingCost += orderCost;
            totalNetProfit += orderProfit;
            totalKgSold += orderKg;
            
            const orderPoints = Number((orderKg * 0.2).toFixed(2));
            totalPointsAwarded += orderPoints;

            if (orderYear === selectedYear) {
              const monthIdx = createdAt.getMonth();
              monthlyStats[monthIdx].totalReceivedSales += orderMoneyReceived;
              monthlyStats[monthIdx].totalBuyingCost += orderCost;
              monthlyStats[monthIdx].totalProfit += orderProfit;
              monthlyStats[monthIdx].totalKgSold += orderKg;
              monthlyStats[monthIdx].paidOrderCount += 1;
            }
          }
        });

        const riceCategoryBreakdown = Object.values(categorySalesMap).map(cat => ({
          ...cat,
          totalRevenue: Number(cat.totalRevenue.toFixed(2)),
          totalBuyingCost: Number(cat.totalBuyingCost.toFixed(2)),
          totalProfit: Number(cat.totalProfit.toFixed(2))
        }));

        res.json({
          selectedYear,
          availableYears: Array.from(yearsSet).sort((a, b) => b - a),
          summary: {
            totalMoneyReceived: Number(totalReceivedMoney.toFixed(2)),
            totalBuyingCost: Number(totalBuyingCost.toFixed(2)),
            totalNetProfit: Number(totalNetProfit.toFixed(2)),
            totalKgSold: Number(totalKgSold.toFixed(2)),
            totalPointsAwarded: Number(totalPointsAwarded.toFixed(2))
          },
          riceCategories: riceCategoryBreakdown,
          monthlySalesGrowth: monthlyStats.map((m) => ({
            ...m,
            totalReceivedSales: Number(m.totalReceivedSales.toFixed(2)),
            totalBuyingCost: Number(m.totalBuyingCost.toFixed(2)),
            totalProfit: Number(m.totalProfit.toFixed(2)),
            totalKgSold: Number(m.totalKgSold.toFixed(2))
          }))
        });
      } catch (err) {
        console.error('DEBUG: Financial Analytics Error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // --- ADMIN UPDATE MONTHLY BUYING PRICE PER PRODUCT ---
    expressApp.put('/api/admin/products/:id/buying-price', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { buyingPrice } = req.body || {};
        if (buyingPrice === undefined || isNaN(Number(buyingPrice))) {
          return res.status(400).json({ error: 'Valid numerical buyingPrice parameter is required.' });
        }

        const product = await RiceProduct.findByPk(req.params.id);
        if (!product) return res.status(404).json({ error: 'Rice product not found.' });

        const oldBuyingPrice = product.buyingPrice;
        product.buyingPrice = Number(buyingPrice);
        await product.save();

        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'UPDATE_PRODUCT_BUYING_PRICE',
          targetType: 'product',
          targetId: product.id,
          changes: { oldBuyingPrice, newBuyingPrice: product.buyingPrice },
          ipAddress: req.ip
        });

        res.json({
          message: `Buying price for ${product.brandName} updated successfully.`,
          productId: product.id,
          buyingPrice: product.buyingPrice
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- BATCH UPDATE BUYING PRICES ---
    expressApp.post('/api/admin/products/buying-prices/batch', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { updates } = req.body || {};
        if (!Array.isArray(updates)) {
          return res.status(400).json({ error: 'Updates must be an array of objects containing id and buyingPrice.' });
        }

        const updatedRecords = [];
        for (const item of updates) {
          if (item.id && item.buyingPrice !== undefined) {
            const product = await RiceProduct.findByPk(item.id);
            if (product) {
              product.buyingPrice = Number(item.buyingPrice);
              await product.save();
              updatedRecords.push({ id: product.id, brandName: product.brandName, buyingPrice: product.buyingPrice });
            }
          }
        }

        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'BATCH_UPDATE_BUYING_PRICES',
          targetType: 'product',
          changes: updates,
          ipAddress: req.ip
        });

        res.json({ message: 'Batch buying prices updated successfully.', updatedRecords });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- ADMIN FILE / IMAGE UPLOAD ROUTE ---
    expressApp.post('/api/admin/upload', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: 'No file buffered to stream.' });
        const fileUrl = await persistUploadedFile(req.file);
        res.json({ url: fileUrl, imageUrl: fileUrl });
      } catch (err) { 
        res.status(500).json({ error: err.message }); 
      }
    });

    // --- PRODUCT MANAGEMENT CONTROLLERS ---
    const addProductHandler = async (req, res) => {
      try {
        console.log("DEBUG: Raw Product Creation Payload:", JSON.stringify(req.body || {}).slice(0, 500)); 
        const payload = {
          ...req.body,
          brandName: req.body.brandName || req.body.brand || 'Premium Rice',
          variety: req.body.variety || 'Aromatic Pishori',
          weightKg: Number(req.body.weightKg || req.body.weight || 0),
          basePrice: Number(req.body.basePrice || req.body.price || 0),
          buyingPrice: req.body.buyingPrice !== undefined && req.body.buyingPrice !== null && req.body.buyingPrice !== '' ? Number(req.body.buyingPrice) : (Number(req.body.basePrice || req.body.price || 0) * 0.75),
          flashSalePrice: req.body.flashSalePrice !== undefined && req.body.flashSalePrice !== null && req.body.flashSalePrice !== '' ? Number(req.body.flashSalePrice) : null,
          stockQuantity: Number(req.body.stockQuantity || req.body.stock || 0),
          imageUrl: req.body.imageUrl || req.body.image || req.body.url || null,
          isAvailable: req.body.isAvailable !== undefined ? Boolean(req.body.isAvailable) : true
        };

        const createdRecord = await RiceProduct.create(payload);
        
        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'CREATE_PRODUCT',
          targetType: 'product',
          targetId: createdRecord.id,
          changes: { brand: createdRecord.brandName, variety: createdRecord.variety },
          ipAddress: req.ip
        });
        
        res.status(201).json(createdRecord);
      } catch (err) {
        if (err.name === 'SequelizeValidationError') {
          console.error("DEBUG: VALIDATION ERROR:", err.errors.map(e => e.message));
          return res.status(400).json({ error: 'Validation Failed', details: err.errors.map(e => e.message) });
        }
        console.error("DEBUG: SERVER ERROR:", err);
        res.status(500).json({ error: err.message }); 
      }
    };

    expressApp.post('/api/admin/products', authenticateToken, requireAdmin, addProductHandler);
    expressApp.post('/api/admin/products/add', authenticateToken, requireAdmin, addProductHandler);
    expressApp.post('/api/admin/laptops/add', authenticateToken, requireAdmin, addProductHandler);

    const editProductHandler = async (req, res) => {
      try {
        const updatePayload = {
          ...req.body
        };
        if (req.body.price !== undefined && req.body.basePrice === undefined) {
          updatePayload.basePrice = Number(req.body.price);
        }
        if (req.body.image !== undefined && req.body.imageUrl === undefined) {
          updatePayload.imageUrl = req.body.image;
        }

        await RiceProduct.update(updatePayload, { where: { id: req.params.id } });
        const updatedProduct = await RiceProduct.findByPk(req.params.id);
        
        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'EDIT_PRODUCT_SPEC_OR_PRICE',
          targetType: 'product',
          targetId: updatedProduct ? updatedProduct.id : req.params.id,
          changes: req.body,
          ipAddress: req.ip
        });
        res.json(updatedProduct);
      } catch (err) { 
        res.status(500).json({ error: err.message }); 
      }
    };

    expressApp.put('/api/admin/products/:id', authenticateToken, requireAdmin, editProductHandler);
    expressApp.put('/api/admin/products/:id/edit', authenticateToken, requireAdmin, editProductHandler);
    expressApp.put('/api/admin/laptops/:id/edit', authenticateToken, requireAdmin, editProductHandler);

    const deleteProductHandler = async (req, res) => {
      try {
        await RiceProduct.destroy({ where: { id: req.params.id } });
        
        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'DELETE_PRODUCT',
          targetType: 'product',
          targetId: req.params.id,
          ipAddress: req.ip
        });

        res.json({ message: 'Catalog item wiped permanently.' });
      } catch (err) { 
        res.status(500).json({ error: err.message }); 
      }
    };

    expressApp.delete('/api/admin/products/:id', authenticateToken, requireAdmin, deleteProductHandler);
    expressApp.delete('/api/admin/products/:id/destroy', authenticateToken, requireAdmin, deleteProductHandler);
    expressApp.delete('/api/admin/laptops/:id/destroy', authenticateToken, requireAdmin, deleteProductHandler);

    // --- GET ADMIN ORDERS WITH CATEGORY & LOCATION SEARCH ---
    expressApp.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { search, category } = req.query;
        const include = [{
          model: User,
          attributes: ['id', 'fullName', 'phoneNumber', 'email', 'role', 'isActive', 'rewardPoints']
        }];

        let whereCondition = {};
        
        if (search && search.trim() !== '') {
          const searchStr = `%${search.trim()}%`;
          // Postgres cannot run LIKE against an INTEGER id, so cast it to text first
          const orderIdSearchClause = sequelize.getDialect() === 'postgres'
            ? sequelize.where(sequelize.cast(sequelize.col('Order.id'), 'TEXT'), { [LIKE_OP]: searchStr })
            : { id: { [Op.like]: searchStr } };

          whereCondition[Op.or] = [
            orderIdSearchClause,
            { county: { [LIKE_OP]: searchStr } },
            { town: { [LIKE_OP]: searchStr } },
            { location: { [LIKE_OP]: searchStr } },
            { '$User.fullName$': { [LIKE_OP]: searchStr } },
            { '$User.phoneNumber$': { [LIKE_OP]: searchStr } },
            { '$User.email$': { [LIKE_OP]: searchStr } }
          ];
        }

        const orders = await Order.findAll({
          where: whereCondition,
          include: include,
          order: [['createdAt', 'DESC']]
        });

        const formattedOrders = orders.map(order => {
          const o = order.toJSON();
          const isPaid = o.paymentDetails && (o.paymentDetails.isPaid === true || o.paymentDetails.paidTag === 'PAID' || o.status === 'paid');
          const isDelivered = o.status === 'delivered';
          
          return {
            ...o,
            isPaid,
            isDelivered,
            transactionCategory: isPaid ? (isDelivered ? 'completed' : 'pending_shipping') : 'unpaid',
            userName: o.User ? o.User.fullName : 'Guest/N/A',
            userPhone: o.User ? o.User.phoneNumber : 'N/A',
            userEmail: o.User ? o.User.email : 'N/A'
          };
        });

        if (category === 'pending_shipping' || category === 'pending') {
          return res.json(formattedOrders.filter(o => o.transactionCategory === 'pending_shipping'));
        } else if (category === 'completed' || category === 'delivered') {
          return res.json(formattedOrders.filter(o => o.transactionCategory === 'completed'));
        }

        res.json(formattedOrders);
      } catch (err) {
        console.error("DEBUG: Order Fetch Error:", err);
        res.status(500).json({ error: err.message });
      }
    });

    // --- PENDING SHIPPING TRANSACTIONS ENDPOINT ---
    expressApp.get('/api/admin/orders/pending-transactions', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const orders = await Order.findAll({
          include: [{
            model: User,
            attributes: ['id', 'fullName', 'phoneNumber', 'email']
          }],
          order: [['createdAt', 'DESC']]
        });

        const pendingTransactions = orders
          .map(order => {
            const o = order.toJSON();
            const isPaid = o.paymentDetails && (o.paymentDetails.isPaid === true || o.paymentDetails.paidTag === 'PAID' || o.status === 'paid');
            const isDelivered = o.status === 'delivered';
            
            return {
              ...o,
              isPaid,
              userName: o.User ? o.User.fullName : 'N/A',
              userPhone: o.User ? o.User.phoneNumber : 'N/A',
              userEmail: o.User ? o.User.email : 'N/A',
              transactionCategory: isPaid ? (isDelivered ? 'completed' : 'pending_shipping') : 'unpaid'
            };
          })
          .filter(o => o.isPaid && !o.isDelivered);

        res.json(pendingTransactions);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- EXPORT ORDERS TO CSV ---
    expressApp.get('/api/admin/orders/export/csv', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const orders = await Order.findAll({
          include: [{ model: User, attributes: ['fullName', 'phoneNumber', 'email'] }],
          order: [['createdAt', 'DESC']]
        });

        let csv = 'Order ID,Customer Name,Phone Number,Email,County,Town,Location,Sublocation,Street Address,Grand Total (KES),Payment Status,M-Pesa Receipt,Delivery Status,Order Date\n';
        
        orders.forEach(o => {
          const customerName = o.User ? String(o.User.fullName || 'N/A').replace(/,/g, ' ') : 'N/A';
          const phone = o.User ? o.User.phoneNumber : 'N/A';
          const email = o.User ? o.User.email || 'N/A' : 'N/A';
          const county = (o.county || '').replace(/,/g, ' ');
          const town = (o.town || '').replace(/,/g, ' ');
          const loc = (o.location || '').replace(/,/g, ' ');
          const subloc = (o.sublocation || '').replace(/,/g, ' ');
          const street = (o.shippingAddress?.streetAddress || o.shippingAddress?.details || '').replace(/,/g, ' ');
          const payTag = o.paymentDetails ? (o.paymentDetails.paidTag || (o.paymentDetails.isPaid ? 'PAID' : 'PENDING')) : 'PENDING';
          const receipt = o.paymentDetails ? (o.paymentDetails.mpesaReceipt || 'N/A') : 'N/A';
          const dateStr = new Date(o.createdAt).toISOString().split('T')[0];
          
          csv += `${o.id},"${customerName}",${phone},${email},${county},${town},${loc},${subloc},"${street}",${o.grandTotal},${payTag},${receipt},${o.status},${dateStr}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=delivery-history-${Date.now()}.csv`);
        res.status(200).send(csv);
      } catch (err) {
        console.error("DEBUG: CSV Export Error:", err);
        res.status(500).json({ error: err.message });
      }
    });

    // --- ORDER STATUS UPDATES ---
    expressApp.put('/api/admin/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        
        const oldStatus = order.status;
        order.status = req.body.status;
        await order.save();

        if (/cancel|refund|reject/i.test(String(req.body.status || ''))) {
          await reverseAgentCommission(order, `Order marked ${req.body.status} by ${req.adminUser.fullName}`);
        }

        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'UPDATE_ORDER_STATUS',
          targetType: 'order',
          targetId: order.id,
          changes: { oldStatus, newStatus: req.body.status },
          ipAddress: req.ip
        });

        io.emit('orderStatusUpdated', order);
        res.json(order);
      } catch (err) { 
        res.status(500).json({ error: err.message }); 
      }
    });

    // --- MANUAL PAYMENT STATUS OVERRIDE ---
    expressApp.put('/api/admin/orders/:id/payment-status', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { isPaid, paidTag, mpesaReceipt, failureReason, method } = req.body || {};
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found.' });

        const currentPaymentDetails = order.paymentDetails || {};
        const updatedIsPaid = isPaid !== undefined ? Boolean(isPaid) : currentPaymentDetails.isPaid;

        order.paymentDetails = {
          ...currentPaymentDetails,
          isPaid: updatedIsPaid,
          paidTag: paidTag || (updatedIsPaid ? 'PAID' : 'PENDING'),
          mpesaReceipt: mpesaReceipt !== undefined ? mpesaReceipt : currentPaymentDetails.mpesaReceipt,
          failureReason: failureReason !== undefined ? failureReason : currentPaymentDetails.failureReason,
          method: method || currentPaymentDetails.method || 'mpesa_stk',
          paidAt: updatedIsPaid ? (currentPaymentDetails.paidAt || new Date()) : currentPaymentDetails.paidAt
        };

        if (updatedIsPaid && order.status === 'payment_failed') {
          order.status = 'pending';
        }

        await order.save();

        if (updatedIsPaid && currentPaymentDetails.isPaid !== true) {
          await onOrderPaid(order, `manual override by ${req.adminUser.fullName}`);
        } else if (!updatedIsPaid && currentPaymentDetails.isPaid === true) {
          await reverseAgentCommission(order, `Payment marked unpaid by ${req.adminUser.fullName}`);
        }

        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'UPDATE_ORDER_PAYMENT_STATUS',
          targetType: 'order',
          targetId: order.id,
          changes: req.body,
          ipAddress: req.ip
        });

        io.emit('orderStatusUpdated', order);
        res.json(order);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- ADMIN AUDIT LOGS ---
    expressApp.get('/api/admin/logs', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const logs = await AdminLog.findAll({ order: [['createdAt', 'DESC']], limit: 500 });
        const adminIds = Array.from(new Set(logs.map((l) => l.adminId).filter(Boolean)));
        const admins = adminIds.length
          ? await User.findAll({ where: { id: adminIds }, attributes: ['id', 'fullName', 'email'] })
          : [];
        const adminMap = {};
        admins.forEach((a) => { adminMap[a.id] = a; });

        res.json(logs.map((l) => {
          const o = l.toJSON();
          const admin = adminMap[o.adminId];
          let details = '';
          if (o.changes !== undefined && o.changes !== null) {
            details = typeof o.changes === 'string' ? o.changes : JSON.stringify(o.changes);
          }
          return {
            id: o.id,
            action: o.action,
            performedByUserId: o.adminId,
            performedByName: admin ? admin.fullName : 'System',
            performedByEmail: admin ? admin.email : undefined,
            module: o.targetType || 'system',
            details: o.targetId ? `${o.targetType || 'item'} #${o.targetId}${details ? ' - ' + details : ''}` : details,
            ipAddress: o.ipAddress,
            timestamp: o.createdAt
          };
        }));
      } catch (err) {
        console.error('DEBUG: Admin Logs Error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // ==========================================================================
    // CUSTOMER CARE (SUPPORT) — can view accounts, fix a name, and un-suspend. Nothing else.
    // ==========================================================================
    const supportOnly = [authenticateToken, requireRoles('support', 'admin')];
    const SUPPORT_USER_ATTRS = ['id', 'fullName', 'phoneNumber', 'email', 'isActive', 'isVerified', 'rewardPoints', 'createdAt', 'role'];

    const overlayStaffRoles = async (users) => {
      const ids = users.map(u => u.id);
      const rows = ids.length ? await StaffRole.findAll({ where: { userId: ids } }) : [];
      const map = {};
      rows.forEach(r => { if (STAFF_ROLES.includes(r.role)) map[r.userId] = r; });
      return users.map((u) => {
        const o = u.toJSON ? u.toJSON() : u;
        const sr = map[o.id];
        return { ...o, role: o.role === 'admin' ? 'admin' : (sr ? sr.role : o.role) };
      });
    };

    const supportTargetGuard = async (req, res, user) => {
      if (!user) { res.status(404).json({ error: 'User not found.' }); return false; }
      if (user.role === 'admin') { res.status(403).json({ error: 'Administrator accounts cannot be managed from customer care.' }); return false; }
      if (req.user.role === 'support') {
        if (Number(user.id) === Number(req.user.id)) { res.status(403).json({ error: 'You cannot manage your own account from here.' }); return false; }
        const sr = await StaffRole.findOne({ where: { userId: user.id } });
        if (sr && sr.role === 'support') { res.status(403).json({ error: 'Other customer care accounts can only be managed by an administrator.' }); return false; }
      }
      return true;
    };

    expressApp.get('/api/support/overview', ...supportOnly, async (req, res) => {
      try {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const base = {};
        const [total, suspended, newThisWeek, unverified] = await Promise.all([
          User.count({ where: base }),
          User.count({ where: { ...base, isActive: false } }),
          User.count({ where: { ...base, createdAt: { [Op.gte]: weekAgo } } }),
          User.count({ where: { ...base, isVerified: false } })
        ]);
        const myRecent = await ActivityEvent.findAll({ where: { actorId: req.user.id }, order: [['createdAt', 'DESC']], limit: 25 });
        const latestOrders = await Order.findAll({ order: [['createdAt', 'DESC']], limit: 1500, attributes: ['id', 'status', 'paymentDetails', 'createdAt'] });
        let pendingPayments = 0, failedPayments = 0, paidToday = 0, paidTodayValue = 0;
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        latestOrders.forEach((o) => {
          const pd = o.paymentDetails || {};
          if (pd.isPaid) {
            if (pd.paidAt && new Date(pd.paidAt) >= startOfDay) { paidToday += 1; paidTodayValue += Number(pd.amount) || 0; }
          } else if (o.status === 'payment_failed' || pd.failureReason) failedPayments += 1;
          else pendingPayments += 1;
        });
        const seesPayments = await hasPermission(req.user.role, 'payments.view');
        res.json({ totalCustomers: total, suspended, newThisWeek, unverified,
          pendingPayments: seesPayments ? pendingPayments : null, failedPayments: seesPayments ? failedPayments : null,
          paidToday: seesPayments ? paidToday : null, paidTodayValue: seesPayments ? round2(paidTodayValue) : null, myRecentActions: myRecent });
      } catch (err) {
        console.error('❌ Support overview error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.get('/api/support/users', ...supportOnly, requirePerm('users.view'), async (req, res) => {
      try {
        const search = String(req.query.search || '').trim().slice(0, 60);
        const status = String(req.query.status || 'all');
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20));
        const and = [];
        if (status === 'suspended') and.push({ isActive: false });
        if (status === 'unverified') and.push({ isVerified: false });
        if (status === 'active') and.push({ isActive: true });
        if (search) {
          const digits = search.replace(/\D/g, '');
          const ors = [{ fullName: { [LIKE_OP]: `%${search}%` } }, { email: { [LIKE_OP]: `%${search}%` } }];
          if (digits.length >= 3) ors.push({ phoneNumber: { [LIKE_OP]: `%${digits.replace(/^0/, '')}%` } });
          const variants = phoneVariants(search);
          if (variants && variants.length) ors.push({ phoneNumber: { [Op.in]: variants } });
          if (/^\d{1,9}$/.test(search)) ors.push({ id: Number(search) });
          and.push({ [Op.or]: ors });
        }
        const { rows, count } = await User.findAndCountAll({ where: and.length ? { [Op.and]: and } : {}, attributes: SUPPORT_USER_ATTRS, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit });
        res.json({ users: await overlayStaffRoles(rows), total: count, page, pages: Math.max(1, Math.ceil(count / limit)) });
      } catch (err) {
        console.error('❌ Support users error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.get('/api/support/users/:id', ...supportOnly, requirePerm('users.view'), async (req, res) => {
      try {
        const user = await User.findByPk(req.params.id, { attributes: SUPPORT_USER_ATTRS });
        if (!user) return res.status(404).json({ error: 'User not found.' });
        const [profile] = await overlayStaffRoles([user]);
        const orders = await Order.findAll({ where: { userId: user.id }, order: [['createdAt', 'DESC']], limit: 50 });
        const notes = await SupportNote.findAll({ where: { customerId: user.id }, order: [['createdAt', 'DESC']], limit: 50 });
        const history = await ActivityEvent.findAll({ where: { targetType: 'user', targetId: String(user.id) }, order: [['createdAt', 'DESC']], limit: 30 });
        const referral = await CustomerReferral.findOne({ where: { customerId: user.id } });
        let referredBy = null;
        if (referral) {
          const agent = await User.findByPk(referral.agentId, { attributes: ['fullName'] });
          referredBy = agent ? `${agent.fullName} (${referral.referralCode})` : referral.referralCode;
        }
        res.json({
          user: profile,
          referredBy,
          orders: orders.map((o) => {
            const pd = o.paymentDetails || {};
            return {
              id: o.id, status: o.status, grandTotal: Number(o.grandTotal) || 0, createdAt: o.createdAt,
              paymentStatus: pd.paidTag || (pd.isPaid ? 'PAID' : 'PENDING'), mpesaReceipt: pd.mpesaReceipt || null, method: pd.method || null,
              county: o.county, town: o.town, items: getOrderItems(o).map(i => `${i.quantity}× ${i.name || i.brandName}`).join(', ')
            };
          }),
          notes,
          history
        });
      } catch (err) {
        console.error('❌ Support user detail error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // All orders & payments, searchable. Read-only for customer care.
    const paymentStateOf = (o) => {
      const pd = o.paymentDetails || {};
      if (pd.isPaid) return 'paid';
      if (o.status === 'payment_failed' || pd.failureReason) return 'failed';
      return 'pending';
    };

    expressApp.get('/api/support/orders', ...supportOnly, requirePerm('orders.view', 'payments.view'), async (req, res) => {
      try {
        const search = String(req.query.search || '').trim().toLowerCase().slice(0, 60);
        const payment = String(req.query.payment || 'all');
        const status = String(req.query.status || 'all');
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20));

        const recent = await Order.findAll({ order: [['createdAt', 'DESC']], limit: 1500 });
        const userIds = [...new Set(recent.map(o => o.userId))];
        const users = userIds.length ? await User.findAll({ where: { id: userIds }, attributes: ['id', 'fullName', 'phoneNumber', 'email'] }) : [];
        const userMap = {};
        users.forEach(u => { userMap[u.id] = u; });

        const counts = { all: recent.length, paid: 0, pending: 0, failed: 0 };
        const shaped = recent.map((o) => {
          const pd = o.paymentDetails || {};
          const state = paymentStateOf(o);
          counts[state] += 1;
          const u = userMap[o.userId];
          const addr = o.shippingAddress || {};
          return {
            id: o.id, createdAt: o.createdAt, status: o.status, paymentState: state, paidTag: pd.paidTag || null, method: pd.method || null,
            mpesaNumber: pd.mpesaNumber || null, mpesaReceipt: pd.mpesaReceipt || null, paidAt: pd.paidAt || null, failureReason: pd.failureReason || null,
            grandTotal: Number(o.grandTotal) || 0, subTotal: Number(o.subTotal) || 0, transportFee: Number(o.transportFee) || 0,
            customer: u ? { id: u.id, fullName: u.fullName, phone: u.phoneNumber, email: u.email } : { id: o.userId, fullName: `User #${o.userId}`, phone: null, email: null },
            county: o.county, town: o.town, location: o.location || addr.location || '', sublocation: o.sublocation || addr.sublocation || '',
            address: addr.details || [addr.streetAddress, o.sublocation, o.location, o.town, o.county].filter(Boolean).join(', '),
            items: getOrderItems(o).map(i => `${i.quantity}× ${i.name || i.brandName}`).join(', '),
            _hay: [o.id, `#${o.id}`, `ORD-${o.id}`, pd.mpesaReceipt, pd.mpesaNumber, u && u.fullName, u && u.phoneNumber, u && u.email].filter(Boolean).join(' ').toLowerCase()
          };
        });
        const filtered = shaped.filter((o) => {
          if (payment !== 'all' && o.paymentState !== payment) return false;
          if (status !== 'all' && o.status !== status) return false;
          if (search && !o._hay.includes(search) && !o._hay.includes(search.replace(/^0/, '254'))) return false;
          return true;
        }).map(({ _hay, ...rest }) => rest);
        const total = filtered.length;
        res.json({ orders: filtered.slice((page - 1) * limit, page * limit), total, page, pages: Math.max(1, Math.ceil(total / limit)), counts });
      } catch (err) {
        console.error('❌ Support orders error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // Asks PayHero whether an order was paid. Read-only: it reports, it never changes the order.
    expressApp.get('/api/support/orders/:id/payment-check', ...supportOnly, requirePerm('payments.check'), async (req, res) => {
      try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        const pd = order.paymentDetails || {};
        const live = await lookupPayHeroStatus(order.id);
        const livePaid = live.reachable && (live.status === 'SUCCESS' || live.status === 'PAID');
        let verdict, message;
        if (!live.reachable) { verdict = 'UNKNOWN'; message = 'PayHero could not be reached right now. Try again in a moment.'; }
        else if (pd.isPaid && livePaid) { verdict = 'CONFIRMED_PAID'; message = 'Paid. Our records and PayHero agree.'; }
        else if (pd.isPaid && !livePaid) { verdict = 'RECORDED_PAID_UNCONFIRMED'; message = `Recorded as paid (receipt ${pd.mpesaReceipt || 'none'}), but PayHero shows "${live.status}". Ask an administrator to review.`; }
        else if (!pd.isPaid && livePaid) { verdict = 'PAID_NOT_RECORDED'; message = 'PayHero shows this payment succeeded but the order is not marked paid yet. Escalate to an administrator.'; }
        else { verdict = 'NOT_PAID'; message = `Not paid. PayHero status: ${live.status}.`; }

        await logEvent({ req, action: verdict === 'PAID_NOT_RECORDED' || verdict === 'RECORDED_PAID_UNCONFIRMED' ? 'PAYMENT_MISMATCH' : 'SUPPORT_PAYMENT_CHECKED',
          category: 'orders', severity: verdict === 'PAID_NOT_RECORDED' || verdict === 'RECORDED_PAID_UNCONFIRMED' ? 'alert' : 'info', targetType: 'order', targetId: order.id,
          summary: `${req.user.fullName} checked payment on order #${order.id}: ${verdict}`, details: { verdict, payheroStatus: live.status, recordedPaid: !!pd.isPaid } });
        res.json({ orderId: order.id, recordedPaid: !!pd.isPaid, mpesaReceipt: pd.mpesaReceipt || null, payheroReachable: live.reachable, payheroStatus: live.status, payheroAmount: live.amount ?? null, orderAmount: Number(order.grandTotal) || 0, verdict, message });
      } catch (err) {
        console.error('❌ Support payment check error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // Customer care may change ONE thing about an account: the display name.
    expressApp.put('/api/support/users/:id/name', ...supportOnly, requirePerm('users.rename'), async (req, res) => {
      try {
        const user = await User.findByPk(req.params.id);
        if (!(await supportTargetGuard(req, res, user))) return;
        const newName = String((req.body || {}).fullName || '').replace(/\s+/g, ' ').trim();
        if (newName.length < 3 || newName.length > 80 || !/^[\p{L}][\p{L}\p{M}'’.\- ]*[\p{L}.]$/u.test(newName)) {
          return res.status(400).json({ error: 'Enter a real full name (3–80 letters; spaces, hyphens and apostrophes are allowed).' });
        }
        const oldName = user.fullName;
        if (oldName === newName) return res.json({ message: 'Name is already up to date.', fullName: newName });
        user.fullName = newName;
        await user.save();
        await logEvent({ req, action: 'USER_NAME_CHANGED', category: 'users', targetType: 'user', targetId: user.id,
          summary: `${req.user.fullName} renamed user #${user.id}: "${oldName}" → "${newName}"`, details: { from: oldName, to: newName } });
        res.json({ message: 'Name updated.', fullName: newName });
      } catch (err) {
        console.error('❌ Support rename error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // ...and reactivate a suspended account. Suspending/deleting stays with administrators.
    expressApp.post('/api/support/users/:id/unsuspend', ...supportOnly, requirePerm('users.unsuspend'), async (req, res) => {
      try {
        const user = await User.findByPk(req.params.id);
        if (!(await supportTargetGuard(req, res, user))) return;
        if (user.isActive !== false) return res.status(400).json({ error: 'This account is not suspended.' });
        const reason = String((req.body || {}).reason || '').trim().slice(0, 300);
        if (reason.length < 3) return res.status(400).json({ error: 'Please give a short reason for reactivating this account.' });
        user.isActive = true;
        await user.save();
        await logEvent({ req, action: 'USER_UNSUSPENDED', category: 'users', severity: 'warn', targetType: 'user', targetId: user.id,
          summary: `${req.user.fullName} reactivated ${user.fullName} (#${user.id}): ${reason}`, details: { reason } });
        res.json({ message: 'Account reactivated.', isActive: true });
      } catch (err) {
        console.error('❌ Support unsuspend error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.post('/api/support/users/:id/notes', ...supportOnly, requirePerm('users.notes'), async (req, res) => {
      try {
        const user = await User.findByPk(req.params.id, { attributes: ['id', 'role', 'fullName'] });
        if (!user || user.role === 'admin') return res.status(404).json({ error: 'User not found.' });
        const note = String((req.body || {}).note || '').trim().slice(0, 1000);
        if (note.length < 3) return res.status(400).json({ error: 'Write a note of at least 3 characters.' });
        const created = await SupportNote.create({ customerId: user.id, authorId: req.user.id, authorName: req.user.fullName, note });
        await logEvent({ req, action: 'SUPPORT_NOTE_ADDED', category: 'users', targetType: 'user', targetId: user.id, summary: `${req.user.fullName} added a note on ${user.fullName} (#${user.id})` });
        res.status(201).json(created);
      } catch (err) {
        console.error('❌ Support note error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // ==========================================================================
    // AGENTS — referral partners who earn a share of profit
    // ==========================================================================
    expressApp.get('/api/config/terms', (req, res) => res.json({ version: TERMS_VERSION }));

    expressApp.get('/api/referral/validate', async (req, res) => {
      try {
        const code = normalizeReferralCode(req.query.code);
        if (!code) return res.json({ valid: false });
        const staff = await StaffRole.findOne({ where: { referralCode: code, role: 'agent' } });
        if (!staff) return res.json({ valid: false });
        const agentUser = await User.findByPk(staff.userId, { attributes: ['fullName', 'isActive'] });
        if (!agentUser || agentUser.isActive === false) return res.json({ valid: false });
        res.json({ valid: true, code, agentName: String(agentUser.fullName || '').split(' ')[0] });
      } catch (err) {
        res.json({ valid: false });
      }
    });

    expressApp.get('/api/agent/overview', authenticateToken, requireRoles('agent'), async (req, res) => {
      try {
        const staff = await StaffRole.findOne({ where: { userId: req.user.id } });
        if (!staff || staff.role !== 'agent') return res.status(403).json({ error: 'You are not an active agent.' });
        const snapshot = await buildAgentSnapshot(req.user.id, req.query.year);
        const agentPerms = (await getPermissions()).agent || {};
        if (!agentPerms['agent.customers']) snapshot.customers = [];
        if (!agentPerms['agent.profit']) {
          snapshot.summary.profitGenerated = null;
          snapshot.commissions = snapshot.commissions.map(c => ({ ...c, profit: null }));
        }
        res.json({ referralCode: staff.referralCode, agentSince: staff.createdAt, rates: await getCommissionRates(), permissions: agentPerms, ...snapshot });
      } catch (err) {
        console.error('❌ Agent overview error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // ==========================================================================
    // ADMIN — roles, agents, payouts, commission settings, full activity feed
    // ==========================================================================
    expressApp.put('/api/admin/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        const result = await assignStaffRole(req, user, String((req.body || {}).role || ''), (req.body || {}).note);
        res.json({ message: result.changed ? `Role updated to ${result.role}.` : 'Role unchanged.', ...result });
      } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
      }
    });

    expressApp.get('/api/admin/agents', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const rows = await StaffRole.findAll({ where: { referralCode: { [Op.ne]: null } } });
        const users = rows.length ? await User.findAll({ where: { id: rows.map(r => r.userId) }, attributes: ['id', 'fullName', 'phoneNumber', 'email', 'isActive'] }) : [];
        const userMap = {};
        users.forEach(u => { userMap[u.id] = u; });
        const agents = await Promise.all(rows.map(async (r) => {
          const u = userMap[r.userId];
          const snap = await buildAgentSnapshot(r.userId, req.query.year);
          return {
            id: r.userId, fullName: u ? u.fullName : `User #${r.userId}`, phoneNumber: u ? u.phoneNumber : null, email: u ? u.email : null,
            isActive: u ? u.isActive !== false : false, isCurrentAgent: r.role === 'agent', referralCode: r.referralCode,
            since: r.createdAt, dismissedAt: r.dismissedAt, summary: snap.summary
          };
        }));
        agents.sort((a, b) => (b.isCurrentAgent - a.isCurrentAgent) || (b.summary.commissionTotal - a.summary.commissionTotal));
        const totals = agents.reduce((t, a) => ({
          pending: round2(t.pending + a.summary.commissionPending), paid: round2(t.paid + a.summary.commissionPaid),
          sales: round2(t.sales + a.summary.salesValue), orders: t.orders + a.summary.orders, customers: t.customers + a.summary.customers
        }), { pending: 0, paid: 0, sales: 0, orders: 0, customers: 0 });
        res.json({ agents, totals, rates: await getCommissionRates() });
      } catch (err) {
        console.error('❌ Admin agents error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.get('/api/admin/agents/:id', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const staff = await StaffRole.findOne({ where: { userId: req.params.id } });
        if (!staff || !staff.referralCode) return res.status(404).json({ error: 'This user has never been an agent.' });
        const u = await User.findByPk(req.params.id, { attributes: ['id', 'fullName', 'phoneNumber', 'email', 'isActive'] });
        const snapshot = await buildAgentSnapshot(req.params.id, req.query.year);
        res.json({ agent: { id: Number(req.params.id), fullName: u ? u.fullName : '', phoneNumber: u ? u.phoneNumber : null, email: u ? u.email : null,
          isActive: u ? u.isActive !== false : false, isCurrentAgent: staff.role === 'agent', referralCode: staff.referralCode }, ...snapshot });
      } catch (err) {
        console.error('❌ Admin agent detail error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.post('/api/admin/agents/:id/payouts', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const agentId = Number(req.params.id);
        const { reference, method, note, commissionIds } = req.body || {};
        const ref = String(reference || '').trim().slice(0, 120);
        if (ref.length < 3) return res.status(400).json({ error: 'Enter the M-Pesa/bank payment reference for this payout.' });
        const duplicate = await AgentPayout.findOne({ where: { agentId, reference: ref } });
        if (duplicate) return res.status(409).json({ error: 'A payout with this reference was already recorded for this agent.' });

        const where = { agentId, status: 'PENDING' };
        if (Array.isArray(commissionIds) && commissionIds.length) where.id = commissionIds.map(Number).filter(Number.isFinite);
        const result = await sequelize.transaction(async (t) => {
          const due = await AgentCommission.findAll({ where, transaction: t });
          if (!due.length) throw httpError(400, 'There are no pending commissions to pay out.');
          const total = round2(due.reduce((s, c) => s + Number(c.amount), 0));
          const payout = await AgentPayout.create({
            agentId, amount: total, method: String(method || 'mpesa').slice(0, 40), reference: ref,
            note: note ? String(note).slice(0, 255) : null, paidBy: req.adminUser.id, commissionCount: due.length
          }, { transaction: t });
          await AgentCommission.update({ status: 'PAID', payoutId: payout.id, paidAt: new Date() }, { where: { id: due.map(c => c.id) }, transaction: t });
          return { payout, total, count: due.length };
        });
        const agentUser = await User.findByPk(agentId, { attributes: ['fullName'] });
        await logEvent({ req, action: 'PAYOUT_RECORDED', category: 'agents', severity: 'warn', targetType: 'user', targetId: agentId,
          summary: `${req.adminUser.fullName} paid ${agentUser ? agentUser.fullName : 'agent #' + agentId} KES ${result.total} for ${result.count} order(s), ref ${ref}`,
          details: { payoutId: result.payout.id, amount: result.total, method: method || 'mpesa', reference: ref } });
        res.status(201).json({ message: `Payout of KES ${result.total} recorded.`, payout: result.payout, amount: result.total, commissions: result.count });
      } catch (err) {
        console.error('❌ Payout error:', err);
        res.status(err.status || 500).json({ error: err.message });
      }
    });

    expressApp.post('/api/admin/agents/:id/regenerate-code', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const staff = await StaffRole.findOne({ where: { userId: req.params.id, role: 'agent' } });
        if (!staff) return res.status(404).json({ error: 'Active agent not found.' });
        const oldCode = staff.referralCode;
        staff.referralCode = await generateUniqueReferralCode();
        await staff.save();
        await CustomerReferral.update({ referralCode: staff.referralCode }, { where: { agentId: staff.userId } });
        await logEvent({ req, action: 'AGENT_CODE_REGENERATED', category: 'agents', severity: 'warn', targetType: 'user', targetId: staff.userId,
          summary: `Referral code for agent #${staff.userId} changed ${oldCode} → ${staff.referralCode}`, details: { from: oldCode, to: staff.referralCode } });
        res.json({ referralCode: staff.referralCode });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.get('/api/admin/config/agent-commission', authenticateToken, requireAdmin, async (req, res) => {
      res.json(await getCommissionRates());
    });
    expressApp.put('/api/admin/config/agent-commission', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const b = req.body || {};
        const rates = {
          newCustomerRate: clampRate(b.newCustomerRate, NaN),
          repeatRate: clampRate(b.repeatRate, NaN)
        };
        if (!Number.isFinite(rates.newCustomerRate) || !Number.isFinite(rates.repeatRate)) {
          return res.status(400).json({ error: 'Enter both rates as percentages between 0 and 100.' });
        }
        const before = await getCommissionRates();
        const [row] = await SystemConfig.findOrCreate({ where: { key: 'agent_commission' }, defaults: { value: rates } });
        row.value = rates;
        row.changed('value', true);
        await row.save();
        await logEvent({ req, action: 'AGENT_RATES_CHANGED', category: 'settings', severity: 'warn', targetType: 'config', targetId: 'agent_commission',
          summary: `Agent commission changed: new customers ${Math.round(before.newCustomerRate * 100)}% → ${Math.round(rates.newCustomerRate * 100)}%, repeat ${Math.round(before.repeatRate * 100)}% → ${Math.round(rates.repeatRate * 100)}%`,
          details: { before, after: rates } });
        res.json({ message: 'Commission rates saved. They apply to payments confirmed from now on.', ...rates });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ---------- Activity feed ----------
    const buildEventFilter = (q) => {
      const where = {};
      if (q.category && q.category !== 'all') where.category = String(q.category);
      if (q.severity && q.severity !== 'all') where.severity = String(q.severity);
      if (q.actorRole && q.actorRole !== 'all') where.actorRole = String(q.actorRole);
      if (q.action) where.action = String(q.action);
      if (q.actorId && /^\d+$/.test(String(q.actorId))) where.actorId = Number(q.actorId);
      const range = {};
      if (q.from && !Number.isNaN(Date.parse(q.from))) range[Op.gte] = new Date(q.from);
      if (q.to && !Number.isNaN(Date.parse(q.to))) { const d = new Date(q.to); d.setHours(23, 59, 59, 999); range[Op.lte] = d; }
      if (Object.getOwnPropertySymbols(range).length) where.createdAt = range;
      const text = String(q.q || '').trim().slice(0, 80);
      if (text) where[Op.or] = [{ summary: { [LIKE_OP]: `%${text}%` } }, { actorName: { [LIKE_OP]: `%${text}%` } }, { action: { [LIKE_OP]: `%${text}%` } }, { targetId: text }];
      return where;
    };

    expressApp.get('/api/admin/events', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(200, Math.max(10, parseInt(req.query.limit, 10) || 50));
        const { rows, count } = await ActivityEvent.findAndCountAll({ where: buildEventFilter(req.query), order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit });
        res.json({ events: rows, total: count, page, pages: Math.max(1, Math.ceil(count / limit)) });
      } catch (err) {
        console.error('❌ Events error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.get('/api/admin/events/summary', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recent = await ActivityEvent.findAll({ where: { createdAt: { [Op.gte]: since } }, order: [['createdAt', 'DESC']], limit: 5000 });
        const byCategory = {}, byHour = Array.from({ length: 24 }, () => 0), actors = {};
        let alerts = 0, warnings = 0, failedLogins = 0;
        const hourAgo = Date.now() - 60 * 60 * 1000;
        recent.forEach((e) => {
          byCategory[e.category] = (byCategory[e.category] || 0) + 1;
          if (e.severity === 'alert') alerts += 1;
          if (e.severity === 'warn') warnings += 1;
          if (/LOGIN_FAILED|LOGIN_LOCKOUT|LOGIN_BLOCKED/.test(e.action) && new Date(e.createdAt).getTime() >= hourAgo) failedLogins += 1;
          const hoursAgo = Math.min(23, Math.floor((Date.now() - new Date(e.createdAt).getTime()) / 3600000));
          byHour[23 - hoursAgo] += 1;
          if (e.actorId && e.actorRole !== 'anonymous') {
            const k = e.actorId;
            actors[k] = actors[k] || { actorId: k, name: e.actorName, role: e.actorRole, count: 0 };
            actors[k].count += 1;
          }
        });
        const pendingCommission = round2((await AgentCommission.findAll({ where: { status: 'PENDING' }, attributes: ['amount'] })).reduce((s, c) => s + Number(c.amount), 0));
        res.json({
          last24h: recent.length, alerts, warnings, failedLoginsLastHour: failedLogins, pendingCommission,
          byCategory, byHour, topActors: Object.values(actors).sort((a, b) => b.count - a.count).slice(0, 6)
        });
      } catch (err) {
        console.error('❌ Events summary error:', err);
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.get('/api/admin/events/export/csv', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const rows = await ActivityEvent.findAll({ where: buildEventFilter(req.query), order: [['createdAt', 'DESC']], limit: 5000 });
        const esc = (v) => {
          let t = v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
          if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; // stops spreadsheet formula injection
          return `"${t.replace(/"/g, '""')}"`;
        };
        const header = ['Time', 'Severity', 'Category', 'Action', 'Actor', 'Role', 'Target', 'Summary', 'IP'];
        const lines = [header.join(',')].concat(rows.map(e => [
          new Date(e.createdAt).toISOString(), e.severity, e.category, e.action, e.actorName, e.actorRole,
          e.targetType ? `${e.targetType} #${e.targetId}` : '', e.summary, e.ipAddress
        ].map(esc).join(',')));
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="activity-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send(lines.join('\n'));
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ==========================================================================
    // SECURITY: admin two-step sign-in, personal permissions
    // ==========================================================================
    const issueLoginResponse = async (user) => {
      const role = await effectiveRoleFor(user);
      const token = jwt.sign({ id: user.id, role }, JWT_SECRET, { expiresIn: '7d' });
      return { token, user: { id: user.id, fullName: user.fullName, role, phoneNumber: user.phoneNumber, email: user.email, rewardPoints: user.rewardPoints || 0 } };
    };

    expressApp.post('/api/user/login/verify-2fa', async (req, res) => {
      try {
        const { challengeId, code } = req.body || {};
        const ch = twoFactorChallenges.get(String(challengeId || ''));
        if (!ch || ch.expires < Date.now()) { twoFactorChallenges.delete(String(challengeId || '')); return res.status(400).json({ error: 'This sign-in code has expired. Please sign in again.', expired: true }); }
        ch.attempts += 1;
        if (ch.attempts > 5) { twoFactorChallenges.delete(challengeId); return res.status(400).json({ error: 'Too many wrong codes. Please sign in again.', expired: true }); }
        const given = crypto.createHash('sha256').update(String(code || '').replace(/\D/g, '')).digest('hex');
        const ok = given.length === ch.code.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(ch.code));
        const user = await User.findByPk(ch.userId);
        if (!ok) {
          await logEvent({ req, actor: { id: ch.userId, role: 'anonymous', name: user ? user.fullName : null }, action: 'ADMIN_2FA_FAILED', category: 'auth', severity: 'alert', targetType: 'user', targetId: ch.userId, summary: `Wrong admin sign-in code entered for ${user ? user.fullName : 'user #' + ch.userId} (attempt ${ch.attempts})` });
          return res.status(400).json({ error: `That code is not correct (${Math.max(0, 5 - ch.attempts)} attempt(s) left).` });
        }
        twoFactorChallenges.delete(challengeId);
        if (!user || user.isActive === false) return res.status(403).json({ error: 'This account is not available.' });
        await logEvent({ req, actor: { id: user.id, role: 'admin', name: user.fullName }, action: 'LOGIN_SUCCESS', category: 'auth', targetType: 'user', targetId: user.id, summary: `${user.fullName} signed in (two-step)` });
        res.json(await issueLoginResponse(user));
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.post('/api/user/login/resend-2fa', async (req, res) => {
      try {
        const ch = twoFactorChallenges.get(String((req.body || {}).challengeId || ''));
        if (!ch || ch.expires < Date.now()) return res.status(400).json({ error: 'This sign-in has expired. Please sign in again.', expired: true });
        if (ch.resends >= 2) return res.status(429).json({ error: 'Code already re-sent twice. Please sign in again.' });
        const user = await User.findByPk(ch.userId);
        if (!user) return res.status(400).json({ error: 'Account not found.' });
        const code = String(crypto.randomInt(100000, 1000000));
        const delivery = await dispatchOtp(user, code, 'admin_login');
        if (!delivery.anySent) return res.status(502).json({ error: 'We could not send the code. Check your SMS credit/email settings.' });
        ch.code = crypto.createHash('sha256').update(code).digest('hex'); ch.expires = Date.now() + 5 * 60 * 1000; ch.attempts = 0; ch.resends += 1;
        res.json({ message: 'A new code has been sent.' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.get('/api/me/permissions', authenticateToken, async (req, res) => {
      try {
        const role = req.user.role;
        const perms = await getPermissions();
        const flat = {};
        Object.values(PERMISSION_CATALOG).flat().forEach((p) => { flat[p.key] = role === 'admin' ? true : !!(perms[role] && perms[role][p.key]); });
        res.json({ role, permissions: flat });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    expressApp.get('/api/admin/permissions', authenticateToken, requireAdmin, async (req, res) => {
      res.json({ catalog: PERMISSION_CATALOG, permissions: await getPermissions(true) });
    });
    expressApp.put('/api/admin/permissions', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { role, changes } = req.body || {};
        const before = (await getPermissions(true))[role] || {};
        const next = await savePermissions(role, changes);
        const diff = Object.keys(next[role]).filter(k => before[k] !== next[role][k]).map(k => `${k}: ${before[k] ? 'on' : 'off'} → ${next[role][k] ? 'on' : 'off'}`);
        await logEvent({ req, action: 'PERMISSIONS_CHANGED', category: 'settings', severity: 'warn', targetType: 'config', targetId: role, summary: `${req.adminUser.fullName} changed ${role} permissions: ${diff.join(', ') || 'no change'}`, details: { role, changes: diff } });
        res.json({ message: 'Permissions saved. They apply immediately.', permissions: next });
      } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
    });

    // ==========================================================================
    // SYSTEM: settings, health, daily summary
    // ==========================================================================
    expressApp.get('/api/admin/ops-settings', authenticateToken, requireAdmin, async (req, res) => {
      res.json({ ...(await getOps(true)), twoFactorForcedOff: String(process.env.DISABLE_ADMIN_2FA || '').toLowerCase() === 'true', sentryConfigured: !!process.env.SENTRY_DSN });
    });
    expressApp.put('/api/admin/ops-settings', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const b = req.body || {};
        const patch = {};
        const num = (v, min, max, label) => { const n = Number(v); if (!Number.isFinite(n) || n < min || n > max) throw httpError(400, `${label} must be between ${min} and ${max}.`); return n; };
        if (b.orderExpiryMinutes !== undefined) patch.orderExpiryMinutes = Math.round(num(b.orderExpiryMinutes, 10, 1440, 'Unpaid order expiry (minutes)'));
        if (b.lowStockDefault !== undefined) patch.lowStockDefault = Math.round(num(b.lowStockDefault, 0, 100000, 'Low stock level'));
        if (b.smsLowThreshold !== undefined) patch.smsLowThreshold = num(b.smsLowThreshold, 0, 100000, 'SMS credit alert level');
        if (b.smsCostPerPart !== undefined) patch.smsCostPerPart = num(b.smsCostPerPart, 0, 10, 'SMS cost per message');
        if (b.adminTwoFactor !== undefined) patch.adminTwoFactor = !!b.adminTwoFactor;
        if (b.autoReconcile !== undefined) patch.autoReconcile = !!b.autoReconcile;
        if (b.dailySummary) {
          const d = b.dailySummary; const ds = {};
          if (d.enabled !== undefined) ds.enabled = !!d.enabled;
          if (d.sms !== undefined) ds.sms = !!d.sms;
          if (d.email !== undefined) ds.email = !!d.email;
          if (d.time !== undefined) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(d.time))) throw httpError(400, 'Summary time must look like 20:00.'); ds.time = d.time; }
          if (d.extraPhones !== undefined) ds.extraPhones = (Array.isArray(d.extraPhones) ? d.extraPhones : []).map(normalizeKenyanPhone).filter(Boolean).slice(0, 5);
          if (d.extraEmails !== undefined) ds.extraEmails = (Array.isArray(d.extraEmails) ? d.extraEmails : []).map(e => String(e).trim().toLowerCase()).filter(e => /^\S+@\S+\.\S+$/.test(e)).slice(0, 5);
          patch.dailySummary = ds;
        }
        const before = await getOps(true);
        const next = await saveOps(patch);
        const sev = (patch.adminTwoFactor === false && before.adminTwoFactor !== false) ? 'alert' : 'warn';
        await logEvent({ req, action: 'SYSTEM_SETTINGS_CHANGED', category: 'settings', severity: sev, targetType: 'config', targetId: 'ops_settings',
          summary: `${req.adminUser.fullName} changed system settings: ${Object.keys(patch).join(', ')}${patch.adminTwoFactor === false && before.adminTwoFactor !== false ? ' (admin two-step sign-in switched OFF)' : ''}`, details: patch });
        res.json({ message: 'Settings saved.', settings: next });
      } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
    });

    expressApp.post('/api/admin/daily-summary/send-test', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const r = await sendDailySummary(eatDateString());
        res.json({ message: `Summary sent: ${r.sms} SMS, ${r.email} email(s).${r.errors.length ? ' Problems: ' + r.errors.join('; ') : ''}`, ...r });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    expressApp.get('/api/admin/system/status', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const ops = await getOps();
        await loadSmsBalanceFromDb();
        const errors = await ActivityEvent.findAll({ where: { category: 'system', action: { [Op.in]: ['SERVER_ERROR', 'SMS_CREDIT_LOW', 'LATE_PAYMENT_STOCK_SHORT'] } }, order: [['createdAt', 'DESC']], limit: 15 });
        const unpaid = await Order.count({ where: { status: { [Op.in]: ['pending', 'payment_failed'] } } });
        let dbOk = true; try { await sequelize.query('SELECT 1'); } catch (_) { dbOk = false; }
        res.json({
          sms: { balance: smsState.balance, updatedAt: smsState.at, threshold: ops.smsLowThreshold, low: smsState.balance !== null && smsState.balance <= ops.smsLowThreshold },
          jobs: jobStatus, unpaidOrders: unpaid, recentErrors: errors,
          twoFactor: { enabled: await twoFactorEnabled(), forcedOffByEnv: String(process.env.DISABLE_ADMIN_2FA || '').toLowerCase() === 'true' },
          sentry: !!sentryClient, sentryConfigured: !!process.env.SENTRY_DSN, database: dbOk, nodeVersion: process.version, uptimeMinutes: Math.round(process.uptime() / 60)
        });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    expressApp.post('/api/admin/system/reconcile-now', authenticateToken, requireAdmin, async (req, res) => {
      runPaymentReconcile();
      res.json({ message: 'Payment re-check started. Results appear under System in a few seconds.' });
    });

    // ==========================================================================
    // REPORTS & EXCEL EXPORTS
    // ==========================================================================
    expressApp.get('/api/admin/reports/profit', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { from, to, fromStr, toStr } = parseRange(req.query);
        res.json(await buildProfitReport(from, to, fromStr, toStr));
      } catch (err) { console.error('❌ Profit report error:', err); res.status(500).json({ error: err.message }); }
    });

    expressApp.get('/api/admin/export/:type', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const type = req.params.type;
        const { from, to, fromStr, toStr } = parseRange(req.query);
        const money = 'money', num = 'number';
        const orderLabel = (o) => { const pd = o.paymentDetails || {}; return pd.isPaid ? 'Paid' : (o.status === 'payment_failed' || pd.failureReason) ? 'Failed' : 'Pending'; };
        let sheets = [], fileName = `${type}-${toStr}.xlsx`;

        if (type === 'orders') {
          const rows = (await Order.findAll({ where: { createdAt: { [Op.gte]: from, [Op.lte]: to } }, order: [['createdAt', 'DESC']], limit: 20000 }));
          const users = rows.length ? await User.findAll({ where: { id: [...new Set(rows.map(o => o.userId))] }, attributes: ['id', 'fullName', 'phoneNumber', 'email'] }) : [];
          const uMap = {}; users.forEach(u => { uMap[u.id] = u; });
          const refs = await CustomerReferral.findAll(); const refMap = {}; refs.forEach(r => { refMap[r.customerId] = r.referralCode; });
          const orderRows = [], itemRows = [];
          rows.forEach((o) => {
            const pd = o.paymentDetails || {}; const u = uMap[o.userId] || {};
            orderRows.push({ id: o.id, date: new Date(o.createdAt).toISOString().slice(0, 16).replace('T', ' '), customer: u.fullName || `User #${o.userId}`, phone: u.phoneNumber, email: u.email, county: o.county, town: o.town, address: (o.shippingAddress && o.shippingAddress.details) || '',
              items: getOrderItems(o).map(i => `${i.quantity}x ${i.name || i.brandName}`).join('; '), kg: Number(o.totalWeightKg) || 0, subtotal: Number(o.subTotal) || 0, delivery: Number(o.transportFee) || 0, total: Number(o.grandTotal) || 0,
              payment: orderLabel(o), receipt: pd.mpesaReceipt, status: o.status, referral: refMap[o.userId] || '' });
            getOrderItems(o).forEach((i) => itemRows.push({ orderId: o.id, product: i.name || i.brandName, qty: Number(i.quantity) || 0, price: Number(i.priceAtPurchase) || 0, cost: Number(i.buyingPrice) || 0, lineProfit: ((Number(i.priceAtPurchase) || 0) - (Number(i.buyingPrice) || 0)) * (Number(i.quantity) || 0), bulk: i.wholesaleApplied ? 'Yes' : '' }));
          });
          sheets = [
            { name: 'Orders', columns: [{ header: 'Order #', key: 'id', type: num }, { header: 'Date', key: 'date' }, { header: 'Customer', key: 'customer' }, { header: 'Phone', key: 'phone' }, { header: 'Email', key: 'email' }, { header: 'County', key: 'county' }, { header: 'Town', key: 'town' }, { header: 'Address', key: 'address' }, { header: 'Items', key: 'items' }, { header: 'Kg', key: 'kg', type: num }, { header: 'Rice (KES)', key: 'subtotal', type: money }, { header: 'Delivery (KES)', key: 'delivery', type: money }, { header: 'Total (KES)', key: 'total', type: money }, { header: 'Payment', key: 'payment' }, { header: 'M-Pesa receipt', key: 'receipt' }, { header: 'Order status', key: 'status' }, { header: 'Referral code', key: 'referral' }], rows: orderRows },
            { name: 'Order items', columns: [{ header: 'Order #', key: 'orderId', type: num }, { header: 'Product', key: 'product' }, { header: 'Qty', key: 'qty', type: num }, { header: 'Price (KES)', key: 'price', type: money }, { header: 'Buying price (KES)', key: 'cost', type: money }, { header: 'Line profit (KES)', key: 'lineProfit', type: money }, { header: 'Bulk price', key: 'bulk' }], rows: itemRows }
          ];
          fileName = `orders-${fromStr}-to-${toStr}.xlsx`;
        } else if (type === 'customers') {
          const users = await User.findAll({ attributes: ['id', 'fullName', 'phoneNumber', 'email', 'isActive', 'isVerified', 'role', 'rewardPoints', 'createdAt'], order: [['createdAt', 'DESC']], limit: 50000 });
          const orders = await Order.findAll({ attributes: ['userId', 'grandTotal', 'paymentDetails', 'createdAt', 'county', 'status'], limit: 50000 });
          const agg = {};
          orders.forEach((o) => { const a = agg[o.userId] || (agg[o.userId] = { orders: 0, paid: 0, spent: 0, last: null, county: '' }); a.orders += 1; if ((o.paymentDetails || {}).isPaid) { a.paid += 1; a.spent += Number(o.grandTotal) || 0; if (!a.last || new Date(o.createdAt) > new Date(a.last)) { a.last = o.createdAt; a.county = o.county; } } });
          const staff = await StaffRole.findAll(); const sMap = {}; staff.forEach(r => { if (STAFF_ROLES.includes(r.role)) sMap[r.userId] = r.role; });
          const refs = await CustomerReferral.findAll(); const refMap = {}; refs.forEach(r => { refMap[r.customerId] = r.referralCode; });
          const prefs = await MarketingPref.findAll({ where: { optedOut: true } }); const optMap = {}; prefs.forEach(p => { optMap[p.userId] = true; });
          sheets = [{ name: 'Customers', columns: [{ header: 'ID', key: 'id', type: num }, { header: 'Name', key: 'name' }, { header: 'Phone', key: 'phone' }, { header: 'Email', key: 'email' }, { header: 'Joined', key: 'joined' }, { header: 'Role', key: 'role' }, { header: 'Active', key: 'active' }, { header: 'Verified', key: 'verified' }, { header: 'Orders', key: 'orders', type: num }, { header: 'Paid orders', key: 'paid', type: num }, { header: 'Total spent (KES)', key: 'spent', type: money }, { header: 'Last paid order', key: 'last' }, { header: 'Last county', key: 'county' }, { header: 'Reward points', key: 'points', type: num }, { header: 'Referral code used', key: 'ref' }, { header: 'Promo SMS opted out', key: 'opt' }],
            rows: users.map((u) => { const a = agg[u.id] || {}; return { id: u.id, name: u.fullName, phone: u.phoneNumber, email: u.email, joined: new Date(u.createdAt).toISOString().slice(0, 10), role: u.role === 'admin' ? 'admin' : (sMap[u.id] || 'customer'), active: u.isActive === false ? 'Suspended' : 'Active', verified: u.isVerified === false ? 'No' : 'Yes', orders: a.orders || 0, paid: a.paid || 0, spent: a.spent || 0, last: a.last ? new Date(a.last).toISOString().slice(0, 10) : '', county: a.county || '', points: Number(u.rewardPoints) || 0, ref: refMap[u.id] || '', opt: optMap[u.id] ? 'Yes' : '' }; }) }];
          fileName = `customers-${toStr}.xlsx`;
        } else if (type === 'finances') {
          const rep = await buildProfitReport(from, to, fromStr, toStr);
          const t = rep.totals;
          const purchases = await Purchase.findAll({ where: { purchaseDate: { [Op.gte]: fromStr, [Op.lte]: toStr } }, order: [['purchaseDate', 'DESC']] });
          const suppliers = await Supplier.findAll(); const supMap = {}; suppliers.forEach(x => { supMap[x.id] = x.name; });
          const commissions = await AgentCommission.findAll({ where: { createdAt: { [Op.gte]: from, [Op.lte]: to } }, order: [['createdAt', 'DESC']] });
          const payouts = await AgentPayout.findAll({ where: { createdAt: { [Op.gte]: from, [Op.lte]: to } }, order: [['createdAt', 'DESC']] });
          const agentIds = [...new Set([...commissions.map(c => c.agentId), ...payouts.map(p => p.agentId)])];
          const agents = agentIds.length ? await User.findAll({ where: { id: agentIds }, attributes: ['id', 'fullName'] }) : []; const aMap = {}; agents.forEach(a => { aMap[a.id] = a.fullName; });
          const groupCols = (label) => [{ header: label, key: 'label' }, { header: 'Orders', key: 'orders', type: num }, { header: 'Kg', key: 'kg', type: num }, { header: 'Revenue (KES)', key: 'revenue', type: money }, { header: 'Cost of rice (KES)', key: 'cost', type: money }, { header: 'Profit (KES)', key: 'profit', type: money }, { header: 'Agent commission (KES)', key: 'commission', type: money }, { header: 'Profit after commission (KES)', key: 'net', type: money }, { header: 'Margin %', key: 'margin', type: num }];
          sheets = [
            { name: 'Summary', columns: [{ header: 'Item', key: 'k' }, { header: 'Amount (KES)', key: 'v', type: money }], rows: [
              { k: `Period ${fromStr} to ${toStr}`, v: '' }, { k: 'Paid orders', v: t.orders }, { k: 'Kg sold', v: t.kg }, { k: 'Rice sales', v: t.riceRevenue }, { k: 'Delivery fees collected', v: t.deliveryIncome }, { k: 'Cost of rice sold', v: t.costOfGoods },
              { k: 'Gross profit on rice', v: t.grossProfit }, { k: 'Agent commissions', v: t.commissions }, { k: 'Expenses', v: t.expenses }, { k: 'NET PROFIT (gross + delivery - commissions - expenses)', v: t.netProfit } ] },
            { name: 'By month', columns: groupCols('Month'), rows: rep.byMonth }, { name: 'By day', columns: groupCols('Day'), rows: rep.byDay }, { name: 'By product', columns: groupCols('Product'), rows: rep.byProduct },
            { name: 'By county', columns: groupCols('County'), rows: rep.byCounty }, { name: 'By agent', columns: groupCols('Agent'), rows: rep.byAgent },
            { name: 'Expenses', columns: [{ header: 'Date', key: 'date' }, { header: 'Category', key: 'category' }, { header: 'Description', key: 'description' }, { header: 'Amount (KES)', key: 'amount', type: money }], rows: rep.expenses },
            { name: 'Purchases', columns: [{ header: 'Date', key: 'date' }, { header: 'Supplier', key: 'supplier' }, { header: 'Item', key: 'item' }, { header: 'Qty', key: 'qty', type: num }, { header: 'Unit cost', key: 'unit', type: money }, { header: 'Total', key: 'total', type: money }, { header: 'Paid', key: 'paid', type: money }, { header: 'Owed', key: 'owed', type: money }, { header: 'Reference', key: 'ref' }],
              rows: purchases.map(p => ({ date: p.purchaseDate, supplier: supMap[p.supplierId] || '', item: p.itemName, qty: p.quantity, unit: Number(p.unitCost), total: Number(p.totalCost), paid: Number(p.amountPaid), owed: Number(p.totalCost) - Number(p.amountPaid), ref: p.reference })) },
            { name: 'Agent commissions', columns: [{ header: 'Date', key: 'date' }, { header: 'Agent', key: 'agent' }, { header: 'Order #', key: 'order', type: num }, { header: 'Type', key: 'type' }, { header: 'Profit (KES)', key: 'profit', type: money }, { header: 'Rate', key: 'rate', type: num }, { header: 'Commission (KES)', key: 'amount', type: money }, { header: 'Status', key: 'status' }],
              rows: commissions.map(c => ({ date: new Date(c.createdAt).toISOString().slice(0, 10), agent: aMap[c.agentId] || `#${c.agentId}`, order: c.orderId, type: c.type, profit: Number(c.orderProfit), rate: Number(c.rate), amount: Number(c.amount), status: c.status })) },
            { name: 'Agent payouts', columns: [{ header: 'Date', key: 'date' }, { header: 'Agent', key: 'agent' }, { header: 'Amount (KES)', key: 'amount', type: money }, { header: 'Method', key: 'method' }, { header: 'Reference', key: 'ref' }],
              rows: payouts.map(p => ({ date: new Date(p.createdAt).toISOString().slice(0, 10), agent: aMap[p.agentId] || `#${p.agentId}`, amount: Number(p.amount), method: p.method, ref: p.reference })) }
          ];
          fileName = `finances-${fromStr}-to-${toStr}.xlsx`;
        } else if (type === 'stock') {
          const products = await RiceProduct.findAll({ order: [['id', 'ASC']] });
          const rowsOut = [];
          for (const p of products) { const th = await lowStockThresholdFor(p.id); rowsOut.push({ id: p.id, name: p.brandName, variety: p.variety, kg: Number(p.weightKg) || 0, stock: p.stockQuantity, level: th, state: p.stockQuantity <= 0 ? 'Out of stock' : p.stockQuantity <= th ? 'Low' : 'OK', price: Number(p.basePrice || p.price) || 0, cost: Number(p.buyingPrice) || 0, value: (Number(p.buyingPrice) || 0) * p.stockQuantity }); }
          sheets = [{ name: 'Stock', columns: [{ header: 'ID', key: 'id', type: num }, { header: 'Product', key: 'name' }, { header: 'Variety', key: 'variety' }, { header: 'Bag kg', key: 'kg', type: num }, { header: 'In stock', key: 'stock', type: num }, { header: 'Alert level', key: 'level', type: num }, { header: 'Status', key: 'state' }, { header: 'Selling price', key: 'price', type: money }, { header: 'Buying price', key: 'cost', type: money }, { header: 'Stock value at cost', key: 'value', type: money }], rows: rowsOut }];
          fileName = `stock-${toStr}.xlsx`;
        } else {
          return res.status(400).json({ error: 'Choose orders, customers, finances or stock.' });
        }

        const buffer = buildXlsx(sheets);
        await logEvent({ req, action: 'DATA_EXPORTED', category: 'admin', severity: 'warn', summary: `${req.adminUser.fullName} exported ${type} to Excel`, details: { type, from: fromStr, to: toStr } });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(buffer);
      } catch (err) { console.error('❌ Export error:', err); res.status(500).json({ error: err.message }); }
    });

    // ==========================================================================
    // SUPPLIERS, PURCHASES, STOCK, EXPENSES
    // ==========================================================================
    const todayEat = () => eatDateString();
    const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v));
    const supplierLedger = async (supplierId) => {
      const rows = await Purchase.findAll({ where: { supplierId }, order: [['purchaseDate', 'DESC']] });
      const total = round2(rows.reduce((s, p) => s + Number(p.totalCost), 0));
      const paid = round2(rows.reduce((s, p) => s + Number(p.amountPaid), 0));
      return { purchases: rows, totalPurchased: total, totalPaid: paid, owed: round2(total - paid) };
    };

    expressApp.get('/api/admin/suppliers', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const suppliers = await Supplier.findAll({ order: [['name', 'ASC']] });
        const all = await Purchase.findAll({ attributes: ['supplierId', 'totalCost', 'amountPaid', 'purchaseDate'] });
        const agg = {}; all.forEach((p) => { const a = agg[p.supplierId] || (agg[p.supplierId] = { total: 0, paid: 0, last: null, count: 0 }); a.total += Number(p.totalCost); a.paid += Number(p.amountPaid); a.count += 1; if (!a.last || p.purchaseDate > a.last) a.last = p.purchaseDate; });
        res.json(suppliers.map(x => ({ ...x.toJSON(), totalPurchased: round2((agg[x.id] || {}).total || 0), totalPaid: round2((agg[x.id] || {}).paid || 0), owed: round2(((agg[x.id] || {}).total || 0) - ((agg[x.id] || {}).paid || 0)), purchases: (agg[x.id] || {}).count || 0, lastPurchase: (agg[x.id] || {}).last || null })));
      } catch (err) { res.status(500).json({ error: err.message }); }
    });
    const saveSupplier = async (req, res, existing) => {
      try {
        const b = req.body || {};
        const name = String(b.name || '').trim().slice(0, 120);
        if (name.length < 2) return res.status(400).json({ error: 'Enter the supplier\'s name.' });
        const type = ['farmer', 'miller', 'transporter', 'other'].includes(b.type) ? b.type : 'farmer';
        const data = { name, type, phone: b.phone ? String(b.phone).slice(0, 40) : null, location: b.location ? String(b.location).slice(0, 120) : null, notes: b.notes ? String(b.notes).slice(0, 500) : null, isActive: b.isActive === undefined ? (existing ? existing.isActive : true) : !!b.isActive };
        const row = existing ? await existing.update(data) : await Supplier.create(data);
        await logEvent({ req, action: existing ? 'SUPPLIER_UPDATED' : 'SUPPLIER_ADDED', category: 'inventory', targetType: 'supplier', targetId: row.id, summary: `${req.adminUser.fullName} ${existing ? 'updated' : 'added'} supplier ${row.name}` });
        res.status(existing ? 200 : 201).json(row);
      } catch (err) { res.status(500).json({ error: err.message }); }
    };
    expressApp.post('/api/admin/suppliers', authenticateToken, requireAdmin, (req, res) => saveSupplier(req, res, null));
    expressApp.put('/api/admin/suppliers/:id', authenticateToken, requireAdmin, async (req, res) => {
      const existing = await Supplier.findByPk(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Supplier not found.' });
      return saveSupplier(req, res, existing);
    });
    expressApp.get('/api/admin/suppliers/:id', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const sup = await Supplier.findByPk(req.params.id);
        if (!sup) return res.status(404).json({ error: 'Supplier not found.' });
        res.json({ supplier: sup, ...(await supplierLedger(sup.id)) });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    expressApp.get('/api/admin/purchases', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { fromStr, toStr } = parseRange(req.query);
        const where = { purchaseDate: { [Op.gte]: fromStr, [Op.lte]: toStr } };
        if (req.query.supplierId && /^\d+$/.test(req.query.supplierId)) where.supplierId = Number(req.query.supplierId);
        const rows = await Purchase.findAll({ where, order: [['purchaseDate', 'DESC'], ['id', 'DESC']], limit: 500 });
        const sups = await Supplier.findAll(); const sMap = {}; sups.forEach(x => { sMap[x.id] = x.name; });
        res.json({ purchases: rows.map(p => ({ ...p.toJSON(), supplierName: sMap[p.supplierId] || '—', unitCost: Number(p.unitCost), totalCost: Number(p.totalCost), amountPaid: Number(p.amountPaid), owed: round2(Number(p.totalCost) - Number(p.amountPaid)) })),
          totals: { spent: round2(rows.reduce((s, p) => s + Number(p.totalCost), 0)), paid: round2(rows.reduce((s, p) => s + Number(p.amountPaid), 0)), owed: round2(rows.reduce((s, p) => s + Number(p.totalCost) - Number(p.amountPaid), 0)) } });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    expressApp.post('/api/admin/purchases', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const b = req.body || {};
        const qty = Math.round(Number(b.quantity)), unit = Number(b.unitCost);
        if (!Number.isFinite(qty) || qty <= 0 || qty > 1000000) return res.status(400).json({ error: 'Enter how many bags/units were bought.' });
        if (!Number.isFinite(unit) || unit < 0 || unit > 10000000) return res.status(400).json({ error: 'Enter the cost per bag/unit.' });
        const total = round2(qty * unit);
        const paid = round2(Number(b.amountPaid) || 0);
        if (paid < 0 || paid > total) return res.status(400).json({ error: 'Amount paid cannot be more than the total cost.' });
        const date = validDate(b.purchaseDate) ? b.purchaseDate : todayEat();
        let supplier = null;
        if (b.supplierId) { supplier = await Supplier.findByPk(b.supplierId); if (!supplier) return res.status(400).json({ error: 'Supplier not found.' }); }
        let product = null;
        if (b.productId) { product = await RiceProduct.findByPk(b.productId); if (!product) return res.status(400).json({ error: 'Product not found.' }); }
        const itemName = String(b.itemName || (product ? product.brandName : '')).trim().slice(0, 160);
        if (!itemName) return res.status(400).json({ error: 'Say what was bought.' });
        const addToStock = !!b.addToStock && !!product;
        if (b.addToStock && !product) return res.status(400).json({ error: 'Choose the product to add the stock to.' });

        const row = await sequelize.transaction(async (t) => {
          const created = await Purchase.create({ supplierId: supplier ? supplier.id : null, productId: product ? product.id : null, itemName, quantity: qty, unitCost: unit, totalCost: total, amountPaid: paid,
            paymentMethod: b.paymentMethod ? String(b.paymentMethod).slice(0, 30) : null, reference: b.reference ? String(b.reference).slice(0, 120) : null, purchaseDate: date, notes: b.notes ? String(b.notes).slice(0, 500) : null, addedToStock: addToStock, createdBy: req.adminUser.id }, { transaction: t });
          if (addToStock) {
            const oldStock = Math.max(0, Number(product.stockQuantity) || 0);
            if (b.updateBuyingPrice) {
              const oldCost = Number(product.buyingPrice) || 0;
              product.buyingPrice = oldStock + qty > 0 ? round2(((oldStock * oldCost) + (qty * unit)) / (oldStock + qty)) : unit;
            }
            product.stockQuantity = oldStock + qty;
            await product.save({ transaction: t });
          }
          return created;
        });
        if (addToStock) io.emit('stockUpdated', { productId: product.id, newStockQuantity: product.stockQuantity });
        await logEvent({ req, action: 'PURCHASE_RECORDED', category: 'inventory', targetType: 'purchase', targetId: row.id,
          summary: `${req.adminUser.fullName} recorded a purchase: ${qty} × ${itemName} at KES ${unit} = KES ${total}${supplier ? ' from ' + supplier.name : ''}${addToStock ? ` (stock now ${product.stockQuantity})` : ''}`, details: { total, paid, addToStock } });
        res.status(201).json({ message: addToStock ? `Purchase saved and stock updated to ${product.stockQuantity}.` : 'Purchase saved.', purchase: row, newStock: addToStock ? product.stockQuantity : null, newBuyingPrice: product ? Number(product.buyingPrice) : null });
      } catch (err) { console.error('❌ Purchase error:', err); res.status(err.status || 500).json({ error: err.message }); }
    });

    expressApp.post('/api/admin/purchases/:id/payment', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const p = await Purchase.findByPk(req.params.id);
        if (!p) return res.status(404).json({ error: 'Purchase not found.' });
        const amount = round2(Number((req.body || {}).amount));
        const owed = round2(Number(p.totalCost) - Number(p.amountPaid));
        if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Enter the amount paid.' });
        if (amount > owed) return res.status(400).json({ error: `Only KES ${owed} is still owed on this purchase.` });
        p.amountPaid = round2(Number(p.amountPaid) + amount);
        p.reference = (req.body || {}).reference ? String((req.body || {}).reference).slice(0, 120) : p.reference;
        await p.save();
        await logEvent({ req, action: 'SUPPLIER_PAID', category: 'inventory', severity: 'warn', targetType: 'purchase', targetId: p.id, summary: `${req.adminUser.fullName} paid KES ${amount} on purchase #${p.id} (${p.itemName})`, details: { amount, owedAfter: round2(owed - amount) } });
        res.json({ message: `Payment of KES ${amount} recorded.`, purchase: p });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    expressApp.get('/api/admin/stock/overview', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const products = await RiceProduct.findAll({ order: [['brandName', 'ASC']] });
        const ops = await getOps();
        const since = new Date(Date.now() - 30 * 86400000);
        const paid = await loadPaidOrdersInRange(since, new Date());
        const sold = {}; paid.forEach(o => getOrderItems(o).forEach(i => { sold[i.productId] = (sold[i.productId] || 0) + (Number(i.quantity) || 0); }));
        const lastBuy = {}; (await Purchase.findAll({ attributes: ['productId', 'purchaseDate', 'unitCost'], order: [['purchaseDate', 'DESC']], limit: 1000 })).forEach(p => { if (p.productId && !lastBuy[p.productId]) lastBuy[p.productId] = { date: p.purchaseDate, unitCost: Number(p.unitCost) }; });
        const list = [];
        for (const p of products) {
          const th = await lowStockThresholdFor(p.id);
          const perDay = (sold[p.id] || 0) / 30;
          list.push({ id: p.id, name: p.brandName, variety: p.variety, weightKg: p.weightKg, stock: p.stockQuantity, threshold: th, customThreshold: ops.lowStockPerProduct && ops.lowStockPerProduct[p.id] !== undefined,
            state: p.stockQuantity <= 0 ? 'out' : p.stockQuantity <= th ? 'low' : 'ok', sold30: sold[p.id] || 0, daysLeft: perDay > 0 ? Math.floor(p.stockQuantity / perDay) : null,
            buyingPrice: Number(p.buyingPrice) || 0, price: Number(p.basePrice || p.price) || 0, lastPurchase: lastBuy[p.id] || null, stockValue: round2((Number(p.buyingPrice) || 0) * p.stockQuantity) });
        }
        res.json({ products: list, defaultThreshold: ops.lowStockDefault, lowCount: list.filter(x => x.state !== 'ok').length, stockValue: round2(list.reduce((s, x) => s + x.stockValue, 0)) });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });
    expressApp.put('/api/admin/stock/thresholds', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const b = req.body || {};
        const patch = {};
        if (b.defaultThreshold !== undefined) { const n = Math.round(Number(b.defaultThreshold)); if (!Number.isFinite(n) || n < 0 || n > 100000) return res.status(400).json({ error: 'Enter a valid default level.' }); patch.lowStockDefault = n; }
        if (b.productId !== undefined) {
          const ops = await getOps(true); const per = { ...(ops.lowStockPerProduct || {}) };
          if (b.threshold === null || b.threshold === '') delete per[b.productId];
          else { const n = Math.round(Number(b.threshold)); if (!Number.isFinite(n) || n < 0 || n > 100000) return res.status(400).json({ error: 'Enter a valid level.' }); per[b.productId] = n; }
          patch.lowStockPerProduct = per;
        }
        const next = await saveOps(patch);
        res.json({ message: 'Stock alert levels saved.', defaultThreshold: next.lowStockDefault });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    expressApp.get('/api/admin/expenses', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { fromStr, toStr } = parseRange(req.query);
        const where = { expenseDate: { [Op.gte]: fromStr, [Op.lte]: toStr } };
        if (req.query.category && EXPENSE_CATEGORIES.includes(req.query.category)) where.category = req.query.category;
        const rows = await Expense.findAll({ where, order: [['expenseDate', 'DESC'], ['id', 'DESC']], limit: 1000 });
        const byCategory = {}, byMonth = {};
        rows.forEach((e) => { byCategory[e.category] = round2((byCategory[e.category] || 0) + Number(e.amount)); const m = String(e.expenseDate).slice(0, 7); byMonth[m] = round2((byMonth[m] || 0) + Number(e.amount)); });
        res.json({ expenses: rows.map(e => ({ ...e.toJSON(), amount: Number(e.amount) })), total: round2(rows.reduce((s, e) => s + Number(e.amount), 0)), byCategory, byMonth, categories: EXPENSE_CATEGORIES });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });
    const saveExpense = async (req, res, existing) => {
      try {
        const b = req.body || {};
        const amount = round2(Number(b.amount));
        if (!EXPENSE_CATEGORIES.includes(b.category)) return res.status(400).json({ error: 'Choose an expense category.' });
        if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) return res.status(400).json({ error: 'Enter a valid amount.' });
        const data = { category: b.category, amount, description: b.description ? String(b.description).trim().slice(0, 300) : null, reference: b.reference ? String(b.reference).slice(0, 120) : null, expenseDate: validDate(b.expenseDate) ? b.expenseDate : todayEat() };
        const row = existing ? await existing.update(data) : await Expense.create({ ...data, createdBy: req.adminUser.id });
        await logEvent({ req, action: existing ? 'EXPENSE_UPDATED' : 'EXPENSE_RECORDED', category: 'admin', severity: 'warn', targetType: 'expense', targetId: row.id, summary: `${req.adminUser.fullName} ${existing ? 'updated' : 'recorded'} a ${data.category} expense of KES ${amount}${data.description ? ' (' + data.description + ')' : ''}` });
        res.status(existing ? 200 : 201).json(row);
      } catch (err) { res.status(500).json({ error: err.message }); }
    };
    expressApp.post('/api/admin/expenses', authenticateToken, requireAdmin, (req, res) => saveExpense(req, res, null));
    expressApp.put('/api/admin/expenses/:id', authenticateToken, requireAdmin, async (req, res) => {
      const e = await Expense.findByPk(req.params.id);
      if (!e) return res.status(404).json({ error: 'Expense not found.' });
      return saveExpense(req, res, e);
    });
    expressApp.delete('/api/admin/expenses/:id', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const e = await Expense.findByPk(req.params.id);
        if (!e) return res.status(404).json({ error: 'Expense not found.' });
        await logEvent({ req, action: 'EXPENSE_DELETED', category: 'admin', severity: 'alert', targetType: 'expense', targetId: e.id, summary: `${req.adminUser.fullName} deleted a ${e.category} expense of KES ${Number(e.amount)} (${e.description || 'no note'}) dated ${e.expenseDate}`, details: e.toJSON() });
        await e.destroy();
        res.json({ message: 'Expense deleted.' });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ==========================================================================
    // WHOLESALE (BULK) PRICING
    // ==========================================================================
    expressApp.get('/api/admin/wholesale', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const tiers = await getWholesaleTiers(true);
        const products = await RiceProduct.findAll({ order: [['brandName', 'ASC']] });
        res.json(products.map(p => ({ id: p.id, name: p.brandName, weightKg: p.weightKg, price: Number(p.basePrice || p.price) || 0, buyingPrice: Number(p.buyingPrice) || 0, tiers: Array.isArray(tiers[p.id]) ? tiers[p.id] : [] })));
      } catch (err) { res.status(500).json({ error: err.message }); }
    });
    expressApp.put('/api/admin/products/:id/wholesale-tiers', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const product = await RiceProduct.findByPk(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found.' });
        const tiers = sanitizeTiers((req.body || {}).tiers);
        const base = Number(product.basePrice || product.price) || 0;
        const cost = Number(product.buyingPrice) || 0;
        for (const t of tiers) {
          if (base && t.price >= base) return res.status(400).json({ error: `A bulk price must be lower than the normal price (KES ${base}).` });
          if (cost && t.price < cost && !(req.body || {}).force) return res.status(400).json({ error: `The ${t.minQty}+ bag price (KES ${t.price}) is below your buying price (KES ${cost}), so you would lose money. Tick "allow anyway" to save it.`, belowCost: true });
        }
        const [row] = await SystemConfig.findOrCreate({ where: { key: 'wholesale_tiers' }, defaults: { value: {} } });
        const all = { ...(row.value || {}) };
        if (tiers.length) all[product.id] = tiers; else delete all[product.id];
        row.value = all; row.changed('value', true); await row.save();
        tierCache = { at: 0, value: {} };
        await logEvent({ req, action: 'WHOLESALE_PRICES_CHANGED', category: 'settings', severity: 'warn', targetType: 'product', targetId: product.id, summary: `${req.adminUser.fullName} set bulk prices for ${product.brandName}: ${tiers.map(t => `${t.minQty}+ @ KES ${t.price}`).join(', ') || 'none'}`, details: { tiers } });
        io.emit('productsChanged', { productId: product.id });
        res.json({ message: tiers.length ? 'Bulk prices saved.' : 'Bulk prices removed.', tiers });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ==========================================================================
    // PRODUCT REVIEWS (verified buyers only)
    // ==========================================================================
    const optionalUserId = (req) => {
      try {
        const header = req.headers['authorization'] || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) return null;
        return jwt.verify(token, JWT_SECRET).id || null;
      } catch (_) { return null; }
    };
    const userBoughtProduct = async (userId, productId) => {
      const orders = await Order.findAll({ where: { userId }, attributes: ['id', 'items', 'paymentDetails', 'status'] });
      const hit = orders.find(o => (o.paymentDetails || {}).isPaid === true && !/cancel|refund|reject/i.test(String(o.status || '')) && getOrderItems(o).some(i => Number(i.productId) === Number(productId)));
      return hit ? hit.id : null;
    };
    const publicName = (full) => { const parts = String(full || 'Customer').trim().split(/\s+/); return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0]; };

    expressApp.get('/api/products/:id/reviews', async (req, res) => {
      try {
        const productId = Number(req.params.id);
        if (!Number.isFinite(productId)) return res.status(400).json({ error: 'Invalid product.' });
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const all = await Review.findAll({ where: { productId, status: 'published' }, order: [['createdAt', 'DESC']] });
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; all.forEach(r => { distribution[r.rating] += 1; });
        const avg = all.length ? Math.round((all.reduce((s, r) => s + r.rating, 0) / all.length) * 10) / 10 : 0;
        const slice = all.slice((page - 1) * 10, page * 10);
        const users = slice.length ? await User.findAll({ where: { id: slice.map(r => r.userId) }, attributes: ['id', 'fullName'] }) : []; const uMap = {}; users.forEach(u => { uMap[u.id] = u.fullName; });
        const me = optionalUserId(req);
        let canReview = false, reason = 'Sign in to review products you have bought.', mine = null;
        if (me) {
          mine = await Review.findOne({ where: { productId, userId: me } });
          const orderId = await userBoughtProduct(me, productId);
          canReview = !!orderId; reason = orderId ? (mine ? 'You can update your review.' : 'Share your experience.') : 'Only customers who have bought and paid for this rice can review it.';
        }
        res.json({ summary: { average: avg, count: all.length, distribution }, reviews: slice.map(r => ({ id: r.id, rating: r.rating, title: r.title, comment: r.comment, author: publicName(uMap[r.userId]), createdAt: r.createdAt, reply: r.adminReply, verified: true, mine: me === r.userId })), page, pages: Math.max(1, Math.ceil(all.length / 10)), canReview, reason, myReview: mine ? { rating: mine.rating, title: mine.title, comment: mine.comment, status: mine.status } : null });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });
    expressApp.post('/api/products/:id/reviews', authenticateToken, async (req, res) => {
      try {
        const productId = Number(req.params.id);
        const product = await RiceProduct.findByPk(productId);
        if (!product) return res.status(404).json({ error: 'Product not found.' });
        const rating = Math.round(Number((req.body || {}).rating));
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Choose a rating from 1 to 5 stars.' });
        const comment = String((req.body || {}).comment || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
        const title = String((req.body || {}).title || '').replace(/\s+/g, ' ').trim().slice(0, 100);
        if (comment.length > 0 && comment.length < 3) return res.status(400).json({ error: 'Your comment is too short.' });
        const orderId = await userBoughtProduct(req.user.id, productId);
        if (!orderId) return res.status(403).json({ error: 'Only customers who have bought and paid for this rice can review it.' });
        let review = await Review.findOne({ where: { productId, userId: req.user.id } });
        if (review) { await review.update({ rating, title: title || null, comment: comment || null, status: review.status === 'hidden' ? 'hidden' : 'published' }); }
        else review = await Review.create({ productId, userId: req.user.id, orderId, rating, title: title || null, comment: comment || null });
        await logEvent({ req, action: 'REVIEW_POSTED', category: 'orders', targetType: 'product', targetId: productId, summary: `${req.user.fullName} rated ${product.brandName} ${rating}/5`, details: { reviewId: review.id } });
        res.status(201).json({ message: review.status === 'hidden' ? 'Saved. This review is hidden by our team.' : 'Thank you! Your review is live.', review });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });
    expressApp.get('/api/admin/reviews', authenticateToken, requirePerm('reviews.moderate'), async (req, res) => {
      try {
        const where = {}; if (req.query.status === 'hidden' || req.query.status === 'published') where.status = req.query.status;
        const rows = await Review.findAll({ where, order: [['createdAt', 'DESC']], limit: 300 });
        const users = rows.length ? await User.findAll({ where: { id: [...new Set(rows.map(r => r.userId))] }, attributes: ['id', 'fullName', 'phoneNumber'] }) : []; const uMap = {}; users.forEach(u => { uMap[u.id] = u; });
        const prods = rows.length ? await RiceProduct.findAll({ where: { id: [...new Set(rows.map(r => r.productId))] }, attributes: ['id', 'brandName'] }) : []; const pMap = {}; prods.forEach(p => { pMap[p.id] = p.brandName; });
        res.json(rows.map(r => ({ ...r.toJSON(), customer: uMap[r.userId] ? uMap[r.userId].fullName : `User #${r.userId}`, phone: uMap[r.userId] ? uMap[r.userId].phoneNumber : null, product: pMap[r.productId] || `Product #${r.productId}` })));
      } catch (err) { res.status(500).json({ error: err.message }); }
    });
    expressApp.put('/api/admin/reviews/:id', authenticateToken, requirePerm('reviews.moderate'), async (req, res) => {
      try {
        const r = await Review.findByPk(req.params.id);
        if (!r) return res.status(404).json({ error: 'Review not found.' });
        const b = req.body || {};
        if (b.status !== undefined) { if (!['published', 'hidden'].includes(b.status)) return res.status(400).json({ error: 'Invalid status.' }); r.status = b.status; }
        if (b.reply !== undefined) r.adminReply = String(b.reply || '').trim().slice(0, 600) || null;
        await r.save();
        await logEvent({ req, action: b.status ? (b.status === 'hidden' ? 'REVIEW_HIDDEN' : 'REVIEW_RESTORED') : 'REVIEW_REPLIED', category: 'users', targetType: 'review', targetId: r.id, summary: `${req.user.fullName} ${b.status === 'hidden' ? 'hid' : b.status === 'published' ? 'restored' : 'replied to'} review #${r.id}` });
        res.json(r);
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ==========================================================================
    // PROMOTIONAL SMS: segments, campaigns, opt-out
    // ==========================================================================
    const optOutPage = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:Segoe UI,Arial,sans-serif;background:#f0fdf4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="background:#fff;border-radius:16px;padding:32px;max-width:420px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.08)"><h2 style="color:#166534;margin-top:0">🌾 Mwea Rice Hub</h2>${body}</div></body></html>`;
    const verifyOptToken = (token) => {
      const [id, sig] = String(token || '').split('.');
      if (!/^\d+$/.test(id || '') || !sig) return null;
      const expected = optOutSignature(id);
      if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
      return Number(id);
    };
    const setOptOut = async (userId, optedOut, source) => {
      const [row] = await MarketingPref.findOrCreate({ where: { userId }, defaults: { optedOut, source } });
      if (row.optedOut !== optedOut) { row.optedOut = optedOut; row.source = source; await row.save(); }
      await logEvent({ actor: { id: userId, role: 'customer', name: null }, action: optedOut ? 'MARKETING_OPT_OUT' : 'MARKETING_OPT_IN', category: 'users', targetType: 'user', targetId: userId, summary: `User #${userId} ${optedOut ? 'opted out of' : 'opted back in to'} promotional SMS (${source})` });
    };
    expressApp.get('/api/optout/:token', async (req, res) => {
      const id = verifyOptToken(req.params.token);
      if (!id) return res.status(400).send(optOutPage('Invalid link', '<p>This opt-out link is not valid.</p>'));
      await setOptOut(id, true, 'sms-link');
      res.send(optOutPage('Unsubscribed', `<p>You will no longer receive promotional SMS from us.</p><p style="color:#64748b;font-size:13px">You will still get order, payment and security messages.</p><p style="font-size:13px"><a href="${RENDER_BASE_URL}/api/optin/${req.params.token}" style="color:#166534">Changed your mind? Subscribe again</a></p>`));
    });
    expressApp.get('/api/optin/:token', async (req, res) => {
      const id = verifyOptToken(req.params.token);
      if (!id) return res.status(400).send(optOutPage('Invalid link', '<p>This link is not valid.</p>'));
      await setOptOut(id, false, 'sms-link');
      res.send(optOutPage('Subscribed', '<p>Welcome back! You will receive our occasional offers.</p>'));
    });
    expressApp.get('/api/user/marketing-preference', authenticateToken, async (req, res) => {
      const pref = await MarketingPref.findOne({ where: { userId: req.user.id } });
      res.json({ optedOut: !!(pref && pref.optedOut) });
    });
    expressApp.put('/api/user/marketing-preference', authenticateToken, async (req, res) => {
      try { const out = !!(req.body || {}).optedOut; await setOptOut(req.user.id, out, 'account'); res.json({ optedOut: out, message: out ? 'You will no longer receive promotional SMS.' : 'You will receive our occasional offers.' }); }
      catch (err) { res.status(500).json({ error: err.message }); }
    });

    const cleanFilters = (f = {}) => {
      const int = (v, max = 100000) => (v === undefined || v === null || v === '' ? null : Math.min(max, Math.max(0, Math.round(Number(v)))));
      return {
        counties: (Array.isArray(f.counties) ? f.counties : []).map(c => String(c).slice(0, 40)).slice(0, 47),
        minOrders: int(f.minOrders), maxOrders: int(f.maxOrders), minSpent: int(f.minSpent, 100000000),
        inactiveDays: int(f.inactiveDays, 3650), joinedWithinDays: int(f.joinedWithinDays, 3650),
        neverOrdered: !!f.neverOrdered, boughtProductIds: (Array.isArray(f.boughtProductIds) ? f.boughtProductIds : []).map(Number).filter(Number.isFinite).slice(0, 20),
        referredOnly: !!f.referredOnly
      };
    };
    const selectAudience = async (filters) => {
      const f = cleanFilters(filters);
      const users = await User.findAll({ where: { isActive: true, role: { [Op.ne]: 'admin' } }, attributes: ['id', 'fullName', 'phoneNumber', 'isVerified', 'createdAt'], limit: 50000 });
      const staff = await StaffRole.findAll(); const staffIds = new Set(staff.filter(r => STAFF_ROLES.includes(r.role)).map(r => r.userId));
      const orders = await Order.findAll({ attributes: ['userId', 'grandTotal', 'paymentDetails', 'county', 'createdAt', 'items', 'status'], limit: 50000 });
      const agg = {};
      orders.forEach((o) => {
        if (!(o.paymentDetails || {}).isPaid) return;
        const a = agg[o.userId] || (agg[o.userId] = { n: 0, spent: 0, last: 0, counties: new Set(), products: new Set() });
        a.n += 1; a.spent += Number(o.grandTotal) || 0; a.last = Math.max(a.last, new Date(o.createdAt).getTime()); if (o.county) a.counties.add(normPlace(o.county));
        getOrderItems(o).forEach(i => a.products.add(Number(i.productId)));
      });
      const refs = await CustomerReferral.findAll(); const referred = new Set(refs.map(r => r.customerId));
      const optedOut = new Set((await MarketingPref.findAll({ where: { optedOut: true } })).map(p => p.userId));
      const wantCounties = f.counties.map(normPlace);
      const now = Date.now();
      let noPhone = 0, optedOutCount = 0; const recipients = [];
      for (const u of users) {
        if (u.isVerified === false || staffIds.has(u.id)) continue;
        const a = agg[u.id] || { n: 0, spent: 0, last: 0, counties: new Set(), products: new Set() };
        if (f.neverOrdered && a.n > 0) continue;
        if (f.minOrders !== null && a.n < f.minOrders) continue;
        if (f.maxOrders !== null && a.n > f.maxOrders) continue;
        if (f.minSpent !== null && a.spent < f.minSpent) continue;
        if (f.inactiveDays !== null && !(a.n > 0 && now - a.last >= f.inactiveDays * 86400000)) continue;
        if (f.joinedWithinDays !== null && now - new Date(u.createdAt).getTime() > f.joinedWithinDays * 86400000) continue;
        if (wantCounties.length && !wantCounties.some(c => a.counties.has(c))) continue;
        if (f.boughtProductIds.length && !f.boughtProductIds.some(id => a.products.has(id))) continue;
        if (f.referredOnly && !referred.has(u.id)) continue;
        const phone = normalizeKenyanPhone(u.phoneNumber);
        if (!phone) { noPhone += 1; continue; }
        if (optedOut.has(u.id)) { optedOutCount += 1; continue; }
        recipients.push({ id: u.id, name: u.fullName, phone });
      }
      return { filters: f, recipients, optedOutCount, noPhone };
    };
    const normPlace = (v) => String(v || '').toLowerCase().replace(/\bcounty\b/g, '').replace(/[^a-z0-9]/g, '');
    const MAX_CAMPAIGN = 1500;
    const campaignMessageFor = (message, userId) => `${message}\nOpt out: ${optOutLink(userId)}`;
    let campaignRunning = false;

    expressApp.post('/api/admin/campaigns/preview', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { message, filters } = req.body || {};
        const aud = await selectAudience(filters);
        const ops = await getOps();
        const sample = campaignMessageFor(String(message || ''), 999999);
        const parts = smsPartsFor(sample);
        const cost = round2(aud.recipients.length * parts * Number(ops.smsCostPerPart));
        res.json({ count: aud.recipients.length, optedOut: aud.optedOutCount, noPhone: aud.noPhone, parts, estimatedCost: cost, balance: smsState.balance, canAfford: smsState.balance === null ? null : smsState.balance >= cost,
          tooMany: aud.recipients.length > MAX_CAMPAIGN, max: MAX_CAMPAIGN, sample: aud.recipients.slice(0, 8).map(r => ({ name: r.name, phone: maskPhone(r.phone) })), exampleMessage: sample });
      } catch (err) { console.error('❌ Campaign preview error:', err); res.status(500).json({ error: err.message }); }
    });

    expressApp.post('/api/admin/campaigns', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const b = req.body || {};
        const name = String(b.name || '').trim().slice(0, 120);
        const message = String(b.message || '').replace(/\s+/g, ' ').trim();
        if (name.length < 3) return res.status(400).json({ error: 'Give the campaign a name.' });
        if (message.length < 10 || message.length > 320) return res.status(400).json({ error: 'The message must be between 10 and 320 characters (the opt-out link is added automatically).' });
        if (b.confirm !== 'SEND') return res.status(400).json({ error: 'Type SEND to confirm.' });
        if (campaignRunning) return res.status(409).json({ error: 'Another campaign is still sending. Wait for it to finish.' });
        const hour = eatNow().getUTCHours();
        if ((hour < 7 || hour >= 20) && !b.allowQuietHours) return res.status(400).json({ error: 'Promotions are not sent between 8pm and 7am. Try again in the morning, or tick "send anyway".', quietHours: true });
        const aud = await selectAudience(b.filters);
        if (!aud.recipients.length) return res.status(400).json({ error: 'No customers match this segment.' });
        if (aud.recipients.length > MAX_CAMPAIGN) return res.status(400).json({ error: `This segment has ${aud.recipients.length} customers. The limit is ${MAX_CAMPAIGN} per campaign; narrow the segment.` });
        const ops = await getOps();
        const parts = smsPartsFor(campaignMessageFor(message, 999999));
        const cost = round2(aud.recipients.length * parts * Number(ops.smsCostPerPart));
        if (smsState.balance !== null && smsState.balance < cost) return res.status(400).json({ error: `Not enough SMS credit: this needs about ${cost} but you have ${smsState.balance}. Top up Ping Africa first.` });

        const campaign = await Campaign.create({ name, message, filters: aud.filters, status: 'sending', totalRecipients: aud.recipients.length, smsParts: parts, optedOutSkipped: aud.optedOutCount, createdBy: req.adminUser.id, startedAt: new Date() });
        await logEvent({ req, action: 'CAMPAIGN_STARTED', category: 'admin', severity: 'warn', targetType: 'campaign', targetId: campaign.id, summary: `${req.adminUser.fullName} started SMS campaign "${name}" to ${aud.recipients.length} customers (about ${cost} credit)`, details: { filters: aud.filters, parts } });
        campaignRunning = true;
        (async () => {
          let sent = 0, failed = 0, i = 0;
          try {
            for (const r of aud.recipients) {
              i += 1;
              if (i % 10 === 1) { const fresh = await Campaign.findByPk(campaign.id); if (fresh && fresh.status === 'stopped') break; }
              const pref = await MarketingPref.findOne({ where: { userId: r.id } });
              if (pref && pref.optedOut) continue;
              const result = await sendSmsRaw(r.phone, campaignMessageFor(message, r.id));
              if (result.ok) sent += 1; else failed += 1;
              if (i % 10 === 0) await Campaign.update({ sentCount: sent, failedCount: failed }, { where: { id: campaign.id } });
              if (!result.ok && /credit|balance|insufficient|unauthor/i.test(String(result.error))) { failed += aud.recipients.length - i; break; }
              await new Promise(rs => setTimeout(rs, 150));
            }
            const done = await Campaign.findByPk(campaign.id);
            await Campaign.update({ sentCount: sent, failedCount: failed, status: done && done.status === 'stopped' ? 'stopped' : (sent === 0 ? 'failed' : 'sent'), finishedAt: new Date() }, { where: { id: campaign.id } });
            await logEvent({ actor: { id: req.adminUser.id, role: 'admin', name: req.adminUser.fullName }, action: 'CAMPAIGN_FINISHED', category: 'admin', targetType: 'campaign', targetId: campaign.id, summary: `Campaign "${name}" finished: ${sent} sent, ${failed} failed` });
          } catch (e) {
            console.error('❌ Campaign run error:', e);
            await Campaign.update({ sentCount: sent, failedCount: failed, status: 'failed', finishedAt: new Date() }, { where: { id: campaign.id } });
          } finally { campaignRunning = false; }
        })();
        res.status(202).json({ message: `Sending to ${aud.recipients.length} customers. You can watch progress below.`, campaign });
      } catch (err) { console.error('❌ Campaign error:', err); res.status(500).json({ error: err.message }); }
    });
    expressApp.get('/api/admin/campaigns', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const rows = await Campaign.findAll({ order: [['createdAt', 'DESC']], limit: 50 });
        const optOuts = await MarketingPref.count({ where: { optedOut: true } });
        res.json({ campaigns: rows, optOuts, balance: smsState.balance, running: campaignRunning });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });
    expressApp.post('/api/admin/campaigns/:id/stop', authenticateToken, requireAdmin, async (req, res) => {
      const c = await Campaign.findByPk(req.params.id);
      if (!c) return res.status(404).json({ error: 'Campaign not found.' });
      if (c.status === 'sending') { c.status = 'stopped'; await c.save(); await logEvent({ req, action: 'CAMPAIGN_STOPPED', category: 'admin', severity: 'warn', targetType: 'campaign', targetId: c.id, summary: `${req.adminUser.fullName} stopped campaign "${c.name}"` }); }
      res.json({ message: 'The campaign will stop within a few messages.' });
    });

    // --- USER CLEARANCE MANAGEMENT ---
    expressApp.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const systemRegisteredUsers = await User.findAll({ attributes: { exclude: ['password', 'resetToken', 'resetTokenExpires', 'verificationOtp', 'verificationOtpExpires'] } });
        const staffRows = await StaffRole.findAll();
        const staffMap = {};
        staffRows.forEach(r => { if (STAFF_ROLES.includes(r.role)) staffMap[r.userId] = r; });
        res.json(systemRegisteredUsers.map((u) => {
          const o = u.toJSON();
          const sr = staffMap[o.id];
          return { ...o, role: o.role === 'admin' ? 'admin' : (sr ? sr.role : o.role), referralCode: sr && sr.role === 'agent' ? sr.referralCode : undefined, isSuspended: o.isActive === false };
        }));
      } catch (err) { 
        res.status(500).json({ error: err.message }); 
      }
    });

// Audit logging must never break an admin action, so failures are only reported in the console.
        const safeAdminLog = async (entry) => {
          try { await AdminLog.create(entry); } catch (logErr) { console.error('⚠️ Admin audit log skipped:', logErr.message); }
        };

        // --- ADMIN: SINGLE USER (view / edit / delete) ---
        expressApp.get('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
          try {
            const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password', 'verificationOtp', 'verificationOtpExpires'] } });
            if (!user) return res.status(404).json({ error: 'User record not found.' });
            res.json(user);
          } catch (err) {
            console.error('❌ Admin route error:', err); res.status(500).json({ error: err.message });
          }
        });

        const adminEditUserHandler = async (req, res) => {
          try {
            const { fullName, role, isActive, email, phoneNumber } = req.body || {};
            const user = await User.findByPk(req.params.id);
            if (!user) return res.status(404).json({ error: 'User record not found.' });
            if (fullName !== undefined) user.fullName = fullName;
            if (role !== undefined) {
              const handledAsStaff = await applyRoleChange(req, user, role);
              if (!handledAsStaff && !STAFF_ROLES.includes(role) && role !== 'none') user.role = role;
            }
            if (isActive !== undefined) user.isActive = isActive;
            if (req.body && req.body.rewardPoints !== undefined) {
              const pts = Math.round(Number(req.body.rewardPoints));
              if (!Number.isFinite(pts) || pts < 0 || pts > 1000000) return res.status(400).json({ error: 'Reward points must be a whole number between 0 and 1,000,000.' });
              if (pts !== Number(user.rewardPoints || 0)) {
                await logEvent({ req, action: 'USER_POINTS_ADJUSTED', category: 'users', severity: 'warn', targetType: 'user', targetId: user.id,
                  summary: `${req.user ? req.user.fullName : 'Admin'} changed reward points for ${user.fullName} (#${user.id}): ${user.rewardPoints || 0} → ${pts}`, details: { from: Number(user.rewardPoints || 0), to: pts } });
                user.rewardPoints = pts;
              }
            }
            if (email !== undefined) user.email = email || null;
            if (phoneNumber !== undefined) user.phoneNumber = phoneNumber ? (normalizeKenyanPhone(phoneNumber) || phoneNumber) : null;
            await user.save();
            await safeAdminLog({ adminId: req.adminUser.id, action: 'MODIFY_USER', targetType: 'user', targetId: user.id, ipAddress: req.ip });
            const safe = user.toJSON ? user.toJSON() : { ...user };
            delete safe.password;
            res.json({ message: 'User record updated successfully.', user: safe });
          } catch (err) {
            console.error('❌ Admin route error:', err); res.status(err.status || 500).json({ error: err.message });
          }
        };
        expressApp.put('/api/admin/users/:id', authenticateToken, requireAdmin, adminEditUserHandler);
        expressApp.patch('/api/admin/users/:id', authenticateToken, requireAdmin, adminEditUserHandler);

        expressApp.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
          try {
            const user = await User.findByPk(req.params.id);
            if (!user) return res.status(404).json({ error: 'User record not found.' });
            if (String(user.id) === String(req.adminUser.id)) {
              return res.status(400).json({ error: 'You cannot delete your own admin account.' });
            }
            const staffRow = await StaffRole.findOne({ where: { userId: user.id } });
            const hasCommissions = await AgentCommission.findOne({ where: { agentId: user.id } });
            if ((staffRow && STAFF_ROLES.includes(staffRow.role)) || hasCommissions) {
              return res.status(409).json({ error: 'This account is (or was) staff with commission history. Dismiss the role and suspend the account instead of deleting it.' });
            }
            try {
              await user.destroy();
            } catch (delErr) {
              if (delErr.name === 'SequelizeForeignKeyConstraintError') {
                return res.status(409).json({ error: 'This user has orders or other records and cannot be deleted. Suspend the account instead.' });
              }
              throw delErr;
            }
            await safeAdminLog({ adminId: req.adminUser.id, action: 'DELETE_USER', targetType: 'user', targetId: req.params.id, ipAddress: req.ip });
            res.json({ message: 'User deleted successfully.' });
          } catch (err) {
            console.error('❌ Admin route error:', err); res.status(500).json({ error: err.message });
          }
        });

        // --- ADMIN: BLACK FRIDAY / FLASH SALE CONTROL ---
        expressApp.get('/api/admin/config/black-friday', authenticateToken, requireAdmin, async (req, res) => {
          try {
            await syncFlashSaleFromDb(true);
            const config = await SystemConfig.findOne({ where: { key: 'black_friday' } });
            const msRemaining = flashSaleState.endTime ? Math.max(0, new Date(flashSaleState.endTime).getTime() - Date.now()) : 0;
            res.json({ ...(config && config.value ? config.value : {}), active: flashSaleState.active, endTime: flashSaleState.endTime, msRemaining });
          } catch (err) {
            console.error('❌ Admin route error:', err); res.status(500).json({ error: err.message });
          }
        });

        const adminSetBlackFridayHandler = async (req, res) => {
          try {
            const b = req.body || {};
            const wantsStop = b.active === false || b.active === 'false' || b.action === 'stop' || b.action === 'end';
            let endTime = null;

            if (!wantsStop) {
              if (b.endTime) {
                endTime = new Date(b.endTime);
              } else {
                const mins = Number(b.durationMinutes) || (Number(b.durationHours) * 60) || (Number(b.durationDays) * 1440) || (Number(b.durationSeconds) / 60) || 0;
                if (mins > 0) endTime = new Date(Date.now() + mins * 60 * 1000);
              }
              if (!endTime || Number.isNaN(endTime.getTime()) || endTime.getTime() <= Date.now()) {
                return res.status(400).json({ error: 'Provide a future endTime or a positive duration (durationMinutes / durationHours / durationDays).' });
              }
            }

            const [config] = await SystemConfig.findOrCreate({ where: { key: 'black_friday' }, defaults: { value: { active: false, endTime: null } } });
            config.value = wantsStop
              ? { ...(config.value || {}), active: false, endTime: null }
              : { ...(config.value || {}), active: true, endTime: endTime.toISOString() };
            config.changed('value', true);
            await config.save();

            await syncFlashSaleFromDb(true);
            if (flashSaleState.countdownIntervalId) { clearInterval(flashSaleState.countdownIntervalId); flashSaleState.countdownIntervalId = null; }
            if (wantsStop) {
              flashSaleState.active = false;
              flashSaleState.endTime = null;
              io.emit('blackFridayEnded', { active: false });
            } else {
              flashSaleState.active = true;
              flashSaleState.endTime = endTime.toISOString();
              startFlashSaleCountdown(io);
              io.emit('blackFridayStarted', { active: true, endTime: flashSaleState.endTime });
              io.emit('blackFridayTick', { active: true, endTime: flashSaleState.endTime, msRemaining: endTime.getTime() - Date.now() });
            }

            await safeAdminLog({ adminId: req.adminUser.id, action: wantsStop ? 'STOP_FLASH_SALE' : 'START_FLASH_SALE', targetType: 'config', targetId: null, ipAddress: req.ip });
            res.json({ message: wantsStop ? 'Flash sale stopped.' : 'Flash sale started.', active: flashSaleState.active, endTime: flashSaleState.endTime });
          } catch (err) {
            console.error('❌ Admin route error:', err); res.status(500).json({ error: err.message });
          }
        };
        expressApp.post('/api/admin/config/black-friday', authenticateToken, requireAdmin, adminSetBlackFridayHandler);
        expressApp.put('/api/admin/config/black-friday', authenticateToken, requireAdmin, adminSetBlackFridayHandler);
        expressApp.delete('/api/admin/config/black-friday', authenticateToken, requireAdmin, (req, res) => {
          req.body = { active: false };
          return adminSetBlackFridayHandler(req, res);
        });

        // --- ADMIN: COUNTY FREIGHT FEE ---
        expressApp.post('/api/admin/config/counties', authenticateToken, requireAdmin, async (req, res) => {
          try {
            const { county, fee } = req.body || {};
            const [row] = await SystemConfig.findOrCreate({ where: { key: 'county_overrides' }, defaults: { value: countyOverrides } });
            const current = { ...countyOverrides, ...(row.value || {}) };

            const canonical = resolveLocationName(county, Object.keys(current));
            if (!canonical) return res.status(400).json({ error: `Unknown county "${county}".` });
            const numericFee = Number(fee);
            if (!Number.isFinite(numericFee) || numericFee < 0 || numericFee > 100000) {
              return res.status(400).json({ error: 'Freight fee must be a number between 0 and 100,000.' });
            }

            current[canonical] = Math.round(numericFee);
            row.value = current;
            row.changed('value', true);
            await row.save();

            await safeAdminLog({ adminId: req.adminUser.id, action: 'UPDATE_COUNTY_FEE', targetType: 'config', targetId: null, ipAddress: req.ip });
            io.emit('countyFeesUpdated', current);
            res.json({ message: `Freight fee for ${canonical} set to KES ${current[canonical]}.`, county: canonical, fee: current[canonical], overrides: current });
          } catch (err) {
            console.error('❌ County fee update error:', err);
            res.status(500).json({ error: err.message });
          }
        });

        // --- ADMIN: HERO BACKDROP SETTINGS ---
        const adminSaveHeroHandler = async (req, res) => {
          try {
            const incoming = req.body;
            if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
              return res.status(400).json({ error: 'Hero settings must be a JSON object.' });
            }
            const clean = {};
            Object.keys(incoming).forEach((k) => {
              const v = incoming[k];
              if (['string', 'number', 'boolean'].includes(typeof v) || v === null) clean[k] = typeof v === 'string' ? v.trim().slice(0, 2000) : v;
            });

            const [row] = await SystemConfig.findOrCreate({ where: { key: 'hero_settings' }, defaults: { value: clean } });
            row.value = { ...(row.value || {}), ...clean };
            row.changed('value', true);
            await row.save();

            await safeAdminLog({ adminId: req.adminUser.id, action: 'UPDATE_HERO_SETTINGS', targetType: 'config', targetId: null, ipAddress: req.ip });
            io.emit('heroUpdated', row.value);
            res.json({ message: 'Hero settings saved.', hero: row.value });
          } catch (err) {
            console.error('❌ Hero settings update error:', err);
            res.status(500).json({ error: err.message });
          }
        };
        expressApp.post('/api/admin/config/hero', authenticateToken, requireAdmin, adminSaveHeroHandler);
        expressApp.put('/api/admin/config/hero', authenticateToken, requireAdmin, adminSaveHeroHandler);

        // --- ADMIN: MODIFY USER DETAILS ---
        expressApp.put('/api/admin/users/:id/modify', authenticateToken, requireAdmin, async (req, res) => {
          try {
            const { fullName, role, isActive } = req.body || {};
            const targetUserRecord = await User.findByPk(req.params.id);
            if (!targetUserRecord) return res.status(404).json({ error: 'User record not found.' });

            if (fullName !== undefined) targetUserRecord.fullName = fullName;
            if (role !== undefined) {
              const handledAsStaff = await applyRoleChange(req, targetUserRecord, role);
              if (!handledAsStaff && !STAFF_ROLES.includes(role) && role !== 'none') targetUserRecord.role = role;
            }
            if (isActive !== undefined) targetUserRecord.isActive = isActive;

            await targetUserRecord.save();

            await AdminLog.create({
              adminId: req.adminUser.id,
              action: 'MODIFY_USER',
              targetType: 'user',
              targetId: targetUserRecord.id,
              ipAddress: req.ip
            });

            const safeUser = targetUserRecord.toJSON();
            delete safeUser.password;
            res.json({ message: 'User record updated successfully.', user: safeUser });
          } catch (err) {
            res.status(err.status || 500).json({ error: err.message });
          }
        });

        // --- ADMIN: TOGGLE USER ACCOUNT SUSPENSION ---
        expressApp.put('/api/admin/users/:id/suspend', authenticateToken, requireAdmin, async (req, res) => {
          try {
            const user = await User.findByPk(req.params.id);
            if (!user) return res.status(404).json({ error: 'User not found.' });
            
            const wantSuspended = req.body && typeof req.body.isSuspended === 'boolean' ? req.body.isSuspended : user.isActive;
            user.isActive = !wantSuspended;
            await user.save();
            
            await AdminLog.create({
              adminId: req.adminUser.id,
              action: user.isActive ? 'ACTIVATE_USER' : 'SUSPEND_USER',
              targetType: 'user',
              targetId: user.id,
              ipAddress: req.ip
            });
            
            res.json({ message: `User account has been ${user.isActive ? 'activated' : 'suspended'}.`, user });
          } catch (err) {
            res.status(500).json({ error: err.message });
          }
        });

        /**
         * ==========================================
         * 8. SYSTEM BOOTSTRAP & PORT LISTENER
         * ==========================================
         */
        // JSON error handler (also catches multer upload errors such as wrong file type / file too large)
        expressApp.use((err, req, res, next) => {
          if (res.headersSent) return next(err);
          console.error('❌ Unhandled request error:', err.message);
          if (!(err.status && err.status < 500) && err.code !== 'LIMIT_FILE_SIZE') recordServerError(`${req.method} ${req.path}`, err.message, { stack: String(err.stack || '').split('\n').slice(0, 5).join('\n'), error: err });
          const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.status || err.statusCode || 400);
          res.status(status).json({ error: err.message || 'Unexpected server error.' });
        });

        if (!IS_VERCEL) {
          startBackgroundJobs();
          console.log(`✅ System Active: Mwea Hub Server fully ready on port ${port}`);
          console.log(`✅ WebSocket Engine attached and listening for real-time events.`);
          console.log('====================================================================');
        } else {
          console.log('✅ System Active: Mwea Hub API ready on Vercel serverless runtime.');
          console.log('====================================================================');
        }

      } catch (dbError) {
        console.error('❌ Database initialization, migration, or synchronization failed (will retry automatically):', dbError);
        // Never kill the runtime (that would turn into a 502 + CORS error in the browser):
        // surface the error so the readiness gate returns a CORS-safe 503 and bootstrap retries.
        throw dbError;
      }
}

// Execute the async server bootstrap function
ensureBootstrapped().catch((err) => {
  console.error('❌ Initial bootstrap failed:', err.message);
});

// Vercel imports this file and uses the exported Express app as the request handler.
export default expressApp;
