"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  ShoppingCart, User as UserIcon, LogIn, Menu, X, Plus, 
  Trash2, Shield, Clock, Search, Edit, Package, Activity, 
  CheckCircle, AlertCircle, Settings, Leaf, ChevronRight,
  ShoppingBag, Users, Image as ImageIcon, Video, Download,
  MapPin, Eye, RefreshCw, LogOut, Check, AlertTriangle, 
  Smartphone, Truck, CreditCard, BarChart2, DollarSign, 
  Award, Calendar, Lock, Unlock, TrendingUp, Filter, 
  FileText, Percent, Layers, Globe, Sliders, Bell, ArrowRight,
  ChevronDown, ArrowUpRight, HelpCircle, Star, PhoneCall,
  XCircle, Zap, Ban, UserCheck, UserX, ShieldAlert, FileSpreadsheet,
  Copy, Link2, Headphones, Wallet, Briefcase, StickyNote, MessageSquare
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// ============================================================================
// 1. SYSTEM TYPES & INTERFACES
// ============================================================================

export interface Product {
  id: number;
  brandName: string;
  variety: string;
  weightKg: number;
  basePrice: number;
  price?: number;
  buyingPrice?: number | null;
  flashSalePrice?: number | null;
  stockQuantity: number;
  imageUrl?: string | null;
  description?: string | null;
  millingGrade?: string | null;
  isOrganic?: boolean;
  ratingAvg?: number;
  ratingCount?: number;
  hasRating?: boolean;
  wholesaleTiers?: { minQty: number; price: number }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserAccount {
  id: number;
  fullName: string;
  email?: string | null;
  phoneNumber: string;
  role: 'customer' | 'admin' | 'logistics' | 'support' | 'agent';
  referralCode?: string;
  rewardPoints: number;
  isSuspended?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  ordersCount?: number;
}

export interface OrderItem {
  id?: number;
  productId: number;
  quantity: number;
  priceAtPurchase: number;
  brandName?: string;
  name?: string;
  weightKg?: number;
  imageUrl?: string;
}

export interface Order {
  id: number;
  userId?: number | null;
  User?: UserAccount | null;
  items: OrderItem[];
  paymentMethod: string;
  mpesaPhoneNumber?: string;
  county: string;
  town?: string;
  location?: string;
  sublocation?: string;
  streetAddress?: string;
  shippingAddress: string;
  shippingFee: number;
  grandTotal: number;
  status: 'pending' | 'processing' | 'dispatched' | 'delivered' | 'cancelled';
  paymentDetails?: {
    isPaid?: boolean;
    paidTag?: 'PAID' | 'PENDING' | 'FAILED';
    mpesaReceipt?: string | null;
    failureReason?: string | null;
    method?: string;
    paidAt?: string | null;
    rawCallback?: any;
    promo?: { code: string; discount: number; gross?: number } | null;
    tillNumber?: string;
    tillName?: string;
  };
  delivery?: { riderName?: string; riderPhone?: string | null; vehicle?: string | null; status: string } | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: number;
  action: string;
  performedByUserId?: number;
  performedByName: string;
  performedByEmail?: string;
  module: string;
  details?: string;
  ipAddress?: string;
  timestamp: string;
}

export interface FinancialMonth {
  monthIndex: number; // 0 = Jan, 11 = Dec
  monthName: string;
  year: number;
  totalRevenue: number;
  totalBuyingCost: number;
  netProfit: number;
  totalKgSold: number;
  orderCount: number;
}

export interface FinancialAnalyticsResponse {
  year: number;
  availableYears: number[];
  monthlyBreakdown: FinancialMonth[];
  summary: {
    totalMoneyReceived: number;
    totalBuyingCosts: number;
    totalNetProfit: number;
    totalKgSold: number;
    totalOrdersCount: number;
    totalPointsAwarded: number;
  };
}

export interface HeroSettings {
  title: string;
  subtitle: string;
  video1: string;
  video2: string;
  img1: string;
  img2: string;
  img3: string;
  ctaButtonText: string;
  secondaryButtonText: string;
  badgeText: string;
  overlayOpacity: string | number;
  announcementTicker: string;
  themeAccentColor: string;
  heroLayoutMode: string;
  enableLiveTicker: boolean;
  promoBadgeColor: string;
  bannerHeight: string;
  featuredTagLabel: string;
  customerTrustBadgeText: string;
  supportHotlineDisplay: string;
  expressLogisticsNote: string;
}

export interface CartItem {
  productId: number;
  quantity: number;
  product: Product;
  bulk?: boolean;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

// ============================================================================
// 2. SYSTEM CONSTANTS & KENYA LOGISTICS DATA
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL 
  ? `${process.env.NEXT_PUBLIC_API_URL}/api` 
  : 'https://premium-rice-store-7.onrender.com/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL 
  || 'https://premium-rice-store-7.onrender.com';

/** Turns 0712345678 / +254712345678 / 712345678 into 254712345678, or null when it is not a Kenyan mobile number. */
export const normalizeKenyanPhone = (raw: string | null | undefined): string | null => {
  const str = String(raw ?? '').trim();
  if (!str || str.includes('@')) return null;
  let digits = str.replace(/\D/g, '');
  if (digits.startsWith('2540') && digits.length === 13) digits = `254${digits.slice(4)}`;
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return `254${digits}`;
  return null;
};

/** Compares place names ignoring case, spaces, hyphens, apostrophes and a trailing "County" (Taita-Taveta == Taita Taveta). */
export const normPlaceName = (v: string | null | undefined): string =>
  String(v ?? '').toLowerCase().replace(/\bcounty\b/g, '').replace(/[^a-z0-9]/g, '');

/** Looks up a county's freight fee whatever spelling the county is stored under. */
export const getCountyFee = (overrides: { [key: string]: number }, county: string): number | undefined => {
  if (!overrides) return undefined;
  if (overrides[county] !== undefined) return Number(overrides[county]);
  const wanted = normPlaceName(county);
  const key = Object.keys(overrides).find(k => normPlaceName(k) === wanted);
  return key !== undefined ? Number(overrides[key]) : undefined;
};

export interface LogisticsData {
  towns: string[];
  locations: string[];
  sublocations: string[];
  streets: string[];
}

export const ALL_47_COUNTIES = [
  "Mombasa", "Kwale", "Kilifi", "Tana River", "Lamu", "Taita-Taveta", "Garissa", "Wajir", "Mandera", "Marsabit", 
  "Isiolo", "Meru", "Tharaka-Nithi", "Embu", "Kitui", "Machakos", "Makueni", "Nyandarua", "Nyeri", "Kirinyaga", 
  "Murang'a", "Kiambu", "Turkana", "West Pokot", "Samburu", "Trans-Nzoia", "Uasin Gishu", "Elgeyo-Marakwet", "Nandi", "Baringo", 
  "Laikipia", "Nakuru", "Narok", "Kajiado", "Kericho", "Bomet", "Kakamega", "Vihiga", "Bungoma", "Busia", 
  "Siaya", "Kisumu", "Homa Bay", "Migori", "Kisii", "Nyamira", "Nairobi"
] as const;

export type County = typeof ALL_47_COUNTIES[number];

export const REGIONAL_LOGISTICS_DATA: Record<County, LogisticsData> = {
"Mombasa": {
    towns: [
      "Nyali", "Mvita", "Kisauni", "Likoni", "Changamwe", "Jomvu", 
      "Bamburi", "Tudor", "Kongowea", "Mikindani", "Shanzu", "Mtongwe", "Miritini"
    ],
    locations: [
      "Old Town", "Tudor", "Ganjoni", "Tononoka", "Shimanzi", "Port Reitz", 
      "Chaani", "Kipevu", "Jomvu Kuu", "Magongo", "Miritini", "Bamburi", 
      "Mkomani", "Ziwa La Ng'ombe", "Majengo", "Mtongwe", "Likoni Central", "Bofu", "Shika Adabu"
    ],
    sublocations: [
      "Bondeni", "Sparki", "Buxton", "Tudor Four", "Saba Saba", "Bombolulu", 
      "Kisauni Stage", "Mwembe Tayari", "Kongowea Market", "Nyali Beach", "English Point", 
      "Frere Town", "Utange", "Mtambo", "Barsheba", "Kiembeni", "Mwakirunge", 
      "Kwa Jomvu", "Mikindani Estate", "Chaani West", "Shelly Beach", "Mtongwe Jetty"
    ],
    streets: [
      "Moi Avenue", "Nkrumah Road", "Nyerere Avenue", "Digo Road", 
      "Abdel Nasser Road", "Links Road", "Malindi Road (A7)", "Mama Ngina Drive", 
      "Archbishop Makarios Road", "Fidel Castro Street", "Treasury Square Road", 
      "Ronald Ngala Road", "Mbaraki Road", "Changamwe-Port Reitz Road", 
      "Airport Road", "Magongo Road", "Jomvu-Miritini Highway", "Likoni Ferry Approach Road"
    ]
  },
  "Kwale": {
    towns: [
      "Ukunda", "Diani", "Kwale Town", "Msambweni", "Lunga Lunga", "Kinango", 
      "Tiwi", "Shimoni", "Vanga", "Samburu", "Majoreni", "Taru", "Mackinnon Road"
    ],
    locations: [
      "Pongwe/Kikoneni", "Dzombo", "Mwereni", "Vanga", "Tiwi", "Kubo South", 
      "Kubo North", "Ndavaya", "Puma", "Kinango", "Kasemeni", "Mwavumbo", 
      "Samburu East", "Mackinnon Road", "Ramisi", "Gombato Bongwe", "Ukunda Ward"
    ],
    sublocations: [
      "Diani Beach", "Bongwe", "Bofa", "Kwale Central", "Mwavumbo", "Dzombo", 
      "Shimba Hills Area", "Gazi", "Bodo", "Kibuyuni", "Funzi", "Wasini Island", 
      "Lunga Lunga Border", "Perani", "Kikoneni", "Mrima", "Kanana", "Matuga", 
      "Vuga", "Kombani", "Waa", "Golini", "Mazeras", "Taru Center"
    ],
    streets: [
      "Likoni-Lunga Lunga Highway (A14)", "Diani Beach Road", "Kwale-Ukunda Road (C106)", 
      "Samburu-Kwale Road", "Lunga Lunga-Vanga Road", "Shimoni Road", 
      "Kombani-Kwale Highway", "Hospital Road Kwale", "Diani Beach Bypass Road"
    ]
  },
  "Kilifi": {
    towns: [
      "Kilifi Town", "Malindi", "Mtwapa", "Watamu", "Mariakani", "Kaloleni", 
      "Vipingo", "Gongoni", "Mazeras", "Bamba", "Ganze", "Marafa"
    ],
    locations: [
      "Tezo", "Sokoni", "Kibarani", "Dabaso", "Matsangoni", "Watamu", "Gede", 
      "Kakuyuni", "Jilore", "Malindi Town", "Shella", "Marafa", "Magarini", 
      "Gongoni", "Mambrui", "Rabai", "Mwawesa", "Ruruma", "Kaloleni", "Kayafungo", 
      "Mwanamwingi", "Bamba", "Ganze", "Sokoke", "Jaribuni", "Junju", "Mtwapa", "Vipingo"
    ],
    sublocations: [
      "Mnarani", "Mtwapa Creek", "Kibarani", "Watamu Village", "Chonyi", "Kilifi CBD", 
      "Maweni", "Kanamai", "Majengo Mtwapa", "Kikambala", "Chasimba", "Dzitsoni", 
      "Vitengeni", "Hell's Kitchen Sub", "Gongoni Salt Works", "Muyeye", "Sabaki", 
      "Kibokoni Malindi", "Kisumu Ndogo Malindi", "Casuarina", "Jacaranda"
    ],
    streets: [
      "Mombas-Malindi Highway (A7)", "Malindi-Garissa Road (C112)", "Mariakani-Kaloleni Road", 
      "Mtwapa Mall Link Road", "Lamu Road Malindi", "Casuarina Road", "Watamu Road", 
      "Kilifi Creek Bridge Approach", "Bamba-Kilifi Road", "Mariakani Highway"
    ]
  },
  "Tana River": {
    towns: [
      "Hola", "Garsen", "Bura", "Madogo", "Kipini", "Bangale", "Wenje", "Tarasaa"
    ],
    locations: [
      "Chewani", "Wayu", "Mikinduni", "Bura", "Bangale", "Madogo", "Hirimani", 
      "Saka", "Kipini East", "Kipini West", "Salama", "Garsen Central", 
      "Garsen South", "Garsen North", "Mwina", "Ngao"
    ],
    sublocations: [
      "Hola Central", "Laza", "Zubaki", "Bura Stage", "Madogo Border", "Garsen South", 
      "Kipini Center", "Masalani Bridge Approach", "Nanighi", "Chara", "Ngao Sub", 
      "Matomba", "Wenje Center", "Kilelengwani"
    ],
    streets: [
      "Garissa-Garsen Road (A3/B8)", "Garsen-Witu-Lamu Highway (C112)", 
      "Hola Market Street", "River Road Hola", "Bura-Hola Road", "Madogo Junction"
    ]
  },
  "Lamu": {
    towns: [
      "Lamu Town", "Mpeketoni", "Witu", "Kiunga", "Faza", "Pate", "Shela", "Matondoni", "Kizingitini"
    ],
    locations: [
      "Shela", "Manda", "Matondoni", "Hindi", "Mokowe", "Hongwe", "Bahari", 
      "Mapenya", "Witu", "Kiunga", "Faza", "Basuba", "Kiwayu"
    ],
    sublocations: [
      "Shela Village", "Amu Old Town", "Lamu Fort Area", "Manda Island", 
      "Mpeketoni Center", "Mokowe Jetty", "Hindi Center", "Lake Kenyatta Area", 
      "Katsakairu", "Bargoni", "Ishakani", "Kiangwe", "Kizingitini Village", "Pate Island Sub"
    ],
    streets: [
      "Lamu Seafront (Harbour Road)", "Shela Beach Walk", "Mpeketoni Main Road", 
      "Mokowe Jetty Road", "Witu-Lamu Highway (C112)", "Hindi-Kiunga Road"
    ]
  },
  "Taita-Taveta": {
    towns: [
      "Voi", "Taveta", "Wundanyi", "Mwatate", "Maungu", "Taveta Border", "Mackinnon Road", "Bura Taita"
    ],
    locations: [
      "Kaloleni", "Ngolia", "Sagalla", "Marter", "Mbololo", "Bura", "Mwawatate", 
      "Chavia", "Wusi/Kishamba", "Werugha", "Wundanyi/Mbale", "Mgange", "Chala", 
      "Mahoo", "Bomani", "Mboghoni", "Mata"
    ],
    sublocations: [
      "Voi CBD", "Ikanga", "Mwakingali", "Kariakor Voi", "Mwatate Junction", 
      "Wundanyi Stage", "Taveta Border", "Kimorigho", "Eldoro", "Chala Center", 
      "Taveta Market", "Kishushe", "Bura Mission", "Demwa", "Mbale", "Ronge Juu"
    ],
    streets: [
      "Nairobi-Mombasa Highway (A109)", "Voi-Taveta-Holili Highway (A23)", 
      "Wundanyi-Mwatate Road", "Taveta Main Market Street", "Voi Station Road", 
      "Hospital Road Voi", "Biashara Street Voi"
    ]
  },
  "Garissa": {
    towns: [
      "Garissa Town", "Dadaab", "Balambala", "Modogashe", "Masalani", "Bura East", "Hulugho", "Ijara"
    ],
    locations: [
      "Galbet", "Waberi", "Iftin", "Township", "Saka", "Sankuri", "Balambala", 
      "Liboi", "Dadaab", "Dertu", "Benane", "Modogashe", "Masalani", "Ijara", "Sangailu", "Hulugho"
    ],
    sublocations: [
      "Bulla Jamhuria", "Bulla Medina", "Bulla Iftin", "Bulla Mzuri", "Bulla Power", 
      "Dadaab Camp Area (Hagadera, Ifo, Dagahaley)", "Liboi Border", "Masalani Town", 
      "Sankuri Stage", "Garissa CBD", "Bula Stage", "Jarrot"
    ],
    streets: [
      "Kismayu Road", "Garissa-Thika Highway (A3)", "Posta Road Garissa", 
      "Sankuri Road", "Garissa-Dadaab Road", "Modogashe Highway", "Market Street Garissa", "River Road Garissa"
    ]
  },
  "Wajir": {
    towns: [
      "Wajir Town", "Habaswein", "Bute", "Eldas", "Tarbaj", "Buna", "Griftu", "Khorof Harar", "Diff"
    ],
    locations: [
      "Township", "Wagberi", "Danoshi", "Bulla Kiria", "Barwaqo", "Bute", "Buna", 
      "Korondile", "Gurar", "Eldas", "Elnur", "Tarbaj", "Sarman", "Wajir Bor", 
      "Habaswein", "Diff", "Sabule"
    ],
    sublocations: [
      "Wajir Central", "Wagberi Sub", "Bulla Jamhuria Wajir", "Habaswein Stage", 
      "Wajir Bor", "Bute Center", "Eldas Center", "Tarbaj Town", "Diff Border", 
      "Kutulo", "Buna Center", "Griftu Stage"
    ],
    streets: [
      "Airport Road Wajir", "Wajir Main Market Street", "Isiolo-Wajir-Moyale Highway (A13)", 
      "Mandera Road", "Habaswein Main Road", "Hospital Road Wajir"
    ]
  },
  "Mandera": {
    towns: [
      "Mandera Town", "Elwak", "Rhamu", "Banissa", "Lafey", "Takaba", "Kutulo"
    ],
    locations: [
      "Neboi", "Bulla Mpya", "Township", "Khalalio", "Hareri", "Rhamu", 
      "Rhamu Dimtu", "Ashabito", "Banissa", "Derkhale", "Guba", "Takaba", 
      "Dandu", "Elwak North", "Elwak South", "Lafey", "Warankara"
    ],
    sublocations: [
      "Mandera CBD", "Bulla Jamhuria Mandera", "Bulla Power", "Elwak Stage", 
      "Rhamu Center", "Banissa Town", "Border Post Sub", "Lafey Stage", 
      "Ashabito Center", "Kutulo Town", "Shimbir Fatuma"
    ],
    streets: [
      "Mandera Main Street", "Elwak-Mandera Highway (A13)", "Airstrip Road Mandera", 
      "Rhamu Road", "Border Post Link Road", "Biashara Street Mandera"
    ]
  },
  "Marsabit": {
    towns: [
      "Marsabit Town", "Moyale", "Laisamis", "North Horr", "Sololo", 
      "Loiyangalani", "Kargi", "Dukana", "Kalacha"
    ],
    locations: [
      "Karare", "Sagante/Jaldesa", "Township", "Manyatta", "Uran", "Obbu", 
      "Heillu/Manyatta", "Golbo", "Sololo", "Laisamis", "Loglogo", "Karare", 
      "Kargi/South Horr", "North Horr", "Dukana", "Maikona", "Loiyangalani"
    ],
    sublocations: [
      "Marsabit Central", "Manyatta Otte", "Nagum", "Moyale Border", "Sololo Center", 
      "Laisamis Stage", "Loiyangalani Town", "Kalacha Oasis Sub", "Kargi Center", 
      "Turbi", "Odha", "Heilu"
    ],
    streets: [
      "Isiolo-Marsabit-Moyale Highway (A2)", "Marsabit Market Road", "Moyale Main Street", 
      "Airport Road Marsabit", "Laisamis Link Road", "North Horr Track"
    ]
  },
  "Isiolo": {
    towns: [
      "Isiolo Town", "Garbatulla", "Merti", "Kinna", "Oldonyiro", "Ngaremara", "Archer's Post Border"
    ],
    locations: [
      "Bulla Pesa", "Wabera", "Burat", "Ngaremara", "Oldonyiro", "Garbatulla", 
      "Kinna", "Sericho", "Cherab", "Chari"
    ],
    sublocations: [
      "Isiolo CBD", "Kulamawe", "Kula Mawe", "Bulla Pesa Sub", "Wabera Center", 
      "Bula Mpya Isiolo", "Garbatulla Center", "Merti Stage", "Kinna Town", 
      "Merti Center", "Bassa"
    ],
    streets: [
      "Isiolo Main Highway (A2)", "Airport Road Isiolo", "Barclays Road Isiolo", 
      "Garbatulla-Isiolo Road", "Meru-Isiolo Road", "Hospital Road Isiolo", "Market Street"
    ]
  },
  "Meru": {
    towns: [
      "Meru Town", "Maua", "Timau", "Nanyuki Border", "Mikinduri", "Laare", 
      "Nchiru", "Muthara", "Kianjai", "Imenti", "Igoji"
    ],
    locations: [
      "Municipality", "Ntima East", "Ntima West", "Nyaki East", "Nyaki West", 
      "Nkuene", "Abogeta East", "Abogeta West", "Abothuguchi", "Igoji East", 
      "Igoji West", "Akithii", "Kianjai", "Akirang'ondu", "Nthambiro", "Amwathi", 
      "Kangeta", "Ruiri/Rwarera"
    ],
    sublocations: [
      "Makutano Meru", "Gakoromone", "Kinoru", "Gitimbine", "Kianjai Center", 
      "Maua Town Center", "Nchiru (MUST Area)", "Timau Town", "Mikinduri Market", 
      "Kangeta Stage", "Mujwa", "Katheri", "Muthara Town"
    ],
    streets: [
      "Meru-Nanyuki Highway (A2/B6)", "Meru-Embu Highway (B6)", "Maua Road", 
      "Tom Mboya Street Meru", "Kirinyaga Street Meru", "Meru-Mikinduri Road", 
      "Makutano-Kianjai Road", "Kenyatta Highway Meru"
    ]
  },
  "Tharaka-Nithi": {
    towns: [
      "Chuka", "Kathwana", "Chogoria", "Marimanti", "Kibugua", "Gatunga", "Mukothima", "Chera"
    ],
    locations: [
      "Karingani", "Magumoni", "Mugwe", "Igambang'ombe", "Ganga", "Muthambi", 
      "Mwimbi", "Chogoria", "Nkondi", "Gatunga", "Marimanti", "Mukothima"
    ],
    sublocations: [
      "Chuka Town Center", "Lower Chuka", "Ndagani (Chuka Univ Area)", 
      "Chogoria Hospital Sub", "Kathwana HQ", "Marimanti Stage", "Gatunga Center", 
      "Kibugua Sub", "Kanwa", "Weru", "Mitheru"
    ],
    streets: [
      "Nairobi-Meru Highway (B6)", "Chuka University Access Road", "Kathwana Main Street", 
      "Chogoria-Chuka Road", "Marimanti-Gatunga Road", "Biashara Street Chuka"
    ]
  },
  "Embu": {
    towns: [
      "Embu Town", "Runyenjes", "Siakago", "Kiritiri", "Ishiara", "Manyatta", "Kanja", "Kibugu"
    ],
    locations: [
      "Kirimari", "Gakwebiri", "Ngandori", "Kieni", "Ruguru", "Gaturi", "Kyeni", 
      "Kagaari", "Central Ward", "Mbeti North", "Mbeti South", "Mavuria", "Mvomoko", "Evurore"
    ],
    sublocations: [
      "Embu CBD", "Kangaru", "Blue Valley", "Kamiu", "Njukiri", "Matakari", 
      "Runyenjes Stage", "Kanja Center", "Kiritiri Town", "Ishiara Market", 
      "Siakago Town", "Karaba Embu", "Ugweri"
    ],
    streets: [
      "Embu-Meru Highway (B6)", "Embu-Nairobi Highway", "Kenyatta Avenue Embu", 
      "Mama Ngina Street Embu", "Runyenjes Main Street", "Siakago-Kiritiri Road", "Kangaru School Road"
    ]
  },
  "Kitui": {
    towns: [
      "Kitui Town", "Mwingi", "Mutomo", "Kabati", "Kwa Vonza", "Migwani", 
      "Ikutha", "Kyuso", "Tseikuru", "Zombe"
    ],
    locations: [
      "Township", "Kyangwithya West", "Kyangwithya East", "Mulango", "Miambani", 
      "Central Mwingi", "Kivou", "Nguni", "Nuu", "Kyuso", "Tseikuru", "Mutomo", 
      "Ikutha", "Mutha", "Kanziko", "Kauwi", "Nzambani"
    ],
    sublocations: [
      "Kitui Central Sub", "Kalundu", "Kitisuru Kitui", "Mwingi CBD", 
      "Kwa Vonza Center", "Kabati Stage", "Mutomo Town", "Kyuso Center", 
      "Zombe Market", "Migwani Town", "Ikanga"
    ],
    streets: [
      "Kitui-Machakos Road (C94)", "Mwingi-Garissa Highway (A3)", 
      "Thika-Garissa Road via Kabati", "Biashara Street Kitui", 
      "Kitui-Mutomo-Kibwezi Road", "Hospital Road Kitui"
    ]
  },
  "Machakos": {
    towns: [
      "Machakos Town", "Mavoko / Syokimau", "Athi River", "Mlolongo", "Kangundo", 
      "Tala", "Matuu", "Masii", "Wamunyu", "Kathiani"
    ],
    locations: [
      "Syokimau/Mulei", "Athi River Town", "Katani", "Mlolongo", "Machakos Central", 
      "Muvuti/Kiima-Kimwe", "Mutituni", "Kalama", "Kangundo Central", "Tala", 
      "Matungulu North", "Ndithini", "Matuu", "Kivaa", "Masii", "Mwala"
    ],
    sublocations: [
      "Sabaki", "Syokimau Phase 1-3", "Katani Center", "Kinanie", "Kyumbi (Chumvi)", 
      "Machakos CBD", "Eastleigh Machakos", "Katheka Kai", "Tala Market", 
      "Kangundo Town", "Matuu CBD", "Kaseve", "Masii Stage", "Devki Area"
    ],
    streets: [
      "Mombasa Road (A104)", "Machakos-Kitui Road (C99)", "Machakos-Turnoff Highway", 
      "Katani Road", "Syokimau Airport Road", "Tala-Kangundo Highway", 
      "Garissa Road (Matuu)", "Machakos Bypass", "Mbagathi/Kyumbuni Road"
    ]
  },
  "Makueni": {
    towns: [
      "Wote", "Mtito Andei", "Sultan Hamud", "Emali", "Kibwezi", "Makindu", 
      "Nzoila", "Mukaa", "Mbooni", "Salama"
    ],
    locations: [
      "Makueni/Wote", "Mbitini", "Kee", "Kako", "Mbooni", "Tulimani", "Kilome", 
      "Mukaa", "Kasikeu", "Nguu/Masumba", "Makindu", "Kibwezi", "Mtito Andei", 
      "Emali/Mulala", "Nzaui"
    ],
    sublocations: [
      "Wote Town Center", "Unoa", "Kambi Mawe", "Emali Junction", "Kibwezi Sub", 
      "Mtito Andei Stage", "Makindu Center", "Sultan Hamud Town", "Salama Stage", 
      "Nunguni", "Kikima"
    ],
    streets: [
      "Nairobi-Mombasa Highway (A109)", "Wote-Machakos Road", "Kibwezi-Kitui Highway (C94)", 
      "Makindu Hospital Road", "Emali-Loitokitok Road", "Wote Market Street"
    ]
  },
  "Nyandarua": {
    towns: [
      "Ol Kalou", "Engineer", "Mairo Inya", "Njabini", "Ndaragwa", "Miharati", 
      "Ol Joro Orok", "Flyover"
    ],
    locations: [
      "Karandi", "Kanjuiri", "Ol Kalou Central", "Kaimbaga", "Passenga", "Kipipiri", 
      "Geta", "Githabai", "Njabini", "Engineer", "Magumu", "North Kinangop", 
      "Ndaragwa", "Leshau Pondo"
    ],
    sublocations: [
      "Ol Kalou CBD", "Engineer Center", "Njabini Stage", "Mairo Inya Sub", 
      "Ol Joro Orok Center", "Miharati Town", "Ndaragwa Center", "Flyover Junction", 
      "Wanjohi", "Murungaru"
    ],
    streets: [
      "Gilgil-Nyahururu Highway (C77)", "Flyover-Engineer-Njabini Road", 
      "Ol Kalou Main Street", "Njabini-Ol Kalou Road", "Ndaragwa-Nyahururu Road", "Stima Road Ol Kalou"
    ]
  },
  "Nyeri": {
    towns: [
      "Nyeri Town", "Karatina", "Othaya", "Mukurweini", "Naro Moru", "Mweiga", 
      "Giakanja", "Chaka", "Endarasha"
    ],
    locations: [
      "Rware", "Gatitu/Aguthi", "Kimathi", "Thenguri", "Kirimukuyu", "Iria-ini (Mathira)", 
      "Konyu", "Magutu", "Mahiga", "Iria-ini (Othaya)", "Chinga", "Karima", 
      "Mukurwe Central", "Gakindu", "Rugi", "Kieni East", "Mweiga"
    ],
    sublocations: [
      "Nyeri CBD", "King'ong'o", "Skuta", "Asian Quarter", "Kamakwa", "Nyamachaki", 
      "Karatina Market Sub", "Othaya Town Center", "Chaka Market", "Naro Moru Town", 
      "Mweiga Center", "Mukurweini Town", "Giakanja Stage"
    ],
    streets: [
      "Kenyatta Road Nyeri", "Nyeri-Nanyuki Highway (B6)", "Karatina Main Street", 
      "Gakere Road Nyeri", "Othaya-Nyeri Road", "Kimathi Way", "Kanisa Road", "Mukurweini Road"
    ]
  },
  "Kirinyaga": {
    towns: [
      "Kerugoya", "Kutus", "Sagana", "Wang'uru (Mwea)", "Baricho", "Kagio", "Kianyaga", "Kagumo", "Diffathas"
    ],
    locations: [
      "Kerugoya", "Mutira", "Inoi", "Kinyaga", "Mutithi", "Murinduko", "Tebere", "Nyangati", "Baricho", "Kiine", "Kariti"
    ],
    sublocations: [
      "Kerugoya Town Center", "Kagumo Sub", "Kutus Sub", "Wang'uru Center", "Sagana Town", "Baricho Market", "Kianyaga Sub", "Mutithi Sub", "Kangai", "Thiba", "Kiburu", "Kiandai"
    ],
    streets: [
      "Kerugoya-Kutus Road (C73)", "Nairobi-Nyeri Highway (A2 / Sagana Highway)", "Kutus-Kianyaga Road", "Mwea-Embu Highway (B6)", "Kerugoya-Kagumo Road", "Kerugoya Hospital Road"
    ]
  },
  "Murang'a": {
    towns: [
      "Murang'a Town", "Kenol", "Maragua", "Kangema", "Thika Greens", "Kigumo", "Kiria-ini", "Kandara", "Saba Saba", "Makuyu"
    ],
    locations: [
      "Township (Murang'a)", "Mbiri", "Mugoiri", "Murarandia", "Kinyona", "Kigumo", "Kangari", "Ithiru", "Gaichanjiru", "Muruka", "Ruchu", "Nginda", "Makuyu", "Kamahuha", "Kiru", "Gitugi"
    ],
    sublocations: [
      "Murang'a Town Center", "Kenol Sub", "Maragua Town", "Kangema Stage", "Kiria-ini Center", "Kigumo Market", "Kandara Town", "Saba Saba Center", "Mukuyu", "Mitheru", "Gaturi"
    ],
    streets: [
      "Thika-Murang'a Highway (C71)", "Kenol-Sagana Highway (A2)", "Murang'a-Kangema Road", "Murang'a-Kiria-ini Road", "Maragua Main Street", "Kandara-Kenol Road", "Cathedral Road Murang'a"
    ]
  },
  "Kiambu": {
    towns: [
      "Thika", "Ruiru", "Kikuyu", "Limuru", "Kiambu Town", "Juja", 
      "Karuri (Banana/Ruaka)", "Kabete", "Githunguri", "Lari", "Gatundu"
    ],
    locations: [
      "Thika Township", "Kamenu", "Hospital Ward", "Ruiru Central", "Kahawa Sukari", 
      "Kahawa Wendani", "Biashara (Kikuyu)", "Karai", "Limuru Central", "Tigoni", 
      "Township (Kiambu)", "Ndumberi", "Juja Central", "Kalimoni", "Karuri", 
      "Muchatha", "Ndenderu", "Kabete", "Githunguri", "Gatundu"
    ],
    sublocations: [
      "Witeithie", "Makongeni", "Section 9 Thika", "Membley", "Ruiru CBD", 
      "Ruaka Center", "Banana Hill", "Muchatha", "Gachie", "Kihara", "Ndenderu", 
      "Kimbo", "Kahawa Sukari", "Kahawa Wendani", "Kenyatta Road (Juja)", "Kamwangi", "Tigoni Sub"
    ],
    streets: [
      "Thika Superhighway (A2)", "Northern Bypass", "Eastern Bypass", "Western Bypass", 
      "Kiambu Road", "Limuru Road", "Kamiti Road", "Thika Garissa Road", 
      "Waiyaki Way (Kikuyu)", "Banana-Raini Road", "Biashara Street Thika"
    ]
  },
  "Turkana": {
    towns: [
      "Lodwar", "Kakuma", "Lokichogio", "Lokichar", "Kalokol", "Lokori", "Kainuk", "Lokitaung"
    ],
    locations: [
      "Township (Lodwar)", "Kanamkemer", "Kalokol", "Kakuma", "Letea", "Songot", 
      "Lokichogio", "Lokichar", "Katilu", "Kainuk", "Lokori", "Lokitaung", "Lapur"
    ],
    sublocations: [
      "Lodwar CBD", "Kanamkemer Sub", "Kakuma Camp Area (Camp 1-4)", "Kalokol Lake Port", 
      "Lokichar Junction", "Kainuk Center", "Lokichogio Town", "Lokori Center", "Katilu Scheme Area"
    ],
    streets: [
      "Kitale-Lodwar-Nadapal Highway (A1)", "Lodwar Main Street", "Kakuma Main Road", 
      "Airport Road Lodwar", "Lokichogio Border Track"
    ]
  },
  "West Pokot": {
    towns: [
      "Kapenguria", "Makutano Pokot", "Chepareria", "Sigor", "Kacheliba", "Ortum", "Kabichbich", "Alale"
    ],
    locations: [
      "Kapenguria", "Mnagei", "Riwo", "Kipkomo", "Chepareria", "Batei", "Wei Wei", 
      "Lomut", "Sekerr", "Kacheliba", "Suam", "Alale"
    ],
    sublocations: [
      "Kapenguria CBD", "Makutano Stage", "Chepareria Center", "Sigor Sub", 
      "Ortum Center", "Kacheliba Border", "Suam Border Post", "Kabichbich Center", "Muruny"
    ],
    streets: [
      "Kitale-Lodwar Highway (A1)", "Makutano Main Road", "Chepareria Street", 
      "Kapenguria-Sigor Road", "Suam Border Road"
    ]
  },
  "Samburu": {
    towns: [
      "Maralal", "Baragoi", "Wamba", "Archers Post", "Suguta Marmar", "South Horr"
    ],
    locations: [
      "Maralal Central", "Loosuk", "Suguta Marmar", "Waso", "Wamba", "Lodokejek", 
      "Archers Post", "El-Barta", "Baragoi", "Ndoto", "South Horr"
    ],
    sublocations: [
      "Maralal CBD", "Lolkunono", "Wamba Center", "Archers Post Junction", 
      "Baragoi Stage", "Suguta Marmar Town", "South Horr Center", "Maralal Safari Lodge Area"
    ],
    streets: [
      "Nyahururu-Maralal Road (C78)", "Maralal Main Street", "Isiolo-Archers Post Highway (A2)", "Baragoi Main Track"
    ]
  },
  "Trans-Nzoia": {
    towns: [
      "Kitale", "Kiminini", "Endebess", "Saboti", "Cherangany/Kipkeikei", "Sibanga", "Suwerwa", "Kitalale"
    ],
    locations: [
      "Hospital Ward", "Bidii", "Tuwan", "Matisi", "Kiminini", "Waitaluk", "Nabiswa", 
      "Endebess", "Matumbei", "Saboti", "Machewa", "Sinyerere", "Cherangany", "Kwanza", "Keiyo"
    ],
    sublocations: [
      "Kitale CBD", "Milimani Kitale", "Tuwan Estate", "Matisi Sub", "Kipkaren", 
      "Kiminini Town", "Endebess Center", "Saboti Town", "Sibanga Market", "Bondeni Kitale"
    ],
    streets: [
      "Kenyatta Street Kitale", "Kitale-Eldoret Highway (A1)", "Kitale-Webuye Road", 
      "Kitale-Endebess Road", "Station Road Kitale", "Lwakhakha Road"
    ]
  },
  "Uasin Gishu": {
    towns: [
      "Eldoret", "Turbo", "Moiben", "Kesses", "Burnt Forest", "Ziwa", "Matunda", "Kipkaren"
    ],
    locations: [
      "Eldoret CBD", "Elgon View", "Huruma", "Langas", "Pioneer", "Kipkenyo", 
      "Kapyemit", "Kimumu", "Kapsoya", "Kapsaret", "Megun", "Ngeria", "Tarakwa", 
      "Moiben", "Sergoit", "Ziwa", "Turbo", "Tapsagoi", "Kipkaren"
    ],
    sublocations: [
      "Annex", "Kimumu", "Sirikwa", "West Indies", "Maili Nne", "Racecourse", 
      "Action Estate", "Hillside", "Block 10", "Munyaka", "Yamumbi", "Burnt Forest Town", 
      "Kapseret Stage", "Cheptiret"
    ],
    streets: [
      "Uganda Road (A104)", "Oloo Street", "Kipchoge Keino Avenue", "Nandi Road", 
      "Eldoret-Iten Road", "Kisumu Road Eldoret", "Eldoret Bypass", "Uganda Highway Frontage"
    ]
  },
  "Elgeyo-Marakwet": {
    towns: [
      "Iten", "Tambach", "Kapsowar", "Chebiemit", "Flourspar", "Chepkorio", "Nyaru", "Bugar"
    ],
    locations: [
      "Iten/Tambach", "Kamariny", "Chepkorio", "Soy North", "Soy South", "Kapsowar", 
      "Chebiemit", "Lelan", "Sambirir", "Endo", "Arror"
    ],
    sublocations: [
      "Iten Viewpoint Sub", "Iten CBD", "Tambach Stage", "Kapsowar Center", 
      "Chebiemit Sub", "Chepkorio Center", "Nyaru Junction", "Flourspar Mining Area", "Tot Market"
    ],
    streets: [
      "Eldoret-Iten Highway (C51)", "Iten-Kapsowar Road", "Iten Viewpoint Road", 
      "Tambach Escarpment Road", "Nyaru-Ravine Road"
    ]
  },
  "Nandi": {
    towns: [
      "Kapsabet", "Nandi Hills", "Mosoriot", "Kobujoi", "Kilibwoni", "Maraba", "Serem", "Chemase"
    ],
    locations: [
      "Kapsabet Township", "Chepterit", "Chemundu", "Kilibwoni", "Nandi Hills Town", 
      "Lessos", "Tindinyo", "Kobujoi", "Kemeloi", "Aldai", "Kabiyet", "Sangalo", "Tinderet", "Songhor"
    ],
    sublocations: [
      "Kapsabet CBD", "Nandi Hills Center", "Mosoriot University Sub", "Kapsabet Stage", 
      "Kamatargui", "Baraton (UEAB Area)", "Chemelil Border", "Serem Market", "Chepterit Stage"
    ],
    streets: [
      "Eldoret-Kapsabet Road (C39)", "Kapsabet-Chavakali Road", "Nandi Hills Main Street", 
      "Kapsabet-Eldama Ravine Road", "Hospital Road Kapsabet"
    ]
  },
  "Baringo": {
    towns: [
      "Kabarnet", "Eldama Ravine", "Marigat", "Mogotio", "Chemulingot", "Kabartonjo", "Tenges"
    ],
    locations: [
      "Kabarnet Township", "Kapropita", "Sacho", "Tenges", "Eldama Ravine Central", 
      "Lembus", "Mumberes", "Marigat", "Mukutani", "Mogotio", "Emining", "Kabartonjo", 
      "Bartabwa", "Ribkwo", "Silale"
    ],
    sublocations: [
      "Kabarnet CBD", "Eldama Ravine Town", "Marigat Junction", "Mogotio Sub", 
      "Chemulingot Center", "Kabartonjo Stage", "Kiamariga", "Timboroa Border", 
      "Lake Baringo Area (Kampi ya Samaki)"
    ],
    streets: [
      "Nakuru-Kabarnet Highway (B4)", "Eldama Ravine-Nakuru Road", "Marigat-Baringo Road", 
      "Kabarnet-Kabartonjo Road", "Ravine Main Street"
    ]
  },
  "Laikipia": {
    towns: [
      "Nanyuki", "Nyahururu", "Rumuruti", "Kinamba", "Doldol", "Ol Joret", "Sipili", "Wiyumirerie"
    ],
    locations: [
      "Nanyuki Central", "Thingithu", "Igwamiti", "Salama", "Rumuruti Township", 
      "Ol-Moran", "Sosian", "Mukogodo East", "Mukogodo West", "Umande", "Segera"
    ],
    sublocations: [
      "Nanyuki CBD", "Majengo Nanyuki", "Likii", "Thingithu Sub", "Nyahururu Town Sub", 
      "Rumuruti Center", "Sipili Market", "Doldol Stage", "Kinamba Town", "Equator Area Nanyuki"
    ],
    streets: [
      "Nairobi-Nanyuki Highway (A2)", "Kenyatta Way Nanyuki", "Nyahururu-Nakuru Road (C77)", 
      "Nanyuki-Doldol Road", "Rumuruti-Nyahururu Highway"
    ]
  },
  "Nakuru": {
    towns: [
      "Nakuru", "Naivasha", "Gilgil", "Molo", "Njoro", "Subukia", "Mai Mahiu", "Bahati", "Elburgon", "Rongai"
    ],
    locations: [
      "Nakuru CBD", "Milimani", "Section 58", "Kiamunyi", "Lanet", "Free Area", 
      "Nakuru East", "Nakuru West", "Naivasha East", "Naivasha Central", "Viwandani", 
      "Mai Mahiu", "Gilgil Township", "Elementaita", "Molo Township", "Njoro", "Lare", "Subukia", "Bahati"
    ],
    sublocations: [
      "Shabab", "White House", "Barnabas", "Pipeline Nakuru", "Freehold", "Kaptembwa", 
      "Bondeni", "Lake View Naivasha", "Longonot", "Gilgil Town Center", "Molo Center", 
      "Egerton University Sub", "Njoro Stage", "Kabatini"
    ],
    streets: [
      "Kenyatta Avenue Nakuru", "Oginga Odinga Road", "Government Road", "Kanu Street", 
      "Nairobi-Nakuru Highway (A104)", "Moi South Lake Road (Naivasha)", "Nakuru-Eldoret Highway", "Bondeni Road"
    ]
  },
  "Narok": {
    towns: [
      "Narok Town", "Kilgoris", "Ololulunga", "Nairagie Enkare", "Ntulele", "Lolgorian", "Emurua Dikirr"
    ],
    locations: [
      "Township (Narok)", "Nkoidila", "Olekurto", "Olokurto", "Ololulunga", "Melelo", 
      "Ntulele", "Mosiro", "Kilgoris Central", "Keyian", "Lolgorian", "Shankoe", "Emurua Dikirr"
    ],
    sublocations: [
      "Narok CBD", "Stadium Area Narok", "Kilgoris Center", "Ololulunga Stage", 
      "Maasai Mara Gateway (Talek, Sekenani)", "Ntulele Center", "Nairagie Enkare Town", "Lolgorian Sub"
    ],
    streets: [
      "Nairobi-Narok Highway (B3)", "Narok-Bomet Road (B3)", "Narok-Mau Narok Road", 
      "Kilgoris Main Street", "Sekenani Road", "Hospital Road Narok"
    ]
  },
  "Kajiado": {
    towns: [
      "Kitengela", "Ongata Rongai", "Ngong", "Kajiado Town", "Loitokitok", "Namanga", "Isinya", "Kiserian", "Bisil"
    ],
    locations: [
      "Nkaimurunya", "Ongata Rongai", "Ngong Central", "Olkeri", "Kitengela", 
      "Oloosirkon/Sholinke", "Isinya", "Kajiado Central", "Dalalekutuk", "Matapato North", 
      "Matapato South", "Oloitokitok", "Rombo", "Entonet", "Kiserian"
    ],
    sublocations: [
      "Kitengela CBD", "Acacia", "Rongai Stage", "Ngong Vet", "Kiserian Town", 
      "Namanga Border Post", "Loitokitok Town", "Isinya Center", "Mile 46", 
      "Sultan Hamud Border", "Bisil Town"
    ],
    streets: [
      "Namanga Highway (A104)", "Magadi Road", "Ngong Road Extension", 
      "Kitengela-Acacia Road", "Kiserian-Isinya Road", "Loitokitok-Emali Road", "Old Namanga Road"
    ]
  },
  "Kericho": {
    towns: [
      "Kericho Town", "Litein", "Kipkelion", "Londiani", "Kapsoit", "Sondu Border", "Kabianga"
    ],
    locations: [
      "Ainamoi", "Kapsoit", "Kipchebor", "Belgut", "Kabianga", "Seretut", "Litein", 
      "Cheplanget", "Cheborge", "Kipkelion", "Chilchila", "Londiani", "Kedowa", "Soin", "Sigowet"
    ],
    sublocations: [
      "Kericho CBD", "Nyagacho", "Litein Center", "Kapsoit Stage", "Londiani Junction", 
      "Kabianga University Area", "Sondu Market Sub", "Brooke Center", "Chepseon"
    ],
    streets: [
      "Nakuru-Kericho Highway (B3)", "Moi Road Kericho", "Kericho-Kisumu Highway (B1)", 
      "Kericho-Litein Road", "Temple Road Kericho", "Hospital Road Kericho"
    ]
  },
  "Bomet": {
    towns: [
      "Bomet Town", "Sotik", "Longisa", "Mulot", "Chepalungu", "Silibwet", "Tenwek", "Mogogosiek"
    ],
    locations: [
      "Township (Bomet)", "Silibwet", "Ndaraweta", "Longisa", "Kipreres", "Sotik Central", 
      "Ndanai/Abosi", "Kipsonoi", "Sigor", "Kongasis", "Mogogosiek", "Kimulot"
    ],
    sublocations: [
      "Bomet CBD", "Sotik Center", "Longisa Stage", "Mulot Border", "Tenwek Hospital Sub", 
      "Silibwet Market", "Chebole", "Ndanai Town", "Mogogosiek Center"
    ],
    streets: [
      "Narok-Bomet Highway (B3)", "Bomet-Kericho Road", "Sotik Main Street", 
      "Tenwek Road", "Bomet-Sotik Highway", "Market Road Bomet"
    ]
  },
  "Kakamega": {
    towns: [
      "Kakamega Town", "Mumias", "Malava", "Butere", "Lugari", "Lumakanda", "Khwisero", "Navakholo", "Shinyalu"
    ],
    locations: [
      "Township (Kakamega)", "Lurambi", "Shirere", "Mahiakalo", "Mumias Central", 
      "Mumias North", "Malava Township", "South Kabras", "Butere Township", 
      "Marama Central", "Kisa Central", "Bunyala", "Lumakanda", "Lugari", "Shinyalu", "Ikolomani"
    ],
    sublocations: [
      "Kakamega CBD", "Kefinco", "Approved Kakamega", "Joyland", "Amalemba", 
      "Mumias Center", "Shibale", "Malava Stage", "Butere Town", "Lumakanda Center", "Khwisero Sub", "Iguhu"
    ],
    streets: [
      "Kisumu-Kakamega Highway (A1)", "Mumias-Kakamega Road", "Canon Awori Street", 
      "Kakamega-Webuye Highway", "Mumias Main Street", "Hospital Road Kakamega"
    ]
  },
  "Vihiga": {
    towns: [
      "Mbale", "Chavakali", "Luanda", "Hamisi", "Majengo Vihiga", "Serem", "Jeptulu"
    ],
    locations: [
      "Maragoli Central", "Mbale", "Sabatia West", "Lyaduywa/Izava", "Chavakali", 
      "Luanda Township", "Luanda South", "Emuhaya Central", "Hamisi", "Shiru", "Gisambai", "Jepkoyai"
    ],
    sublocations: [
      "Mbale CBD", "Chavakali Market Sub", "Luanda Stage", "Majengo Junction", "Mungoma", 
      "Kaimosi Complex Area", "Mudete", "Gambogi", "Lunyerere", "Maseno Border"
    ],
    streets: [
      "Kisumu-Kakamega Highway (A1)", "Luanda-Majengo Road", "Mbale Main Street", 
      "Chavakali-Kaimosi Road", "C39 Highway"
    ]
  },
  "Bungoma": {
    towns: [
      "Bungoma Town", "Webuye", "Kimilili", "Chwele", "Sirisia", "Kanduyi", 
      "Malaba Border (Bungoma side)", "Kapsokwony", "Cheptais"
    ],
    locations: [
      "Township (Bungoma)", "Bukembe West", "Khalaba", "Webuye East", "Webuye West", 
      "Misikhu", "Kimilili Township", "Maeni", "Chwele", "Mukweya", "Sirisia", 
      "Kapsokwony", "Cheptais", "Tongaren"
    ],
    sublocations: [
      "Bungoma CBD", "Kanduyi Junction", "Webuye Town Sub", "National Housing Estate Bungoma", 
      "Kimilili Center", "Chwele Market Sub", "Malakisi", "Cheptais Town", "Kapsokwony Stage", "Kamukuywa"
    ],
    streets: [
      "Eldoret-Malaba Highway (A104)", "Mumias-Bungoma Road", "Webuye Highway", 
      "Bungoma-Kimilili Road", "Station Road Bungoma", "Cathedral Road"
    ]
  },
  "Busia": {
    towns: [
      "Busia Town", "Malaba", "Nambale", "Funyula", "Port Victoria", "Bumala", "Amukura", "Matayos"
    ],
    locations: [
      "Township (Busia)", "Burumba", "Matayos South", "Malaba Central", "Malaba North", 
      "Ang'urai", "Nambale Township", "Bukhayo Central", "Funyula Central", "Bwiri", "Bunyala Central", "Bunyala South"
    ],
    sublocations: [
      "Busia Border", "Custom Area", "Burumba Estate", "Malaba Border Sub", 
      "Nambale Center", "Port Victoria Sub", "Bumala Market", "Ang'orom", "Amukura Town", "Sio Port"
    ],
    streets: [
      "Kisumu-Busia Highway (B1)", "Eldoret-Malaba Highway (A104)", "Customs Road Busia", 
      "Port Victoria Road", "Busia-Nambale Road", "Border Post Link"
    ]
  },
  "Siaya": {
    towns: [
      "Siaya Town", "Bondo", "Ugunja", "Yala", "Usenge", "Ndori", "Akala", "Aram"
    ],
    locations: [
      "Township (Siaya)", "Alego Central", "Yimbo East", "Yimbo West", "Bondo Township", 
      "Sakwa", "Central Gem", "Yala Township", "Ugunja", "Ugenya", "Rarieda", "Uyoma"
    ],
    sublocations: [
      "Siaya CBD", "Rabango", "Mulaha", "Bondo Town Sub", "Usenge Beach/Port", 
      "Ugunja Center", "Yala Stage", "Ndori Junction", "Aram Market", "Nyadorera", "Luanda Kotieno"
    ],
    streets: [
      "Kisumu-Bondo Highway (C28)", "Siaya-Rang'ala Road", "Bondo-Usenge Road", 
      "Siaya-Bondo Road", "Hospital Road Siaya", "Luanda Kotieno Link"
    ]
  },
  "Kisumu": {
    towns: [
      "Kisumu City", "Muhoroni", "Maseno", "Ahero", "Kombewa", "Awasi"
    ],
    locations: [
      "Kisumu Central", "Kaloleni", "Kisumu East", "Kajulu", "Kisumu West", 
      "North Seme", "South Seme", "Nyando", "Ahero", "Kobura", "Muhoroni Township", "Miwani", "Chemelil"
    ],
    sublocations: [
      "Milimani Kisumu", "Kisumu CBD", "Kondele", "Mamboleo", "Manyatta", 
      "Nyawita", "Migosi", "Polyview", "Tom Mboya", "Riat", "Nyamasaria", 
      "Otonglo", "Kibos", "Maseno Town", "Ahero Center", "Muhoroni Town"
    ],
    streets: [
      "Oginga Odinga Street", "Jomo Kenyatta Highway", "Accra Street", 
      "Nyerere Road", "Kisumu-Kakamega Road (A1)", "Kisumu-Busia Road", 
      "Otieno Oyoo Street", "Nairobi Road (Nyamasaria Frontage)"
    ]
  },
  "Homa Bay": {
    towns: [
      "Homa Bay Town", "Oyugis", "Mbita", "Kendu Bay", "Ndhiwa", "Sindo", "Rangwe", "Rodi Kopany"
    ],
    locations: [
      "Township (Homa Bay)", "Homa Bay Central", "Kasipul", "Karachuonyo", "Kendu West", 
      "Mbita Township", "Rusinga East/West", "Ndhiwa Township", "Kanyamwa", "Suba Central", "Gwassi North"
    ],
    sublocations: [
      "Homa Bay CBD", "Shauri Yako", "Sofia", "Oyugis Center", "Mbita Point Sub", 
      "Rusinga Island Area", "Kendu Bay Stage", "Ndhiwa Town", "Rodi Kopany Junction", "Sindo Town", "Mfangano Island Sub"
    ],
    streets: [
      "Kisumu-Homa Bay Highway", "Homa Bay-Mbita Road", "Oyugis-Kisii Road", 
      "Homa Bay-Rodi Kopany Road", "Pier Road Homa Bay", "Kendu Bay Main Street"
    ]
  },
  "Migori": {
    towns: [
      "Migori Town", "Rongo", "Awendo", "Isebania", "Kehancha", "Sori", "Macalder", "Muhuru Bay"
    ],
    locations: [
      "Suna East", "Suna West", "Kakrao", "Rongo Township", "Central Kamagambo", 
      "Awendo Township", "North Sakwa", "Kuria West", "Kehancha", "Kuria East", "Nyatike", "Karungu"
    ],
    sublocations: [
      "Migori CBD", "Kakrao Sub", "Oruba", "Rongo Center", "Awendo Sare (Sony Sugar Area)", 
      "Isebania Border Post", "Kehancha Town", "Sori Karungu Bay", "Muhuru Beach Sub"
    ],
    streets: [
      "Kisii-Migori-Isebania Highway (A1)", "Rongo Highway", "Sony Sugar Road", 
      "Kehancha-Migori Road", "Isebania Border Link", "Suna Market Street"
    ]
  },
  "Kisii": {
    towns: [
      "Kisii Town", "Ogembo", "Suneka", "Keroka Border", "Tabaka", "Gesusu", "Nyamache", "Marani"
    ],
    locations: [
      "Kitutu Chache North/South", "Nyaribari Chache", "Township (Kisii)", "Nyaribari Masaba", 
      "Bomachoge Borabu", "Ogembo Township", "Bonchari", "Suneka", "Bobasi", "Nyamache", "South Mugirango", "Tabaka"
    ],
    sublocations: [
      "Kisii CBD", "Nyanchwa", "Daraja Mbili", "Mosocho", "Jogoo Estate", 
      "Nyambera", "Ogembo Center", "Suneka Town", "Tabaka Soapstone Area", "Keroka Kisii side", "Nyamache Market"
    ],
    streets: [
      "Kisumu-Kisii Highway (A1)", "Kisii-Kilgoris Road", "Hospital Road Kisii", 
      "Ogembo Main Street", "Kisii-Keroka Highway", "Market Street Kisii", "Manga Road"
    ]
  },
  "Nyamira": {
    towns: [
      "Nyamira Town", "Keroka", "Nyamira North (Ekerenyo)", "Manga", "Rigoma", "Kebirigo", "Nyansiongo"
    ],
    locations: [
      "West Mugirango", "Township (Nyamira)", "Kebirigo", "North Mugirango", 
      "Ekerenyo", "Borabu", "Nyansiongo", "Kitutu Masaba", "Manga", "Rigoma"
    ],
    sublocations: [
      "Nyamira CBD", "Kebirigo Center", "Keroka Nyamira side", "Ekerenyo Stage", 
      "Manga Sub", "Rigoma Market", "Nyansiongo Town", "Sang'anyi", "Chepilat"
    ],
    streets: [
      "Kisii-Chemosit Highway", "Nyamira-Keroka Road", "Main Street Nyamira", 
      "Kebirigo-Nyamira Highway", "Hospital Road Nyamira"
    ]
  },
  "Nairobi": {
    towns: [
      "Westlands", "Kasarani", "Lang'ata", "Starehe", "Dagoretti", "Embakasi", 
      "Makadara", "Kamukunji", "Roysambu", "Mathare", "Kibra"
    ],
    locations: [
      "Kilimani", "Kasarani Central", "Karen", "CBD", "Upper Hill", "Industrial Area", 
      "Eastleigh", "Buruburu", "South C", "Runda", "Lavington", "Westlands Central", 
      "Parklands", "Embakasi East/West/Central", "Roysambu", "Kahawa West", "Kibera", "Pumwani", "Pangani"
    ],
    sublocations: [
      "Mwiki", "Roysambu Sub", "Lavington", "Hurlingham", "South B", "Imara Daima", 
      "Kileleshwa", "Parklands", "Donholm", "Pipeline", "Utawala", "Ruai", 
      "Kayole", "Komarock", "Zimmerman", "Kahawa West", "Githurai 44", "Highridge", "Kangemi", "Kawangware"
    ],
    streets: [
      "Moi Avenue", "Kenyatta Avenue", "Waiyaki Way (A104)", "Thika Superhighway", 
      "Ngong Road", "Enterprise Road", "Argwings Kodhek Road", "Jogoo Road", 
      "Mombasa Road", "Lang'ata Road", "Uhuru Highway", "Peponi Road", "Kiambu Road", "Ring Road Kilimani"
    ]
  }
}; // <--- Fixed: Added closing brace and semicolon here!

export const DEFAULT_REGIONAL_LOGISTICS = {
  towns: ["Central District / Town", "North District", "South District", "East District", "West District", "Municipal Center"],
  locations: ["Central Location", "Market Center", "Highway Junction", "Administrative Center", "Commercial Zone"],
  sublocations: ["Town Center Sub-location", "North Ward", "South Ward", "East Ward", "West Ward"],
  streets: ["Main Street / Highway", "Market Road", "Hospital Road", "School Lane", "Opposite Chief's Camp", "Supermarket Landmark"]
};

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ============================================================================
// 3. UTILITY FUNCTIONS
// ============================================================================

const formatKES = (amount: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(amount || 0);
};

const formatShippingAddress = (addr: any) => {
  if (!addr) return 'Standard Regional Delivery';
  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object') {
    return addr.streetAddress || addr.details || addr.location || [addr.town, addr.county].filter(Boolean).join(', ') || JSON.stringify(addr);
  }
  return String(addr);
};

const extractPaymentInfo = (order: any) => {
  if (!order) return { status: 'PENDING', isPaid: false, receipt: null, reason: null, method: 'M-Pesa STK', paidAt: null };
  
  const pd = order.paymentDetails || {};
  const isPaid = pd.isPaid === true || pd.paidTag === 'PAID' || order.status === 'paid' || order.status === 'completed' || order.status === 'delivered';
  const tag = pd.paidTag || (isPaid ? 'PAID' : (pd.failureReason || order.status === 'payment_failed' ? 'FAILED' : 'PENDING'));
  
  return {
    status: tag,
    isPaid: isPaid,
    receipt: pd.mpesaReceipt || pd.rawCallback?.mpesa_code || null,
    reason: pd.failureReason || null,
    method: pd.method || 'M-Pesa STK',
    paidAt: pd.paidAt || null
  };
};

const formatCountdownMs = (ms: number) => {
  if (ms <= 0) return '00:00:00';
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ============================================================================
// 4. CUSTOM FINANCIAL GROWTH CHART COMPONENT (SVG-BASED)
// Dynamic graph showing real monthly growth from database with empty month visualizers
// ============================================================================

interface FinancialGrowthChartProps {
  monthlyData: FinancialMonth[];
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
  isLoading?: boolean;
}

const FinancialGrowthChart: React.FC<FinancialGrowthChartProps> = ({
  monthlyData,
  selectedYear,
  availableYears,
  onYearChange,
  isLoading = false
}) => {
  const [metric, setMetric] = useState<'revenue' | 'profit' | 'kg'>('revenue');

  // Normalize 12 months array ensuring all 12 months (Jan - Dec) exist even if empty
  const fullYearMonths = useMemo(() => {
    const list: FinancialMonth[] = [];
    for (let i = 0; i < 12; i++) {
      const found = monthlyData?.find(m => m.monthIndex === i);
      if (found) {
        list.push(found);
      } else {
        list.push({
          monthIndex: i,
          monthName: MONTH_NAMES_SHORT[i],
          year: selectedYear,
          totalRevenue: 0,
          totalBuyingCost: 0,
          netProfit: 0,
          totalKgSold: 0,
          orderCount: 0
        });
      }
    }
    return list;
  }, [monthlyData, selectedYear]);

  // Compute maximum values for SVG height scaling
  const maxValue = useMemo(() => {
    let max = 0;
    fullYearMonths.forEach(m => {
      const val = metric === 'revenue' ? m.totalRevenue : metric === 'profit' ? m.netProfit : m.totalKgSold;
      if (val > max) max = val;
    });
    return max > 0 ? max * 1.15 : 10000;
  }, [fullYearMonths, metric]);

  const svgWidth = 800;
  const svgHeight = 280;
  const paddingX = 50;
  const paddingY = 40;
  const graphWidth = svgWidth - paddingX * 2;
  const graphHeight = svgHeight - paddingY * 2;

  // Generate SVG Points for Line / Area Chart
  const points = useMemo(() => {
    return fullYearMonths.map((m, idx) => {
      const val = metric === 'revenue' ? m.totalRevenue : metric === 'profit' ? m.netProfit : m.totalKgSold;
      const x = paddingX + (idx / 11) * graphWidth;
      const y = svgHeight - paddingY - (val / maxValue) * graphHeight;
      return { x, y, val, month: m.monthName, orders: m.orderCount, data: m };
    });
  }, [fullYearMonths, metric, maxValue, graphWidth, graphHeight]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    return `${pathD} L ${last.x} ${svgHeight - paddingY} L ${first.x} ${svgHeight - paddingY} Z`;
  }, [pathD, points, svgHeight, paddingY]);

  return (
    <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 border border-emerald-900/60 shadow-2xl space-y-6">
      
      {/* Top Controls & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xl font-black text-white">Database Financial Growth Engine</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time monthly aggregation from verified paid customer orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Year Switcher Dropdown */}
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">Select Year:</span>
            <select 
              value={selectedYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="bg-slate-900 text-emerald-400 font-extrabold px-2 py-1 rounded-lg border border-emerald-500/30 focus:outline-none cursor-pointer"
            >
              {(availableYears && availableYears.length > 0 ? availableYears : [2024, 2025, 2026, 2027]).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Metric Selector Pills */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs font-bold">
            <button 
              onClick={() => setMetric('revenue')}
              className={`px-3 py-1 rounded-lg transition-all ${metric === 'revenue' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Revenue
            </button>
            <button 
              onClick={() => setMetric('profit')}
              className={`px-3 py-1 rounded-lg transition-all ${metric === 'profit' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Net Profit
            </button>
            <button 
              onClick={() => setMetric('kg')}
              className={`px-3 py-1 rounded-lg transition-all ${metric === 'kg' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Grain Volume (Kg)
            </button>
          </div>
        </div>
      </div>

      {/* SVG Chart Graphics */}
      <div className="relative w-full overflow-x-auto">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
            <span>Retrieving real-time purchase logs from database...</span>
          </div>
        ) : (
          <div className="min-w-[650px]">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
              <defs>
                <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const yVal = svgHeight - paddingY - ratio * graphHeight;
                const gridVal = Math.round(ratio * maxValue);
                return (
                  <g key={i}>
                    <line 
                      x1={paddingX} 
                      y1={yVal} 
                      x2={svgWidth - paddingX} 
                      y2={yVal} 
                      stroke="#334155" 
                      strokeDasharray="4 4" 
                      strokeWidth="1"
                    />
                    <text 
                      x={paddingX - 8} 
                      y={yVal + 4} 
                      fill="#64748b" 
                      fontSize="10" 
                      textAnchor="end" 
                      fontWeight="600"
                    >
                      {metric === 'kg' ? `${gridVal}kg` : `KES ${gridVal >= 1000 ? `${(gridVal/1000).toFixed(0)}k` : gridVal}`}
                    </text>
                  </g>
                );
              })}

              {/* Shaded Area Fill */}
              <path 
                d={areaD} 
                fill={metric === 'revenue' ? "url(#emeraldGrad)" : metric === 'profit' ? "url(#tealGrad)" : "url(#amberGrad)"} 
              />

              {/* Chart Line */}
              <path 
                d={pathD} 
                fill="none" 
                stroke={metric === 'revenue' ? "#10b981" : metric === 'profit' ? "#14b8a6" : "#f59e0b"} 
                strokeWidth="3.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />

              {/* Month Data Points & Empty Indicators */}
              {points.map((p, idx) => {
                const isEmpty = p.val === 0;

                return (
                  <g key={idx} className="group cursor-pointer">
                    {/* Vertical guideline */}
                    <line 
                      x1={p.x} 
                      y1={paddingY} 
                      x2={p.x} 
                      y2={svgHeight - paddingY} 
                      stroke="#1e293b" 
                      strokeWidth="1"
                      className="group-hover:stroke-slate-500 transition-colors"
                    />

                    {/* Data Point Marker */}
                    {isEmpty ? (
                      /* Empty Month Visual Tag */
                      <g>
                        <circle 
                          cx={p.x} 
                          cy={p.y} 
                          r="4" 
                          fill="#0f172a" 
                          stroke="#64748b" 
                          strokeWidth="2" 
                        />
                        <text 
                          x={p.x} 
                          y={p.y - 10} 
                          fill="#64748b" 
                          fontSize="9" 
                          textAnchor="middle"
                          fontWeight="700"
                        >
                          Empty
                        </text>
                      </g>
                    ) : (
                      /* Active Month Data Marker */
                      <circle 
                        cx={p.x} 
                        cy={p.y} 
                        r="6" 
                        fill={metric === 'revenue' ? "#10b981" : metric === 'profit' ? "#14b8a6" : "#f59e0b"} 
                        stroke="#0f172a" 
                        strokeWidth="3" 
                        className="group-hover:r-8 transition-all"
                      />
                    )}

                    {/* X-Axis Month Name Label */}
                    <text 
                      x={p.x} 
                      y={svgHeight - paddingY + 20} 
                      fill={isEmpty ? "#64748b" : "#f8fafc"} 
                      fontSize="11" 
                      fontWeight={isEmpty ? "500" : "800"} 
                      textAnchor="middle"
                    >
                      {p.month}
                    </text>

                    {/* Hover Tooltip Popup */}
                    <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <rect 
                        x={p.x - 65} 
                        y={p.y - 55} 
                        width="130" 
                        height="45" 
                        rx="8" 
                        fill="#022c22" 
                        stroke="#10b981" 
                        strokeWidth="1.5" 
                      />
                      <text x={p.x} y={p.y - 38} fill="#ffffff" fontSize="10" fontWeight="800" textAnchor="middle">
                        {p.month} {selectedYear}
                      </text>
                      <text x={p.x} y={p.y - 22} fill="#34d399" fontSize="11" fontWeight="900" textAnchor="middle">
                        {isEmpty ? 'No Purchases' : metric === 'kg' ? `${p.val} kg` : formatKES(p.val)}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Monthly Data Matrix Table (Highlights Zero Value / Empty Months) */}
      <div className="pt-4 border-t border-slate-800">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Monthly Ledger Breakdown ({selectedYear})
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {fullYearMonths.map((m) => {
            const isEmpty = m.totalRevenue === 0;

            return (
              <div 
                key={m.monthIndex} 
                className={`p-3 rounded-2xl border transition-all ${
                  isEmpty 
                    ? 'bg-slate-950/40 border-slate-800/80 text-slate-500' 
                    : 'bg-slate-800/60 border-emerald-900/40 text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                  <span>{m.monthName}</span>
                  {isEmpty ? (
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                      Empty
                    </span>
                  ) : (
                    <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800/50">
                      {m.orderCount} Orders
                    </span>
                  )}
                </div>

                <div className="text-sm font-extrabold text-white">
                  {isEmpty ? '-' : formatKES(m.totalRevenue)}
                </div>

                {!isEmpty && (
                  <div className="flex justify-between items-center text-[10px] mt-1 text-slate-400">
                    <span>Profit:</span>
                    <span className="text-teal-400 font-bold">{formatKES(m.netProfit)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

// ============================================================================
// 5. REUSABLE PRODUCT CARD COMPONENT
// Prioritizes phone screen priority (2 items per row on small devices, 4 on desktop)
// ============================================================================

/** Bulk-order settings the ADMIN controls: default discount, per-rice overrides and the delivery cost per county. */
export interface BulkConfig {
  enabled: boolean;
  minKg: number;
  discountPercent: number;
  perProduct: Record<string, { discountPercent?: number; minKg?: number }>;
  transport: Record<string, number>;
}

/** The minimum kg and discount that apply to one rice type (its own setting, otherwise the default). Mirrors the server. */
export const bulkRuleFor = (cfg: BulkConfig | null, productId: number) => {
  const o: { discountPercent?: number; minKg?: number } = (cfg && cfg.perProduct && cfg.perProduct[String(productId)]) || {};
  return { minKg: o.minKg ?? cfg?.minKg ?? 50, discountPercent: o.discountPercent ?? cfg?.discountPercent ?? 0 };
};

/** True when the quantity clears that rice type's bulk minimum (kg). */
export const isBulkQualified = (cfg: BulkConfig | null, p: any, qty: number) => {
  const kg = (Number(p?.weightKg) || 0) * Number(qty);
  return kg > 0 && kg >= bulkRuleFor(cfg, p?.id).minKg;
};

/** Price per bag for a cart line, including the admin's bulk % off for lines placed from the Bulk Order tab (mirrors the server). */
export const getCartLineUnit = (item: CartItem, flashActive: boolean, cfg: BulkConfig | null): { price: number; bulk: boolean; base: number; bulkPercent?: number } => {
  const p: any = item.product || {};
  const unit: { price: number; bulk: boolean; base: number; bulkPercent?: number } = getUnitPrice(p, item.quantity, flashActive);
  if (item.bulk && cfg && cfg.enabled && isBulkQualified(cfg, p, item.quantity)) {
    const pct = bulkRuleFor(cfg, p.id).discountPercent;
    const discounted = Math.round(unit.price * (1 - pct / 100) * 100) / 100;
    if (pct > 0 && discounted < unit.price) return { ...unit, price: discounted, bulk: true, bulkPercent: pct };
  }
  return unit;
};

/** Price per bag for a quantity: the best of the normal/flash price and any bulk tier (mirrors the server). */
export const getUnitPrice = (p: any, qty: number, flashActive: boolean) => {
  const base = flashActive && p.flashSalePrice ? p.flashSalePrice : (p.basePrice || p.price || 0);
  const tiers: { minQty: number; price: number }[] = Array.isArray(p.wholesaleTiers) ? p.wholesaleTiers : [];
  const tier = [...tiers].filter(t => qty >= t.minQty && t.price > 0).sort((a, b) => b.minQty - a.minQty)[0];
  return tier && tier.price < base ? { price: tier.price, bulk: true, base } : { price: base, bulk: false, base };
};

interface ProductCardProps {
  product: Product;
  flashActive?: boolean;
  onAddToCart: () => void;
  onQuickView: () => void;
  onReviews?: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  flashActive = false,
  onAddToCart,
  onQuickView,
  onReviews
}) => {
  const effectivePrice = flashActive && product.flashSalePrice ? product.flashSalePrice : (product.basePrice || product.price || 0);
  const originalPrice = product.basePrice || product.price || 0;
  const hasDiscount = flashActive && product.flashSalePrice && product.flashSalePrice < originalPrice;
  const isLowStock = product.stockQuantity > 0 && product.stockQuantity <= 10;
  const isOutOfStock = product.stockQuantity <= 0;

  return (
    <div className="group relative bg-white rounded-3xl p-3 sm:p-4 border border-emerald-100 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 flex flex-col justify-between">
      
      {/* Top Badges & Image Frame */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-emerald-50/50 mb-3">
        <img 
          src={product.imageUrl || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80'} 
          alt={product.brandName} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={(e) => { const t = e.currentTarget; if (!t.dataset.fallback) { t.dataset.fallback = '1'; t.src = 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80'; } }}
        />

        {/* Dynamic Badges: wrap instead of overlapping on narrow phone cards */}
        <div className="absolute top-2 inset-x-2 z-10 flex flex-wrap items-start justify-between gap-1 pointer-events-none">
          <div className="flex flex-col gap-1 items-start min-w-0 max-w-full">
            <span className="bg-emerald-900/90 text-emerald-200 font-black text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full backdrop-blur-md uppercase tracking-wide sm:tracking-wider shadow-sm whitespace-nowrap">
              {Number(product.weightKg) || product.weightKg}kg Sack
            </span>
            {product.isOrganic && (
              <span className="bg-teal-700/90 text-white font-bold text-[9px] px-1.5 sm:px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 whitespace-nowrap">
                <Leaf className="w-2.5 h-2.5" /> Organic
              </span>
            )}
          </div>
          {hasDiscount && (
            <span className="bg-rose-600 text-white font-black text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full shadow-md animate-pulse whitespace-nowrap">
              SALE
            </span>
          )}
        </div>

        {/* Quick View Button Overlay */}
        <button 
          onClick={onQuickView}
          className="absolute inset-x-3 bottom-3 py-2 rounded-xl bg-white/95 text-slate-800 text-xs font-extrabold shadow-lg opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-1.5 backdrop-blur-sm"
          aria-label="Quick View Details"
        >
          <Eye className="w-3.5 h-3.5 text-emerald-700" /> Quick View
        </button>
      </div>

      {/* Product Information */}
      <div className="space-y-1.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-1 text-[11px] text-emerald-700 font-bold">
            <span className="truncate">{product.variety}</span>
            <span className="text-[10px] text-slate-400 font-normal">Mwea Grade 1</span>
          </div>

          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2 mt-0.5 group-hover:text-emerald-800 transition-colors">
            {product.brandName}
          </h3>
          {onReviews && (
            <button type="button" onClick={onReviews} className="flex items-center gap-1 mt-1 text-[11px] cursor-pointer hover:underline" aria-label="See reviews">
              {(product.hasRating ?? ((product.ratingCount || 0) > 0)) ? (
                <><StarRating value={product.ratingAvg || 0} size={12} /><span className="font-bold text-slate-700">{(product.ratingAvg || 0).toFixed(1)}</span></>
              ) : (
                <span className="px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-bold text-[10px]">New · Be the first to review</span>
              )}
            </button>
          )}
        </div>

        {/* Pricing & Stock Indicator */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-baseline gap-2">
            <span className="text-base sm:text-lg font-black text-emerald-800">
              {formatKES(effectivePrice)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-slate-400 line-through font-semibold">
                {formatKES(originalPrice)}
              </span>
            )}
          </div>
          {Array.isArray(product.wholesaleTiers) && product.wholesaleTiers.length > 0 && (
            <p className="text-[10px] font-bold text-sky-700 mt-0.5">Bulk: {product.wholesaleTiers[0].minQty}+ bags at {formatKES(product.wholesaleTiers[0].price)} each</p>
          )}

          {/* Stock Availability */}
          <div className="flex items-center justify-between text-[11px] mt-1">
            {isOutOfStock ? (
              <span className="text-rose-600 font-bold flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Out of Stock
              </span>
            ) : isLowStock ? (
              <span className="text-amber-600 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Only {product.stockQuantity} left
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> In Stock ({product.stockQuantity})
              </span>
            )}
          </div>
        </div>

        {/* Add To Cart CTA Button */}
        <button 
          onClick={onAddToCart}
          disabled={isOutOfStock}
          className="w-full mt-3 py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>{isOutOfStock ? 'Sold Out' : 'Add To Cart'}</span>
        </button>
      </div>

    </div>
  );
};

// ============================================================================
// 6. MAIN APPLICATION COMPONENT (PREMIUM RICE STORE)
// ============================================================================

// ============================================================================
// TERMS & CONDITIONS, PASSWORD STRENGTH
// ============================================================================
const TERMS_VERSION = '2026-11';
const MIN_PASSWORD_LENGTH = 8;

/** Advises on strength but never blocks: anything with 8+ characters is allowed. */
const assessPassword = (pw: string) => {
  const tips: string[] = [];
  if (!pw) return { score: 0, label: '', tips, color: 'bg-slate-200', text: 'text-slate-400' };
  const lower = pw.toLowerCase();
  const common = ['password', '12345678', '123456789', '1234567890', 'qwertyui', 'qwerty123', 'iloveyou', 'abc12345', '11111111', '00000000', 'admin123', 'welcome1', 'mwearice'];
  const isCommon = common.some(c => lower.includes(c));
  const hasLower = /[a-z]/.test(pw), hasUpper = /[A-Z]/.test(pw), hasNum = /\d/.test(pw), hasSym = /[^A-Za-z0-9]/.test(pw);
  const variety = [hasLower, hasUpper, hasNum, hasSym].filter(Boolean).length;
  const repeated = /^(.)\1+$/.test(pw) || /(.)\1{3,}/.test(pw);
  const sequence = /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/i.test(pw);

  let score = 0;
  if (pw.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (pw.length >= 12) score += 1;
  if (variety >= 3) score += 1;
  if (variety === 4 || pw.length >= 16) score += 1;
  if (isCommon || repeated) score = Math.min(score, 1);
  else if (sequence) score = Math.min(score, 2);
  if (pw.length < MIN_PASSWORD_LENGTH) score = 0;

  if (pw.length < MIN_PASSWORD_LENGTH) tips.push(`Use at least ${MIN_PASSWORD_LENGTH} characters (${MIN_PASSWORD_LENGTH - pw.length} more).`);
  if (isCommon) tips.push('This looks like a very common password.');
  else if (repeated) tips.push('Avoid repeating the same character.');
  else if (sequence) tips.push('Avoid simple sequences like 1234 or qwerty.');
  if (pw.length >= MIN_PASSWORD_LENGTH && score < 3) {
    if (!hasUpper || !hasLower) tips.push('Mix upper and lower case letters.');
    if (!hasNum) tips.push('Add a number.');
    if (!hasSym) tips.push('Add a symbol such as ! or #.');
    if (pw.length < 12) tips.push('A longer password (12+ characters) is much harder to guess.');
  }
  const levels = [
    { label: 'Too short', color: 'bg-rose-500', text: 'text-rose-600' },
    { label: 'Weak', color: 'bg-orange-500', text: 'text-orange-600' },
    { label: 'Fair', color: 'bg-amber-400', text: 'text-amber-600' },
    { label: 'Good', color: 'bg-lime-500', text: 'text-lime-600' },
    { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600' }
  ];
  return { score, ...levels[score], tips: tips.slice(0, 3) };
};

function PasswordStrength({ value }: { value: string }) {
  if (!value) return <p className="text-[10px] text-slate-400 mt-1">At least {MIN_PASSWORD_LENGTH} characters. A longer mix of letters, numbers and symbols is safer.</p>;
  const a = assessPassword(value);
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map(i => <div key={i} className={`h-1.5 rounded-full ${a.score >= i ? a.color : 'bg-slate-200'}`} />)}
        </div>
        <span className={`text-[10px] font-black uppercase ${a.text}`}>{a.label}</span>
      </div>
      {a.tips.length > 0 && <p className="text-[10px] text-slate-500 leading-snug">{a.tips.join(' ')}</p>}
      {value.length >= MIN_PASSWORD_LENGTH && a.score < 3 && <p className="text-[10px] font-bold text-slate-500">You can still use this password, but a stronger one protects your account better.</p>}
    </div>
  );
}

const TERMS_SECTIONS: { title: string; body: string[] }[] = [
  { title: '1. About these terms', body: [
    'These Terms and Conditions govern your use of the Mwea Rice Hub website and the purchase of rice and related products through it ("the Service"). By creating an account or placing an order you agree to them. If you do not agree, please do not use the Service.'
  ]},
  { title: '2. Your account', body: [
    'You must give accurate information when you register, including a working phone number that can receive SMS verification codes. You are responsible for keeping your password private and for everything done through your account.',
    'You must be at least 18 years old, or have a parent or guardian\'s permission. We may suspend or close accounts that give false information, abuse the Service or are used for fraud.'
  ]},
  { title: '3. Products and prices', body: [
    'All prices are in Kenyan Shillings (KES). Prices, stock, flash-sale offers and bulk (quantity) prices can change at any time; the price shown when you pay is the price you are charged. Flash-sale prices apply only while the sale is running, and where both a flash-sale price and a bulk price apply you get the lower one. Product pictures are for illustration and packaging may vary slightly.'
  ]},
  { title: '4. Orders and payment', body: [
    'Payment is made by M-Pesa STK push, processed by PayHero. An order is confirmed only after your payment is received and verified. If you do not complete the M-Pesa prompt, the order stays unpaid and may be cancelled.',
    'Always keep your M-Pesa confirmation message. If you were charged but your order shows unpaid, contact customer care with your M-Pesa receipt and we will resolve it.'
  ]},
  { title: '5. Delivery', body: [
    'We deliver across Kenya. A delivery fee based on your county is added at checkout. Delivery times are estimates and can be affected by distance, weather and road conditions. You must give a complete, correct delivery address and be reachable on your phone; we are not responsible for delays or failed deliveries caused by wrong or incomplete details.'
  ]},
  { title: '6. Inspection, returns and refunds', body: [
    'Please inspect your rice on delivery. Report a damaged, wrong or short-weight order to customer care as soon as possible, ideally within 24 hours, with photos where you can. Where the problem is confirmed we will replace the item or refund you. Opened food products that are in good condition cannot normally be returned.'
  ]},
  { title: '6a. Reviews', body: [
    'Only customers who have bought and paid for a product can review it. Reviews must be honest and respectful. We may hide reviews that are abusive, misleading, contain personal details or are unrelated to the product. Your first name and the initial of your last name are shown with your review.'
  ]},
  { title: '7. Reward points', body: [
    'You may earn reward points on paid orders. Points have no cash value, cannot be transferred and can be corrected or removed if they were earned by mistake or through misuse of the Service.'
  ]},
  { title: '8. Referral codes and agents', body: [
    'You may enter an agent\'s referral code when you sign up or order. Once a code is linked to your account it stays linked. Using a code does not change the price you pay. Agents earn commission from us; it is never charged to you.',
    'Agents must not mislead customers, make false claims about our products or use another person\'s code or details. We may withdraw an agent\'s role and unpaid commission where these rules are broken.'
  ]},
  { title: '9. Acceptable use', body: [
    'You must not misuse the Service: no fraud, no attempts to break into accounts or systems, no automated scraping or abuse of verification codes, and no use that harms other customers or us.'
  ]},
  { title: '10. Your personal data', body: [
    'We collect your name, phone number, email (if given), delivery details, order and payment records, and the technical information needed to keep the Service secure (such as IP address and sign-in activity). We use it to run your account, process and deliver orders, send verification codes and order messages, prevent fraud and improve the Service.',
    'We share only what is needed with our payment provider (PayHero/M-Pesa), our SMS provider and delivery partners. We do not sell your personal data. Customer care staff can see your account and order details to help you. Under the Kenya Data Protection Act, 2019 you may ask to see, correct or delete your personal data by contacting us.'
  ]},
  { title: '11. Messages', body: [
    'By registering you agree that we may send you SMS or email messages about verification codes, orders, payments and delivery. We may also send occasional promotional offers by SMS. Every promotional message contains an opt-out link, and you can switch promotions off at any time in your account; you will still receive order, payment and security messages.'
  ]},
  { title: '12. Our responsibility', body: [
    'We take care to deliver safe, good quality rice, but to the extent allowed by law we are not liable for indirect losses, or for delays or failures outside our reasonable control, including network, M-Pesa or courier outages. Nothing in these terms limits rights you have under Kenyan consumer protection law.'
  ]},
  { title: '13. Changes to these terms', body: [
    'We may update these terms. The current version is shown here with its version number. If we make an important change we will ask you to accept it again; continuing to use the Service after a change means you accept the updated terms.'
  ]},
  { title: '14. Governing law and contact', body: [
    'These terms are governed by the laws of Kenya. For questions, complaints or data requests, contact Mwea Rice Hub at mweadirectrice@gmail.com.'
  ]}
];

function TermsModal({ onClose, onAccept }: { onClose: () => void; onAccept?: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Terms and Conditions">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900">Terms and Conditions</h3>
            <p className="text-[11px] text-slate-500">Mwea Rice Hub · version {TERMS_VERSION}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-4 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
          {TERMS_SECTIONS.map(sec => (
            <section key={sec.title}>
              <h4 className="font-black text-slate-900 mb-1">{sec.title}</h4>
              {sec.body.map((p, i) => <p key={i} className="mb-1.5">{p}</p>)}
            </section>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer">Close</button>
          {onAccept && <button type="button" onClick={onAccept} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer">I have read and accept</button>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// OPERATIONS SCREENS: reports, stock & suppliers, expenses, campaigns, reviews, system
// ============================================================================
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const rangePresets = () => {
  const now = new Date();
  const daysAgo = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
  return [
    { label: 'Today', from: ymd(now), to: ymd(now) },
    { label: '7 days', from: ymd(daysAgo(6)), to: ymd(now) },
    { label: '30 days', from: ymd(daysAgo(29)), to: ymd(now) },
    { label: 'This month', from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) },
    { label: 'Last month', from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)) },
    { label: 'This year', from: ymd(new Date(now.getFullYear(), 0, 1)), to: ymd(now) }
  ];
};

const downloadExcel = async (type: string, from: string, to: string, token: string | null, showToast: ToastFn) => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/export/${type}?from=${from}&to=${to}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Export failed'); }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${type}-${to}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast('Excel file downloaded.', 'success');
  } catch (err: any) { showToast(err.message, 'error'); }
};

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white';
const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1';
const cardCls = 'bg-slate-900 rounded-3xl border border-slate-800';

const DateRange = ({ from, to, onChange }: { from: string; to: string; onChange: (f: string, t: string) => void }) => (
  <div className="flex flex-wrap items-center gap-2">
    {rangePresets().map(p => (
      <button key={p.label} onClick={() => onChange(p.from, p.to)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${from === p.from && to === p.to ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{p.label}</button>
    ))}
    <input type="date" value={from} onChange={(e) => onChange(e.target.value, to)} className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-white" />
    <span className="text-slate-500 text-xs">to</span>
    <input type="date" value={to} onChange={(e) => onChange(from, e.target.value)} className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-white" />
  </div>
);

// ---------------------------------------------------------------------------
// PROFIT REPORTS & EXCEL EXPORTS
// ---------------------------------------------------------------------------
function AdminReportsPanel({ token, showToast }: { token: string | null; showToast: ToastFn }) {
  const p30 = rangePresets()[2];
  const [from, setFrom] = useState(p30.from);
  const [to, setTo] = useState(p30.to);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<'byProduct' | 'byCounty' | 'byAgent' | 'byMonth' | 'byDay'>('byProduct');

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await staffApi(`/admin/reports/profit?from=${from}&to=${to}`, token)); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setLoading(false); }
  }, [token, from, to]);
  useEffect(() => { load(); }, [load]);

  const t = data?.totals;
  const rows: any[] = data ? data[group] : [];
  const maxProfit = Math.max(1, ...rows.map(r => Math.abs(r.profit)));
  const groupLabels: Record<string, string> = { byProduct: 'Product', byCounty: 'County', byAgent: 'Agent', byMonth: 'Month', byDay: 'Day' };

  return (
    <div className="space-y-6">
      <div className={`${cardCls} p-5 space-y-4`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-400" /> Profit reports</h3>
            <p className="text-[11px] text-slate-500">Based on paid orders and the buying prices recorded when each order was placed.</p>
          </div>
          <DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt); }} />
        </div>
        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-800">
          <span className="text-[10px] font-black uppercase text-slate-500 self-center mr-1">Download Excel:</span>
          {[['orders', 'Orders'], ['customers', 'Customers'], ['finances', 'Finances (profit, expenses, commissions)'], ['stock', 'Stock']].map(([k, label]) => (
            <button key={k} onClick={() => downloadExcel(k, from, to, token, showToast)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"><Download className="w-3.5 h-3.5" /> {label}</button>
          ))}
        </div>
      </div>

      {loading && !data && <p className="text-xs text-slate-500 font-bold">Calculating…</p>}
      {t && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StaffStat label="Rice sales" value={formatKES(t.riceRevenue)} hint={`${t.orders} paid orders · ${t.kg} kg`} />
            <StaffStat label="Cost of rice sold" value={formatKES(t.costOfGoods)} tone="amber" />
            <StaffStat label="Gross profit" value={formatKES(t.grossProfit)} tone="emerald" hint={`${data.margin}% margin`} />
            <StaffStat label="Delivery fees collected" value={formatKES(t.deliveryIncome)} tone="sky" />
            <StaffStat label="Agent commissions" value={formatKES(t.commissions)} tone="amber" />
            <StaffStat label="Expenses" value={formatKES(t.expenses)} tone="amber" />
            <StaffStat label="Net profit" value={formatKES(t.netProfit)} tone={t.netProfit >= 0 ? 'emerald' : 'rose'} hint="gross + delivery − commissions − expenses" />
            <StaffStat label="Average per order" value={formatKES(t.orders ? t.netProfit / t.orders : 0)} />
          </div>

          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-3 flex flex-wrap gap-2 border-b border-slate-800">
              {(Object.keys(groupLabels) as Array<keyof typeof groupLabels>).map(k => (
                <button key={k} onClick={() => setGroup(k as any)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${group === k ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>By {groupLabels[k].toLowerCase()}</button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-black"><tr><th className="p-3">{groupLabels[group]}</th><th className="p-3 text-right">Orders</th><th className="p-3 text-right">Kg</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right">Cost</th><th className="p-3 text-right">Profit</th><th className="p-3 text-right">Margin</th>{group === 'byAgent' && <th className="p-3 text-right">Commission</th>}{group === 'byAgent' && <th className="p-3 text-right">After commission</th>}<th className="p-3 w-32"></th></tr></thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rows.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-slate-500 font-bold">No paid orders in this period.</td></tr>}
                  {rows.map((r: any) => (
                    <tr key={r.key} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">{r.label}</td>
                      <td className="p-3 text-right">{r.orders}</td><td className="p-3 text-right">{r.kg}</td>
                      <td className="p-3 text-right">{formatKES(r.revenue)}</td><td className="p-3 text-right text-slate-400">{formatKES(r.cost)}</td>
                      <td className={`p-3 text-right font-black ${r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatKES(r.profit)}</td>
                      <td className="p-3 text-right">{r.margin}%</td>
                      {group === 'byAgent' && <td className="p-3 text-right text-amber-400">{formatKES(r.commission)}</td>}
                      {group === 'byAgent' && <td className="p-3 text-right font-bold">{formatKES(r.net)}</td>}
                      <td className="p-3"><div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full rounded-full ${r.profit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.max(2, (Math.abs(r.profit) / maxProfit) * 100)}%` }} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {Object.keys(data.expenseByCategory).length > 0 && (
            <div className={`${cardCls} p-5`}>
              <p className="text-xs font-black text-white mb-3">Where the money went (expenses)</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(data.expenseByCategory).map(([c, v]: any) => (
                  <div key={c} className="p-3 rounded-xl bg-slate-950 border border-slate-800"><p className="text-[10px] font-black uppercase text-slate-500">{String(c).replace('_', ' ')}</p><p className="text-sm font-black text-amber-400">{formatKES(v)}</p></div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STOCK, SUPPLIERS, PURCHASES, BULK PRICING
// ---------------------------------------------------------------------------
function StockLevelsView({ token, showToast, onRecordPurchase }: { token: string | null; showToast: ToastFn; onRecordPurchase: (productId: number) => void }) {
  const [data, setData] = useState<any>(null);
  const [defaultLevel, setDefaultLevel] = useState('20');
  const load = useCallback(async () => {
    try { const d = await staffApi('/admin/stock/overview', token); setData(d); setDefaultLevel(String(d.defaultThreshold)); }
    catch (err: any) { showToast(err.message, 'error'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const saveDefault = async () => {
    try { await staffApi('/admin/stock/thresholds', token, { method: 'PUT', body: { defaultThreshold: Number(defaultLevel) } }); showToast('Default alert level saved.', 'success'); load(); }
    catch (err: any) { showToast(err.message, 'error'); }
  };
  const saveOne = async (productId: number, value: string) => {
    try { await staffApi('/admin/stock/thresholds', token, { method: 'PUT', body: { productId, threshold: value === '' ? null : Number(value) } }); load(); }
    catch (err: any) { showToast(err.message, 'error'); }
  };
  if (!data) return <p className="text-xs text-slate-500 font-bold">Loading stock…</p>;
  const pill: Record<string, string> = { ok: 'bg-emerald-950 text-emerald-300 border-emerald-800', low: 'bg-amber-950 text-amber-300 border-amber-800', out: 'bg-rose-950 text-rose-300 border-rose-800' };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StaffStat label="Products needing restock" value={data.lowCount} tone={data.lowCount ? 'rose' : 'emerald'} />
        <StaffStat label="Stock value (at cost)" value={formatKES(data.stockValue)} />
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 col-span-2">
          <p className={labelCls}>Alert me when a product has this many bags or fewer</p>
          <div className="flex gap-2"><input type="number" min={0} value={defaultLevel} onChange={(e) => setDefaultLevel(e.target.value)} className={inputCls} /><button onClick={saveDefault} className="px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer">Save</button></div>
        </div>
      </div>
      <div className={`${cardCls} overflow-x-auto`}>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase font-black"><tr><th className="p-3">Product</th><th className="p-3 text-right">In stock</th><th className="p-3">Status</th><th className="p-3 text-right">Alert at</th><th className="p-3 text-right">Sold (30d)</th><th className="p-3 text-right">Lasts about</th><th className="p-3 text-right">Buying price</th><th className="p-3">Last purchase</th><th className="p-3"></th></tr></thead>
          <tbody className="divide-y divide-slate-800/60">
            {data.products.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-800/40">
                <td className="p-3 font-bold text-white">{p.name} <span className="text-slate-500 font-medium">{p.weightKg}kg</span></td>
                <td className="p-3 text-right font-black">{p.stock}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${pill[p.state]}`}>{p.state === 'ok' ? 'OK' : p.state === 'low' ? 'Low' : 'Out'}</span></td>
                <td className="p-3 text-right"><input type="number" min={0} defaultValue={p.customThreshold ? p.threshold : ''} placeholder={String(p.threshold)} onBlur={(e) => { if (e.target.value !== String(p.customThreshold ? p.threshold : '')) saveOne(p.id, e.target.value); }} className="w-16 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-right text-xs text-white" /></td>
                <td className="p-3 text-right">{p.sold30}</td>
                <td className="p-3 text-right text-slate-300">{p.daysLeft === null ? '—' : `${p.daysLeft} days`}</td>
                <td className="p-3 text-right">{formatKES(p.buyingPrice)}</td>
                <td className="p-3 text-slate-400">{p.lastPurchase ? `${p.lastPurchase.date} @ ${formatKES(p.lastPurchase.unitCost)}` : '—'}</td>
                <td className="p-3 text-right"><button onClick={() => onRecordPurchase(p.id)} className="px-2.5 py-1.5 rounded-lg bg-sky-800 hover:bg-sky-700 text-white text-[10px] font-extrabold cursor-pointer">Record purchase</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-500">Leave “Alert at” empty to use the default. You get a warning on this page (and in Live Activity) the first time a product drops to its level, then again after 12 hours if it is still low.</p>
    </div>
  );
}

function SuppliersView({ token, showToast }: { token: string | null; showToast: ToastFn }) {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ name: '', type: 'farmer', phone: '', location: '', notes: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<any>(null);
  const load = useCallback(async () => { try { setList(await staffApi('/admin/suppliers', token)); } catch (err: any) { showToast(err.message, 'error'); } }, [token]);
  useEffect(() => { load(); }, [load]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await staffApi(editId ? `/admin/suppliers/${editId}` : '/admin/suppliers', token, { method: editId ? 'PUT' : 'POST', body: form });
      showToast(editId ? 'Supplier updated.' : 'Supplier added.', 'success');
      setForm({ name: '', type: 'farmer', phone: '', location: '', notes: '' }); setEditId(null); load();
    } catch (err: any) { showToast(err.message, 'error'); }
  };
  const openLedger = async (id: number) => { try { setLedger(await staffApi(`/admin/suppliers/${id}`, token)); } catch (err: any) { showToast(err.message, 'error'); } };
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
      <form onSubmit={save} className={`${cardCls} p-5 space-y-3`}>
        <p className="text-xs font-black text-white">{editId ? 'Edit supplier' : 'Add a supplier'}</p>
        <div><label className={labelCls}>Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="e.g. Mwea Millers Co-op" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}><option value="farmer">Farmer</option><option value="miller">Miller</option><option value="transporter">Transporter</option><option value="other">Other</option></select></div>
          <div><label className={labelCls}>Phone</label><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Location</label><input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} /></div>
        <div><label className={labelCls}>Notes</label><input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} /></div>
        <div className="flex gap-2"><button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer">{editId ? 'Save changes' : 'Add supplier'}</button>{editId && <button type="button" onClick={() => { setEditId(null); setForm({ name: '', type: 'farmer', phone: '', location: '', notes: '' }); }} className="px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer">Cancel</button>}</div>
      </form>
      <div className={`xl:col-span-2 ${cardCls} overflow-x-auto`}>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase font-black"><tr><th className="p-3">Supplier</th><th className="p-3">Type</th><th className="p-3 text-right">Bought</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">We owe</th><th className="p-3">Last</th><th className="p-3"></th></tr></thead>
          <tbody className="divide-y divide-slate-800/60">
            {list.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-500 font-bold">No suppliers yet.</td></tr>}
            {list.map(x => (
              <tr key={x.id} className="hover:bg-slate-800/40">
                <td className="p-3"><p className="font-bold text-white">{x.name}</p><p className="text-[10px] text-slate-500">{x.phone} {x.location ? `· ${x.location}` : ''}</p></td>
                <td className="p-3 capitalize">{x.type}</td>
                <td className="p-3 text-right">{formatKES(x.totalPurchased)}</td><td className="p-3 text-right text-emerald-400">{formatKES(x.totalPaid)}</td>
                <td className={`p-3 text-right font-black ${x.owed > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{formatKES(x.owed)}</td>
                <td className="p-3 text-slate-400">{x.lastPurchase || '—'}</td>
                <td className="p-3 text-right whitespace-nowrap"><button onClick={() => openLedger(x.id)} className="p-1.5 text-slate-400 hover:text-emerald-400 cursor-pointer" title="Ledger"><Eye className="w-4 h-4" /></button><button onClick={() => { setEditId(x.id); setForm({ name: x.name, type: x.type, phone: x.phone, location: x.location, notes: x.notes }); }} className="p-1.5 text-slate-400 hover:text-sky-400 cursor-pointer" title="Edit"><Edit className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ledger && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-3xl my-8 space-y-4">
            <div className="flex justify-between items-start"><div><h3 className="text-lg font-black text-white">{ledger.supplier.name}</h3><p className="text-xs text-slate-400">Bought {formatKES(ledger.totalPurchased)} · Paid {formatKES(ledger.totalPaid)} · <span className="text-amber-400 font-black">Owed {formatKES(ledger.owed)}</span></p></div><button onClick={() => setLedger(null)} className="p-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"><X className="w-4 h-4" /></button></div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-2xl border border-slate-800"><table className="w-full text-left text-xs"><thead className="bg-slate-950 text-slate-400 uppercase font-black"><tr><th className="p-3">Date</th><th className="p-3">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Paid</th></tr></thead>
              <tbody className="divide-y divide-slate-800/60">{ledger.purchases.map((p: any) => <tr key={p.id}><td className="p-3 text-slate-400">{p.purchaseDate}</td><td className="p-3 text-white font-bold">{p.itemName}</td><td className="p-3 text-right">{p.quantity}</td><td className="p-3 text-right">{formatKES(Number(p.totalCost))}</td><td className="p-3 text-right text-emerald-400">{formatKES(Number(p.amountPaid))}</td></tr>)}</tbody></table></div>
          </div>
        </div>
      )}
    </div>
  );
}

function PurchasesView({ token, showToast, presetProductId, onStockChanged }: { token: string | null; showToast: ToastFn; presetProductId: number | null; onStockChanged: () => void }) {
  const p30 = rangePresets()[2];
  const [from, setFrom] = useState(p30.from);
  const [to, setTo] = useState(p30.to);
  const [data, setData] = useState<any>({ purchases: [], totals: { spent: 0, paid: 0, owed: 0 } });
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const blank = { supplierId: '', productId: presetProductId ? String(presetProductId) : '', itemName: '', quantity: '', unitCost: '', amountPaid: '', paymentMethod: 'mpesa', reference: '', purchaseDate: ymd(new Date()), notes: '', addToStock: true, updateBuyingPrice: true };
  const [form, setForm] = useState<any>(blank);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s, st] = await Promise.all([staffApi(`/admin/purchases?from=${from}&to=${to}`, token), staffApi('/admin/suppliers', token), staffApi('/admin/stock/overview', token)]);
      setData(p); setSuppliers(s); setProducts(st.products);
    } catch (err: any) { showToast(err.message, 'error'); }
  }, [token, from, to]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (presetProductId) setForm((f: any) => ({ ...f, productId: String(presetProductId) })); }, [presetProductId]);

  const total = (Number(form.quantity) || 0) * (Number(form.unitCost) || 0);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { ...form, supplierId: form.supplierId ? Number(form.supplierId) : null, productId: form.productId ? Number(form.productId) : null, quantity: Number(form.quantity), unitCost: Number(form.unitCost), amountPaid: Number(form.amountPaid) || 0 };
      const r = await staffApi('/admin/purchases', token, { method: 'POST', body });
      showToast(r.message, 'success'); setForm({ ...blank, productId: '' }); load(); onStockChanged();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };
  const payBalance = async (p: any) => {
    const v = prompt(`How much are you paying now? (KES ${p.owed} is still owed)`, String(p.owed));
    if (!v) return;
    try { const r = await staffApi(`/admin/purchases/${p.id}/payment`, token, { method: 'POST', body: { amount: Number(v) } }); showToast(r.message, 'success'); load(); }
    catch (err: any) { showToast(err.message, 'error'); }
  };
  return (
    <div className="space-y-5">
      <form onSubmit={save} className={`${cardCls} p-5 space-y-3`}>
        <p className="text-xs font-black text-white flex items-center gap-2"><Package className="w-4 h-4 text-emerald-400" /> Record a purchase (what you buy from farmers or millers)</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div><label className={labelCls}>Supplier</label><select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className={inputCls}><option value="">— none —</option>{suppliers.filter(s => s.isActive).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className={labelCls}>Product (to add stock to)</label><select value={form.productId} onChange={(e) => { const pr = products.find(x => String(x.id) === e.target.value); setForm({ ...form, productId: e.target.value, itemName: pr ? pr.name : form.itemName }); }} className={inputCls}><option value="">— not a product —</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock})</option>)}</select></div>
          <div><label className={labelCls}>What was bought *</label><input required value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} className={inputCls} placeholder="e.g. Pishori 50kg sacks" /></div>
          <div><label className={labelCls}>Date</label><input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Bags / units *</label><input required type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Cost per bag (KES) *</label><input required type="number" min={0} step="0.01" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Paid so far (KES)</label><input type="number" min={0} step="0.01" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} className={inputCls} placeholder={String(total || 0)} /></div>
          <div><label className={labelCls}>Reference</label><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputCls} placeholder="M-Pesa code / receipt" /></div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.addToStock} disabled={!form.productId} onChange={(e) => setForm({ ...form, addToStock: e.target.checked })} className="accent-emerald-500" /> Add these bags to the product&apos;s stock</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.updateBuyingPrice} disabled={!form.productId || !form.addToStock} onChange={(e) => setForm({ ...form, updateBuyingPrice: e.target.checked })} className="accent-emerald-500" /> Update the product&apos;s buying price (average of old and new stock)</label>
          <span className="ml-auto font-black text-white">Total: {formatKES(total)}</span>
          <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold cursor-pointer">Save purchase</button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3"><DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <p className="text-xs text-slate-400">Spent <b className="text-white">{formatKES(data.totals.spent)}</b> · Paid <b className="text-emerald-400">{formatKES(data.totals.paid)}</b> · Still owed <b className="text-amber-400">{formatKES(data.totals.owed)}</b></p></div>
      <div className={`${cardCls} overflow-x-auto`}>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase font-black"><tr><th className="p-3">Date</th><th className="p-3">Supplier</th><th className="p-3">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Unit</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Owed</th><th className="p-3">Stock</th><th className="p-3"></th></tr></thead>
          <tbody className="divide-y divide-slate-800/60">
            {data.purchases.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-500 font-bold">No purchases in this period.</td></tr>}
            {data.purchases.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-800/40"><td className="p-3 text-slate-400 whitespace-nowrap">{p.purchaseDate}</td><td className="p-3">{p.supplierName}</td><td className="p-3 font-bold text-white">{p.itemName}</td><td className="p-3 text-right">{p.quantity}</td><td className="p-3 text-right">{formatKES(p.unitCost)}</td><td className="p-3 text-right font-bold">{formatKES(p.totalCost)}</td>
                <td className={`p-3 text-right font-black ${p.owed > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{formatKES(p.owed)}</td><td className="p-3">{p.addedToStock ? <span className="text-emerald-400 font-bold">Added</span> : <span className="text-slate-500">—</span>}</td>
                <td className="p-3 text-right">{p.owed > 0 && <button onClick={() => payBalance(p)} className="px-2.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-extrabold cursor-pointer">Pay balance</button>}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkPricingView({ token, showToast }: { token: string | null; showToast: ToastFn }) {
  const [products, setProducts] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<number, { minQty: string; price: string }[]>>({});
  const load = useCallback(async () => {
    try {
      const list = await staffApi('/admin/wholesale', token);
      setProducts(list);
      const d: Record<number, { minQty: string; price: string }[]> = {};
      list.forEach((p: any) => { d[p.id] = (p.tiers || []).map((t: any) => ({ minQty: String(t.minQty), price: String(t.price) })); });
      setDrafts(d);
    } catch (err: any) { showToast(err.message, 'error'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const save = async (p: any, force = false) => {
    try {
      const tiers = (drafts[p.id] || []).filter(t => t.minQty && t.price).map(t => ({ minQty: Number(t.minQty), price: Number(t.price) }));
      const r = await staffApi(`/admin/products/${p.id}/wholesale-tiers`, token, { method: 'PUT', body: { tiers, force } });
      showToast(r.message, 'success'); load();
    } catch (err: any) {
      if (err.message.includes('below your buying price') && confirm(`${err.message}\n\nSave anyway?`)) return save(p, true);
      showToast(err.message, 'error');
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">Give hotels, schools and shops a lower price per bag when they buy many. The best price wins automatically at checkout (it never stacks with the flash sale price). Customers see the bulk prices on the product and in their cart.</p>
      {products.map(p => (
        <div key={p.id} className={`${cardCls} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div><p className="text-sm font-black text-white">{p.name} <span className="text-slate-500 font-medium">{p.weightKg}kg</span></p><p className="text-[11px] text-slate-400">Normal price {formatKES(p.price)} · Your buying price {formatKES(p.buyingPrice)}</p></div>
            <button onClick={() => save(p)} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer">Save bulk prices</button>
          </div>
          <div className="space-y-2">
            {(drafts[p.id] || []).map((t, i) => {
              const price = Number(t.price);
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-400">Buy</span><input type="number" min={2} value={t.minQty} onChange={(e) => setDrafts(d => ({ ...d, [p.id]: d[p.id].map((x, j) => j === i ? { ...x, minQty: e.target.value } : x) }))} className="w-20 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white" />
                  <span className="text-slate-400">or more bags — each at KES</span><input type="number" min={1} value={t.price} onChange={(e) => setDrafts(d => ({ ...d, [p.id]: d[p.id].map((x, j) => j === i ? { ...x, price: e.target.value } : x) }))} className="w-28 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white" />
                  {price > 0 && p.price > 0 && <span className="text-emerald-400 font-bold">{Math.round((1 - price / p.price) * 100)}% off</span>}
                  {price > 0 && p.buyingPrice > 0 && <span className={`font-bold ${price < p.buyingPrice ? 'text-rose-400' : 'text-slate-400'}`}>profit/bag {formatKES(price - p.buyingPrice)}</span>}
                  <button onClick={() => setDrafts(d => ({ ...d, [p.id]: d[p.id].filter((_, j) => j !== i) }))} className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
            {(drafts[p.id] || []).length < 5 && <button onClick={() => setDrafts(d => ({ ...d, [p.id]: [...(d[p.id] || []), { minQty: '', price: '' }] }))} className="text-[11px] font-bold text-sky-400 hover:underline cursor-pointer">+ Add a bulk price</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminStockPanel({ token, showToast }: { token: string | null; showToast: ToastFn }) {
  const [tab, setTab] = useState<'levels' | 'purchases' | 'suppliers' | 'bulk'>('levels');
  const [presetProduct, setPresetProduct] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {([['levels', 'Stock levels & alerts'], ['purchases', 'Purchases'], ['suppliers', 'Suppliers'], ['bulk', 'Bulk (wholesale) prices']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${tab === id ? 'bg-emerald-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}>{label}</button>
        ))}
      </div>
      {tab === 'levels' && <StockLevelsView key={refresh} token={token} showToast={showToast} onRecordPurchase={(id) => { setPresetProduct(id); setTab('purchases'); }} />}
      {tab === 'purchases' && <PurchasesView token={token} showToast={showToast} presetProductId={presetProduct} onStockChanged={() => setRefresh(r => r + 1)} />}
      {tab === 'suppliers' && <SuppliersView token={token} showToast={showToast} />}
      {tab === 'bulk' && <BulkPricingView token={token} showToast={showToast} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EXPENSES
// ---------------------------------------------------------------------------
function AdminExpensesPanel({ token, showToast }: { token: string | null; showToast: ToastFn }) {
  const p30 = rangePresets()[3];
  const [from, setFrom] = useState(p30.from);
  const [to, setTo] = useState(p30.to);
  const [category, setCategory] = useState('all');
  const [data, setData] = useState<any>({ expenses: [], total: 0, byCategory: {}, byMonth: {}, categories: [] });
  const blank = { category: 'transport', amount: '', description: '', reference: '', expenseDate: ymd(new Date()) };
  const [form, setForm] = useState<any>(blank);
  const [editId, setEditId] = useState<number | null>(null);
  const load = useCallback(async () => {
    try { setData(await staffApi(`/admin/expenses?from=${from}&to=${to}${category !== 'all' ? `&category=${category}` : ''}`, token)); }
    catch (err: any) { showToast(err.message, 'error'); }
  }, [token, from, to, category]);
  useEffect(() => { load(); }, [load]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await staffApi(editId ? `/admin/expenses/${editId}` : '/admin/expenses', token, { method: editId ? 'PUT' : 'POST', body: { ...form, amount: Number(form.amount) } });
      showToast(editId ? 'Expense updated.' : 'Expense recorded.', 'success'); setForm(blank); setEditId(null); load();
    } catch (err: any) { showToast(err.message, 'error'); }
  };
  const del = async (x: any) => {
    if (!confirm(`Delete this ${x.category} expense of ${formatKES(x.amount)}? This is recorded in the activity log.`)) return;
    try { await staffApi(`/admin/expenses/${x.id}`, token, { method: 'DELETE' }); showToast('Expense deleted.', 'success'); load(); } catch (err: any) { showToast(err.message, 'error'); }
  };
  const cats: string[] = data.categories || [];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <form onSubmit={save} className={`${cardCls} p-5 space-y-3`}>
          <p className="text-xs font-black text-white flex items-center gap-2"><Wallet className="w-4 h-4 text-amber-400" /> {editId ? 'Edit expense' : 'Record an expense'}</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>{cats.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}</select></div>
            <div><label className={labelCls}>Amount (KES)</label><input required type="number" min={1} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>What was it for?</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} placeholder="e.g. Lorry to Mombasa, 200 packaging bags" /></div>
          <div className="grid grid-cols-2 gap-2"><div><label className={labelCls}>Date</label><input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className={inputCls} /></div><div><label className={labelCls}>Reference</label><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputCls} /></div></div>
          <div className="flex gap-2"><button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer">{editId ? 'Save changes' : 'Record expense'}</button>{editId && <button type="button" onClick={() => { setEditId(null); setForm(blank); }} className="px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer">Cancel</button>}</div>
          <p className="text-[10px] text-slate-500">Don&apos;t record rice you buy here — use Stock &amp; Suppliers → Purchases. Expenses are for running costs and reduce your net profit.</p>
        </form>
        <div className="xl:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-white cursor-pointer"><option value="all">All categories</option>{cats.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}</select></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StaffStat label="Total expenses" value={formatKES(data.total)} tone="amber" />
            {Object.entries(data.byCategory).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3).map(([c, v]: any) => <StaffStat key={c} label={String(c).replace('_', ' ')} value={formatKES(v)} />)}
          </div>
          <div className={`${cardCls} overflow-x-auto`}>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-black"><tr><th className="p-3">Date</th><th className="p-3">Category</th><th className="p-3">Details</th><th className="p-3 text-right">Amount</th><th className="p-3"></th></tr></thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.expenses.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500 font-bold">No expenses in this period.</td></tr>}
                {data.expenses.map((x: any) => (
                  <tr key={x.id} className="hover:bg-slate-800/40"><td className="p-3 text-slate-400 whitespace-nowrap">{x.expenseDate}</td><td className="p-3 capitalize font-bold text-white">{x.category.replace('_', ' ')}</td><td className="p-3 text-slate-300">{x.description || '—'}{x.reference && <span className="block text-[10px] font-mono text-slate-500">{x.reference}</span>}</td><td className="p-3 text-right font-black text-amber-400">{formatKES(x.amount)}</td>
                    <td className="p-3 text-right whitespace-nowrap"><button onClick={() => { setEditId(x.id); setForm({ category: x.category, amount: String(x.amount), description: x.description || '', reference: x.reference || '', expenseDate: x.expenseDate }); }} className="p-1.5 text-slate-400 hover:text-sky-400 cursor-pointer"><Edit className="w-4 h-4" /></button><button onClick={() => del(x)} className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"><Trash2 className="w-4 h-4" /></button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CUSTOMER SEGMENTS & SMS CAMPAIGNS
// ---------------------------------------------------------------------------
function AdminCampaignsPanel({ token, showToast }: { token: string | null; showToast: ToastFn }) {
  const blankF = { counties: [] as string[], minOrders: '', maxOrders: '', minSpent: '', inactiveDays: '', joinedWithinDays: '', neverOrdered: false, referredOnly: false, boughtProductIds: [] as number[] };
  const [f, setF] = useState<any>(blankF);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [confirmText, setConfirmText] = useState('');
  const [allowQuiet, setAllowQuiet] = useState(false);
  const [footerLink, setFooterLink] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [history, setHistory] = useState<any>({ campaigns: [], optOuts: 0, balance: null, running: false });
  const [products, setProducts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => { try { setHistory(await staffApi('/admin/campaigns', token)); } catch (_) { /* ignore */ } }, [token]);
  useEffect(() => { loadHistory(); staffApi('/admin/wholesale', token).then(setProducts).catch(() => {}); }, [loadHistory, token]);
  useEffect(() => { if (!history.running && !history.campaigns.some((c: any) => c.status === 'sending')) return; const t = setInterval(loadHistory, 4000); return () => clearInterval(t); }, [history, loadHistory]);

  const filterBody = () => ({ ...f, minOrders: f.minOrders === '' ? null : Number(f.minOrders), maxOrders: f.maxOrders === '' ? null : Number(f.maxOrders), minSpent: f.minSpent === '' ? null : Number(f.minSpent), inactiveDays: f.inactiveDays === '' ? null : Number(f.inactiveDays), joinedWithinDays: f.joinedWithinDays === '' ? null : Number(f.joinedWithinDays) });
  const runPreview = async () => {
    setBusy(true);
    try { setPreview(await staffApi('/admin/campaigns/preview', token, { method: 'POST', body: { message, filters: filterBody() } })); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };
  const send = async () => {
    setBusy(true);
    try {
      const r = await staffApi('/admin/campaigns', token, { method: 'POST', body: { name, message, filters: filterBody(), confirm: confirmText, allowQuietHours: allowQuiet, footerLink } });
      showToast(r.message, 'success'); setConfirmText(''); setPreview(null); setMessage(''); setName(''); loadHistory();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };
  const sendTest = async () => {
    setBusy(true); setTestResult(null);
    try { setTestResult(await staffApi('/admin/sms/test', token, { method: 'POST', body: { message, promo: true, footerLink, phone: testPhone || undefined } })); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };
  const stop = async (id: number) => { try { await staffApi(`/admin/campaigns/${id}/stop`, token, { method: 'POST' }); showToast('Stopping…', 'info'); loadHistory(); } catch (err: any) { showToast(err.message, 'error'); } };
  const toggleCounty = (c: string) => setF((x: any) => ({ ...x, counties: x.counties.includes(c) ? x.counties.filter((y: string) => y !== c) : [...x.counties, c] }));
  const presets: { label: string; apply: any }[] = [
    { label: 'Everyone', apply: blankF },
    { label: 'Never ordered', apply: { ...blankF, neverOrdered: true } },
    { label: 'Repeat buyers (2+ orders)', apply: { ...blankF, minOrders: '2' } },
    { label: 'Big spenders (KES 10,000+)', apply: { ...blankF, minSpent: '10000' } },
    { label: 'Haven\'t ordered in 60 days', apply: { ...blankF, inactiveDays: '60' } },
    { label: 'Joined in the last 14 days', apply: { ...blankF, joinedWithinDays: '14' } }
  ];
  const parts = smsPartsOf(message);
  const statusPill: Record<string, string> = { sending: 'bg-sky-950 text-sky-300 border-sky-800', sent: 'bg-emerald-950 text-emerald-300 border-emerald-800', failed: 'bg-rose-950 text-rose-300 border-rose-800', stopped: 'bg-amber-950 text-amber-300 border-amber-800' };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StaffStat label="SMS credit" value={history.balance === null ? 'Unknown' : history.balance} tone={history.balance !== null && history.balance < 10 ? 'rose' : 'emerald'} hint="Updates after each SMS sent" />
        <StaffStat label="Opted out of promotions" value={history.optOuts} hint="Never messaged again" />
        <StaffStat label="Campaigns sent" value={history.campaigns.filter((c: any) => c.status === 'sent').length} />
        <StaffStat label="Status" value={history.running ? 'Sending…' : 'Idle'} tone={history.running ? 'sky' : 'slate'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <div className={`${cardCls} p-5 space-y-4`}>
          <p className="text-xs font-black text-white flex items-center gap-2"><Users className="w-4 h-4 text-sky-400" /> 1 · Choose who gets it</p>
          <div className="flex flex-wrap gap-2">{presets.map(p => <button key={p.label} onClick={() => { setF(p.apply); setPreview(null); }} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer">{p.label}</button>)}</div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><label className={labelCls}>At least this many orders</label><input type="number" min={0} value={f.minOrders} onChange={(e) => setF({ ...f, minOrders: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>At most this many orders</label><input type="number" min={0} value={f.maxOrders} onChange={(e) => setF({ ...f, maxOrders: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Spent at least (KES)</label><input type="number" min={0} value={f.minSpent} onChange={(e) => setF({ ...f, minSpent: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Last order older than (days)</label><input type="number" min={0} value={f.inactiveDays} onChange={(e) => setF({ ...f, inactiveDays: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Joined within (days)</label><input type="number" min={0} value={f.joinedWithinDays} onChange={(e) => setF({ ...f, joinedWithinDays: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Bought this rice</label><select value={f.boughtProductIds[0] || ''} onChange={(e) => setF({ ...f, boughtProductIds: e.target.value ? [Number(e.target.value)] : [] })} className={inputCls}><option value="">Any</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.neverOrdered} onChange={(e) => setF({ ...f, neverOrdered: e.target.checked })} className="accent-emerald-500" /> Never paid for an order</label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.referredOnly} onChange={(e) => setF({ ...f, referredOnly: e.target.checked })} className="accent-emerald-500" /> Only customers referred by an agent</label>
          </div>
          <div>
            <label className={labelCls}>Counties they have ordered from {f.counties.length > 0 && <span className="text-emerald-400">({f.counties.length} chosen)</span>}</label>
            <div className="max-h-28 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap gap-1.5">
              {ALL_47_COUNTIES.map(c => <button key={c} onClick={() => toggleCounty(c)} className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer ${f.counties.includes(c) ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{c}</button>)}
            </div>
          </div>
        </div>

        <div className={`${cardCls} p-5 space-y-4`}>
          <p className="text-xs font-black text-white flex items-center gap-2"><MessageSquare className="w-4 h-4 text-emerald-400" /> 2 · Write the message</p>
          <div><label className={labelCls}>Campaign name (only you see this)</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. October bulk offer" /></div>
          <div>
            <label className={labelCls}>Message (an opt-out link is added automatically)</label>
            <textarea rows={4} maxLength={320} value={message} onChange={(e) => { setMessage(e.target.value); setPreview(null); }} className={inputCls} placeholder="Mwea Rice Hub: Buy 10+ bags of Pishori and pay only KES 1,100 each. Order now at ..." />
            <p className="text-[10px] text-slate-500 mt-1">{message.length}/320 characters · about {parts} SMS per customer including the opt-out link</p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <p className="text-[11px] font-black text-white">Test first: send this exact message to one phone</p>
            <div className="flex gap-2"><input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="Your phone (leave empty for the one on your account)" className={inputCls} />
              <button onClick={sendTest} disabled={busy || message.trim().length < 10} className="px-4 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer whitespace-nowrap">Send test</button></div>
            <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer"><input type="checkbox" checked={footerLink} onChange={(e) => setFooterLink(e.target.checked)} className="accent-emerald-500" /> Add the opt-out link (some networks block messages that contain links; test with and without)</label>
            {testResult && (
              <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${testResult.ok ? 'bg-emerald-950/40 border-emerald-800 text-emerald-100' : 'bg-rose-950/40 border-rose-800 text-rose-100'}`}>
                <p className="font-black">{testResult.ok ? `Gateway accepted it for ${testResult.sentTo} (${testResult.parts} SMS)` : `Gateway refused it: ${testResult.error}`}</p>
                <p>{testResult.advice}</p>
                {testResult.gatewayResponse && <pre className="text-[10px] whitespace-pre-wrap break-all opacity-80">{JSON.stringify(testResult.gatewayResponse, null, 2)}</pre>}
              </div>
            )}
          </div>
          <button onClick={runPreview} disabled={busy || message.trim().length < 10} className="w-full py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer">Check who this reaches and what it costs</button>
          {preview && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><p className={labelCls}>Customers reached</p><p className="text-xl font-black text-white">{preview.count}</p></div>
                <div><p className={labelCls}>Estimated SMS credit</p><p className="text-xl font-black text-amber-400">{preview.estimatedCost}</p></div>
              </div>
              <p className="text-[11px] text-slate-400">Skipped: {preview.optedOut} opted out · {preview.noPhone} without a valid phone. {preview.canAfford === false && <b className="text-rose-400">You do not have enough SMS credit ({preview.balance}).</b>} {preview.tooMany && <b className="text-rose-400">Over the limit of {preview.max} — narrow the segment.</b>}</p>
              {preview.sample.length > 0 && <p className="text-[11px] text-slate-500">Examples: {preview.sample.map((s: any) => `${s.name} (${s.phone})`).join(', ')}</p>}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 whitespace-pre-wrap">{preview.exampleMessage}</div>
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer"><input type="checkbox" checked={allowQuiet} onChange={(e) => setAllowQuiet(e.target.checked)} className="accent-emerald-500" /> Send even outside 7am–8pm</label>
                <div className="flex gap-2"><input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type SEND to confirm" className={inputCls} />
                  <button onClick={send} disabled={busy || confirmText !== 'SEND' || preview.count === 0 || preview.tooMany || name.trim().length < 3} className="px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer whitespace-nowrap">Send now</button></div>
                {name.trim().length < 3 && <p className="text-[10px] text-amber-400">Give the campaign a name first.</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`${cardCls} overflow-x-auto`}>
        <p className="p-4 text-xs font-black text-white border-b border-slate-800">Campaign history</p>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase font-black"><tr><th className="p-3">Campaign</th><th className="p-3">Started</th><th className="p-3">Status</th><th className="p-3 text-right">Targeted</th><th className="p-3 text-right">Sent</th><th className="p-3 text-right">Failed</th><th className="p-3 text-right">Opted-out skipped</th><th className="p-3"></th></tr></thead>
          <tbody className="divide-y divide-slate-800/60">
            {history.campaigns.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-500 font-bold">No campaigns yet.</td></tr>}
            {history.campaigns.map((c: any) => (
              <tr key={c.id}><td className="p-3"><p className="font-bold text-white">{c.name}</p><p className="text-[10px] text-slate-500 max-w-xs truncate">{c.message}</p><CampaignProblem c={c} token={token} /></td><td className="p-3 text-slate-400 whitespace-nowrap">{formatWhen(c.startedAt)}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${statusPill[c.status] || ''}`}>{c.status}</span></td><td className="p-3 text-right">{c.totalRecipients}</td><td className="p-3 text-right text-emerald-400 font-bold">{c.sentCount}</td><td className="p-3 text-right text-rose-400">{c.failedCount}</td><td className="p-3 text-right text-slate-400">{c.optedOutSkipped}</td>
                <td className="p-3 text-right">{c.status === 'sending' && <button onClick={() => stop(c.id)} className="px-2.5 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white text-[10px] font-extrabold cursor-pointer">Stop</button>}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
const smsPartsOf = (text: string) => { const len = text.length + 1 + 12 + 'Opt out: '.length + 60; return len <= 160 ? 1 : Math.ceil(len / 153); };

// ---------------------------------------------------------------------------
// REVIEWS (storefront widgets + moderation)
// ---------------------------------------------------------------------------
function StarRating({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" disabled={!onChange} onClick={() => onChange && onChange(i)} className={onChange ? 'cursor-pointer' : 'cursor-default'} aria-label={`${i} star`}>
          <Star style={{ width: size, height: size }} className={i <= Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
        </button>
      ))}
    </span>
  );
}

function ReviewsModal({ product, token, user, onClose, showToast, onChanged }: { product: Product; token: string | null; user: UserAccount | null; onClose: () => void; showToast: ToastFn; onChanged: () => void }) {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/products/${product.id}/reviews?page=${page}`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      const d = await res.json(); setData(d);
      if (d.myReview) { setRating(d.myReview.rating); setTitle(d.myReview.title || ''); setComment(d.myReview.comment || ''); }
    } catch (_) { /* ignore */ }
  }, [product.id, page, token]);
  useEffect(() => { load(); }, [load]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) { showToast('Choose a star rating first.', 'error'); return; }
    setBusy(true);
    try { const r = await staffApi(`/products/${product.id}/reviews`, token, { method: 'POST', body: { rating, title, comment } }); showToast(r.message, 'success'); await load(); onChanged(); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };
  const sum = data?.summary;
  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div><h3 className="font-black text-slate-900 text-base">{product.brandName}</h3>
            {sum && <div className="flex items-center gap-2 mt-1"><StarRating value={sum.average} /><span className="text-xs font-bold text-slate-700">{sum.hasReviews ? sum.average.toFixed(1) : 'No reviews yet'}</span>{typeof sum.count === 'number' && sum.count > 0 && <span className="text-[11px] text-amber-600 font-bold" title="Only administrators can see how many people rated">({sum.count} rating{sum.count > 1 ? 's' : ''} · admin only)</span>}</div>}</div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {sum && typeof sum.count === 'number' && sum.count > 0 && (
            <div className="space-y-1">{[5, 4, 3, 2, 1].map(n => (<div key={n} className="flex items-center gap-2 text-[11px] text-slate-500"><span className="w-3">{n}</span><Star className="w-3 h-3 text-amber-400 fill-amber-400" /><div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${(sum.distribution[n] / sum.count) * 100}%` }} /></div><span className="w-6 text-right">{sum.distribution[n]}</span></div>))}</div>
          )}
          {data && (data.canReview ? (
            <form onSubmit={submit} className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-2">
              <p className="text-xs font-black text-emerald-900">{data.myReview ? 'Update your review' : 'Write a review'} <span className="font-medium text-emerald-700">· verified buyer</span></p>
              <StarRating value={rating} size={26} onChange={setRating} />
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Headline (optional)" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs" />
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} placeholder="How was the rice? Cooking, aroma, packaging, delivery…" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs" />
              <button type="submit" disabled={busy} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer">{data.myReview ? 'Update review' : 'Post review'}</button>
            </form>
          ) : <p className="text-[11px] text-slate-500 p-3 rounded-xl bg-slate-50 border border-slate-100">{data.reason}</p>)}
          <div className="space-y-3">
            {data && data.reviews.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Be the first to review this rice.</p>}
            {data && data.reviews.map((r: any) => (
              <div key={r.id} className="p-3 rounded-2xl border border-slate-100 space-y-1">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><StarRating value={r.rating} size={12} /><span className="text-xs font-bold text-slate-800">{r.author}</span></div><span className="text-[10px] text-slate-400">{new Date(r.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-700"><Check className="w-3 h-3" /> Verified buyer</span>
                {r.title && <p className="text-xs font-extrabold text-slate-900">{r.title}</p>}
                {r.comment && <p className="text-xs text-slate-600 leading-relaxed">{r.comment}</p>}
                {r.reply && <p className="text-[11px] text-slate-600 bg-slate-50 rounded-xl p-2 border-l-2 border-emerald-500"><b>Mwea Rice Hub:</b> {r.reply}</p>}
              </div>
            ))}
            {data && data.pages > 1 && <div className="flex justify-between text-xs"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-slate-100 disabled:opacity-40 cursor-pointer">Newer</button><button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-slate-100 disabled:opacity-40 cursor-pointer">Older</button></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BULK RICE ORDER TAB — customer enters how many kg they need of a given
// variety; price is the normal per-kg price, with the admin's bulk % off
// applied once the order clears the admin-set kg threshold. Uses the exact
// same cart → checkout → payment flow as a normal purchase.
// ============================================================================
interface BulkQuote {
  productId: number; brandName: string; variety?: string; weightKg: number;
  requestedKg: number; sacks: number; actualKg: number; pricePerKg: number;
  grossTotal: number; discountPercent: number; discountAmount: number; netTotal: number;
  qualifies: boolean; minKgForDiscount: number; ruleDiscountPercent: number; isBulk: boolean; inStock: boolean; stockQuantity: number;
}

function BulkOrderView({ products, addToCart, setView, showToast }: {
  products: Product[];
  addToCart: (product: Product, qty?: number, bulk?: boolean) => void;
  setView: (v: any) => void;
  showToast: ToastFn;
}) {
  const [productId, setProductId] = useState<number | ''>('');
  const [kg, setKg] = useState<string>('');
  const [quote, setQuote] = useState<BulkQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [bulkCfg, setBulkCfg] = useState<BulkConfig | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/config/bulk-discount`).then(r => r.json()).then(setBulkCfg).catch(() => {});
  }, []);

  useEffect(() => {
    if (!productId || !kg || Number(kg) <= 0) { setQuote(null); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/bulk/quote?productId=${productId}&kg=${Number(kg)}`);
        const data = await res.json();
        if (res.ok) setQuote(data); else { setQuote(null); showToast(data.error || 'Could not calculate that quote.', 'error'); }
      } catch (_) { setQuote(null); } finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [productId, kg]);

  const selectedProduct = products.find(p => p.id === productId) || null;
  const rule = bulkRuleFor(bulkCfg, selectedProduct ? selectedProduct.id : 0);

  const handleAddBulkToCart = () => {
    if (!selectedProduct || !quote) return;
    if (!quote.inStock) { showToast(`Only ${quote.stockQuantity} sacks are in stock for an order this small. Order ${quote.minKgForDiscount}kg or more for a bulk order with no stock limit.`, 'error'); return; }
    addToCart(selectedProduct, quote.sacks, true);
    setView('cart');
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2"><Layers className="w-7 h-7 text-emerald-600" /> Bulk Rice Order</h2>
        <p className="text-slate-500 text-xs sm:text-sm">
          Tell us how many kilograms you need and we'll work out the nearest sack count at our normal price.
          {bulkCfg?.enabled ? (rule.discountPercent > 0 ? ` Orders of ${rule.minKg}kg or more ${selectedProduct ? 'of this rice' : 'of one rice type'} get ${rule.discountPercent}% off automatically.` : ` Orders of ${rule.minKg}kg or more ${selectedProduct ? 'of this rice' : 'of one rice type'} are treated as bulk orders.`) : ' Bulk discount pricing is currently off — you still get the normal price.'}
          {' '}Bulk orders are not limited by shelf stock, and delivery is charged by county at checkout.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Rice Type</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white cursor-pointer focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Choose a rice type…</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.brandName} {p.variety ? `— ${p.variety}` : ''} ({p.weightKg}kg sacks)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">How many kilograms do you need?</label>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              placeholder="e.g. 100"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-extrabold focus:ring-2 focus:ring-emerald-500"
            />
            {selectedProduct && <p className="text-[11px] text-slate-400 mt-1">Sold in {selectedProduct.weightKg}kg sacks — we'll round up to the nearest whole sack.</p>}
          </div>

          <button
            onClick={handleAddBulkToCart}
            disabled={!quote || loading || !quote.inStock}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-lg shadow-emerald-600/20 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" /> Add Bulk Order To Cart
          </button>
        </div>

        <div className="bg-slate-950 rounded-3xl p-6 text-white space-y-3">
          <h3 className="font-black text-sm flex items-center gap-2"><Percent className="w-4 h-4 text-emerald-400" /> Your Quote</h3>
          {!productId || !kg ? (
            <p className="text-xs text-slate-400 py-8 text-center">Choose a rice type and enter the kilograms you need to see your price.</p>
          ) : loading ? (
            <p className="text-xs text-slate-400 py-8 text-center flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Calculating…</p>
          ) : quote ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400"><span>Sacks needed:</span><span className="font-bold text-white">{quote.sacks} × {quote.weightKg}kg</span></div>
              <div className="flex justify-between text-slate-400"><span>Total weight:</span><span className="font-bold text-white">{quote.actualKg}kg</span></div>
              <div className="flex justify-between text-slate-400"><span>Price per kg:</span><span className="font-bold text-white">{formatKES(quote.pricePerKg)}</span></div>
              <div className="flex justify-between text-slate-400"><span>Subtotal:</span><span className="font-bold text-white">{formatKES(quote.grossTotal)}</span></div>
              {quote.qualifies ? (
                <div className="flex justify-between text-emerald-400 font-bold"><span>Bulk discount ({quote.discountPercent}%):</span><span>-{formatKES(quote.discountAmount)}</span></div>
              ) : bulkCfg?.enabled && quote.ruleDiscountPercent > 0 ? (
                <p className="text-[11px] text-amber-400">Add {Math.max(0, quote.minKgForDiscount - quote.actualKg)}kg more to unlock {quote.ruleDiscountPercent}% off.</p>
              ) : null}
              {quote.isBulk && <p className="text-[11px] text-emerald-300">Bulk order: not limited by shelf stock.</p>}
              <div className="border-t border-slate-800 pt-2 flex justify-between text-base font-black">
                <span>Total:</span><span className="text-emerald-400">{formatKES(quote.netTotal)}</span>
              </div>
              {!quote.inStock && <p className="text-[11px] text-rose-400 font-bold">Only {quote.stockQuantity} sacks in stock for an order this small — order {quote.minKgForDiscount}kg or more for a bulk order with no stock limit, or pick another rice type.</p>}
              <p className="text-[10px] text-slate-500 pt-2">Checkout and M-Pesa payment work like a normal order. Bulk delivery is charged by county at checkout — this just adds a bulk line to your cart.</p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-8 text-center">No quote yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminReviewsPanel({ token, showToast }: { token: string | null; showToast: ToastFn }) {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<'all' | 'published' | 'hidden'>('all');
  const [summary, setSummary] = useState<any[]>([]);
  const load = useCallback(async () => { try { setRows(await staffApi(`/admin/reviews${status !== 'all' ? `?status=${status}` : ''}`, token)); } catch (err: any) { showToast(err.message, 'error'); } }, [token, status]);
  useEffect(() => { load(); }, [load]);
  // How many people rated each rice: only the admin ever sees these numbers
  useEffect(() => { staffApi('/admin/reviews/summary', token).then((d: any) => setSummary(Array.isArray(d) ? d : [])).catch(() => {}); }, [token, rows]);
  const update = async (id: number, body: any) => { try { await staffApi(`/admin/reviews/${id}`, token, { method: 'PUT', body }); load(); } catch (err: any) { showToast(err.message, 'error'); } };
  return (
    <div className="space-y-4">
      {summary.length > 0 && (
        <div className={`${cardCls} p-4 space-y-2`}>
          <p className="text-[11px] font-black uppercase text-slate-400">Ratings per rice · only you can see how many people rated</p>
          {summary.map((s: any) => (
            <div key={s.productId} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-200 font-bold truncate">{s.product}</span>
              <span className="flex items-center gap-2 shrink-0"><StarRating value={s.average} size={12} /><span className="font-black text-white">{Number(s.average).toFixed(1)}</span><span className="text-slate-400">· {s.count} rating{s.count === 1 ? '' : 's'}</span></span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">{(['all', 'published', 'hidden'] as const).map(s => <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize cursor-pointer ${status === s ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{s}</button>)}</div>
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-xs text-slate-500 font-bold p-6 text-center bg-slate-900 rounded-2xl border border-slate-800">No reviews yet.</p>}
        {rows.map(r => (
          <div key={r.id} className={`${cardCls} p-4 space-y-2 ${r.status === 'hidden' ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><StarRating value={r.rating} size={13} /><span className="text-xs font-bold text-white">{r.product}</span></div><span className="text-[10px] text-slate-500">{r.customer} · {formatWhen(r.createdAt)}</span></div>
            {r.title && <p className="text-xs font-extrabold text-slate-200">{r.title}</p>}
            {r.comment && <p className="text-xs text-slate-300">{r.comment}</p>}
            {r.adminReply && <p className="text-[11px] text-emerald-300">Your reply: {r.adminReply}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => update(r.id, { status: r.status === 'hidden' ? 'published' : 'hidden' })} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${r.status === 'hidden' ? 'bg-emerald-700 text-white' : 'bg-rose-900 text-rose-100'}`}>{r.status === 'hidden' ? 'Restore' : 'Hide'}</button>
              <button onClick={() => { const v = prompt('Your public reply to this review:', r.adminReply || ''); if (v !== null) update(r.id, { reply: v }); }} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-[11px] font-bold cursor-pointer">{r.adminReply ? 'Edit reply' : 'Reply'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN SIGN-IN SECOND STEP
// ---------------------------------------------------------------------------
function TwoFactorModal({ challenge, onSuccess, onClose, showToast }: { challenge: { challengeId: string; message: string }; onSuccess: (data: any) => void; onClose: () => void; showToast: ToastFn }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) { showToast('Enter the 6-digit code.', 'error'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/login/verify-2fa`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId: challenge.challengeId, code }) });
      const d = await res.json();
      if (res.ok && d.token) onSuccess(d);
      else { showToast(d.error || 'Could not verify the code.', 'error'); if (d.expired) onClose(); }
    } catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };
  const resend = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/login/resend-2fa`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId: challenge.challengeId }) });
      const d = await res.json(); showToast(d.message || d.error, res.ok ? 'success' : 'error'); if (d.expired) onClose();
    } catch (err: any) { showToast(err.message, 'error'); }
  };
  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div className="text-center space-y-1"><ShieldAlert className="w-10 h-10 text-emerald-600 mx-auto" /><h3 className="font-black text-slate-900">Confirm it&apos;s you</h3><p className="text-xs text-slate-500">{challenge.message}</p></div>
        <input autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" className="w-full text-center tracking-[0.5em] text-2xl font-black px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" />
        <button type="submit" disabled={busy || code.length !== 6} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold text-xs cursor-pointer">Verify and sign in</button>
        <div className="flex justify-between text-[11px]"><button type="button" onClick={resend} className="font-bold text-emerald-700 cursor-pointer">Send a new code</button><button type="button" onClick={onClose} className="font-bold text-slate-500 cursor-pointer">Cancel</button></div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN: SYSTEM (health, safety settings, daily summary, permissions)
// ---------------------------------------------------------------------------
function AdminSystemPanel({ token, showToast }: { token: string | null; showToast: ToastFn }) {
  const [status, setStatus] = useState<any>(null);
  const [ops, setOps] = useState<any>(null);
  const [perms, setPerms] = useState<any>(null);
  const [extra, setExtra] = useState({ phones: '', emails: '' });
  const [busy, setBusy] = useState(false);
  const [schema, setSchema] = useState<any>(null);
  const [smsTest, setSmsTest] = useState<any>(null);
  const [smsTestPhone, setSmsTestPhone] = useState('');

  const load = useCallback(async () => {
    try {
      staffApi('/admin/system/schema', token).then(setSchema).catch(() => {});
      const [s, o, p] = await Promise.all([staffApi('/admin/system/status', token), staffApi('/admin/ops-settings', token), staffApi('/admin/permissions', token)]);
      setStatus(s); setOps(o); setPerms(p);
      setExtra({ phones: (o.dailySummary.extraPhones || []).join(', '), emails: (o.dailySummary.extraEmails || []).join(', ') });
    } catch (err: any) { showToast(err.message, 'error'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const saveOps = async (patch: any, okMsg = 'Settings saved.') => {
    setBusy(true);
    try { await staffApi('/admin/ops-settings', token, { method: 'PUT', body: patch }); showToast(okMsg, 'success'); await load(); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };
  const togglePerm = async (role: string, key: string, value: boolean) => {
    try { const r = await staffApi('/admin/permissions', token, { method: 'PUT', body: { role, changes: { [key]: value } } }); setPerms((p: any) => ({ ...p, permissions: r.permissions })); showToast('Permission updated.', 'success'); }
    catch (err: any) { showToast(err.message, 'error'); }
  };
  const sendTest = async () => {
    setBusy(true);
    try { const r = await staffApi('/admin/daily-summary/send-test', token, { method: 'POST' }); showToast(r.message, r.errors && r.errors.length ? 'warning' : 'success'); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };
  const repairDb = async () => {
    if (!confirm('Create any missing tables and add any missing columns? Existing data is not touched.')) return;
    setBusy(true);
    try { const r = await staffApi('/admin/system/schema/repair', token, { method: 'POST' }); showToast(r.message, r.errors && r.errors.length ? 'warning' : 'success'); setSchema(await staffApi('/admin/system/schema', token)); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };
  const runSmsTest = async () => {
    setBusy(true); setSmsTest(null);
    try { setSmsTest(await staffApi('/admin/sms/test', token, { method: 'POST', body: { phone: smsTestPhone || undefined, message: 'Mwea Rice Hub test message. If you can read this, SMS is working.' } })); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };
  const reconcile = async () => { try { const r = await staffApi('/admin/system/reconcile-now', token, { method: 'POST' }); showToast(r.message, 'info'); setTimeout(load, 6000); } catch (err: any) { showToast(err.message, 'error'); } };

  if (!status || !ops || !perms) return <p className="text-xs text-slate-500 font-bold">Loading system status…</p>;
  const job = status.jobs.paymentReconcile;
  const smsPct = status.sms.balance === null ? 0 : Math.min(100, (status.sms.balance / Math.max(1, status.sms.threshold * 4)) * 100);
  const roleLabels: Record<string, string> = { support: 'Customer care', agent: 'Agents' };

  return (
    <div className="space-y-6">
      {/* HEALTH */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`rounded-2xl p-4 border ${status.sms.low ? 'bg-rose-950/50 border-rose-800' : 'bg-slate-900 border-slate-800'}`}>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">SMS credit (OTP codes)</p>
          <p className={`text-xl font-black mt-1 ${status.sms.low ? 'text-rose-400' : 'text-emerald-400'}`}>{status.sms.balance === null ? 'Not known yet' : status.sms.balance}</p>
          <div className="h-1.5 rounded-full bg-slate-800 mt-2 overflow-hidden"><div className={`h-full ${status.sms.low ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${smsPct}%` }} /></div>
          <p className="text-[10px] text-slate-500 mt-1">{status.sms.low ? 'LOW — top up Ping Africa now' : `Alert below ${status.sms.threshold}`}</p>
        </div>
        <StaffStat label="Database" value={status.database ? 'Connected' : 'DOWN'} tone={status.database ? 'emerald' : 'rose'} hint={`Server up ${status.uptimeMinutes} min · Node ${status.nodeVersion}`} />
        <StaffStat label="Unpaid orders now" value={status.unpaidOrders} tone={status.unpaidOrders > 10 ? 'amber' : 'slate'} hint="Checked every 3 minutes" />
        <StaffStat label="Error monitoring" value={status.sentry ? 'Sentry on' : 'Built-in log'} tone={status.sentry ? 'emerald' : 'sky'} hint={status.sentryConfigured && !status.sentry ? 'DSN set but package missing' : 'Errors appear in Live Activity'} />
      </div>

      {/* DATABASE & SMS CHECKS */}
      <div className={`${cardCls} p-5 space-y-3`}>
        <p className="text-xs font-black text-white flex items-center gap-2"><Shield className="w-4 h-4 text-sky-400" /> Database and SMS checks</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Database tables</p>
            {!schema && <p className="text-xs text-slate-500">Checking…</p>}
            {schema && schema.healthy && <p className="text-xs font-bold text-emerald-400">All {schema.total} tables and every column the server needs are present.</p>}
            {schema && !schema.healthy && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-rose-400">{schema.problems.length} problem(s) found:</p>
                {schema.problems.map((p: any) => <p key={p.model} className="text-[11px] text-slate-300">{p.missingTable ? `Missing table: ${p.table}` : `${p.table} is missing columns: ${p.missingColumns.join(', ')}`}</p>)}
                <button onClick={repairDb} disabled={busy} className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[11px] font-extrabold cursor-pointer">Repair database</button>
              </div>
            )}
          </div>
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Send a test SMS</p>
            <div className="flex gap-2"><input value={smsTestPhone} onChange={(e) => setSmsTestPhone(e.target.value)} placeholder="Phone (empty = your account's phone)" className={inputCls} /><button onClick={runSmsTest} disabled={busy} className="px-4 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer whitespace-nowrap">Send</button></div>
            {smsTest && (<div className={`p-3 rounded-xl border text-[11px] space-y-1 ${smsTest.ok ? 'bg-emerald-950/40 border-emerald-800 text-emerald-100' : 'bg-rose-950/40 border-rose-800 text-rose-100'}`}><p className="font-black">{smsTest.ok ? `Gateway accepted it for ${smsTest.sentTo}` : `Gateway refused it: ${smsTest.error}`}</p><p>{smsTest.advice}</p>{smsTest.gatewayResponse && <pre className="text-[10px] whitespace-pre-wrap break-all opacity-80">{JSON.stringify(smsTest.gatewayResponse, null, 2)}</pre>}</div>)}
          </div>
        </div>
      </div>

      {/* PAYMENT SAFETY NET */}
      <div className={`${cardCls} p-5 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black text-white flex items-center gap-2"><RefreshCw className="w-4 h-4 text-emerald-400" /> Payment safety net</p><button onClick={reconcile} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer">Re-check payments now</button></div>
        <p className="text-[11px] text-slate-400">Every 3 minutes the server asks PayHero about unpaid orders. Paid ones are confirmed even if the customer closed the page; orders still unpaid after the time below are cancelled and their stock is released.</p>
        <p className="text-[11px] text-slate-500">Last run: {job.lastRun ? formatWhen(job.lastRun) : 'not yet'} · checked {job.checked} · confirmed {job.confirmed} · failed {job.failed} · expired {job.expired}{job.error ? ` · ${job.error}` : ''}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
          <div><label className={labelCls}>Cancel unpaid orders after (minutes)</label><input type="number" min={10} max={1440} defaultValue={ops.orderExpiryMinutes} onBlur={(e) => Number(e.target.value) !== ops.orderExpiryMinutes && saveOps({ orderExpiryMinutes: Number(e.target.value) })} className={inputCls} /></div>
          <div><label className={labelCls}>Low stock default (bags)</label><input type="number" min={0} defaultValue={ops.lowStockDefault} onBlur={(e) => Number(e.target.value) !== ops.lowStockDefault && saveOps({ lowStockDefault: Number(e.target.value) })} className={inputCls} /></div>
          <div><label className={labelCls}>SMS credit alert level</label><input type="number" min={0} defaultValue={ops.smsLowThreshold} onBlur={(e) => Number(e.target.value) !== ops.smsLowThreshold && saveOps({ smsLowThreshold: Number(e.target.value) })} className={inputCls} /></div>
          <div><label className={labelCls}>Credit used per SMS</label><input type="number" min={0} step="0.05" defaultValue={ops.smsCostPerPart} onBlur={(e) => Number(e.target.value) !== ops.smsCostPerPart && saveOps({ smsCostPerPart: Number(e.target.value) })} className={inputCls} /></div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer"><input type="checkbox" checked={ops.autoReconcile !== false} onChange={(e) => saveOps({ autoReconcile: e.target.checked })} className="accent-emerald-500" /> Automatic payment re-check and unpaid-order expiry is ON</label>
      </div>

      {/* SECURITY */}
      <div className={`${cardCls} p-5 space-y-2`}>
        <p className="text-xs font-black text-white flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-400" /> Administrator sign-in security</p>
        <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer"><input type="checkbox" checked={ops.adminTwoFactor !== false} onChange={(e) => { if (!e.target.checked && !confirm('Turn OFF two-step sign-in for administrators? Anyone with an admin password could then get in. This is recorded as a security alert.')) return; saveOps({ adminTwoFactor: e.target.checked }); }} className="accent-emerald-500 mt-0.5" /> <span>Require a 6-digit code (sent by SMS and email) after the password when an administrator signs in.</span></label>
        {status.twoFactor.forcedOffByEnv && <p className="text-[11px] text-amber-400 font-bold">Currently forced OFF by the DISABLE_ADMIN_2FA setting on your server. Remove that setting to turn it back on.</p>}
        <p className="text-[10px] text-slate-500">If SMS credit runs out and you cannot receive the email, set DISABLE_ADMIN_2FA=true on Render to get back in, then remove it.</p>
      </div>

      {/* DAILY SUMMARY */}
      <div className={`${cardCls} p-5 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black text-white flex items-center gap-2"><MessageSquare className="w-4 h-4 text-sky-400" /> Daily summary</p><button onClick={sendTest} disabled={busy} className="px-3 py-1.5 rounded-lg bg-sky-800 hover:bg-sky-700 text-white text-[11px] font-extrabold cursor-pointer">Send today&apos;s summary now</button></div>
        <p className="text-[11px] text-slate-400">Sales, payments, profit estimate, low stock, commissions owed and alerts, sent to every administrator.</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={ops.dailySummary.enabled} onChange={(e) => saveOps({ dailySummary: { enabled: e.target.checked } })} className="accent-emerald-500" /> Send every day at</label>
          <input type="time" defaultValue={ops.dailySummary.time} onBlur={(e) => e.target.value && e.target.value !== ops.dailySummary.time && saveOps({ dailySummary: { time: e.target.value } })} className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white" /><span className="text-slate-500 text-[11px]">(Kenya time)</span>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={ops.dailySummary.sms} onChange={(e) => saveOps({ dailySummary: { sms: e.target.checked } })} className="accent-emerald-500" /> SMS</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={ops.dailySummary.email} onChange={(e) => saveOps({ dailySummary: { email: e.target.checked } })} className="accent-emerald-500" /> Email</label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className={labelCls}>Extra phone numbers (comma separated)</label><input value={extra.phones} onChange={(e) => setExtra({ ...extra, phones: e.target.value })} onBlur={() => saveOps({ dailySummary: { extraPhones: extra.phones.split(',').map(s => s.trim()).filter(Boolean) } })} className={inputCls} placeholder="0712345678, 0722000000" /></div>
          <div><label className={labelCls}>Extra email addresses</label><input value={extra.emails} onChange={(e) => setExtra({ ...extra, emails: e.target.value })} onBlur={() => saveOps({ dailySummary: { extraEmails: extra.emails.split(',').map(s => s.trim()).filter(Boolean) } })} className={inputCls} placeholder="accountant@example.com" /></div>
        </div>
        <p className="text-[10px] text-slate-500">Administrators&apos; own phone numbers and emails (from their accounts) always receive it.</p>
      </div>

      {/* PERMISSIONS */}
      <div className={`${cardCls} p-5 space-y-4`}>
        <p className="text-xs font-black text-white flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-400" /> Role permissions</p>
        <p className="text-[11px] text-slate-400">Switch abilities on or off for each staff type. Changes apply immediately. Administrators always have full access.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.keys(perms.catalog).map(role => (
            <div key={role} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-sky-400">{roleLabels[role] || role}</p>
              {perms.catalog[role].map((p: any) => (
                <label key={p.key} className="flex items-center justify-between gap-3 text-xs text-slate-200 cursor-pointer py-1">
                  <span>{p.label}</span>
                  <input type="checkbox" checked={!!perms.permissions[role][p.key]} onChange={(e) => togglePerm(role, p.key, e.target.checked)} className="accent-emerald-500 w-4 h-4" />
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* RECENT PROBLEMS */}
      <div className={`${cardCls} overflow-hidden`}>
        <p className="p-4 text-xs font-black text-white border-b border-slate-800">Recent problems & warnings</p>
        <div className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
          {status.recentErrors.length === 0 && <p className="p-6 text-center text-xs text-emerald-400 font-bold">Nothing wrong has been recorded. 🎉</p>}
          {status.recentErrors.map((e: any) => (<div key={e.id} className="p-3"><p className="text-xs text-slate-200"><span className="font-mono text-[10px] text-rose-400">{e.action}</span> {e.summary}</p><p className="text-[10px] text-slate-500 mt-0.5">{formatWhen(e.createdAt)}</p></div>))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STAFF, AGENT & ACTIVITY SCREENS (customer care, agents, admin tracking)
// ============================================================================

type ToastFn = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

const staffApi = async (path: string, token: string | null, options: { method?: string; body?: any } = {}) => {
  // Always use the NEWEST saved token (the one the server last renewed), never a stale copy held in React state.
  let live: string | null = token;
  try { live = (typeof window !== 'undefined' && window.localStorage.getItem('token')) || token; } catch (_) { /* keep prop token */ }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(live ? { 'Authorization': `Bearer ${live}` } : {}) },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mwea:auth-401')); // the app confirms with the server before signing anyone out
    const err: any = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
};

const formatWhen = (value: any) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const StaffStat = ({ label, value, tone = 'slate', hint }: { label: string; value: React.ReactNode; tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'sky'; hint?: string }) => {
  const tones: Record<string, string> = {
    slate: 'text-white', emerald: 'text-emerald-400', amber: 'text-amber-400', rose: 'text-rose-400', sky: 'text-sky-400'
  };
  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-xl font-black mt-1 ${tones[tone]}`}>{value}</p>
      {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
};

const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-950 text-amber-300 border-amber-800',
    PAID: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    NO_PROFIT: 'bg-slate-800 text-slate-400 border-slate-700',
    REVERSED: 'bg-slate-800 text-slate-400 border-slate-700',
    CLAWBACK_DUE: 'bg-rose-950 text-rose-300 border-rose-800'
  };
  const label: Record<string, string> = { PENDING: 'Pending payout', PAID: 'Paid', NO_PROFIT: 'No profit', REVERSED: 'Reversed', CLAWBACK_DUE: 'Recover from agent' };
  return <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${map[status] || map.NO_PROFIT}`}>{label[status] || status}</span>;
};

const copyText = async (text: string, showToast: ToastFn, okMessage: string) => {
  try {
    await navigator.clipboard.writeText(text);
    showToast(okMessage, 'success');
  } catch (_) {
    showToast('Could not copy automatically. Select the text and copy it.', 'warning');
  }
};

// ---------------------------------------------------------------------------
// AGENT DASHBOARD
// ---------------------------------------------------------------------------
function AgentDashboard({ token, user, showToast, onSessionExpired }: { token: string | null; user: UserAccount; showToast: ToastFn; onSessionExpired: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [tab, setTab] = useState<'customers' | 'commissions' | 'rice' | 'payouts'>('commissions');

  const load = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const d = await staffApi(`/agent/overview?year=${y}`, token);
      setData(d);
    } catch (err: any) {
      if (err.status === 401) onSessionExpired();
      else showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(year); }, [year, load]);

  if (loading && !data) return <div className="min-h-[60vh] flex items-center justify-center bg-slate-950 text-slate-400 text-sm font-bold">Loading your agent dashboard…</div>;
  if (!data) return <div className="min-h-[60vh] flex items-center justify-center bg-slate-950 text-slate-400 text-sm font-bold">Your agent dashboard is not available right now.</div>;

  const sm = data.summary;
  const link = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${data.referralCode}` : data.referralCode;
  const maxCommission = Math.max(1, ...data.monthly.map((m: any) => m.commission));

  return (
    <div className="min-h-[85vh] bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Agent Partner Console</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Welcome, {user.fullName}</h2>
            <p className="text-xs text-slate-400 mt-1">
              You earn {Math.round(data.rates.newCustomerRate * 100)}% of the profit on a new customer&apos;s first order and {Math.round(data.rates.repeatRate * 100)}% on every repeat order.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase text-slate-500">Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white cursor-pointer">
              {data.availableYears.map((y: number) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => load(year)} className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 cursor-pointer" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Referral code card */}
        <div className="bg-gradient-to-r from-emerald-900/60 to-teal-900/40 border border-emerald-700/40 rounded-3xl p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Your referral code</p>
            <p className="text-3xl font-black font-mono tracking-widest text-white mt-1">{data.referralCode}</p>
            <p className="text-[11px] text-emerald-100/70 mt-1">Customers enter this when they sign up or at checkout.</p>
          </div>
          <div className="md:col-span-2 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Your sign-up link</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input readOnly value={link} className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-xs font-mono text-slate-200" />
              <button onClick={() => copyText(link, showToast, 'Link copied. Share it with your customers!')} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer">
                <Link2 className="w-4 h-4" /> Copy link
              </button>
              <button onClick={() => copyText(data.referralCode, showToast, 'Code copied.')} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer">
                <Copy className="w-4 h-4" /> Copy code
              </button>
            </div>
          </div>
        </div>

        {sm.clawbackDue > 0 && (
          <div className="bg-rose-950/60 border border-rose-800 rounded-2xl p-4 text-xs text-rose-200 font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {formatKES(sm.clawbackDue)} of commission you were already paid is on orders that were later refunded or cancelled. Admin will settle this with you.
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StaffStat label="Customers referred" value={sm.customers} tone="sky" />
          <StaffStat label="Paid orders" value={sm.orders} hint={`${sm.newCustomerOrders} first orders · ${sm.repeatOrders} repeat`} />
          <StaffStat label="Rice sold" value={`${sm.kgSold.toLocaleString()} kg`} tone="emerald" />
          <StaffStat label="Sales value" value={formatKES(sm.salesValue)} />
          <StaffStat label="Profit you generated" value={sm.profitGenerated === null ? '—' : formatKES(sm.profitGenerated)} />
          <StaffStat label="Commission pending" value={formatKES(sm.commissionPending)} tone="amber" hint="Awaiting payout" />
          <StaffStat label="Commission paid" value={formatKES(sm.commissionPaid)} tone="emerald" />
          <StaffStat label="Total earned" value={formatKES(sm.commissionTotal)} tone="emerald" />
        </div>

        {/* Monthly commission bars */}
        <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800">
          <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-emerald-400" /> Commission by month — {data.year}</h3>
          <div className="grid grid-cols-12 gap-2 items-end h-40">
            {data.monthly.map((m: any) => (
              <div key={m.monthIndex} className="flex flex-col items-center justify-end h-full gap-1" title={`${m.month}: ${formatKES(m.commission)} from ${m.orders} order(s), ${m.kg} kg`}>
                <span className="text-[9px] font-bold text-slate-400">{m.commission > 0 ? Math.round(m.commission) : ''}</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-emerald-700 to-emerald-400" style={{ height: `${Math.max(m.commission > 0 ? 6 : 2, (m.commission / maxCommission) * 100)}%`, opacity: m.commission > 0 ? 1 : 0.25 }} />
                <span className="text-[9px] font-bold text-slate-500">{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {([
            ['commissions', 'My Sales & Commission'], ['customers', 'My Customers'], ['rice', 'Rice I Have Sold'], ['payouts', 'Payouts Received']
          ] as const).filter(([id]) => id !== 'customers' || data.permissions?.['agent.customers'] !== false).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${tab === id ? 'bg-emerald-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}>{label}</button>
          ))}
        </div>

        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            {tab === 'commissions' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                  <tr><th className="p-3">Order</th><th className="p-3">Date</th><th className="p-3">Customer</th><th className="p-3">Rice</th><th className="p-3">Type</th><th className="p-3 text-right">Profit</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">You earn</th><th className="p-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.commissions.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-500 font-bold">No sales yet. Share your link to get your first customer!</td></tr>}
                  {data.commissions.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-slate-400">#{c.orderId}</td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">{formatWhen(c.date)}</td>
                      <td className="p-3 font-bold text-white">{c.customer}</td>
                      <td className="p-3 text-slate-300 max-w-[220px] truncate" title={c.items}>{c.items}</td>
                      <td className="p-3"><span className={`px-2 py-0.5 rounded-md font-black text-[9px] uppercase ${c.type === 'NEW_CUSTOMER' ? 'bg-sky-950 text-sky-300' : 'bg-slate-800 text-slate-300'}`}>{c.type === 'NEW_CUSTOMER' ? 'New customer' : 'Repeat'}</span></td>
                      <td className="p-3 text-right">{c.profit === null ? '—' : formatKES(c.profit)}</td>
                      <td className="p-3 text-right text-slate-300">{Math.round(c.rate * 100)}%</td>
                      <td className="p-3 text-right font-black text-emerald-400">{formatKES(c.amount)}</td>
                      <td className="p-3"><StatusPill status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'customers' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                  <tr><th className="p-3">Customer</th><th className="p-3">Phone</th><th className="p-3">Joined</th><th className="p-3 text-right">Orders</th><th className="p-3 text-right">Spent on rice</th><th className="p-3 text-right">Your commission</th><th className="p-3">Last order</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.customers.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-500 font-bold">Nobody has signed up with your code yet.</td></tr>}
                  {data.customers.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">{c.fullName}</td>
                      <td className="p-3 font-mono text-slate-400">{c.phone}</td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">{formatWhen(c.joinedAt)}</td>
                      <td className="p-3 text-right">{c.orders}</td>
                      <td className="p-3 text-right">{formatKES(c.totalSpent)}</td>
                      <td className="p-3 text-right font-black text-emerald-400">{formatKES(c.commissionEarned)}</td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">{c.lastOrderAt ? formatWhen(c.lastOrderAt) : 'No order yet'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'rice' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                  <tr><th className="p-3">Rice</th><th className="p-3 text-right">Bags sold</th><th className="p-3 text-right">Total kg</th><th className="p-3 text-right">Sales value</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.products.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500 font-bold">Your rice sales will appear here once customers pay.</td></tr>}
                  {data.products.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">{p.name}</td>
                      <td className="p-3 text-right">{p.quantity}</td>
                      <td className="p-3 text-right text-emerald-400 font-black">{p.kg.toLocaleString()} kg</td>
                      <td className="p-3 text-right">{formatKES(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'payouts' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                  <tr><th className="p-3">Date</th><th className="p-3">Reference</th><th className="p-3">Method</th><th className="p-3 text-right">Orders covered</th><th className="p-3 text-right">Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.payouts.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500 font-bold">No payouts yet. Pending commission is paid out by the admin.</td></tr>}
                  {data.payouts.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400 whitespace-nowrap">{formatWhen(p.date)}</td>
                      <td className="p-3 font-mono font-bold text-white">{p.reference}</td>
                      <td className="p-3 uppercase text-slate-400">{p.method}</td>
                      <td className="p-3 text-right">{p.commissionCount}</td>
                      <td className="p-3 text-right font-black text-emerald-400">{formatKES(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CUSTOMER CARE DASHBOARD — fixed navigation panel on the left, work area on the right
// Can view every account, order and payment. The only changes allowed: fix a name, reactivate an account.
// ---------------------------------------------------------------------------
type SupportSection = 'overview' | 'customers' | 'orders' | 'payments' | 'reviews' | 'activity';

function SupportDashboard({ token, user, showToast, onSessionExpired }: { token: string | null; user: UserAccount; showToast: ToastFn; onSessionExpired: () => void }) {
  const [section, setSection] = useState<SupportSection>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [perms, setPerms] = useState<Record<string, boolean> | null>(null);
  const can = (k: string) => !!(perms && perms[k]);
  useEffect(() => { staffApi('/me/permissions', token).then(d => setPerms(d.permissions)).catch(() => setPerms({})); }, [token]);

  // customers
  const [list, setList] = useState<any>({ users: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'suspended' | 'unverified'>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [reason, setReason] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [busy, setBusy] = useState(false);

  // orders & payments
  const [orders, setOrders] = useState<any>({ orders: [], total: 0, page: 1, pages: 1, counts: { all: 0, paid: 0, pending: 0, failed: 0 } });
  const [orderSearch, setOrderSearch] = useState('');
  const [payFilter, setPayFilter] = useState<'all' | 'paid' | 'pending' | 'failed'>('all');
  const [orderPage, setOrderPage] = useState(1);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [openOrder, setOpenOrder] = useState<number | null>(null);
  const [checks, setChecks] = useState<Record<number, any>>({});
  const [checking, setChecking] = useState<number | null>(null);

  const fail = (err: any) => { if (err.status === 401) onSessionExpired(); else showToast(err.message, 'error'); };

  const loadOverview = useCallback(async () => {
    try { setOverview(await staffApi('/support/overview', token)); } catch (err) { fail(err); }
  }, [token]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try { setList(await staffApi(`/support/users?search=${encodeURIComponent(search)}&status=${status}&page=${page}`, token)); }
    catch (err) { fail(err); } finally { setLoading(false); }
  }, [token, search, status, page]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const pay = section === 'payments' ? payFilter : 'all';
      setOrders(await staffApi(`/support/orders?search=${encodeURIComponent(orderSearch)}&payment=${pay}&page=${orderPage}`, token));
    } catch (err) { fail(err); } finally { setOrdersLoading(false); }
  }, [token, orderSearch, payFilter, orderPage, section]);

  const openUser = async (id: number) => {
    setDetailLoading(true);
    try {
      const d = await staffApi(`/support/users/${id}`, token);
      setSelected(d); setNameDraft(d.user.fullName); setReason(''); setNoteDraft('');
    } catch (err) { fail(err); } finally { setDetailLoading(false); }
  };

  const goToCustomer = (id: number) => { setSection('customers'); openUser(id); };

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { if (section === 'customers') { const t = setTimeout(loadList, 300); return () => clearTimeout(t); } }, [section, loadList]);
  useEffect(() => { if (section === 'orders' || section === 'payments') { const t = setTimeout(loadOrders, 300); return () => clearTimeout(t); } }, [section, loadOrders]);

  const refreshUser = async (id: number) => { await Promise.all([openUser(id), loadList(), loadOverview()]); };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return; setBusy(true);
    try { const r = await staffApi(`/support/users/${selected.user.id}/name`, token, { method: 'PUT', body: { fullName: nameDraft } }); showToast(r.message || 'Name updated.', 'success'); await refreshUser(selected.user.id); }
    catch (err) { fail(err); } finally { setBusy(false); }
  };
  const unsuspend = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return; setBusy(true);
    try { const r = await staffApi(`/support/users/${selected.user.id}/unsuspend`, token, { method: 'POST', body: { reason } }); showToast(r.message || 'Account reactivated.', 'success'); await refreshUser(selected.user.id); }
    catch (err) { fail(err); } finally { setBusy(false); }
  };
  const addNote = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return; setBusy(true);
    try { await staffApi(`/support/users/${selected.user.id}/notes`, token, { method: 'POST', body: { note: noteDraft } }); setNoteDraft(''); await openUser(selected.user.id); showToast('Note saved.', 'success'); }
    catch (err) { fail(err); } finally { setBusy(false); }
  };
  const checkPayment = async (orderId: number) => {
    setChecking(orderId);
    try { const r = await staffApi(`/support/orders/${orderId}/payment-check`, token); setChecks(c => ({ ...c, [orderId]: r })); loadOverview(); }
    catch (err) { fail(err); } finally { setChecking(null); }
  };

  const u = selected?.user;
  const readOnly = !!u && (u.role === 'admin' || u.role === 'support' || u.id === user.id);
  const allNav: { id: SupportSection; label: string; icon: any; badge?: number; perm?: string[] }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'customers', label: 'Customers', icon: Users, badge: overview?.suspended, perm: ['users.view'] },
    { id: 'orders', label: 'Orders', icon: Package, perm: ['orders.view'] },
    { id: 'payments', label: 'Payments', icon: Wallet, badge: overview && overview.pendingPayments !== null ? overview.pendingPayments + overview.failedPayments : undefined, perm: ['payments.view'] },
    { id: 'reviews', label: 'Reviews', icon: Star, perm: ['reviews.moderate'] },
    { id: 'activity', label: 'My Activity', icon: Clock }
  ];
  const navItems = allNav.filter(n => !n.perm || n.perm.some(k => can(k)));
  useEffect(() => { if (perms && !navItems.some(n => n.id === section)) setSection('overview'); }, [perms]);
  const verdictStyle: Record<string, string> = {
    CONFIRMED_PAID: 'bg-emerald-950 border-emerald-800 text-emerald-200', NOT_PAID: 'bg-slate-800 border-slate-700 text-slate-200',
    PAID_NOT_RECORDED: 'bg-rose-950 border-rose-800 text-rose-200', RECORDED_PAID_UNCONFIRMED: 'bg-amber-950 border-amber-800 text-amber-200', UNKNOWN: 'bg-slate-800 border-slate-700 text-slate-300'
  };
  const payPill = (s: string) => s === 'paid' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : s === 'failed' ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-amber-950 text-amber-300 border-amber-800';

  const OrdersTable = ({ mode }: { mode: 'orders' | 'payments' }) => (
    <div className="space-y-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
        <input value={orderSearch} onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(1); }} placeholder={mode === 'payments' ? 'Search M-Pesa receipt, phone, customer name or order #…' : 'Search order #, customer, phone or receipt…'} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white" />
        {mode === 'payments' && (
          <div className="flex flex-wrap gap-2">
            {(['all', 'paid', 'pending', 'failed'] as const).map(f => (
              <button key={f} onClick={() => { setPayFilter(f); setOrderPage(1); }} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize cursor-pointer ${payFilter === f ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                {f} <span className="opacity-70">({orders.counts[f] ?? 0})</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-black">
              <tr><th className="p-3">Order</th><th className="p-3">Date</th><th className="p-3">Customer</th>{mode === 'payments' ? <><th className="p-3">M-Pesa</th><th className="p-3">Receipt</th></> : <><th className="p-3">Delivery</th><th className="p-3">Status</th></>}<th className="p-3 text-right">Total</th><th className="p-3">Payment</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {ordersLoading && orders.orders.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-500 font-bold">Loading…</td></tr>}
              {!ordersLoading && orders.orders.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-500 font-bold">Nothing matches.</td></tr>}
              {orders.orders.map((o: any) => (
                <React.Fragment key={o.id}>
                  <tr className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-slate-300">#{o.id}</td>
                    <td className="p-3 text-slate-400 whitespace-nowrap">{formatWhen(o.createdAt)}</td>
                    <td className="p-3"><button onClick={() => goToCustomer(o.customer.id)} className="font-bold text-sky-400 hover:underline cursor-pointer text-left">{o.customer.fullName}</button><p className="text-[10px] text-slate-500">{o.customer.phone}</p></td>
                    {mode === 'payments'
                      ? <><td className="p-3 font-mono text-slate-300">{o.mpesaNumber || '—'}</td><td className="p-3 font-mono font-bold text-emerald-400">{o.mpesaReceipt || '—'}</td></>
                      : <><td className="p-3 text-slate-300">{o.county}{o.town ? `, ${o.town}` : ''}</td><td className="p-3 capitalize text-slate-300">{String(o.status).replace('_', ' ')}</td></>}
                    <td className="p-3 text-right font-bold">{formatKES(o.grandTotal)}</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${payPill(o.paymentState)}`}>{o.paymentState}</span></td>
                    <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                      <button style={{ display: can('payments.check') ? undefined : 'none' }} onClick={() => checkPayment(o.id)} disabled={checking === o.id} className="px-2.5 py-1.5 rounded-lg bg-sky-800 hover:bg-sky-700 disabled:opacity-50 text-white text-[10px] font-extrabold cursor-pointer">{checking === o.id ? 'Checking…' : 'Check payment'}</button>
                      <button onClick={() => setOpenOrder(openOrder === o.id ? null : o.id)} className="p-1.5 text-slate-400 hover:text-white cursor-pointer" title="Details"><Eye className="w-4 h-4" /></button>
                    </td>
                  </tr>
                  {(openOrder === o.id || checks[o.id]) && (
                    <tr className="bg-slate-950/60"><td colSpan={8} className="p-4 space-y-3">
                      {checks[o.id] && (
                        <div className={`p-3 rounded-xl border text-xs font-bold ${verdictStyle[checks[o.id].verdict] || verdictStyle.UNKNOWN}`}>
                          {checks[o.id].message}
                          <span className="block text-[10px] font-medium opacity-80 mt-0.5">PayHero status: {checks[o.id].payheroStatus || 'unreachable'} · Order amount {formatKES(checks[o.id].orderAmount)}{checks[o.id].mpesaReceipt ? ` · Receipt ${checks[o.id].mpesaReceipt}` : ''}</span>
                        </div>
                      )}
                      {openOrder === o.id && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div><p className="text-[10px] font-black uppercase text-slate-500">Items</p><p className="text-slate-200">{o.items}</p><p className="text-slate-500 mt-1">Rice {formatKES(o.subTotal)} + delivery {formatKES(o.transportFee)}</p></div>
                          <div><p className="text-[10px] font-black uppercase text-slate-500">Delivery address</p><p className="text-slate-200">{o.address || '—'}</p></div>
                          <div><p className="text-[10px] font-black uppercase text-slate-500">Payment</p><p className="text-slate-200">{o.paidTag || o.paymentState} via {String(o.method || 'mpesa').replace('_', ' ')}</p>{o.paidAt && <p className="text-slate-500">Paid {formatWhen(o.paidAt)}</p>}{o.failureReason && <p className="text-rose-300">Reason: {o.failureReason}</p>}<p className="text-slate-500 mt-1">{o.customer.email || ''}</p></div>
                        </div>
                      )}
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 flex items-center justify-between border-t border-slate-800 text-xs">
          <button disabled={orderPage <= 1} onClick={() => setOrderPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer">Newer</button>
          <span className="text-slate-500 font-bold">{orders.total} result(s) · page {orders.page} of {orders.pages}</span>
          <button disabled={orderPage >= orders.pages} onClick={() => setOrderPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer">Older</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-slate-950 text-slate-100 lg:h-[calc(100vh-4.5rem)] flex flex-col lg:flex-row lg:overflow-hidden">
      {/* FIXED NAVIGATION PANEL */}
      <aside className="lg:w-60 lg:shrink-0 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 lg:h-full flex lg:flex-col sticky top-0 lg:static z-20">
        <div className="hidden lg:block p-5 border-b border-slate-800">
          <div className="flex items-center gap-2"><Headphones className="w-5 h-5 text-sky-400" /><span className="text-[11px] font-black text-sky-400 uppercase tracking-widest">Customer Care</span></div>
          <p className="text-sm font-black text-white mt-2 truncate">{user.fullName}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">View everything · change names · reactivate accounts</p>
        </div>
        <nav className="flex lg:flex-col gap-1 p-2 lg:p-3 overflow-x-auto lg:overflow-visible w-full">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setSection(item.id)} className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${section === item.id ? 'bg-sky-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <item.icon className="w-4 h-4 shrink-0" /> <span>{item.label}</span>
              {!!item.badge && <span className="ml-auto px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black">{item.badge}</span>}
            </button>
          ))}
        </nav>
        <p className="hidden lg:block mt-auto p-4 text-[10px] text-slate-600 leading-relaxed">Everything you do here is recorded for the administrator.</p>
      </aside>

      {/* WORK PANEL */}
      <main className="flex-1 min-w-0 lg:overflow-y-auto p-4 sm:p-6 space-y-5">
        {section === 'overview' && (
          <>
            <div><h2 className="text-xl sm:text-2xl font-black text-white">Hello, {user.fullName}</h2><p className="text-xs text-slate-400 mt-1">Here is what needs attention today.</p></div>
            {overview ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StaffStat label="Accounts" value={overview.totalCustomers} />
                  <StaffStat label="Suspended" value={overview.suspended} tone="rose" />
                  <StaffStat label="Not verified" value={overview.unverified} tone="amber" />
                  <StaffStat label="New this week" value={overview.newThisWeek} tone="emerald" />
                  {overview.paidToday !== null && <StaffStat label="Paid today" value={overview.paidToday} tone="emerald" hint={formatKES(overview.paidTodayValue)} />}
                  {overview.pendingPayments !== null && <StaffStat label="Awaiting payment" value={overview.pendingPayments} tone="amber" />}
                  {overview.failedPayments !== null && <StaffStat label="Failed payments" value={overview.failedPayments} tone="rose" />}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button onClick={() => { setStatus('suspended'); setPage(1); setSection('customers'); }} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-rose-700 text-left cursor-pointer"><p className="text-xs font-black text-white flex items-center gap-2"><Ban className="w-4 h-4 text-rose-400" /> Suspended accounts</p><p className="text-[11px] text-slate-400 mt-1">Review and reactivate customers who were suspended.</p></button>
                  {can('payments.view') && <button onClick={() => { setPayFilter('failed'); setOrderPage(1); setSection('payments'); }} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-rose-700 text-left cursor-pointer"><p className="text-xs font-black text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-400" /> Failed payments</p><p className="text-[11px] text-slate-400 mt-1">Help customers whose M-Pesa payment did not go through.</p></button>}
                  {can('payments.view') && <button onClick={() => { setPayFilter('pending'); setOrderPage(1); setSection('payments'); }} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-700 text-left cursor-pointer"><p className="text-xs font-black text-white flex items-center gap-2"><Clock className="w-4 h-4 text-amber-400" /> Awaiting payment</p><p className="text-[11px] text-slate-400 mt-1">Check whether pending orders were actually paid.</p></button>}
                </div>
              </>
            ) : <p className="text-xs text-slate-500 font-bold">Loading…</p>}
          </>
        )}

        {section === 'customers' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="p-4 space-y-3 border-b border-slate-800">
                <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, phone, email or account number…" className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white" />
                <div className="flex flex-wrap gap-2">
                  {(['all', 'active', 'suspended', 'unverified'] as const).map(s => (
                    <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize cursor-pointer ${status === s ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{s}</button>
                  ))}
                  <span className="ml-auto text-[11px] font-bold text-slate-500 self-center">{list.total} found</span>
                </div>
              </div>
              <div className="divide-y divide-slate-800/60 max-h-[62vh] overflow-y-auto">
                {loading && list.users.length === 0 && <p className="p-6 text-center text-xs text-slate-500 font-bold">Searching…</p>}
                {!loading && list.users.length === 0 && <p className="p-6 text-center text-xs text-slate-500 font-bold">No accounts match.</p>}
                {list.users.map((x: any) => (
                  <button key={x.id} onClick={() => openUser(x.id)} className={`w-full p-4 text-left hover:bg-slate-800/50 cursor-pointer flex items-center justify-between gap-3 ${selected?.user?.id === x.id ? 'bg-slate-800/70' : ''}`}>
                    <div className="min-w-0"><p className="text-xs font-extrabold text-white truncate">{x.fullName}</p><p className="text-[11px] text-slate-400 truncate">{x.phoneNumber}{x.email ? ` · ${x.email}` : ''}</p></div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {x.isActive === false ? <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[9px] font-black uppercase">Suspended</span>
                        : x.isVerified === false ? <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[9px] font-black uppercase">Unverified</span>
                        : <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-black uppercase">Active</span>}
                      {(x.role === 'agent' || x.role === 'support' || x.role === 'admin') && <span className="text-[9px] font-black uppercase text-sky-400">{x.role}</span>}
                    </div>
                  </button>
                ))}
              </div>
              <div className="p-3 flex items-center justify-between border-t border-slate-800 text-xs">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer">Previous</button>
                <span className="text-slate-500 font-bold">Page {list.page} of {list.pages}</span>
                <button disabled={page >= list.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer">Next</button>
              </div>
            </div>

            <div className="xl:col-span-7 space-y-4">
              {!selected && !detailLoading && <div className="bg-slate-900 rounded-2xl border border-slate-800 p-10 text-center text-xs font-bold text-slate-500">Select an account to see its details.</div>}
              {detailLoading && <div className="bg-slate-900 rounded-2xl border border-slate-800 p-10 text-center text-xs font-bold text-slate-500">Loading account…</div>}
              {selected && u && !detailLoading && (
                <>
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-[10px] font-black uppercase text-slate-500">Account #{u.id} · {u.role === 'user' ? 'customer' : u.role}</p><h3 className="text-lg font-black text-white">{u.fullName}</h3></div>
                      {u.isActive === false ? <span className="px-3 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-black uppercase">Suspended</span> : <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-black uppercase">Active</span>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div><p className="text-[10px] font-black uppercase text-slate-500">Phone</p><p className="font-bold text-slate-200">{u.phoneNumber || '—'}</p></div>
                      <div><p className="text-[10px] font-black uppercase text-slate-500">Email</p><p className="font-bold text-slate-200 break-all">{u.email || '—'}</p></div>
                      <div><p className="text-[10px] font-black uppercase text-slate-500">Reward points</p><p className="font-bold text-amber-400">{u.rewardPoints || 0} pts</p></div>
                      <div><p className="text-[10px] font-black uppercase text-slate-500">Joined</p><p className="font-bold text-slate-200">{formatWhen(u.createdAt)}</p></div>
                      <div><p className="text-[10px] font-black uppercase text-slate-500">Verified</p><p className="font-bold text-slate-200">{u.isVerified === false ? 'No' : 'Yes'}</p></div>
                      <div><p className="text-[10px] font-black uppercase text-slate-500">Referred by</p><p className="font-bold text-slate-200">{selected.referredBy || '—'}</p></div>
                    </div>
                    {readOnly ? (
                      <p className="text-[11px] font-bold text-slate-400 pt-3 border-t border-slate-800">This is a staff or administrator account, so it is view-only for you.</p>
                    ) : (
                      <>
                        <form onSubmit={saveName} style={{ display: can('users.rename') ? undefined : 'none' }} className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-800">
                          <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white" placeholder="Correct full name" />
                          <button type="submit" disabled={busy || nameDraft.trim() === u.fullName} className="px-4 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer">Update name</button>
                        </form>
                        {u.isActive === false && can('users.unsuspend') && (
                          <form onSubmit={unsuspend} className="space-y-2 pt-3 border-t border-slate-800">
                            <p className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5"><Ban className="w-3.5 h-3.5" /> Suspended: this customer cannot sign in.</p>
                            <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white" placeholder="Why is it being reactivated? (required)" />
                            <button type="submit" disabled={busy || reason.trim().length < 3} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer"><UserCheck className="w-4 h-4" /> Reactivate account</button>
                          </form>
                        )}
                      </>
                    )}
                  </div>

                  <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                    <p className="p-4 text-xs font-black text-white border-b border-slate-800">Orders ({selected.orders.length})</p>
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-black"><tr><th className="p-3">Order</th><th className="p-3">Date</th><th className="p-3">Items</th><th className="p-3 text-right">Total</th><th className="p-3">Status</th><th className="p-3">Payment</th><th className="p-3"></th></tr></thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {selected.orders.length === 0 && <tr><td colSpan={7} className="p-5 text-center text-slate-500 font-bold">No orders yet.</td></tr>}
                          {selected.orders.map((o: any) => (
                            <tr key={o.id}>
                              <td className="p-3 font-mono font-bold text-slate-400">#{o.id}</td>
                              <td className="p-3 text-slate-400 whitespace-nowrap">{formatWhen(o.createdAt)}</td>
                              <td className="p-3 text-slate-300 max-w-[160px] truncate" title={o.items}>{o.items}</td>
                              <td className="p-3 text-right font-bold">{formatKES(o.grandTotal)}</td>
                              <td className="p-3 capitalize text-slate-300">{String(o.status).replace('_', ' ')}</td>
                              <td className="p-3"><span className="font-bold text-slate-200">{o.paymentStatus}</span>{o.mpesaReceipt && <span className="block font-mono text-[10px] text-slate-500">{o.mpesaReceipt}</span>}</td>
                              <td className="p-3"><button onClick={() => { setOrderSearch(String(o.id)); setPayFilter('all'); setOrderPage(1); setSection('payments'); }} className="text-[10px] font-extrabold text-sky-400 hover:underline cursor-pointer">Check</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
                      <p className="text-xs font-black text-white flex items-center gap-2"><StickyNote className="w-4 h-4 text-amber-400" /> Case notes</p>
                      <form onSubmit={addNote} style={{ display: can('users.notes') ? undefined : 'none' }} className="flex gap-2">
                        <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white" placeholder="Add a note about this customer…" />
                        <button type="submit" disabled={busy || noteDraft.trim().length < 3 || u.role === 'admin'} className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-xs font-bold cursor-pointer">Add</button>
                      </form>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selected.notes.length === 0 && <p className="text-[11px] text-slate-500 font-bold">No notes yet.</p>}
                        {selected.notes.map((n: any) => (<div key={n.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800"><p className="text-xs text-slate-200">{n.note}</p><p className="text-[10px] text-slate-500 mt-1">{n.authorName} · {formatWhen(n.createdAt)}</p></div>))}
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
                      <p className="text-xs font-black text-white flex items-center gap-2"><Clock className="w-4 h-4 text-sky-400" /> Account history</p>
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {selected.history.length === 0 && <p className="text-[11px] text-slate-500 font-bold">Nothing recorded yet.</p>}
                        {selected.history.map((h: any) => (<div key={h.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800"><p className="text-xs text-slate-200">{h.summary}</p><p className="text-[10px] text-slate-500 mt-1">{formatWhen(h.createdAt)}</p></div>))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {section === 'orders' && <><h2 className="text-xl font-black text-white">All orders</h2>{OrdersTable({ mode: 'orders' })}</>}
        {section === 'payments' && <><h2 className="text-xl font-black text-white">Payments</h2><p className="text-xs text-slate-400 -mt-2">Use <span className="font-bold text-sky-300">Check payment</span> to ask PayHero if an order was really paid. It only reports; it never changes the order.</p>{OrdersTable({ mode: 'payments' })}</>}

        {section === 'reviews' && <><h2 className="text-xl font-black text-white">Customer reviews</h2><AdminReviewsPanel token={token} showToast={showToast} /></>}

        {section === 'activity' && (
          <>
            <h2 className="text-xl font-black text-white">My recent activity</h2>
            <div className="bg-slate-900 rounded-2xl border border-slate-800 divide-y divide-slate-800/60">
              {(!overview || overview.myRecentActions.length === 0) && <p className="p-6 text-center text-xs text-slate-500 font-bold">Nothing yet.</p>}
              {overview && overview.myRecentActions.map((a: any) => (<div key={a.id} className="p-4"><p className="text-xs text-slate-200">{a.summary}</p><p className="text-[10px] text-slate-500 mt-1">{formatWhen(a.createdAt)}</p></div>))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN: AGENTS (appoint, track, pay out, set commission rates)
// ---------------------------------------------------------------------------
function AdminAgentsPanel({ token, showToast, adminUsers, onUsersChanged }: { token: string | null; showToast: ToastFn; adminUsers: UserAccount[]; onUsersChanged: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState({ newCustomerRate: '60', repeatRate: '40' });
  const [appointId, setAppointId] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [payout, setPayout] = useState({ reference: '', method: 'mpesa', note: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await staffApi('/admin/agents', token);
      setData(d);
      setRates({ newCustomerRate: String(Math.round(d.rates.newCustomerRate * 100)), repeatRate: String(Math.round(d.rates.repeatRate * 100)) });
    } catch (err: any) { showToast(err.message, 'error'); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openAgent = async (id: number) => {
    try { setDetail(await staffApi(`/admin/agents/${id}`, token)); setPayout({ reference: '', method: 'mpesa', note: '' }); }
    catch (err: any) { showToast(err.message, 'error'); }
  };

  const saveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(rates.newCustomerRate), r = Number(rates.repeatRate);
    if (![n, r].every(v => Number.isFinite(v) && v >= 0 && v <= 100)) { showToast('Enter both rates as percentages between 0 and 100.', 'error'); return; }
    try {
      const res = await staffApi('/admin/config/agent-commission', token, { method: 'PUT', body: { newCustomerRate: n / 100, repeatRate: r / 100 } });
      showToast(res.message || 'Rates saved.', 'success');
      load();
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const setRole = async (userId: number, role: 'agent' | 'customer', label: string) => {
    if (!confirm(label)) return;
    try {
      const res = await staffApi(`/admin/users/${userId}/role`, token, { method: 'PUT', body: { role } });
      showToast(res.message || 'Role updated.', 'success');
      setAppointId('');
      if (detail && detail.agent.id === userId) setDetail(null);
      load();
      onUsersChanged();
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const regenerate = async (id: number) => {
    if (!confirm('Create a new referral code for this agent? The old code will stop working for new sign-ups (existing customers stay linked).')) return;
    try {
      const res = await staffApi(`/admin/agents/${id}/regenerate-code`, token, { method: 'POST' });
      showToast(`New code: ${res.referralCode}`, 'success');
      load();
      if (detail) openAgent(id);
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const recordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    if (!confirm(`Record a payout of ${formatKES(detail.summary.commissionPending)} to ${detail.agent.fullName}? This marks all pending commissions as paid.`)) return;
    setBusy(true);
    try {
      const res = await staffApi(`/admin/agents/${detail.agent.id}/payouts`, token, { method: 'POST', body: payout });
      showToast(res.message || 'Payout recorded.', 'success');
      await openAgent(detail.agent.id);
      load();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };

  const eligible = adminUsers.filter(u => u.role !== 'admin' && u.role !== 'agent' && u.role !== 'support' && !u.isSuspended && (u as any).isVerified !== false);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StaffStat label="Active agents" value={data ? data.agents.filter((a: any) => a.isCurrentAgent).length : '…'} tone="sky" />
        <StaffStat label="Sales through agents" value={data ? formatKES(data.totals.sales) : '…'} />
        <StaffStat label="Commission owed" value={data ? formatKES(data.totals.pending) : '…'} tone="amber" hint="Pending payout" />
        <StaffStat label="Commission paid" value={data ? formatKES(data.totals.paid) : '…'} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form onSubmit={saveRates} className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-3">
          <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Percent className="w-4 h-4 text-emerald-400" /> Commission rates (share of profit)</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-400 mb-1">New customer&apos;s first order (%)</label>
              <input type="number" min={0} max={100} value={rates.newCustomerRate} onChange={(e) => setRates(r => ({ ...r, newCustomerRate: e.target.value }))} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold" />
            </div>
            <div>
              <label className="block font-bold text-slate-400 mb-1">Repeat / old customers (%)</label>
              <input type="number" min={0} max={100} value={rates.repeatRate} onChange={(e) => setRates(r => ({ ...r, repeatRate: e.target.value }))} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500">Profit = price paid minus buying price, per bag. Delivery fees are never counted. Changes apply only to payments confirmed after you save.</p>
          <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer">Save commission rates</button>
        </form>

        <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-3">
          <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2"><Briefcase className="w-4 h-4 text-sky-400" /> Appoint a new agent</h4>
          <select value={appointId} onChange={(e) => setAppointId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-bold cursor-pointer">
            <option value="">Choose a customer…</option>
            {eligible.map(u => <option key={u.id} value={u.id}>{u.fullName} — {u.phoneNumber || u.email}</option>)}
          </select>
          <button disabled={!appointId} onClick={() => setRole(Number(appointId), 'agent', 'Make this customer an agent? They get a referral code and an agent dashboard at their next sign-in.')} className="w-full py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white font-extrabold text-xs cursor-pointer">Make agent</button>
          <p className="text-[10px] text-slate-500">Agents sign in exactly like customers. Dismissing an agent turns them back into a normal customer; their past earnings stay on record.</p>
        </div>
      </div>

      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-slate-800">
          <p className="text-xs font-black text-white">All agents</p>
          <button onClick={load} className="p-1.5 text-slate-400 hover:text-emerald-400 cursor-pointer" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-black"><tr><th className="p-3">Agent</th><th className="p-3">Code</th><th className="p-3 text-right">Customers</th><th className="p-3 text-right">Orders</th><th className="p-3 text-right">Kg sold</th><th className="p-3 text-right">Sales</th><th className="p-3 text-right">Owed</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-800/60">
              {data && data.agents.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-500 font-bold">No agents yet. Appoint one above.</td></tr>}
              {data && data.agents.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-800/40">
                  <td className="p-3"><p className="font-extrabold text-white">{a.fullName}</p><p className="text-[10px] text-slate-500">{a.phoneNumber}{!a.isCurrentAgent && ' · dismissed'}{!a.isActive && ' · suspended'}</p></td>
                  <td className="p-3 font-mono font-bold text-emerald-400">{a.referralCode}</td>
                  <td className="p-3 text-right">{a.summary.customers}</td>
                  <td className="p-3 text-right">{a.summary.orders}</td>
                  <td className="p-3 text-right">{a.summary.kgSold}</td>
                  <td className="p-3 text-right">{formatKES(a.summary.salesValue)}</td>
                  <td className="p-3 text-right font-black text-amber-400">{formatKES(a.summary.commissionPending)}</td>
                  <td className="p-3 text-right text-emerald-400">{formatKES(a.summary.commissionPaid)}</td>
                  <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                    <button onClick={() => openAgent(a.id)} className="p-1.5 text-slate-400 hover:text-emerald-400 cursor-pointer" title="View details & pay out"><Eye className="w-4 h-4" /></button>
                    {a.isCurrentAgent && <button onClick={() => regenerate(a.id)} className="p-1.5 text-slate-400 hover:text-sky-400 cursor-pointer" title="New referral code"><RefreshCw className="w-4 h-4" /></button>}
                    {a.isCurrentAgent
                      ? <button onClick={() => setRole(a.id, 'customer', `Dismiss ${a.fullName} as an agent? They become a normal customer and stop earning commission.`)} className="p-1.5 text-amber-400 hover:text-amber-300 cursor-pointer" title="Dismiss agent"><UserX className="w-4 h-4" /></button>
                      : <button onClick={() => setRole(a.id, 'agent', `Re-appoint ${a.fullName} as an agent? Their old code is restored.`)} className="p-1.5 text-emerald-400 hover:text-emerald-300 cursor-pointer" title="Re-appoint agent"><UserCheck className="w-4 h-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-4xl my-8 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500">Agent #{detail.agent.id} · code {detail.agent.referralCode}</p>
                <h3 className="text-lg font-black text-white">{detail.agent.fullName}</h3>
                <p className="text-xs text-slate-400">{detail.agent.phoneNumber} {detail.agent.email ? `· ${detail.agent.email}` : ''}</p>
              </div>
              <button onClick={() => setDetail(null)} className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StaffStat label="Customers" value={detail.summary.customers} tone="sky" />
              <StaffStat label="Kg sold" value={detail.summary.kgSold} tone="emerald" />
              <StaffStat label="Profit generated" value={formatKES(detail.summary.profitGenerated)} />
              <StaffStat label="Owed now" value={formatKES(detail.summary.commissionPending)} tone="amber" />
            </div>
            {detail.summary.clawbackDue > 0 && <div className="bg-rose-950/60 border border-rose-800 rounded-2xl p-3 text-xs text-rose-200 font-bold">{formatKES(detail.summary.clawbackDue)} was paid on orders that were later reversed — recover it or offset it against the next payout.</div>}

            {detail.summary.commissionPending > 0 && (
              <form onSubmit={recordPayout} className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                <input required value={payout.reference} onChange={(e) => setPayout(p => ({ ...p, reference: e.target.value }))} placeholder="M-Pesa / bank reference *" className="sm:col-span-2 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono font-bold" />
                <select value={payout.method} onChange={(e) => setPayout(p => ({ ...p, method: e.target.value }))} className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-bold cursor-pointer">
                  <option value="mpesa">M-Pesa</option><option value="bank">Bank</option><option value="cash">Cash</option>
                </select>
                <button type="submit" disabled={busy} className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold cursor-pointer flex items-center justify-center gap-2"><Wallet className="w-4 h-4" /> Record payout</button>
                <input value={payout.note} onChange={(e) => setPayout(p => ({ ...p, note: e.target.value }))} placeholder="Note (optional)" className="sm:col-span-4 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white" />
              </form>
            )}

            <div className="overflow-x-auto rounded-2xl border border-slate-800 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-black"><tr><th className="p-3">Order</th><th className="p-3">Date</th><th className="p-3">Customer</th><th className="p-3">Type</th><th className="p-3 text-right">Profit</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Commission</th><th className="p-3">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-800/60">
                  {detail.commissions.length === 0 && <tr><td colSpan={8} className="p-5 text-center text-slate-500 font-bold">No sales yet.</td></tr>}
                  {detail.commissions.map((c: any) => (
                    <tr key={c.id}>
                      <td className="p-3 font-mono text-slate-400">#{c.orderId}</td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">{formatWhen(c.date)}</td>
                      <td className="p-3 font-bold text-white">{c.customer}</td>
                      <td className="p-3">{c.type === 'NEW_CUSTOMER' ? 'New' : 'Repeat'}</td>
                      <td className="p-3 text-right">{formatKES(c.profit)}</td>
                      <td className="p-3 text-right">{Math.round(c.rate * 100)}%</td>
                      <td className="p-3 text-right font-black text-emerald-400">{formatKES(c.amount)}</td>
                      <td className="p-3"><StatusPill status={c.status} />{c.note && <span className="block text-[10px] text-slate-500 mt-0.5 max-w-[160px]">{c.note}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detail.payouts.length > 0 && (
              <div className="text-xs space-y-1.5">
                <p className="font-black text-white">Payout history</p>
                {detail.payouts.map((p: any) => (
                  <div key={p.id} className="flex justify-between gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">{formatWhen(p.date)} · <span className="font-mono text-slate-200">{p.reference}</span> · {String(p.method).toUpperCase()}</span>
                    <span className="font-black text-emerald-400">{formatKES(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN: ACTIVITY FEED (everything that happens, live)
// ---------------------------------------------------------------------------
function AdminActivityPanel({ token, showToast, socket }: { token: string | null; showToast: ToastFn; socket: Socket | null }) {
  const [summary, setSummary] = useState<any>(null);
  const [feed, setFeed] = useState<any>({ events: [], total: 0, page: 1, pages: 1 });
  const [filters, setFilters] = useState({ category: 'all', severity: 'all', actorRole: 'all', q: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(true);

  const queryString = useCallback((extra: Record<string, string | number> = {}) => {
    const p = new URLSearchParams();
    Object.entries({ ...filters, ...extra }).forEach(([k, v]) => { if (v !== '' && v !== 'all') p.set(k, String(v)); });
    return p.toString();
  }, [filters]);

  const loadSummary = useCallback(async () => {
    try { setSummary(await staffApi('/admin/events/summary', token)); } catch (_) { /* optional */ }
  }, [token]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try { setFeed(await staffApi(`/admin/events?${queryString({ page, limit: 50 })}`, token)); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setLoading(false); }
  }, [token, queryString, page]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { const t = setTimeout(loadFeed, 250); return () => clearTimeout(t); }, [loadFeed]);

  // Live updates pushed by the server as things happen
  useEffect(() => {
    if (!socket || !live) return;
    const onEvent = () => { loadSummary(); if (page === 1) loadFeed(); };
    socket.on('activityEvent', onEvent);
    return () => { socket.off('activityEvent', onEvent); };
  }, [socket, live, page, loadFeed, loadSummary]);

  const exportCsv = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/events/export/csv?${queryString()}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const setFilter = (k: string, v: string) => { setPage(1); setFilters(f => ({ ...f, [k]: v })); };
  const sevStyle: Record<string, string> = { info: 'bg-slate-800 text-slate-300', warn: 'bg-amber-950 text-amber-300 border border-amber-800', alert: 'bg-rose-950 text-rose-300 border border-rose-800' };
  const maxHour = summary ? Math.max(1, ...summary.byHour) : 1;

  return (
    <div className="space-y-6">
      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StaffStat label="Events (24h)" value={summary.last24h} tone="sky" />
            <StaffStat label="Security alerts" value={summary.alerts} tone={summary.alerts ? 'rose' : 'slate'} />
            <StaffStat label="Warnings" value={summary.warnings} tone="amber" />
            <StaffStat label="Failed logins (1h)" value={summary.failedLoginsLastHour} tone={summary.failedLoginsLastHour > 5 ? 'rose' : 'slate'} />
            <StaffStat label="Agent commission owed" value={formatKES(summary.pendingCommission)} tone="amber" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-slate-900 rounded-3xl p-4 border border-slate-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">Activity per hour — last 24 hours</p>
              <div className="flex items-end gap-1 h-24">
                {summary.byHour.map((n: number, i: number) => (
                  <div key={i} className="flex-1 rounded-t bg-emerald-500/80" style={{ height: `${Math.max(3, (n / maxHour) * 100)}%`, opacity: n ? 1 : 0.2 }} title={`${n} event(s)`} />
                ))}
              </div>
            </div>
            <div className="bg-slate-900 rounded-3xl p-4 border border-slate-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Most active (24h)</p>
              <div className="space-y-1.5">
                {summary.topActors.length === 0 && <p className="text-xs text-slate-500 font-bold">Nothing yet.</p>}
                {summary.topActors.map((a: any) => (
                  <button key={a.actorId} onClick={() => setFilter('q', a.name || '')} className="w-full flex justify-between text-xs p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer">
                    <span className="font-bold text-slate-200 truncate">{a.name} <span className="text-[9px] uppercase text-slate-500">{a.role}</span></span>
                    <span className="font-black text-emerald-400">{a.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
        <div className="p-4 grid grid-cols-2 lg:grid-cols-7 gap-2 border-b border-slate-800 text-xs">
          <input value={filters.q} onChange={(e) => setFilter('q', e.target.value)} placeholder="Search who / what / order #…" className="col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white" />
          <select value={filters.category} onChange={(e) => setFilter('category', e.target.value)} className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white cursor-pointer">
            <option value="all">All categories</option><option value="auth">Sign-ins & accounts</option><option value="orders">Orders & payments</option><option value="users">Users & roles</option><option value="agents">Agents & commission</option><option value="inventory">Inventory</option><option value="settings">Settings</option><option value="admin">Other admin</option>
          </select>
          <select value={filters.severity} onChange={(e) => setFilter('severity', e.target.value)} className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white cursor-pointer">
            <option value="all">Any severity</option><option value="alert">Alerts</option><option value="warn">Warnings</option><option value="info">Info</option>
          </select>
          <select value={filters.actorRole} onChange={(e) => setFilter('actorRole', e.target.value)} className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white cursor-pointer">
            <option value="all">Anyone</option><option value="admin">Admins</option><option value="support">Customer care</option><option value="agent">Agents</option><option value="customer">Customers</option><option value="user">Customers (legacy)</option><option value="anonymous">Not signed in</option>
          </select>
          <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white" title="From" />
          <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white" title="To" />
        </div>
        <div className="px-4 py-2 flex items-center justify-between text-xs border-b border-slate-800">
          <span className="font-bold text-slate-400">{feed.total.toLocaleString()} event(s)</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setLive(l => !l)} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer flex items-center gap-1.5 ${live ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
              <span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} /> {live ? 'Live' : 'Paused'}
            </button>
            <button onClick={() => { loadFeed(); loadSummary(); }} className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-emerald-400 cursor-pointer" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <button onClick={exportCsv} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 font-bold hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"><Download className="w-3.5 h-3.5" /> Export CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-black"><tr><th className="p-3">When</th><th className="p-3">Level</th><th className="p-3">Who</th><th className="p-3">What happened</th><th className="p-3">IP</th></tr></thead>
            <tbody className="divide-y divide-slate-800/60">
              {feed.events.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-bold">{loading ? 'Loading…' : 'No events match these filters.'}</td></tr>}
              {feed.events.map((e: any) => (
                <tr key={e.id} className="hover:bg-slate-800/40 align-top">
                  <td className="p-3 text-slate-400 whitespace-nowrap">{formatWhen(e.createdAt)}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-md font-black text-[9px] uppercase ${sevStyle[e.severity] || sevStyle.info}`}>{e.severity}</span></td>
                  <td className="p-3"><p className="font-bold text-white">{e.actorName || 'System'}</p><p className="text-[9px] uppercase font-black text-slate-500">{e.actorRole || 'system'}</p></td>
                  <td className="p-3 text-slate-300 max-w-md"><span className="font-mono text-[10px] text-emerald-400">{e.action}</span><p className="mt-0.5">{e.summary}</p></td>
                  <td className="p-3 font-mono text-[10px] text-slate-500">{e.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 flex items-center justify-between border-t border-slate-800 text-xs">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer">Newer</button>
          <span className="text-slate-500 font-bold">Page {feed.page} of {feed.pages}</span>
          <button disabled={page >= feed.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer">Older</button>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// v3.7 ADDITIONS: mobile admin navigation, Payments Center (Till + STK checks),
// Promo Codes and Delivery Dispatch board
// ============================================================================

type AdminTabDef = { id: string; label: string; icon: any; desc: string; group: string };

/** Phone-first admin navigation: a sticky strip of big pills plus an "All sections" sheet. Hidden on large screens (the sidebar is used there). */
function AdminMobileNav({ tabs, active, onChange, badges = {} }: { tabs: AdminTabDef[]; active: string; onChange: (id: string) => void; badges?: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const current = tabs.find(t => t.id === active) || tabs[0];
  const CurrentIcon = current.icon;
  const groups = Array.from(new Set(tabs.map(t => t.group)));

  useEffect(() => {
    const el = stripRef.current?.querySelector(`[data-tab="${active}"]`) as HTMLElement | null;
    if (el && stripRef.current) stripRef.current.scrollTo({ left: el.offsetLeft - 16, behavior: 'smooth' });
  }, [active]);

  const pick = (id: string) => { onChange(id); setOpen(false); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="lg:hidden sticky top-20 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-slate-950/95 backdrop-blur-md border-b border-slate-800">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(true)} className="shrink-0 flex items-center gap-2 pl-3 pr-3.5 py-2.5 rounded-2xl bg-emerald-700 text-white text-xs font-black shadow-lg active:scale-95" aria-label="Open all admin sections">
          <Menu className="w-4 h-4" /> <span>Menu</span>
        </button>
        <div ref={stripRef} className="flex-1 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden snap-x scroll-smooth" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(t => {
            const Icon = t.icon; const on = t.id === active;
            return (
              <button key={t.id} data-tab={t.id} onClick={() => pick(t.id)}
                className={`snap-start shrink-0 relative flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all active:scale-95 ${on ? 'bg-emerald-800 border-emerald-500/50 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                <Icon className="w-4 h-4" /> {t.label}
                {badges[t.id] > 0 && <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center">{badges[t.id]}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500 flex items-center gap-1.5"><CurrentIcon className="w-3 h-3" /> {current.label} · {current.desc}</p>

      {open && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-end" onClick={() => setOpen(false)}>
          <div className="w-full max-h-[85vh] overflow-y-auto bg-slate-900 rounded-t-3xl border-t border-slate-700 p-4 pb-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-white">Admin sections</p>
              <button onClick={() => setOpen(false)} className="p-2 rounded-full bg-slate-800 text-slate-300" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            {groups.map(g => (
              <div key={g} className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{g}</p>
                <div className="grid grid-cols-2 gap-2">
                  {tabs.filter(t => t.group === g).map(t => {
                    const Icon = t.icon; const on = t.id === active;
                    return (
                      <button key={t.id} onClick={() => pick(t.id)} className={`relative p-3 rounded-2xl text-left border flex flex-col gap-1.5 active:scale-95 ${on ? 'bg-emerald-900/70 border-emerald-500/50' : 'bg-slate-950 border-slate-800'}`}>
                        <Icon className={`w-5 h-5 ${on ? 'text-emerald-300' : 'text-slate-400'}`} />
                        <span className="text-xs font-extrabold text-white leading-tight">{t.label}</span>
                        <span className="text-[10px] text-slate-500 leading-tight">{t.desc}</span>
                        {badges[t.id] > 0 && <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center">{badges[t.id]}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PAYMENTS CENTER: payment methods, Till confirmations, pasted M-Pesa messages, unpaid orders
// ---------------------------------------------------------------------------
function AdminPaymentsPanel({ token, showToast }: { token: string | null; showToast: ToastFn }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ tillNumber: '', tillName: '', tillEnabled: false, stkEnabled: true });
  const [formLoaded, setFormLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await staffApi('/admin/payments/overview', token);
      setData(d);
      if (!formLoaded && d.config) {
        setForm({ tillNumber: d.config.tillNumber || '', tillName: d.config.tillName || '', tillEnabled: !!d.config.tillEnabled, stkEnabled: d.config.stkEnabled !== false });
        setFormLoaded(true);
      }
    } catch (err: any) { showToast(err.message, 'error'); } finally { setLoading(false); }
  }, [token, formLoaded]);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const saveSettings = async () => {
    setSaving(true);
    try { await staffApi('/admin/config/payment-methods', token, { method: 'PUT', body: form }); showToast('Payment settings saved.', 'success'); load(); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setSaving(false); }
  };
  const approve = async (r: any) => {
    setBusyId(`a${r.id}`);
    try { await staffApi(`/admin/payments/till/${r.id}/approve`, token, { method: 'POST', body: { amount: amounts[r.id] ? Number(amounts[r.id]) : undefined } }); showToast(`Order #${r.orderId} marked paid.`, 'success'); load(); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setBusyId(null); }
  };
  const reject = async (r: any) => {
    const reason = window.prompt('Why are you rejecting this code? (the customer will see that it could not be verified)', 'Not found on the Till statement');
    if (reason === null) return;
    setBusyId(`r${r.id}`);
    try { await staffApi(`/admin/payments/till/${r.id}/reject`, token, { method: 'POST', body: { reason } }); showToast('Code rejected.', 'info'); load(); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setBusyId(null); }
  };
  const doImport = async () => {
    setImporting(true);
    try {
      const r = await staffApi('/admin/payments/till/import', token, { method: 'POST', body: { text: importText } });
      showToast(`${r.found} message(s) read · ${r.matched} order(s) confirmed · ${r.duplicates} already known.`, 'success');
      setImportText(''); load();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setImporting(false); }
  };
  const recheck = async (o: any) => {
    setBusyId(`c${o.id}`);
    try { const r = await staffApi(`/admin/payments/orders/${o.id}/recheck`, token, { method: 'POST' }); showToast(r.message, r.verdict === 'PAID' ? 'success' : 'info'); load(); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setBusyId(null); }
  };

  if (loading) return <div className={`${cardCls} p-8 text-center text-xs text-slate-400`}>Loading payments…</div>;
  const waiting = data?.waiting || [];
  const unpaid = data?.unpaidOrders || [];

  return (
    <div className="space-y-5">
      {/* Methods */}
      <div className={`${cardCls} p-4 sm:p-6 space-y-4`}>
        <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2"><Wallet className="w-5 h-5 text-emerald-400" /> Payment methods</h3>
        <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
          <input type="checkbox" checked={form.stkEnabled} onChange={(e) => setForm({ ...form, stkEnabled: e.target.checked })} className="mt-1 w-5 h-5 accent-emerald-500" />
          <span><span className="block text-xs font-extrabold text-white">M-Pesa STK push (PayHero)</span><span className="block text-[11px] text-slate-500">A prompt appears on the customer&apos;s phone. Confirmed by asking PayHero, so no one can fake it.</span></span>
        </label>
        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.tillEnabled} onChange={(e) => setForm({ ...form, tillEnabled: e.target.checked })} className="mt-1 w-5 h-5 accent-emerald-500" />
            <span><span className="block text-xs font-extrabold text-white">Pay to Till number (Buy Goods)</span><span className="block text-[11px] text-slate-500">Customer pays to your Till, then enters the M-Pesa code. The code is checked against real payments before the order is marked paid.</span></span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Till number</label><input inputMode="numeric" value={form.tillNumber} onChange={(e) => setForm({ ...form, tillNumber: e.target.value.replace(/\D/g, '').slice(0, 8) })} placeholder="e.g. 5123456" className={inputCls} /></div>
            <div><label className={labelCls}>Name shown on M-Pesa</label><input value={form.tillName} onChange={(e) => setForm({ ...form, tillName: e.target.value })} placeholder="e.g. MWEA RICE HUB" className={inputCls} /></div>
          </div>
        </div>
        <button onClick={saveSettings} disabled={saving} className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer">{saving ? 'Saving…' : 'Save payment settings'}</button>
        <div className={`p-3 rounded-2xl border text-[11px] leading-relaxed ${data?.c2bConfigured ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300' : 'bg-amber-950/30 border-amber-800/40 text-amber-200'}`}>
          {data?.c2bConfigured
            ? 'Automatic Till checking is ON: every payment to your Till reaches the system from Safaricom, so customer codes are confirmed instantly.'
            : 'Automatic Till checking is OFF. Customer codes wait below until you confirm them, or until you paste your M-Pesa messages in the box further down. To make it fully automatic, register the Confirmation URL with Safaricom Daraja (C2B) and set MPESA_C2B_SECRET on the server.'}
        </div>
      </div>

      {/* Waiting */}
      <div className={`${cardCls} p-4 sm:p-6 space-y-3`}>
        <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2"><Clock className="w-4 h-4 text-amber-400" /> Till codes waiting for confirmation <span className="px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 text-[10px]">{waiting.length}</span></h3>
        {waiting.length === 0 && <p className="text-xs text-slate-500">Nothing waiting. New customer codes appear here.</p>}
        {waiting.map((r: any) => (
          <div key={r.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black text-white">Order #{r.orderId} · {r.order ? formatKES(r.order.total) : '—'}</p>
                <p className="text-[11px] text-slate-400">{r.order?.customer || 'Customer'} {r.order?.phone ? `· ${r.order.phone}` : ''}</p>
              </div>
              <button onClick={() => copyText(r.mpesaCode, showToast, 'Code copied.')} className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono font-black text-emerald-300 text-xs flex items-center gap-1.5"><Copy className="w-3 h-3" /> {r.mpesaCode}</button>
            </div>
            <p className="text-[11px] text-slate-500">{r.amount ? `Amount on record: ${formatKES(Number(r.amount))}` : 'Not yet seen in your M-Pesa feed. Check your Till statement for this code, then enter the amount you see.'}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              {!r.amount && <input inputMode="decimal" placeholder="Amount on statement (KES)" value={amounts[r.id] || ''} onChange={(e) => setAmounts({ ...amounts, [r.id]: e.target.value })} className={inputCls} />}
              <button onClick={() => approve(r)} disabled={busyId === `a${r.id}`} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer whitespace-nowrap">{busyId === `a${r.id}` ? 'Confirming…' : 'Confirm payment'}</button>
              <button onClick={() => reject(r)} disabled={busyId === `r${r.id}`} className="px-4 py-2.5 rounded-xl bg-rose-900/70 hover:bg-rose-800 text-rose-200 text-xs font-extrabold cursor-pointer">Reject</button>
            </div>
          </div>
        ))}
      </div>

      {/* Import */}
      <div className={`${cardCls} p-4 sm:p-6 space-y-3`}>
        <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2"><FileText className="w-4 h-4 text-sky-400" /> Paste M-Pesa messages</h3>
        <p className="text-[11px] text-slate-500">Copy the &quot;Confirmed. Ksh… received from…&quot; SMS messages from your Till phone (or the statement lines) and paste them here. Each code is saved and matched to any waiting order automatically.</p>
        <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={5} placeholder="SJK4L9XQ2P Confirmed. You have received Ksh1,500.00 from JOHN DOE 2547… on 20/10/26…" className={`${inputCls} font-mono`} />
        <button onClick={doImport} disabled={importing || importText.trim().length < 20} className="px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer">{importing ? 'Reading…' : 'Read and match'}</button>
      </div>

      {/* Unpaid orders */}
      <div className={`${cardCls} p-4 sm:p-6 space-y-3`}>
        <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-400" /> Unpaid orders (last 3 days) <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px]">{unpaid.length}</span></h3>
        {unpaid.length === 0 && <p className="text-xs text-slate-500">No unpaid orders.</p>}
        {unpaid.map((o: any) => (
          <div key={o.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-black text-white">Order #{o.id} · {formatKES(o.total)} <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-800 text-[9px] uppercase text-slate-300">{o.method === 'mpesa_till' ? 'Till' : 'STK'}</span> <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] uppercase ${o.paidTag === 'FAILED' ? 'bg-rose-900/60 text-rose-300' : 'bg-amber-900/50 text-amber-300'}`}>{o.paidTag}</span></p>
              <p className="text-[11px] text-slate-400 truncate">{o.customer} · {o.phone} · {formatWhen(o.createdAt)}</p>
              {o.reason && <p className="text-[11px] text-rose-400">{o.reason}</p>}
            </div>
            {o.method !== 'mpesa_till' && <button onClick={() => recheck(o)} disabled={busyId === `c${o.id}`} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-extrabold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"><RefreshCw className={`w-3 h-3 ${busyId === `c${o.id}` ? 'animate-spin' : ''}`} /> Check with PayHero</button>}
          </div>
        ))}
      </div>

      {(data?.unmatched?.length > 0 || data?.recentMatched?.length > 0) && (
        <div className={`${cardCls} p-4 sm:p-6 space-y-3`}>
          {data.unmatched.length > 0 && (<>
            <h3 className="text-sm font-black text-white">Payments received, no order yet <span className="text-slate-500 font-medium">({data.unmatched.length})</span></h3>
            <div className="space-y-1.5">{data.unmatched.slice(0, 15).map((u: any) => (<p key={u.id} className="text-[11px] text-slate-400 font-mono">{u.mpesaCode} · {formatKES(Number(u.amount))} · {u.payerName || u.phoneNumber || '—'} · {formatWhen(u.receivedAt || u.createdAt)}</p>))}</div>
          </>)}
          {data.recentMatched.length > 0 && (<>
            <h3 className="text-sm font-black text-white pt-2">Recently confirmed Till payments</h3>
            <div className="space-y-1.5">{data.recentMatched.map((u: any) => (<p key={u.id} className="text-[11px] text-emerald-400/90 font-mono">{u.mpesaCode} · {formatKES(Number(u.amount))} → order #{u.orderId}</p>))}</div>
          </>)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SHOPPING ASSISTANT — floating chat backed by /api/chat (see chatAssistant.js). No third-party AI.
// The server runs the whole sales conversation (rice -> quantity -> location -> payment) and sends back
// text, tappable options, product cards and "actions". This widget shows them and performs the actions:
//   require_login   -> opens the login page, then resumes the order automatically after sign-in
//   payment_started -> opens the page's M-Pesa payment pop-up (STK) or Till/Paybill pop-up
//   refresh_orders  -> reloads the customer's order history
// ---------------------------------------------------------------------------
interface ChatCard { id: number; name: string; variety?: string | null; bagKg: number; priceKes: number; perKg?: number | null; stock: string; inStock: boolean; flash?: boolean; bulk?: string | null; image?: string | null; }
interface ChatOption { label: string; value: string; }
interface ChatMsg { role: 'user' | 'assistant'; content: string; options?: ChatOption[]; cards?: ChatCard[]; messageId?: number | null; fb?: 1 | -1; }
interface ChatAction { type: 'payment_started' | 'require_login' | 'refresh_orders' | 'payment_result' | 'basket'; orderId?: number; method?: 'mpesa_stk' | 'mpesa_till'; phone?: string | null; amount?: number; till?: any; status?: string; }

const CHAT_STORAGE_KEY = 'riceHubChatV3';
const CHAT_SESSION_KEY = 'riceHubChatSession';

function ShoppingAssistantWidget({ token, user, onPaymentStarted, onOrdersChanged, onRequireLogin }: {
  token: string | null;
  user: UserAccount | null;
  onPaymentStarted: (info: { orderId: number; method: 'mpesa_stk' | 'mpesa_till'; phone?: string | null; amount: number }) => void;
  onOrdersChanged: () => void;
  onRequireLogin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [assistantName, setAssistantName] = useState('Wanjiru');
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try { const raw = sessionStorage.getItem(CHAT_STORAGE_KEY); return raw ? JSON.parse(raw).slice(-40) : []; } catch (_) { return []; }
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [stage, setStage] = useState('idle');
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastUserId = useRef<number | string | null>(user ? (user as any).id : null);
  const sessionRef = useRef<string>((() => { try { return sessionStorage.getItem(CHAT_SESSION_KEY) || ''; } catch (_) { return ''; } })());
  const waitingForLogin = useRef(false);
  const sendingRef = useRef(false);

  const firstName = user && (user as any).fullName ? String((user as any).fullName).trim().split(/\s+/)[0] : '';
  const greeting = `Hi${firstName ? ' ' + firstName : ''}! 👋 I'm ${assistantName} from Mwea Rice Hub. I can help you choose rice, work out delivery, and take your order right here, including M-Pesa payment. English or Swahili, just type.`;
  const QUICK = ['Show me your rice', 'Delivery to my area', 'I want a bulk order', 'Track my order'];

  useEffect(() => { fetch(`${API_BASE_URL}/config/chat-assistant`).then(r => r.json()).then(d => { if (d && d.assistantName) setAssistantName(d.assistantName); }).catch(() => {}); }, []);

  // Signing in keeps the chat (the basket must survive the login). Switching or leaving an account starts a clean chat.
  useEffect(() => {
    const id = user ? (user as any).id : null;
    if (lastUserId.current !== id) {
      const wasSignedIn = lastUserId.current !== null;
      lastUserId.current = id;
      if (wasSignedIn) { setMessages([]); setStage('idle'); sessionRef.current = ''; try { sessionStorage.removeItem(CHAT_STORAGE_KEY); sessionStorage.removeItem(CHAT_SESSION_KEY); } catch (_) { /* ignore */ } }
    }
  }, [user]);
  useEffect(() => { try { sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-40))); } catch (_) { /* ignore */ } }, [messages]);
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open, sending]);

  const runActions = (actions: ChatAction[]) => {
    actions.forEach(a => {
      if (a.type === 'payment_started' && a.orderId && a.method) onPaymentStarted({ orderId: a.orderId, method: a.method, phone: a.phone, amount: Number(a.amount) || 0 });
      else if (a.type === 'refresh_orders') onOrdersChanged();
      else if (a.type === 'require_login') { waitingForLogin.current = true; setOpen(false); onRequireLogin(); }
    });
  };

  const send = async (text: string, payload?: string) => {
    const shown = text.trim();
    if ((!shown && !payload) || sendingRef.current) return;
    sendingRef.current = true;
    if (shown) setMessages(prev => [...prev.map(m => ({ ...m, options: undefined })), { role: 'user', content: shown }]);
    setInput(''); setSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: shown, payload: payload || undefined, sessionId: sessionRef.current || undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reply) {
        if (data.sessionId) { sessionRef.current = data.sessionId; try { sessionStorage.setItem(CHAT_SESSION_KEY, data.sessionId); } catch (_) { /* ignore */ } }
        setStage(data.stage || 'idle');
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, options: data.options || [], cards: data.cards || [], messageId: data.messageId }]);
        runActions(Array.isArray(data.actions) ? data.actions : []);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || "Sorry, I'm having trouble replying right now. Please try again shortly, or reach customer care directly." }]);
      }
    } catch (_) {
      setMessages(prev => [...prev, { role: 'assistant', content: "I couldn't reach the server. Please check your connection and try again." }]);
    } finally { setSending(false); sendingRef.current = false; }
  };

  // After the customer signs in from the login page, reopen the chat and carry on with their order
  useEffect(() => {
    if (token && waitingForLogin.current) { waitingForLogin.current = false; setOpen(true); setTimeout(() => send("I'm signed in", 'login_done'), 300); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // While a payment is pending, listen for the result so the customer is told the moment M-Pesa confirms
  useEffect(() => {
    if (stage !== 'awaiting_payment' || !token || !sessionRef.current) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/chat/poll`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionId: sessionRef.current }) });
        const d = await res.json().catch(() => ({}));
        if (d && d.message && d.message.reply) {
          setMessages(prev => [...prev, { role: 'assistant', content: d.message.reply, options: d.message.options || [], messageId: d.message.messageId }]);
          runActions(Array.isArray(d.message.actions) ? d.message.actions : []);
          setStage('idle');
        }
      } catch (_) { /* try again next tick */ }
    }, 6000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, token]);

  const rate = (idx: number, value: 1 | -1) => {
    const m = messages[idx];
    if (!m || !m.messageId || m.fb) return;
    setMessages(prev => prev.map((x, i) => (i === idx ? { ...x, fb: value } : x)));
    fetch(`${API_BASE_URL}/chat/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: m.messageId, sessionId: sessionRef.current, value }) }).catch(() => {});
  };
  const newChat = () => { setMessages([]); setStage('idle'); sessionRef.current = ''; try { sessionStorage.removeItem(CHAT_STORAGE_KEY); sessionStorage.removeItem(CHAT_SESSION_KEY); } catch (_) { /* ignore */ } };
  const lastAssistant = (() => { for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return i; return -1; })();

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed z-[70] bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-2xl shadow-emerald-700/40 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
        aria-label="Chat with the shopping assistant"
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed z-[70] bottom-36 md:bottom-24 right-4 md:right-6 w-[calc(100vw-2rem)] sm:w-96 max-w-sm h-[32rem] max-h-[75vh] bg-white rounded-3xl shadow-2xl border border-emerald-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-700 to-teal-700 text-white flex items-center gap-2">
            <Leaf className="w-4 h-4" />
            <div className="min-w-0 flex-1"><p className="text-xs font-black leading-tight">{assistantName} · Rice Hub</p><p className="text-[10px] text-emerald-100">{user ? `Signed in as ${firstName || 'you'}` : 'Guest: sign in only when you pay'}</p></div>
            {messages.length > 0 && <button onClick={newChat} className="text-[10px] text-emerald-100 hover:text-white underline cursor-pointer" aria-label="Start a new chat">New chat</button>}
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50">
            <div className="flex justify-start"><div className="max-w-[88%] px-3 py-2 rounded-2xl text-[12px] leading-relaxed whitespace-pre-wrap bg-white text-slate-800 border border-slate-100 rounded-bl-sm">{greeting}</div></div>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK.map(q => <button key={q} onClick={() => send(q)} className="px-2.5 py-1.5 rounded-full bg-white border border-emerald-200 text-emerald-700 text-[11px] font-bold hover:bg-emerald-50 cursor-pointer">{q}</button>)}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[88%] px-3 py-2 rounded-2xl text-[12px] leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm'}`}>{m.content}</div>
                {m.role === 'assistant' && m.cards && m.cards.length > 0 && (
                  <div className="mt-1.5 flex gap-2 overflow-x-auto max-w-full pb-1">
                    {m.cards.map(c => (
                      <div key={c.id} className="shrink-0 w-36 bg-white rounded-2xl border border-emerald-100 overflow-hidden shadow-sm">
                        {c.image ? <img src={c.image} alt={c.name} className="w-full h-16 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}
                        <div className="p-2 space-y-0.5">
                          <p className="text-[11px] font-black text-slate-800 leading-tight">{c.name}</p>
                          <p className="text-[10px] text-slate-500">{c.variety ? `${c.variety} · ` : ''}{c.bagKg}kg bag</p>
                          <p className="text-xs font-black text-emerald-700">{formatKES(c.priceKes)}{c.flash ? ' ⚡' : ''}</p>
                          <p className={`text-[10px] font-bold ${c.inStock ? 'text-slate-500' : 'text-rose-500'}`}>{c.stock}{c.perKg ? ` · ${formatKES(c.perKg)}/kg` : ''}</p>
                          {c.bulk && <p className="text-[10px] text-amber-600 font-bold">Bulk: {c.bulk}</p>}
                          <button onClick={() => send(`Buy ${c.name}`, `pick:${c.id}`)} className="mt-1 w-full py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer">Choose</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {m.role === 'assistant' && i === lastAssistant && m.options && m.options.length > 0 && !sending && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[92%]">
                    {m.options.map(o => <button key={o.value + o.label} onClick={() => send(o.label, o.value)} className="px-2.5 py-1.5 rounded-full bg-white border border-emerald-300 text-emerald-700 text-[11px] font-bold hover:bg-emerald-50 cursor-pointer">{o.label}</button>)}
                  </div>
                )}
                {m.role === 'assistant' && m.messageId && (
                  <div className="mt-0.5 flex gap-1 text-[10px] text-slate-400">
                    <button onClick={() => rate(i, 1)} disabled={!!m.fb} className={`px-1 cursor-pointer ${m.fb === 1 ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`} aria-label="Helpful">👍</button>
                    <button onClick={() => rate(i, -1)} disabled={!!m.fb} className={`px-1 cursor-pointer ${m.fb === -1 ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`} aria-label="Not helpful">👎</button>
                    {m.fb === -1 && <span className="text-slate-400">Thanks, I'll learn from this</span>}
                  </div>
                )}
              </div>
            ))}
            {sending && <div className="flex justify-start"><div className="px-3 py-2 rounded-2xl bg-white border border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> {assistantName} is typing…</div></div>}
            <div ref={bottomRef} />
          </div>
          <div className="p-2.5 border-t border-slate-100 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={stage === 'ask_phone' ? 'M-Pesa number e.g. 0712345678' : stage === 'awaiting_payment' ? 'Paste M-Pesa code, or ask a question' : 'Type here, e.g. "2 bags pishori to Nakuru"'}
              maxLength={1000}
              className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
            />
            <button onClick={() => send(input)} disabled={sending || !input.trim()} className="px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white cursor-pointer" aria-label="Send"><ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// CHAT AI (admin) — what customers ask, what the assistant could not answer, what it learned,
// and the database tables it is asking permission to add.
// ---------------------------------------------------------------------------
function AdminChatPanel({ token, showToast }: { token: string | null; showToast: ToastFn }) {
  const [overview, setOverview] = useState<any>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Record<number, string>>({});
  const [newQ, setNewQ] = useState(''); const [newA, setNewA] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const card = 'bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3';
  const input = 'w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500';
  const btn = 'px-3 py-2 rounded-xl text-[11px] font-extrabold cursor-pointer disabled:opacity-50';

  const load = useCallback(async () => {
    try {
      const [o, p, k, s] = await Promise.all([staffApi('/admin/chat/overview', token), staffApi('/admin/chat/schema-proposals', token), staffApi('/admin/chat/knowledge', token), staffApi('/admin/config/chat-assistant', token)]);
      setOverview(o); setProposals(Array.isArray(p) ? p : []); setKnowledge(Array.isArray(k) ? k : []); setSettings(s);
    } catch (err: any) { showToast(err.message, 'error'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try { await fn(); showToast(ok, 'success'); await load(); } catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(null); }
  };
  const pending = proposals.filter(p => p.status === 'pending');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[['Messages (7 days)', overview?.messages ?? '…'], ['Answered', overview ? `${overview.handledRate}%` : '…'], ['Orders via chat', overview?.ordersPlaced ?? '…'], ['👍 / 👎', overview ? `${overview.helpful} / ${overview.notHelpful}` : '…'], ['Waiting for you', overview ? overview.pendingProposals + overview.unanswered.length : '…']].map(([l, v]) => (
          <div key={String(l)} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3"><p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{l}</p><p className="text-xl font-black text-white">{v as any}</p></div>
        ))}
      </div>

      <div className={card}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div><h3 className="text-sm font-black text-white">Database tables the assistant is asking to add {pending.length > 0 && <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px]">{pending.length} waiting</span>}</h3>
            <p className="text-[11px] text-slate-400">As chat usage grows, the assistant proposes extra tables to stay fast. Nothing is created until you approve it, and it can only ever create new "chat_" tables.</p></div>
          <div className="flex gap-2">
            <button disabled={busy === 'scan'} onClick={() => act('scan', () => staffApi('/admin/chat/schema-proposals/scan', token, { method: 'POST', body: { force: false } }), 'Checked current usage')} className={`${btn} bg-slate-800 text-white`}>Check now</button>
            <button disabled={busy === 'scanf'} onClick={() => act('scanf', () => staffApi('/admin/chat/schema-proposals/scan', token, { method: 'POST', body: { force: true } }), 'Prepared all proposals for review')} className={`${btn} bg-slate-800 text-slate-300`}>Prepare all in advance</button>
          </div>
        </div>
        {pending.length === 0 && <p className="text-[11px] text-slate-500">Nothing waiting. The assistant has all the tables it needs for today's usage.</p>}
        {pending.map(p => (
          <div key={p.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <p className="text-xs font-black text-amber-300">{p.title} <span className="font-mono text-slate-400 font-medium">({p.tableName})</span></p>
            <p className="text-[11px] text-slate-300">{p.reason}</p>
            <pre className="text-[10px] text-emerald-300 bg-slate-950 rounded-lg p-2 overflow-x-auto">{p.sqlPreview}</pre>
            <div className="flex flex-wrap gap-2 items-center">
              <input value={confirm[p.id] || ''} onChange={e => setConfirm(prev => ({ ...prev, [p.id]: e.target.value }))} placeholder={`Type ${p.tableName} to approve`} className={`${input} sm:w-72`} />
              <button disabled={busy === `a${p.id}` || (confirm[p.id] || '').trim() !== p.tableName} onClick={() => act(`a${p.id}`, () => staffApi(`/admin/chat/schema-proposals/${p.id}/approve`, token, { method: 'POST', body: { confirmTable: (confirm[p.id] || '').trim() } }), `Table ${p.tableName} created`)} className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}>Approve & create</button>
              <button disabled={busy === `r${p.id}`} onClick={() => act(`r${p.id}`, () => staffApi(`/admin/chat/schema-proposals/${p.id}/reject`, token, { method: 'POST', body: {} }), 'Declined')} className={`${btn} bg-slate-800 text-slate-200`}>Decline</button>
            </div>
          </div>
        ))}
        {proposals.filter(p => p.status !== 'pending').length > 0 && (
          <div className="text-[10px] text-slate-500 space-y-0.5">{proposals.filter(p => p.status !== 'pending').slice(0, 8).map(p => <p key={p.id}><span className="font-mono">{p.tableName}</span> · {p.status}{p.note ? ` · ${p.note}` : ''}</p>)}</div>
        )}
      </div>

      <div className={card}>
        <h3 className="text-sm font-black text-white">Questions customers asked that I could not answer</h3>
        <p className="text-[11px] text-slate-400">Type the answer once. The assistant uses it straight away and for similar wording.</p>
        {(overview?.unanswered || []).length === 0 && <p className="text-[11px] text-slate-500">Nothing unanswered right now.</p>}
        {(overview?.unanswered || []).map((u: any) => (
          <div key={u.signature} className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-2">
            <p className="text-xs text-white font-bold">"{u.example}" <span className="text-slate-500 font-medium">asked {u.n}×</span></p>
            <div className="flex gap-2"><input value={answers[u.signature] || ''} onChange={e => setAnswers(prev => ({ ...prev, [u.signature]: e.target.value }))} placeholder="Your answer…" className={input} />
              <button disabled={busy === u.signature || (answers[u.signature] || '').trim().length < 2} onClick={() => act(u.signature, () => staffApi('/admin/chat/knowledge', token, { method: 'POST', body: { question: u.example, answer: answers[u.signature], signature: u.signature } }), 'Taught. I will answer this from now on.')} className={`${btn} bg-emerald-600 text-white shrink-0`}>Teach</button></div>
          </div>
        ))}
      </div>

      {(overview?.candidates || []).length > 0 && (
        <div className={card}>
          <h3 className="text-sm font-black text-white">New phrases I picked up from customers</h3>
          <p className="text-[11px] text-slate-400">Seen once so far. They go live automatically when a second customer confirms them; you can also approve or block them now.</p>
          {overview.candidates.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-[11px] text-slate-300 bg-slate-950/60 rounded-xl p-2.5">
              <span>"{c.question}" → <b className="text-emerald-300">{c.intent}</b></span>
              <span className="flex gap-1.5"><button onClick={() => act(`c${c.id}`, () => staffApi(`/admin/chat/knowledge/${c.id}`, token, { method: 'PUT', body: { status: 'active' } }), 'Approved')} className={`${btn} bg-emerald-700 text-white`}>Approve</button><button onClick={() => act(`d${c.id}`, () => staffApi(`/admin/chat/knowledge/${c.id}`, token, { method: 'PUT', body: { status: 'off' } }), 'Blocked')} className={`${btn} bg-slate-800 text-slate-200`}>Block</button></span>
            </div>
          ))}
        </div>
      )}

      <div className={card}>
        <h3 className="text-sm font-black text-white">What I have been taught</h3>
        <div className="grid sm:grid-cols-2 gap-2"><input value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Question customers ask" className={input} /><input value={newA} onChange={e => setNewA(e.target.value)} placeholder="Answer to give" className={input} /></div>
        <button disabled={busy === 'new' || newQ.trim().length < 4 || newA.trim().length < 2} onClick={() => act('new', async () => { await staffApi('/admin/chat/knowledge', token, { method: 'POST', body: { question: newQ, answer: newA } }); setNewQ(''); setNewA(''); }, 'Added')} className={`${btn} bg-emerald-600 text-white`}>Add answer</button>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {knowledge.filter(k => k.answer).map(k => (
            <div key={k.id} className="flex items-start justify-between gap-2 text-[11px] bg-slate-950/60 rounded-xl p-2.5">
              <div className="min-w-0"><p className="text-white font-bold">{k.question}</p><p className="text-slate-400">{k.answer}</p><p className="text-slate-600">used {k.hits}× · 👍{k.upVotes} 👎{k.downVotes} · {k.status}</p></div>
              <span className="flex gap-1.5 shrink-0"><button onClick={() => act(`t${k.id}`, () => staffApi(`/admin/chat/knowledge/${k.id}`, token, { method: 'PUT', body: { status: k.status === 'active' ? 'off' : 'active' } }), 'Updated')} className={`${btn} bg-slate-800 text-slate-200`}>{k.status === 'active' ? 'Turn off' : 'Turn on'}</button><button onClick={() => act(`x${k.id}`, () => staffApi(`/admin/chat/knowledge/${k.id}`, token, { method: 'DELETE' }), 'Deleted')} className={`${btn} bg-rose-900/60 text-rose-200`}>Delete</button></span>
            </div>
          ))}
        </div>
      </div>

      {settings && (
        <div className={card}>
          <h3 className="text-sm font-black text-white">Assistant settings</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {([['assistantName', 'Assistant name'], ['businessHours', 'Business hours'], ['supportPhone', 'Support phone'], ['whatsapp', 'WhatsApp number']] as const).map(([k, label]) => (
              <label key={k} className="text-[10px] text-slate-400 font-bold space-y-1 block">{label}<input value={settings[k] || ''} onChange={e => setSettings((s: any) => ({ ...s, [k]: e.target.value }))} className={input} /></label>
            ))}
          </div>
          <label className="text-[10px] text-slate-400 font-bold space-y-1 block">Quick answers, one per line as: question | answer<textarea rows={3} value={settings.extraKnowledge || ''} onChange={e => setSettings((s: any) => ({ ...s, extraKnowledge: e.target.value }))} className={input} /></label>
          <button disabled={busy === 'save'} onClick={() => act('save', () => staffApi('/admin/config/chat-assistant', token, { method: 'PUT', body: settings }), 'Settings saved')} className={`${btn} bg-emerald-600 text-white`}>Save settings</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BULK ORDERS (admin) — the admin dictates the discount per rice and the bulk delivery cost per county
// ---------------------------------------------------------------------------
function AdminBulkOrdersPanel({ token, showToast, products, countyFees }: { token: string | null; showToast: ToastFn; products: Product[]; countyFees: { [key: string]: number } }) {
  const [enabled, setEnabled] = useState(true);
  const [minKg, setMinKg] = useState('50');
  const [discount, setDiscount] = useState('10');
  const [perProduct, setPerProduct] = useState<Record<string, { discountPercent: string; minKg: string }>>({});
  const [transport, setTransport] = useState<Record<string, string>>({});
  const [countySearch, setCountySearch] = useState('');
  const [fillAll, setFillAll] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/bulk-discount`);
      const d = await res.json();
      setEnabled(d.enabled !== false);
      setMinKg(String(d.minKg ?? 50));
      setDiscount(String(d.discountPercent ?? 10));
      const pp: Record<string, { discountPercent: string; minKg: string }> = {};
      Object.entries(d.perProduct || {}).forEach(([id, r]: [string, any]) => {
        pp[id] = { discountPercent: r.discountPercent !== undefined ? String(r.discountPercent) : '', minKg: r.minKg !== undefined ? String(r.minKg) : '' };
      });
      setPerProduct(pp);
      const tr: Record<string, string> = {};
      Object.entries(d.transport || {}).forEach(([c, f]) => { tr[c] = String(f); });
      setTransport(tr);
    } catch (_) { /* ignore */ } finally { setLoaded(true); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const pp: Record<string, any> = {};
      Object.entries(perProduct as Record<string, { discountPercent: string; minKg: string }>).forEach(([id, r]) => {
        if (r.discountPercent !== '' || r.minKg !== '') pp[id] = { discountPercent: r.discountPercent === '' ? null : Number(r.discountPercent), minKg: r.minKg === '' ? null : Number(r.minKg) };
      });
      const tr: Record<string, number> = {};
      Object.entries(transport).forEach(([c, f]) => { if (f !== '') tr[c] = Number(f); });
      await staffApi('/admin/config/bulk-discount', token, { method: 'PUT', body: { enabled, minKg: Number(minKg), discountPercent: Number(discount), perProduct: pp, transport: tr } });
      showToast('Bulk order settings saved. Customers see them immediately.', 'success');
      await load();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setSaving(false); }
  };

  const setProd = (id: number, patch: Partial<{ discountPercent: string; minKg: string }>) =>
    setPerProduct(prev => {
      const cur = prev[String(id)] || { discountPercent: '', minKg: '' };
      return { ...prev, [String(id)]: { ...cur, ...patch } };
    });

  const counties = Object.keys(countyFees || {}).sort((a, b) => a.localeCompare(b));
  const shownCounties = counties.filter(c => c.toLowerCase().includes(countySearch.trim().toLowerCase()));
  const customCount = Object.values(transport).filter(v => v !== '').length;
  const digitsOnly = (v: string) => v.replace(/[^0-9.]/g, '');

  if (!loaded) return <div className={`${cardCls} p-8 text-center text-xs text-slate-400`}>Loading bulk orders…</div>;

  return (
    <div className="space-y-5">
      <div className={`${cardCls} p-4 sm:p-6 space-y-4`}>
        <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2"><Layers className="w-5 h-5 text-emerald-400" /> Bulk Orders</h3>
        <p className="text-[11px] text-slate-500">You decide what bulk customers pay. A customer who uses the &quot;Bulk Order&quot; tab and reaches the minimum kg gets your discount, is <b className="text-slate-300">not limited by the shelf stock</b> of that rice, and pays the bulk delivery cost you set for their county (blank = the normal county fee).</p>
        <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-1 w-5 h-5 accent-emerald-500" />
          <span><span className="block text-xs font-extrabold text-white">Bulk discount switched on</span><span className="block text-[11px] text-slate-500">When off, bulk orders still work (no stock limit, county bulk delivery) but at the normal price.</span></span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelCls}>Default minimum kg to count as bulk</label><input inputMode="numeric" value={minKg} onChange={(e) => setMinKg(e.target.value.replace(/\D/g, ''))} placeholder="50" className={inputCls} /></div>
          <div><label className={labelCls}>Default discount for bulk (%)</label><input inputMode="decimal" value={discount} onChange={(e) => setDiscount(digitsOnly(e.target.value))} placeholder="10" className={inputCls} /></div>
        </div>
      </div>

      <div className={`${cardCls} p-4 sm:p-6 space-y-3`}>
        <h4 className="text-sm font-black text-white flex items-center gap-2"><Percent className="w-4 h-4 text-emerald-400" /> Discount per rice type</h4>
        <p className="text-[11px] text-slate-500">Leave a box empty to use the default above. Type 0 to give no bulk discount on that rice.</p>
        <div className="space-y-2">
          {products.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No rice products yet.</p>}
          {products.map(p => {
            const r = perProduct[String(p.id)] || { discountPercent: '', minKg: '' };
            const pct = r.discountPercent !== '' ? Number(r.discountPercent) : Number(discount);
            const bulkBag = Number.isFinite(pct) ? Math.round((p.basePrice || 0) * (1 - pct / 100)) : p.basePrice;
            return (
              <div key={p.id} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="col-span-2 sm:col-span-5">
                  <p className="text-xs font-extrabold text-white truncate">{p.brandName}{p.variety ? ` · ${p.variety}` : ''}</p>
                  <p className="text-[11px] text-slate-500">{p.weightKg}kg sack · normal {formatKES(p.basePrice)}{enabled ? <> → bulk <b className="text-emerald-400">{formatKES(bulkBag as number)}</b></> : null}</p>
                </div>
                <div className="sm:col-span-3"><label className="block text-[10px] font-bold text-slate-500 mb-0.5">Discount %</label><input inputMode="decimal" value={r.discountPercent} onChange={(e) => setProd(p.id, { discountPercent: digitsOnly(e.target.value) })} placeholder={`default ${discount || 0}`} className={inputCls} /></div>
                <div className="sm:col-span-4"><label className="block text-[10px] font-bold text-slate-500 mb-0.5">Minimum kg</label><input inputMode="numeric" value={r.minKg} onChange={(e) => setProd(p.id, { minKg: e.target.value.replace(/\D/g, '') })} placeholder={`default ${minKg || 0}`} className={inputCls} /></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${cardCls} p-4 sm:p-6 space-y-3`}>
        <h4 className="text-sm font-black text-white flex items-center gap-2"><Truck className="w-4 h-4 text-emerald-400" /> Bulk delivery cost per county</h4>
        <p className="text-[11px] text-slate-500">Charged instead of the normal county fee when the order contains a bulk line. Leave a county empty to use its normal fee. {customCount} of {counties.length} counties have a bulk price.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={countySearch} onChange={(e) => setCountySearch(e.target.value)} placeholder="Search county…" className={`${inputCls} sm:flex-1`} />
          <input inputMode="decimal" value={fillAll} onChange={(e) => setFillAll(digitsOnly(e.target.value))} placeholder="Amount (KES)" className={`${inputCls} sm:w-36`} />
          <button type="button" onClick={() => { if (fillAll === '') { showToast('Type an amount first.', 'error'); return; } const next = { ...transport }; shownCounties.forEach(c => { next[c] = fillAll; }); setTransport(next); }} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-bold cursor-pointer">Set {countySearch.trim() ? 'shown' : 'all'}</button>
          <button type="button" onClick={() => { const next = { ...transport }; shownCounties.forEach(c => { delete next[c]; }); setTransport(next); }} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-bold cursor-pointer">Clear {countySearch.trim() ? 'shown' : 'all'}</button>
        </div>
        <div className="max-h-[28rem] overflow-y-auto rounded-2xl border border-slate-800 divide-y divide-slate-800">
          {shownCounties.length === 0 && <p className="text-xs text-slate-500 text-center py-6">No county matches.</p>}
          {shownCounties.map(c => (
            <div key={c} className="flex items-center gap-3 px-3 py-2 bg-slate-950">
              <span className="flex-1 text-xs font-bold text-slate-200 truncate">{c}</span>
              <span className="text-[11px] text-slate-500 shrink-0">normal {formatKES(Number(countyFees[c]) || 0)}</span>
              <input inputMode="decimal" value={transport[c] ?? ''} onChange={(e) => setTransport(prev => ({ ...prev, [c]: digitsOnly(e.target.value) }))} placeholder="bulk KES" className="w-28 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white" />
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer">{saving ? 'Saving…' : 'Save bulk order settings'}</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PROMO CODES
// ---------------------------------------------------------------------------
function AdminPromosPanel({ token, showToast }: { token: string | null; showToast: ToastFn }) {
  const blank = { code: '', description: '', type: 'percent', value: '', minOrder: '', maxDiscount: '', maxUses: '', expiresAt: '', perUserOnce: true };
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<any>(blank);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setRows(await staffApi('/admin/promos', token)); } catch (err: any) { showToast(err.message, 'error'); } }, [token]);
  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await staffApi('/admin/promos', token, { method: 'POST', body: { ...f, value: Number(f.value) } }); showToast(`Promo code ${String(f.code).toUpperCase()} created.`, 'success'); setF(blank); load(); }
    catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(false); }
  };
  const toggle = async (r: any) => {
    try { await staffApi(`/admin/promos/${r.id}`, token, { method: 'PUT', body: { ...r, expiresAt: r.expiresAt ? String(r.expiresAt).slice(0, 10) : '', isActive: !r.isActive } }); load(); }
    catch (err: any) { showToast(err.message, 'error'); }
  };
  const remove = async (r: any) => {
    if (!window.confirm(`Delete promo code ${r.code}?`)) return;
    try { await staffApi(`/admin/promos/${r.id}`, token, { method: 'DELETE' }); load(); } catch (err: any) { showToast(err.message, 'error'); }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={create} className={`${cardCls} p-4 sm:p-6 space-y-4`}>
        <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2"><Percent className="w-5 h-5 text-emerald-400" /> Create a promo code</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div><label className={labelCls}>Code</label><input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24) })} placeholder="MASHUJAA10" className={`${inputCls} font-mono`} /></div>
          <div><label className={labelCls}>Discount type</label><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inputCls}><option value="percent">Percent off (%)</option><option value="fixed">Fixed amount off (KES)</option></select></div>
          <div><label className={labelCls}>{f.type === 'percent' ? 'Percent' : 'Amount (KES)'}</label><input required inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Minimum order (KES)</label><input inputMode="numeric" value={f.minOrder} onChange={(e) => setF({ ...f, minOrder: e.target.value })} placeholder="0" className={inputCls} /></div>
          {f.type === 'percent' && <div><label className={labelCls}>Max discount (KES)</label><input inputMode="numeric" value={f.maxDiscount} onChange={(e) => setF({ ...f, maxDiscount: e.target.value })} placeholder="no limit" className={inputCls} /></div>}
          <div><label className={labelCls}>Total uses allowed</label><input inputMode="numeric" value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} placeholder="unlimited" className={inputCls} /></div>
          <div><label className={labelCls}>Last valid day</label><input type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Note (for you)</label><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Mashujaa Day offer" className={inputCls} /></div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer"><input type="checkbox" checked={f.perUserOnce} onChange={(e) => setF({ ...f, perUserOnce: e.target.checked })} className="w-4 h-4 accent-emerald-500" /> Each customer can use it only once</label>
        <button disabled={busy} className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer">{busy ? 'Saving…' : 'Create code'}</button>
      </form>

      <div className="space-y-2">
        {rows.length === 0 && <div className={`${cardCls} p-6 text-center text-xs text-slate-500`}>No promo codes yet.</div>}
        {rows.map((r) => {
          const expired = r.expiresAt && new Date(r.expiresAt).getTime() < Date.now();
          return (
            <div key={r.id} className={`${cardCls} p-4 flex flex-wrap items-center justify-between gap-3`}>
              <div className="min-w-0">
                <p className="text-sm font-black font-mono text-white">{r.code} <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${!r.isActive ? 'bg-slate-800 text-slate-400' : expired ? 'bg-rose-900/50 text-rose-300' : 'bg-emerald-900/60 text-emerald-300'}`}>{!r.isActive ? 'Off' : expired ? 'Expired' : 'Active'}</span></p>
                <p className="text-[11px] text-slate-400">{r.type === 'percent' ? `${Number(r.value)}% off` : `${formatKES(Number(r.value))} off`}{Number(r.minOrder) > 0 ? ` · min ${formatKES(Number(r.minOrder))}` : ''} · used {r.usedCount}{r.maxUses ? `/${r.maxUses}` : ''}{r.expiresAt ? ` · until ${new Date(r.expiresAt).toLocaleDateString('en-KE')}` : ''}{r.perUserOnce ? ' · once per customer' : ''}</p>
                {r.description && <p className="text-[11px] text-slate-500">{r.description}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggle(r)} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-extrabold cursor-pointer">{r.isActive ? 'Switch off' : 'Switch on'}</button>
                <button onClick={() => remove(r)} className="px-3 py-2 rounded-xl bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-[11px] font-extrabold cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DELIVERY DISPATCH BOARD
// ---------------------------------------------------------------------------
function AdminDispatchPanel({ token, showToast }: { token: string | null; showToast: ToastFn }) {
  const [data, setData] = useState<{ active: any[]; delivered: any[] } | null>(null);
  const [forms, setForms] = useState<Record<number, any>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'out'>('all');
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => { try { setData(await staffApi('/admin/dispatch', token)); } catch (err: any) { showToast(err.message, 'error'); } }, [token]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const formFor = (o: any) => forms[o.id] || { riderName: o.delivery?.riderName || '', riderPhone: o.delivery?.riderPhone || '', vehicle: o.delivery?.vehicle || '', status: o.delivery?.status || 'assigned', note: o.delivery?.note || '', notifyCustomer: true };
  const setField = (o: any, patch: any) => setForms(prev => ({ ...prev, [o.id]: { ...formFor(o), ...patch } }));
  const save = async (o: any, statusOverride?: string) => {
    const body = { ...formFor(o), ...(statusOverride ? { status: statusOverride } : {}) };
    setBusy(o.id);
    try {
      const r = await staffApi(`/admin/dispatch/${o.id}`, token, { method: 'PUT', body });
      showToast(`Order #${o.id} updated.${r.smsNote ? ' ' + r.smsNote : ''}`, 'success');
      setForms(prev => { const n = { ...prev }; delete n[o.id]; return n; });
      load();
    } catch (err: any) { showToast(err.message, 'error'); } finally { setBusy(null); }
  };

  if (!data) return <div className={`${cardCls} p-8 text-center text-xs text-slate-400`}>Loading deliveries…</div>;
  const list = data.active.filter(o => filter === 'all' ? true : filter === 'unassigned' ? !o.delivery : o.delivery?.status === 'out_for_delivery');
  const statusTone: Record<string, string> = { assigned: 'bg-sky-900/50 text-sky-300', out_for_delivery: 'bg-amber-900/50 text-amber-300', delivered: 'bg-emerald-900/60 text-emerald-300', failed: 'bg-rose-900/50 text-rose-300' };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-4 flex flex-wrap items-center justify-between gap-3`}>
        <div><h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2"><Truck className="w-5 h-5 text-emerald-400" /> Delivery board</h3><p className="text-[11px] text-slate-500">Paid orders waiting to be delivered. Give each one a rider and move it along.</p></div>
        <div className="flex gap-1.5 flex-wrap">
          {([['all', `All (${data.active.length})`], ['unassigned', `No rider (${data.active.filter(o => !o.delivery).length})`], ['out', `On the road (${data.active.filter(o => o.delivery?.status === 'out_for_delivery').length})`]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id as any)} className={`px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer ${filter === id ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-300'}`}>{label}</button>
          ))}
        </div>
      </div>

      {list.length === 0 && <div className={`${cardCls} p-8 text-center text-xs text-slate-500`}>Nothing to deliver here.</div>}
      {list.map(o => {
        const f = formFor(o);
        return (
          <div key={o.id} className={`${cardCls} p-4 space-y-3`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-black text-white">Order #{o.id} · {formatKES(o.total)} · {o.kg} kg {o.delivery && <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusTone[o.delivery.status] || ''}`}>{String(o.delivery.status).replace(/_/g, ' ')}</span>}</p>
                <p className="text-[11px] text-slate-300 flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 text-emerald-400 shrink-0" /> {[o.address, o.sublocation, o.location, o.town, o.county].filter(Boolean).join(', ')}</p>
                <p className="text-[11px] text-slate-500 break-words">{o.items}</p>
              </div>
              <a href={`tel:${o.phone}`} className="px-3 py-2 rounded-xl bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1.5"><PhoneCall className="w-3 h-3" /> {o.customer || 'Customer'}</a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input value={f.riderName} onChange={(e) => setField(o, { riderName: e.target.value })} placeholder="Rider / driver name" className={inputCls} />
              <input inputMode="tel" value={f.riderPhone} onChange={(e) => setField(o, { riderPhone: e.target.value })} placeholder="Rider phone" className={inputCls} />
              <input value={f.vehicle} onChange={(e) => setField(o, { vehicle: e.target.value })} placeholder="Vehicle / plate (optional)" className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer"><input type="checkbox" checked={f.notifyCustomer} onChange={(e) => setField(o, { notifyCustomer: e.target.checked })} className="w-4 h-4 accent-emerald-500" /> Tell the customer by SMS when it is dispatched or delivered</label>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy === o.id} onClick={() => save(o, 'assigned')} className="px-4 py-2.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50">Save rider</button>
              <button disabled={busy === o.id} onClick={() => save(o, 'out_for_delivery')} className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50">Out for delivery</button>
              <button disabled={busy === o.id} onClick={() => save(o, 'delivered')} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50">Mark delivered</button>
            </div>
          </div>
        );
      })}

      {data.delivered.length > 0 && (
        <div className={`${cardCls} p-4`}>
          <button onClick={() => setShowDone(!showDone)} className="w-full flex items-center justify-between text-xs font-black text-white cursor-pointer">Recently delivered ({data.delivered.length}) <ChevronDown className={`w-4 h-4 transition-transform ${showDone ? 'rotate-180' : ''}`} /></button>
          {showDone && <div className="mt-3 space-y-1.5">{data.delivered.map(o => <p key={o.id} className="text-[11px] text-slate-400">#{o.id} · {o.customer} · {o.town || o.county} · rider {o.delivery?.riderName || '—'} · {o.delivery?.deliveredAt ? formatWhen(o.delivery.deliveredAt) : ''}</p>)}</div>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Address helpers (an order's address is saved as an object; the old screen tried to print that object)
// ---------------------------------------------------------------------------
const resolveAddress = (order: any) => {
  let sa: any = order?.shippingAddress;
  if (typeof sa === 'string') { try { const p = JSON.parse(sa); if (p && typeof p === 'object') sa = p; } catch (_) { /* plain text address */ } }
  const obj = sa && typeof sa === 'object' ? sa : {};
  const clean = (v: any) => { const s = typeof v === 'string' ? v.trim() : ''; return s && s !== 'Not Specified' ? s : ''; };
  const text = typeof sa === 'string' ? sa : '';
  return {
    county: clean(order?.county) || clean(obj.county),
    town: clean(order?.town) || clean(obj.town),
    location: clean(order?.location) || clean(obj.location),
    sublocation: clean(order?.sublocation) || clean(obj.sublocation),
    street: clean(obj.streetAddress) || clean(order?.streetAddress) || clean(text) || clean(obj.details)
  };
};

/** Explains a campaign's failures in plain words and lets the admin see exactly which numbers failed. */
function CampaignProblem({ c, token }: { c: any; token: string | null }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[] | null>(null);
  if (!c.problem && !c.failedCount) return null;
  const noRoute = /no route/i.test(c.problem || '');
  const toggle = async () => {
    setOpen(!open);
    if (!rows) { try { const d = await staffApi(`/admin/campaigns/${c.id}/failures`, token); setRows(d.failed || []); } catch (_) { setRows([]); } }
  };
  return (
    <div className="mt-1 space-y-1">
      <p className="text-[10px] text-rose-400 max-w-xs">
        {noRoute
          ? `${c.failedCount} number${c.failedCount === 1 ? '' : 's'} could not be reached by the SMS gateway ("No route found"). This is usually a wrong, disconnected or unsupported phone number, not a fault with the campaign.`
          : (c.problem ? `Problem: ${c.problem}` : `${c.failedCount} message(s) failed.`)}
      </p>
      {c.failedCount > 0 && <button onClick={toggle} className="text-[10px] text-sky-400 underline cursor-pointer">{open ? 'Hide' : 'See who it failed for'}</button>}
      {open && rows && (rows.length
        ? <ul className="space-y-0.5">{rows.map((r, i) => <li key={i} className="text-[10px] text-slate-400">{r.name} · <span className="font-mono">{r.phone}</span> · {r.reason}</li>)}</ul>
        : <p className="text-[10px] text-slate-500">Details were not saved for this campaign. New campaigns list every failed number.</p>)}
    </div>
  );
}

const ADMIN_TABS: AdminTabDef[] = [
  { id: 'inventory', label: 'Grain Catalog', icon: Package, desc: 'Edit all products', group: 'Shop' },
  { id: 'orders', label: 'Order Dispatch', icon: ShoppingBag, desc: 'Real-time pipeline', group: 'Shop' },
  { id: 'dispatch', label: 'Delivery Board', icon: Truck, desc: 'Riders & deliveries', group: 'Shop' },
  { id: 'bulk', label: 'Bulk Orders', icon: Layers, desc: 'Discount & county delivery', group: 'Shop' },
  { id: 'chat', label: 'Chat AI', icon: MessageSquare, desc: 'Teach it, approve new tables', group: 'Shop' },
  { id: 'payments', label: 'Payments', icon: Wallet, desc: 'Till, STK & checks', group: 'Money' },
  { id: 'promos', label: 'Promo Codes', icon: Percent, desc: 'Discount codes', group: 'Money' },
  { id: 'finances', label: 'Financial Engine', icon: DollarSign, desc: 'Real DB growth graph', group: 'Money' },
  { id: 'reports', label: 'Profit & Exports', icon: TrendingUp, desc: 'Profit reports, Excel', group: 'Money' },
  { id: 'expenses', label: 'Expenses', icon: Wallet, desc: 'Running costs, net profit', group: 'Money' },
  { id: 'stock', label: 'Stock & Suppliers', icon: Package, desc: 'Alerts, purchases, bulk prices', group: 'Money' },
  { id: 'users', label: 'User Clearance', icon: Users, desc: 'Edit, suspend, delete', group: 'People' },
  { id: 'agents', label: 'Agents', icon: Briefcase, desc: 'Referrals, commission, payouts', group: 'People' },
  { id: 'campaigns', label: 'SMS Campaigns', icon: MessageSquare, desc: 'Segments & promotions', group: 'People' },
  { id: 'reviews', label: 'Reviews', icon: Star, desc: 'Moderate customer reviews', group: 'People' },
  { id: 'config', label: 'Regional Freight', icon: MapPin, desc: '47 county shipping rates', group: 'Settings' },
  { id: 'carousel', label: 'Hero Backdrop', icon: Sliders, desc: 'UI/UX & advert control', group: 'Settings' },
  { id: 'system', label: 'System & Security', icon: Shield, desc: 'Health, 2-step, permissions', group: 'Settings' },
  { id: 'activity', label: 'Live Activity', icon: Activity, desc: 'Everything that happens', group: 'Settings' },
  { id: 'logs', label: 'Audit Logs', icon: FileText, desc: 'User account logs', group: 'Settings' }
];


export default function PremiumRiceStore() {
  // ROUTING & VIEW STATES
  const [view, setView] = useState<'home' | 'shop' | 'bulk' | 'cart' | 'login' | 'admin' | 'profile' | 'agent' | 'support'>('home');
  const [user, setUser] = useState<UserAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // CATALOG & STORE DATA STATES
  const [products, setProducts] = useState<Product[]>([]);
  const [carousel, setCarousel] = useState<any[]>([]);
  
  // HERO BACKDROP CONFIGURATION (10 EXPLICIT SETTINGS FOR FULL CONTROL)
  const [heroSettings, setHeroSettings] = useState<HeroSettings>({
    title: 'Direct From Mwea Paddy Fields',
    subtitle: '100% Pure Aromatic Pishori Rice harvested and delivered straight to your doorstep across Kenya.',
    video1: 'https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI',
    video2: '',
    img1: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80',
    img2: 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=1600&q=80',
    img3: '',
    ctaButtonText: 'Explore Grain Catalog',
    secondaryButtonText: 'Track Order Status',
    badgeText: '🌾 Pure Kenya Agricultural Harvest',
    overlayOpacity: '40',
    announcementTicker: '🔥 Special Wholesale Discounts Active Across All 47 Counties! Express Doorstep Delivery.',
    themeAccentColor: 'emerald',
    heroLayoutMode: 'split-banner',
    enableLiveTicker: true,
    promoBadgeColor: 'rose',
    bannerHeight: '65vh',
    featuredTagLabel: 'Certified Organic Harvest',
    customerTrustBadgeText: 'Verified Mwea Milling Standards',
    supportHotlineDisplay: '+254 700 000000',
    expressLogisticsNote: 'Same-day dispatch available for Nairobi, Kiambu & Kirinyaga'
  });
  
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  
  const [flashSale, setFlashSale] = useState({ active: false, endTime: null as string | null, msRemaining: 0 });
  const [baseTransportFee, setBaseTransportFee] = useState(250);
  const [bulkCfg, setBulkCfg] = useState<BulkConfig | null>(null);
  const [countyOverrides, setCountyOverrides] = useState<{ [key: string]: number }>({});
  const [serverLocations, setServerLocations] = useState<{ [county: string]: string[] }>({});
  const [socket, setSocket] = useState<Socket | null>(null);

  // REAL-TIME PAYHERO PAYMENT STATUS MODAL STATE
  const [activePaymentModal, setActivePaymentModal] = useState<{
    isOpen: boolean;
    orderId: string | number | null;
    status: 'PENDING' | 'PAID' | 'FAILED';
    receipt: string | null;
    reason: string | null;
    phoneNumber: string;
    amount: number;
    isPolling: boolean;
    method?: 'mpesa_stk' | 'mpesa_till';
    tillNumber?: string | null;
    tillName?: string | null;
  }>({
    isOpen: false,
    orderId: null,
    status: 'PENDING',
    receipt: null,
    reason: null,
    phoneNumber: '',
    amount: 0,
    isPolling: false
  });

  // CLICKABLE ADDRESS & PAYMENT DETAILS MODAL STATES
  const [viewAddressModal, setViewAddressModal] = useState<Order | null>(null);
  const [viewPaymentDetailsModal, setViewPaymentDetailsModal] = useState<Order | null>(null);

  // PAYMENT METHODS, TILL CODE ENTRY, PROMO CODE, IDLE WARNING
  const [paymentMethods, setPaymentMethods] = useState<{ stkEnabled: boolean; tillEnabled: boolean; tillNumber: string | null; tillName: string | null; tillAutoVerify: boolean }>({ stkEnabled: true, tillEnabled: false, tillNumber: null, tillName: null, tillAutoVerify: false });
  const [tillCodeInput, setTillCodeInput] = useState('');
  const [tillSubmitting, setTillSubmitting] = useState(false);
  const [tillMessage, setTillMessage] = useState<{ text: string; tone: 'info' | 'error' | 'success' } | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoState, setPromoState] = useState<{ code: string; discount: number; message: string } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [idleWarning, setIdleWarning] = useState<number | null>(null);
  const idleWarningRef = useRef<number | null>(null);

  // REGIONAL CHECKOUT DATA STATE
  const [checkoutData, setCheckoutData] = useState({
    county: '',
    town: '',
    location: '',
    sublocation: '',
    shippingAddress: '',
    paymentMethod: 'mpesa_stk',
    stkPhoneNumber: ''
  });
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  // AUTH FORM STATES
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'reset'>('request');
  const [formData, setFormData] = useState({ phoneNumber: '', email: '', password: '', fullName: '', resetToken: '', newPassword: '' });
  const [signupOtpStep, setSignupOtpStep] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);     // true while a sign-in / register / verify request is running
  const [resendWait, setResendWait] = useState(0);     // seconds before "Resend code" can be used again
  const [referralInput, setReferralInput] = useState('');
  const [referralCheck, setReferralCheck] = useState<{ state: 'idle' | 'checking' | 'valid' | 'invalid'; agentName?: string }>({ state: 'idle' });
  const [signupOtp, setSignupOtp] = useState('');
  const [otpSentTo, setOtpSentTo] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [twoFactor, setTwoFactor] = useState<{ challengeId: string; message: string } | null>(null);
  const [reviewProduct, setReviewProduct] = useState<Product | null>(null);
  const [marketingOptOut, setMarketingOptOut] = useState<boolean | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  
  // ADMIN PANEL NAVIGATION & DATA STATES
  const [adminTab, setAdminTab] = useState<'inventory' | 'orders' | 'finances' | 'users' | 'config' | 'carousel' | 'logs' | 'agents' | 'activity' | 'reports' | 'stock' | 'expenses' | 'campaigns' | 'reviews' | 'system' | 'payments' | 'promos' | 'dispatch' | 'bulk' | 'chat'>('inventory');
  const [newProduct, setNewProduct] = useState({ 
    brandName: '', variety: '', weightKg: '', basePrice: '', buyingPrice: '', flashSalePrice: '', stockQuantity: '', imageUrl: '', description: '', isOrganic: false 
  });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserAccount[]>([]);
  const [adminLogs, setAdminLogs] = useState<AuditLog[]>([]);
  const [financialData, setFinancialData] = useState<FinancialAnalyticsResponse | null>(null);
  const [isFinanceLoading, setIsFinanceLoading] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [financeYear, setFinanceYear] = useState<number>(new Date().getFullYear());
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  
  // CATALOG FILTERING STATES
  const [shopSearch, setShopSearch] = useState('');
  const [selectedVariety, setSelectedVariety] = useState<string>('All');
  const [selectedWeight, setSelectedWeight] = useState<string>('All');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(15000);
  
  const [countyOverrideForm, setCountyOverrideForm] = useState({ county: 'Nairobi', fee: '' });
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // TOAST NOTIFICATION DISPATCHER
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Town list for a county = built-in towns + every official constituency served by the backend (no duplicates)
  const getTownOptions = (county: string): string[] => {
    const base = (REGIONAL_LOGISTICS_DATA[county as keyof typeof REGIONAL_LOGISTICS_DATA] || DEFAULT_REGIONAL_LOGISTICS).towns;
    const key = Object.keys(serverLocations).find(k => normPlaceName(k) === normPlaceName(county));
    const extra = key && Array.isArray(serverLocations[key]) ? serverLocations[key] : [];
    const seen = new Set<string>();
    const out: string[] = [];
    [...base, ...extra].forEach(t => {
      const n = normPlaceName(t);
      if (n && !seen.has(n)) { seen.add(n); out.push(t); }
    });
    return out;
  };

  // Shows the server's error message for a failed admin/API call
  const showApiError = async (res: Response, fallback: string) => {
    const d = await res.json().catch(() => ({}));
    showToast(d.error || `${fallback} (${res.status})`, 'error');
    if (res.status === 401) handleSessionExpired();
  };

  const getAccountCartKey = (u: UserAccount | null) => {
    return u ? `mwea_hub_cart_${u.id || u.phoneNumber}` : 'mwea_hub_cart_guest';
  };

  // LOCAL STORAGE CART SYNCHRONIZATION
  useEffect(() => {
    try {
      const storageKey = getAccountCartKey(user);
      const savedCart = localStorage.getItem(storageKey);
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      } else {
        setCart([]);
      }
    } catch (err) {
      console.error("Failed to read account cart from storage:", err);
      setCart([]);
    }
  }, [user]);

  useEffect(() => {
    try {
      const storageKey = getAccountCartKey(user);
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch (err) {
      console.error("Failed to save cart to storage:", err);
    }
  }, [cart, user]);

  const clearCart = () => {
    setCart([]);
    showToast('Cart cleared successfully.', 'info');
  };

  // HERO BACKDROP MEDIA ROTATION TIMER
  useEffect(() => {
    const mediaArray = [
      { type: 'video', url: heroSettings?.video1 },
      { type: 'video', url: heroSettings?.video2 },
      { type: 'image', url: heroSettings?.img1 },
      { type: 'image', url: heroSettings?.img2 },
      { type: 'image', url: heroSettings?.img3 }
    ].filter(item => item.url && item.url.trim() !== '');

    const currentMedia = mediaArray.length > 0 ? mediaArray[activeHeroIndex % mediaArray.length] : null;
    const delay = currentMedia?.type === 'video' ? 7000 : 4500;

    const timeoutId = setTimeout(() => {
      setActiveHeroIndex(prev => prev + 1);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [activeHeroIndex, heroSettings]);

  // CASCADE REGIONAL LOGISTICS SELECTION WHEN COUNTY CHANGES
  useEffect(() => {
    // Changing the county clears the rest of the address: the customer always fills it in themselves.
    setCheckoutData(prev => ({ ...prev, town: '', location: '', sublocation: '', shippingAddress: '' }));
  }, [checkoutData.county]);

  useEffect(() => {
    if (user && !checkoutData.stkPhoneNumber) {
      setCheckoutData(prev => ({ ...prev, stkPhoneNumber: user.phoneNumber || '' }));
    }
  }, [user]);

  // INITIAL SESSION RECOVERY & WEBSOCKET SETUP
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch (err) {
      console.error("Error reading saved authentication state:", err);
    }

    fetchProducts();
    fetchCarousel();
    fetchHero();
    fetchCountiesConfig();
    fetchLocations();
    fetchFlashSale();
    fetchPaymentMethods();
    fetchBulkConfig();

    let newSocket: Socket | null = null;
    try {
      newSocket = io(SOCKET_URL, { transports: ['websocket', 'polling'], reconnectionDelayMax: 10000 });
      setSocket(newSocket);

      newSocket.on('blackFridayTick', (data: any) => {
        setFlashSale({ active: data.active, endTime: data.endTime, msRemaining: data.msRemaining });
      });
      
      newSocket.on('blackFridayEnded', () => {
        setFlashSale({ active: false, endTime: null, msRemaining: 0 });
        fetchProducts();
      });

      newSocket.on('blackFridayStarted', (data: any) => {
        setFlashSale({ active: data.active, endTime: data.endTime, msRemaining: 0 });
        fetchProducts();
      });

      newSocket.on('stockUpdated', (data: any) => {
        setProducts(prev => prev.map(p => p.id === data.productId ? { ...p, stockQuantity: data.newStockQuantity } : p));
      });

      newSocket.on('connect', () => { fetchFlashSale(); });
      newSocket.on('smsCreditLow', (d: any) => showToast(`SMS credit is low (${d?.balance}). Customers may stop receiving OTP codes. Top up Ping Africa.`, 'warning'));
      newSocket.on('lowStockAlert', (d: any) => showToast(`Low stock: ${d?.name} has ${d?.remainingStock} left.`, 'warning'));
      newSocket.on('productsChanged', () => fetchProducts());

      newSocket.on('countyFeesUpdated', (fees: any) => {
        if (fees && typeof fees === 'object') setCountyOverrides(fees);
      });

      newSocket.on('bulkConfigUpdated', (cfg: any) => {
        if (cfg && typeof cfg === 'object') setBulkCfg(cfg);
      });

      newSocket.on('heroUpdated', (newHero: any) => {
        setHeroSettings(newHero);
      });

      newSocket.on('carouselUpdated', (newSlides: any[]) => {
        setCarousel(newSlides);
      });

      newSocket.on('orderStatusUpdated', (updatedOrder: any) => {
        setMyOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        setAdminOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        
        if (activePaymentModal.orderId && String(activePaymentModal.orderId) === String(updatedOrder.id)) {
          const info = extractPaymentInfo(updatedOrder);
          setActivePaymentModal(prev => ({
            ...prev,
            status: info.status as any,
            receipt: info.receipt,
            reason: info.reason,
            isPolling: info.status === 'PENDING'
          }));
          
          if (info.status === 'PAID') {
            showToast(`Payment Verified! M-Pesa Code: ${info.receipt || 'CONFIRMED'}`, 'success');
          } else if (info.status === 'FAILED') {
            showToast(`Payment Failed: ${info.reason || 'Cancelled'}`, 'error');
          }
        }
      });

      newSocket.on('paymentReceived', (paymentEvent: any) => {
        if (activePaymentModal.orderId && String(activePaymentModal.orderId) === String(paymentEvent.orderId)) {
          setActivePaymentModal(prev => ({
            ...prev,
            status: paymentEvent.isPaid ? 'PAID' : 'FAILED',
            receipt: paymentEvent.mpesaReceipt || null,
            reason: paymentEvent.paymentDetails?.failureReason || null,
            isPolling: false
          }));
        }
      });
    } catch (err) {
      console.error("Socket.io connection error:", err);
    }

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, []);

  // SLIDING SESSION: the server sends back a fresh token while the person is active, and every API call uses the newest one.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const isApi = url.startsWith(API_BASE_URL);
      let nextInit = init;
      try {
        const latest = localStorage.getItem('token');
        if (isApi && latest) {
          const hdrs = new Headers((init && init.headers) || (typeof input !== 'string' && input && input.headers) || undefined);
          if (hdrs.has('Authorization')) { hdrs.set('Authorization', `Bearer ${latest}`); nextInit = { ...(init || {}), headers: hdrs }; }
        }
      } catch (_) { /* keep original request */ }
      let res = await originalFetch(input, nextInit);
      try {
        const fresh = res.headers.get('x-refresh-token');
        if (isApi && fresh && localStorage.getItem('token')) localStorage.setItem('token', fresh);
      } catch (_) { /* ignore */ }
      // A 401 can be a request that left with an older token while a newer one was already saved. Retry once with the newest token before anyone is told to sign in again.
      try {
        if (isApi && res.status === 401 && typeof input === 'string') {
          const latest2 = localStorage.getItem('token');
          const sentAuth = new Headers((nextInit && nextInit.headers) || undefined).get('Authorization');
          if (latest2 && sentAuth && sentAuth !== `Bearer ${latest2}`) {
            const hdrs2 = new Headers((nextInit && nextInit.headers) || undefined);
            hdrs2.set('Authorization', `Bearer ${latest2}`);
            res = await originalFetch(input, { ...(nextInit || {}), headers: hdrs2 });
            const fresh2 = res.headers.get('x-refresh-token');
            if (fresh2 && localStorage.getItem('token')) localStorage.setItem('token', fresh2);
          }
        }
      } catch (_) { /* keep first response */ }
      return res;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  // IDLE LOGOUT: after a stretch with no activity (admin 6 hours, customers 24 hours, agents/support 30 min) the person must log in again.
  useEffect(() => {
    if (!token || !user) return;
    const minutes = ({ admin: 360, support: 30, agent: 30 } as Record<string, number>)[user.role] || 1440;
    const idleMs = minutes * 60 * 1000;
    const WARN_MS = 60 * 1000;
    const KEY = 'mwea_last_activity';
    let lastMark = 0;
    const mark = () => { lastMark = Date.now(); try { localStorage.setItem(KEY, String(lastMark)); } catch (_) { /* ignore */ } };
    try { if (!localStorage.getItem(KEY)) mark(); } catch (_) { /* ignore */ }
    const onActivity = () => { if (idleWarningRef.current !== null) return; if (Date.now() - lastMark > 4000) mark(); };
    const check = () => {
      let last = Date.now();
      try { last = Number(localStorage.getItem(KEY)) || Date.now(); } catch (_) { /* ignore */ }
      const idle = Date.now() - last;
      if (idle >= idleMs) {
        idleWarningRef.current = null; setIdleWarning(null);
        handleSessionExpired('You were away for a while, so you were signed out for your security. Please log in again.', true);
      } else if (idleMs - idle <= WARN_MS) {
        const secs = Math.ceil((idleMs - idle) / 1000);
        idleWarningRef.current = secs; setIdleWarning(secs);
      } else if (idleWarningRef.current !== null) { idleWarningRef.current = null; setIdleWarning(null); }
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    const timer = setInterval(check, 5000);
    check();
    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      clearInterval(timer);
    };
  }, [token, user?.id, user?.role]);

  // Only offer payment methods the shop has switched on
  useEffect(() => {
    setCheckoutData(prev => {
      if (prev.paymentMethod === 'mpesa_till' && !paymentMethods.tillEnabled) return { ...prev, paymentMethod: 'mpesa_stk' };
      if (prev.paymentMethod === 'mpesa_stk' && !paymentMethods.stkEnabled && paymentMethods.tillEnabled) return { ...prev, paymentMethod: 'mpesa_till' };
      return prev;
    });
  }, [paymentMethods.tillEnabled, paymentMethods.stkEnabled]);

  // If the phone number or email changes after a code was sent, the old code no longer applies
  const otpIdentityRef = useRef('');
  useEffect(() => {
    const current = `${(formData.phoneNumber || '').replace(/\D/g, '')}|${(formData.email || '').trim().toLowerCase()}`;
    if (signupOtpStep && !otpIdentityRef.current) otpIdentityRef.current = current;
    if (!signupOtpStep) otpIdentityRef.current = '';
    if (signupOtpStep && otpIdentityRef.current && otpIdentityRef.current !== current) {
      setSignupOtpStep(false);
      setSignupOtp('');
      otpIdentityRef.current = '';
      showToast('You changed your contact details, so please request a new code.', 'info');
    }
  }, [signupOtpStep, formData.phoneNumber, formData.email]);

  // REFERRAL LINKS: ?ref=CODE is remembered so it survives until the person signs up or checks out
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('ref');
      const code = (fromUrl || localStorage.getItem('mwea_ref') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      if (code) {
        localStorage.setItem('mwea_ref', code);
        setReferralInput(code);
        if (fromUrl) showToast('Referral code applied. Create an account to link it.', 'info');
      }
    } catch (_) { /* storage unavailable */ }
  }, []);

  // Confirms a typed referral code with the server and shows the agent's first name
  useEffect(() => {
    const code = referralInput.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) { setReferralCheck({ state: 'idle' }); return; }
    setReferralCheck({ state: 'checking' });
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/referral/validate?code=${encodeURIComponent(code)}`);
        const d = await res.json();
        setReferralCheck(d.valid ? { state: 'valid', agentName: d.agentName } : { state: 'invalid' });
      } catch (_) { setReferralCheck({ state: 'idle' }); }
    }, 400);
    return () => clearTimeout(t);
  }, [referralInput]);

  // KEEP EACH ROLE ON ITS OWN SCREEN (e.g. a dismissed agent is sent home)
  useEffect(() => {
    if (view === 'admin' && user?.role !== 'admin') setView(user ? 'home' : 'login');
    if (view === 'agent' && user?.role !== 'agent') setView(user ? 'home' : 'login');
    if (view === 'support' && user?.role !== 'support') setView(user ? 'home' : 'login');
  }, [view, user?.role]);

  // Always price the cart with the admin's latest bulk settings when the customer opens the cart or the bulk tab
  useEffect(() => { if (view === 'cart' || view === 'bulk') fetchBulkConfig(); }, [view]);

  // Cart lines use the newest product details (stock, bulk prices) whenever the catalog reloads
  useEffect(() => {
    if (!products.length) return;
    setCart(prev => {
      let changed = false;
      const next = prev.map(i => { const fresh = products.find(p => p.id === i.productId); if (fresh && fresh !== i.product) { changed = true; return { ...i, product: fresh }; } return i; });
      return changed ? next : prev;
    });
  }, [products]);

  // Whether this customer wants promotional SMS
  useEffect(() => {
    if (!token || view !== 'profile') return;
    fetch(`${API_BASE_URL}/user/marketing-preference`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json()).then(d => setMarketingOptOut(!!d.optedOut)).catch(() => {});
  }, [token, view]);

  // CONFIRM THE SAVED LOGIN IS STILL VALID (expired / deleted / suspended accounts are signed out)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (cancelled) return;
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          handleSessionExpired('Your session is no longer valid. Please log in again.', true);
          return;
        }
        if (res.ok) {
          const p = await res.json();
          setUser(prev => {
            if (!prev) return prev;
            const merged = { ...prev, fullName: p.fullName ?? prev.fullName, role: p.role ?? prev.role, rewardPoints: p.rewardPoints ?? prev.rewardPoints };
            if (merged.fullName === prev.fullName && merged.role === prev.role && merged.rewardPoints === prev.rewardPoints) return prev;
            try { localStorage.setItem('user', JSON.stringify(merged)); } catch (_) { /* ignore */ }
            return merged;
          });
        }
      } catch (err) {
        console.warn("Session check skipped (network):", err);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // ADMINS JOIN THE LIVE ORDER CHANNEL SO NEW ORDERS APPEAR INSTANTLY
  useEffect(() => {
    if (!socket || !token || user?.role !== 'admin') return;
    const join = () => socket.emit('joinAdminChannel', localStorage.getItem('token') || token);
    const onNewOrder = (order: any) => {
      showToast(`New order #${order?.id ?? ''} received!`, 'info');
      fetchAdminOrders();
    };
    join();
    socket.on('connect', join);
    socket.on('newOrderAlert', onNewOrder);
    return () => {
      socket.off('connect', join);
      socket.off('newOrderAlert', onNewOrder);
    };
  }, [socket, token, user?.role]);

  // LOAD USER DATA & ADMIN RECORDS ON LOGIN
  useEffect(() => {
    if (token && user) {
      fetchMyOrders();
      if (user.role === 'admin') {
        fetchAdminOrders();
        fetchAdminUsers();
        fetchAdminLogs();
        fetchFinancialAnalytics(financeYear);
      }
    }
  }, [token, user]);

  // REFRESH LIVE ADMIN DATA WHENEVER THE LOGS / FINANCES TAB IS OPENED
  useEffect(() => {
    if (token && user?.role === 'admin') {
      if (adminTab === 'logs') fetchAdminLogs();
      if (adminTab === 'finances') fetchFinancialAnalytics(financeYear);
    }
  }, [adminTab]);

  // REAL-TIME PAYHERO PAYMENT POLLING ENGINE
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    if (activePaymentModal.isOpen && activePaymentModal.orderId && activePaymentModal.status === 'PENDING') {
      setActivePaymentModal(prev => ({ ...prev, isPolling: true }));

      pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/payments/payhero/status/${activePaymentModal.orderId}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
          
          if (res.ok) {
            const data = await res.json();
            const rawStatus = data.paymentStatus || (data.paymentDetails?.isPaid ? 'PAID' : 'PENDING');
            
            if (rawStatus === 'PAID' || rawStatus === 'SUCCESS') {
              const receiptCode = data.paymentDetails?.mpesaReceipt || data.heroData?.mpesa_code || 'CONFIRMED';
              setActivePaymentModal(prev => ({
                ...prev,
                status: 'PAID',
                receipt: receiptCode,
                reason: null,
                isPolling: false
              }));
              showToast(`M-Pesa Payment Confirmed! Receipt #${receiptCode}`, 'success');
              fetchMyOrders();
              if (pollInterval) clearInterval(pollInterval);
            } else if (rawStatus === 'FAILED' || rawStatus === 'CANCELLED') {
              const reasonText = data.paymentDetails?.failureReason || 'Declined on mobile handset';
              setActivePaymentModal(prev => ({
                ...prev,
                status: 'FAILED',
                receipt: null,
                reason: reasonText,
                isPolling: false
              }));
              showToast(`Payment Failed: ${reasonText}`, 'error');
              if (pollInterval) clearInterval(pollInterval);
            }
          }
        } catch (pollErr) {
          console.warn("PayHero backend status check warning:", pollErr);
        }
      }, 3000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activePaymentModal.isOpen, activePaymentModal.orderId, activePaymentModal.status, token]);

  // ============================================================================
  // 7. API FETCHERS & DISPATCHERS
  // ============================================================================

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/products/catalog`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error("Failed to load catalog:", err);
    }
  };

  const fetchCarousel = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/carousel`);
      if (res.ok) {
        const data = await res.json();
        setCarousel(data);
      }
    } catch (err) {
      console.error("Failed to load carousel config:", err);
    }
  };

  const fetchHero = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/hero`);
      if (res.ok) {
        const data = await res.json();
        if (data && Object.keys(data).length > 0) {
          setHeroSettings((prev: any) => ({ ...prev, ...data }));
        }
      }
    } catch (err) {
      console.error("Failed to load hero backdrop config:", err);
    }
  };

  const fetchCountiesConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/counties`);
      if (res.ok) {
        const data = await res.json();
        setCountyOverrides(data || {});
      }
    } catch (err) {
      console.error("Failed to load regional transport config:", err);
    }
  };

  const fetchBulkConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/bulk-discount`);
      if (res.ok) setBulkCfg(await res.json());
    } catch (err) {
      console.error("Failed to load bulk order settings:", err);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/payment-methods`);
      if (res.ok) setPaymentMethods(await res.json());
    } catch (err) { console.error('Failed to load payment methods:', err); }
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/locations`);
      if (res.ok) {
        const data = await res.json();
        const tree = data && data.hierarchy && !Array.isArray(data.hierarchy) ? data.hierarchy : data;
        const clean: { [county: string]: string[] } = {};
        Object.keys(tree || {}).forEach(k => { if (Array.isArray(tree[k])) clean[k] = tree[k].filter((x: any) => typeof x === 'string'); });
        setServerLocations(clean);
      }
    } catch (err) {
      console.error("Failed to load Kenya locations:", err);
    }
  };

  const fetchFlashSale = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/flash-sale`);
      if (res.ok) {
        const d = await res.json();
        setFlashSale({ active: !!d.active, endTime: d.endTime ?? null, msRemaining: Number(d.msRemaining) || 0 });
      }
    } catch (err) {
      console.error("Failed to load flash sale state:", err);
    }
  };

  const fetchMyOrders = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/orders/my-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyOrders(data);
      }
    } catch (err) {
      console.error("Failed to fetch user orders:", err);
    }
  };

  const fetchAdminOrders = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminOrders(data);
      }
    } catch (err) {
      console.error("Failed to load admin orders:", err);
    }
  };

  const fetchAdminUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list: any[] = Array.isArray(data) ? data : (data.users || []);
        setAdminUsers(list.map((u: any) => ({ ...u, isSuspended: u.isSuspended ?? (u.isActive === false) })));
      }
    } catch (err) {
      console.error("Failed to fetch user directory:", err);
    }
  };

  const fetchAdminLogs = async () => {
    if (!token) return;
    setIsLogsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list: any[] = Array.isArray(data) ? data : (data.logs || []);
        setAdminLogs(list.map((l: any) => ({
          id: l.id,
          action: String(l.action || 'UNKNOWN'),
          performedByUserId: l.performedByUserId ?? l.adminId,
          performedByName: l.performedByName || l.adminName || 'System Auto',
          performedByEmail: l.performedByEmail,
          module: l.module || l.targetType || 'system',
          details: l.details || (l.changes ? (typeof l.changes === 'string' ? l.changes : JSON.stringify(l.changes)) : ''),
          ipAddress: l.ipAddress,
          timestamp: l.timestamp || l.createdAt
        })));
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Failed to load audit logs', 'error');
      }
    } catch (err) {
      console.error("Failed to load system audit logs:", err);
    } finally {
      setIsLogsLoading(false);
    }
  };

  const fetchFinancialAnalytics = async (year: number) => {
    if (!token) return;
    setIsFinanceLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/analytics/finances?year=${year}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const rawMonths: any[] = data.monthlyBreakdown || data.monthlySalesGrowth || [];
        const monthlyBreakdown: FinancialMonth[] = rawMonths.map((m: any, i: number) => {
          const idx = typeof m.monthIndex === 'number' ? m.monthIndex : i;
          const revenue = Number(m.totalRevenue ?? m.totalReceivedSales ?? 0);
          const cost = Number(m.totalBuyingCost ?? 0);
          return {
            monthIndex: idx,
            monthName: m.monthName || m.month || MONTH_NAMES_SHORT[idx],
            year: Number(data.year ?? data.selectedYear ?? year),
            totalRevenue: revenue,
            totalBuyingCost: cost,
            netProfit: Number(m.netProfit ?? m.totalProfit ?? (revenue - cost)),
            totalKgSold: Number(m.totalKgSold ?? 0),
            orderCount: Number(m.orderCount ?? m.paidOrderCount ?? 0)
          };
        });
        const sm = data.summary || {};
        setFinancialData({
          year: Number(data.year ?? data.selectedYear ?? year),
          availableYears: Array.isArray(data.availableYears) && data.availableYears.length > 0 ? data.availableYears : [year],
          monthlyBreakdown,
          summary: {
            totalMoneyReceived: Number(sm.totalMoneyReceived ?? 0),
            totalBuyingCosts: Number(sm.totalBuyingCosts ?? sm.totalBuyingCost ?? 0),
            totalNetProfit: Number(sm.totalNetProfit ?? 0),
            totalKgSold: Number(sm.totalKgSold ?? 0),
            totalOrdersCount: Number(sm.totalOrdersCount ?? monthlyBreakdown.reduce((n, m) => n + m.orderCount, 0)),
            totalPointsAwarded: Number(sm.totalPointsAwarded ?? 0)
          }
        });
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Failed to load financial analytics', 'error');
      }
    } catch (err) {
      console.error("Failed to load financial engine analytics:", err);
    } finally {
      setIsFinanceLoading(false);
    }
  };

  // CART CALCULATIONS
  const addToCart = (product: Product, qty: number = 1, bulk: boolean = false) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.productId === product.id && !!item.bulk === bulk);
      if (existing) {
        return prevCart.map(item => (item.productId === product.id && !!item.bulk === bulk) ? { ...item, quantity: item.quantity + qty } : item);
      }
      return [...prevCart, { productId: product.id, quantity: qty, product, bulk }];
    });
    showToast(bulk ? `Added bulk order: ${product.brandName} (${qty} bags) to cart!` : `Added ${product.brandName} (${product.weightKg}kg) to cart!`, 'success');
  };

  const updateCartQuantity = (productId: number, qty: number, bulk: boolean = false) => {
    if (qty <= 0) {
      removeFromCart(productId, bulk);
      return;
    }
    setCart(prev => prev.map(item => (item.productId === productId && !!item.bulk === bulk) ? { ...item, quantity: qty } : item));
  };

  const removeFromCart = (productId: number, bulk: boolean = false) => {
    setCart(prev => prev.filter(item => !(item.productId === productId && !!item.bulk === bulk)));
    showToast('Item removed from cart.', 'info');
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      return sum + (getCartLineUnit(item, flashSale.active, bulkCfg).price * item.quantity);
    }, 0);
  }, [cart, flashSale.active, bulkCfg]);

  const totalCartWeightKg = useMemo(() => {
    return cart.reduce((sum, item) => {
      const p = item.product || {};
      return sum + ((p.weightKg || 0) * item.quantity);
    }, 0);
  }, [cart]);

  // When the cart holds a bulk order, the admin's BULK delivery cost for the county replaces the normal fee (if one is set)
  const bulkFreightFee = useMemo(() => {
    if (!checkoutData.county || !bulkCfg) return undefined;
    if (!cart.some(i => i.bulk && isBulkQualified(bulkCfg, i.product, i.quantity))) return undefined;
    const f = getCountyFee(bulkCfg.transport || {}, checkoutData.county);
    return f !== undefined && Number.isFinite(f) ? f : undefined;
  }, [cart, bulkCfg, checkoutData.county]);

  const activeShippingFee = useMemo(() => {
    const selectedCounty = checkoutData.county;
    if (!selectedCounty) return 0;
    if (bulkFreightFee !== undefined) return bulkFreightFee;
    const overrideFee = getCountyFee(countyOverrides, selectedCounty);
    if (overrideFee !== undefined && Number.isFinite(overrideFee)) {
      return overrideFee;
    }
    return baseTransportFee;
  }, [checkoutData.county, countyOverrides, baseTransportFee, bulkFreightFee]);

  const promoDiscount = promoState ? Math.min(promoState.discount, cartSubtotal) : 0;
  const cartGrandTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - promoDiscount) + (cart.length > 0 ? activeShippingFee : 0);
  }, [cartSubtotal, promoDiscount, cart.length, activeShippingFee]);

  // If the cart changes, the promo discount is checked again against the new subtotal
  useEffect(() => { if (promoState) applyPromo(promoState.code, true); }, [cartSubtotal]);

  const expectedRewardPoints = useMemo(() => {
    return Number((totalCartWeightKg * 0.2).toFixed(2));
  }, [totalCartWeightKg]);

  // AUTH HANDLERS
  // Splits the single "phone or email" box into the field the backend expects
  const buildIdentityPayload = (raw: string) => {
    const value = (raw || '').trim();
    return value.includes('@') ? { email: value } : { phoneNumber: value };
  };

  // Second step of an administrator sign-in
  const finishTwoFactorSignIn = (data: any) => {
    setTwoFactor(null);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('mwea_last_activity', String(Date.now()));
    showToast(`Welcome back, ${data.user.fullName}!`, 'success');
    setView('admin');
  };

  // Resend cooldown ticks down once a second
  useEffect(() => {
    if (resendWait <= 0) return;
    const t = setTimeout(() => setResendWait(w => Math.max(0, w - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendWait]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy) return; // a second tap while the first request is still running is ignored (it used to send twice)
    const identifier = (formData.phoneNumber || formData.email || '').trim();
    const identity = buildIdentityPayload(identifier);

    if (!identifier) {
      showToast('Enter your phone number or email address.', 'error');
      return;
    }
    if (identifier.includes('@')) {
      if (!/^\S+@\S+\.\S+$/.test(identifier)) { showToast('Enter a valid email address.', 'error'); return; }
    } else if (!normalizeKenyanPhone(identifier)) {
      showToast('Enter a valid Kenyan phone number, e.g. 0712345678.', 'error');
      return;
    }
    if (!isLogin && signupOtpStep) {
      if (!/^\d{6}$/.test(signupOtp.trim())) { showToast('Enter the 6-digit verification code.', 'error'); return; }
    } else {
      if (!formData.password) { showToast('Enter your password.', 'error'); return; }
      if (!isLogin) {
        if (!String(formData.fullName || '').trim()) { showToast('Enter your full name.', 'error'); return; }
        if (formData.password.length < MIN_PASSWORD_LENGTH) { showToast(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 'error'); return; }
        if (!acceptedTerms) { showToast('Please read and accept the Terms and Conditions to create an account.', 'error'); return; }
      }
    }
    
    setAuthBusy(true);
    try {
      let endpoint = '/user/login';
      let payload: any = { ...identity, identifier, password: formData.password };

      if (!isLogin) {
        if (signupOtpStep) {
          endpoint = '/user/signup/verify-otp';
          payload = { ...identity, otp: signupOtp.trim(), referralCode: referralInput || undefined };
        } else {
          endpoint = '/user/signup';
          payload = { ...identity, password: formData.password, fullName: formData.fullName, requireOtp: true, acceptedTerms: true, termsVersion: TERMS_VERSION, referralCode: referralInput || undefined };
        }
      }

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.requiresOtp) {
        const shownPhone = String(data.phoneNumber || identifier || '').replace(/\D/g, '');
        setOtpSentTo(data.smsSent === false && data.emailSent ? (data.email || 'your email') : (shownPhone.length >= 9 ? `0${shownPhone.slice(-9, -6)}***${shownPhone.slice(-3)}`.replace(/^0(\d{3})/, '0$1') : (data.email || 'your phone')));
        setSignupOtpStep(true);
        setResendWait(30);
        showToast(data.message || 'Verification code sent. Check your phone or email.', 'success');
        return;
      }
      
      if (res.ok && data.requiresTwoFactor) {
        setTwoFactor({ challengeId: data.challengeId, message: data.message || 'Enter the 6-digit code we sent you.' });
        showToast('Check your phone or email for your sign-in code.', 'info');
        return;
      }

      if (res.ok && data.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('mwea_last_activity', String(Date.now()));
        showToast(isLogin ? `Welcome back, ${data.user.fullName}!` : 'Account created successfully!', 'success');
        setSignupOtpStep(false);
        setSignupOtp('');
        try { if (!isLogin) localStorage.removeItem('mwea_ref'); } catch (_) { /* ignore */ }
        setView(data.user.role === 'admin' ? 'admin' : data.user.role === 'agent' ? 'agent' : data.user.role === 'support' ? 'support' : 'home');
      } else if (data && data.requiresVerification) {
        // Right password but the account was never verified: the server just sent a code, so continue at the code step.
        setIsLogin(false);
        setSignupOtpStep(true);
        setSignupOtp('');
        showToast(data.error || 'Enter the verification code we sent to finish creating your account.', 'info');
      } else {
        showToast(data.error || 'Authentication failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Server authentication error', 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleResendSignupOtp = async () => {
    if (authBusy || resendWait > 0) return;
    const identifier = (formData.phoneNumber || formData.email || '').trim();
    setAuthBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/signup/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildIdentityPayload(identifier))
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'A fresh verification code has been sent.', 'success');
      } else {
        showToast(data.error || 'Failed to resend code', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to resend verification code', 'error');
    } finally {
      setAuthBusy(false);
      setResendWait(30);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetStep === 'request') {
      try {
        const res = await fetch(`${API_BASE_URL}/user/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildIdentityPayload(formData.email || formData.phoneNumber))
        });
        const data = await res.json();
        if (res.ok) {
          showToast(data.message || 'OTP sent to your phone or email.', 'success');
          setResetStep('reset');
        } else {
          showToast((data.error || 'Failed to request OTP') + (data.detail ? ` (${data.detail})` : ''), 'error');
        }
      } catch (err: any) {
        showToast(err.message || 'Failed to dispatch password reset request', 'error');
      }
    } else {
      if (formData.newPassword.length < MIN_PASSWORD_LENGTH) {
        showToast(`Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 'error');
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/user/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...buildIdentityPayload(formData.email || formData.phoneNumber),
            otp: formData.resetToken,
            newPassword: formData.newPassword
          })
        });
        const data = await res.json();
        if (res.ok) {
          showToast(data.message || 'Password reset successfully. Please login.', 'success');
          setIsForgotPassword(false);
          setResetStep('request');
          setIsLogin(true);
        } else {
          showToast(data.error || 'OTP Verification failed', 'error');
        }
      } catch (err: any) {
        showToast(err.message || 'Error updating password', 'error');
      }
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('mwea_last_activity');
    setView('home');
    showToast('Logged out successfully.', 'info');
  };

  // Called when the server says the saved login is no longer valid
  // Signs the person out. A stray 401 from one screen (for example a request that raced a token renewal) must NOT
  // sign anybody out, so unless the caller is certain (`force`), the server is asked first whether the login is really dead.
  const sessionCheckRef = useRef<boolean>(false);
  const signOutNow = (message: string) => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('mwea_last_activity');
    setView('login');
    showToast(message, 'warning');
  };
  const handleSessionExpired = (message: string = 'Your session has expired. Please log in again.', force: boolean = false) => {
    if (force || !localStorage.getItem('token')) { signOutNow(message); return; }
    if (sessionCheckRef.current) return; // many requests failing together = one check
    sessionCheckRef.current = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/profile`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          let code = '';
          try { code = (await res.clone().json()).code || ''; } catch (_) { /* ignore */ }
          console.warn('Session confirmed invalid by the server:', res.status, code);
          signOutNow(message);
        } else {
          console.warn('Ignored a stray 401: the session is still valid.');
        }
      } catch (_) { /* network problem: keep the session */ }
      finally { setTimeout(() => { sessionCheckRef.current = false; }, 4000); }
    })();
  };

  const handleExpiredRef = useRef(handleSessionExpired);
  handleExpiredRef.current = handleSessionExpired;
  useEffect(() => {
    const h = () => handleExpiredRef.current();
    window.addEventListener('mwea:auth-401', h);
    return () => window.removeEventListener('mwea:auth-401', h);
  }, []);

  // ORDER CREATION & STK PUSH INITIATION
  const handlePlaceOrder = async () => {
    if (!token) {
      showToast('Please login to finalize your order.', 'error');
      setView('login');
      return;
    }

    if (cart.length === 0) {
      showToast('Your cart is empty!', 'error');
      return;
    }

    if (isCheckingOut) return;

    const stkPhone = normalizeKenyanPhone(checkoutData.stkPhoneNumber);
    if (checkoutData.paymentMethod === 'mpesa_till' && !paymentMethods.tillEnabled) {
      showToast('Till payments are not available right now. Please use STK push.', 'error');
      return;
    }
    if (checkoutData.paymentMethod === 'mpesa_stk' && !stkPhone) {
      showToast('Enter a valid M-Pesa number, e.g. 0712345678, for the STK Push prompt.', 'error');
      return;
    }
    if (!checkoutData.county || !checkoutData.town) {
      showToast('Please choose your delivery county and town.', 'error');
      return;
    }
    if (String(checkoutData.shippingAddress || '').trim().length < 3) {
      showToast('Please enter your street, building or landmark so we can find you.', 'error');
      return;
    }

    setIsCheckingOut(true);

    try {
      const payload = {
        cartItems: cart.map(i => ({ productId: i.productId, quantity: i.quantity, bulk: !!i.bulk })),
        paymentMethod: checkoutData.paymentMethod,
        mpesaPhoneNumber: stkPhone || checkoutData.stkPhoneNumber,
        referralCode: referralInput || undefined,
        promoCode: promoState ? promoState.code : undefined,
        county: checkoutData.county,
        town: checkoutData.town,
        location: checkoutData.location,
        sublocation: checkoutData.sublocation,
        streetAddress: checkoutData.shippingAddress,
        shippingAddress: `${checkoutData.shippingAddress}, ${checkoutData.sublocation}, ${checkoutData.location}, ${checkoutData.town}, ${checkoutData.county}`,
        shippingFee: activeShippingFee,
        grandTotal: cartGrandTotal
      };

      const res = await fetch(`${API_BASE_URL}/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.id) {
        setCart([]);
        fetchMyOrders();
        
        const initialPaymentInfo = extractPaymentInfo(data);
        const isTill = checkoutData.paymentMethod === 'mpesa_till';
        setTillCodeInput('');
        setTillMessage(null);
        setPromoState(null);
        setPromoInput('');
        setActivePaymentModal({
          isOpen: true,
          orderId: data.id,
          status: initialPaymentInfo.status as any,
          receipt: initialPaymentInfo.receipt,
          reason: initialPaymentInfo.reason,
          phoneNumber: stkPhone || checkoutData.stkPhoneNumber || user?.phoneNumber || 'N/A',
          amount: Number(data.grandTotal ?? cartGrandTotal),
          isPolling: true,
          method: isTill ? 'mpesa_till' : 'mpesa_stk',
          tillNumber: data.till?.number || paymentMethods.tillNumber,
          tillName: data.till?.name || paymentMethods.tillName
        });

        if (isTill) {
          showToast(`Order #${data.id} placed. Pay to Till ${data.till?.number || paymentMethods.tillNumber}, then enter your M-Pesa code.`, 'success');
        } else if (data.stkPromptSent) {
          showToast('STK Push dispatched to handset! Enter M-Pesa PIN to complete.', 'success');
        } else {
          showToast(data.stkStatusMessage || 'Order placed, but the M-Pesa prompt could not be sent. Use Retry to resend it.', 'warning');
        }
      } else {
        if (res.status === 401) { handleSessionExpired(); return; }
        if (res.status === 422) fetchProducts();
        showToast(data.error || 'Order creation failed.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Server error while processing order', 'error');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleRetryStkPush = async (orderId: number | string, phone: string, amount: number) => {
    try {
      const retryPhone = normalizeKenyanPhone(phone);
      if (!retryPhone) {
        showToast('Enter a valid M-Pesa number, e.g. 0712345678.', 'error');
        return;
      }
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}/retry-stk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ phoneNumber: retryPhone })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast('STK push prompt resent to handset.', 'success');
        setActivePaymentModal({ isOpen: true, orderId, status: 'PENDING', receipt: null, reason: null, phoneNumber: phone, amount, isPolling: true, method: 'mpesa_stk' });
      } else {
        if (res.status === 401) { handleSessionExpired(); return; }
        showToast(data.error || 'Failed to dispatch STK Push', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'STK Push dispatch error', 'error');
    }
  };

  // Opens the Till payment screen for an unpaid order
  const openTillModal = (order: any) => {
    setTillCodeInput('');
    setTillMessage(null);
    setActivePaymentModal({
      isOpen: true, orderId: order.id, status: 'PENDING', receipt: null, reason: null, phoneNumber: user?.phoneNumber || '',
      amount: Number(order.grandTotal) || 0, isPolling: true, method: 'mpesa_till',
      tillNumber: order.paymentDetails?.tillNumber || paymentMethods.tillNumber, tillName: order.paymentDetails?.tillName || paymentMethods.tillName
    });
  };

  const handleSubmitTillCode = async () => {
    if (!activePaymentModal.orderId || tillSubmitting) return;
    const code = tillCodeInput.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 10) { setTillMessage({ text: 'The M-Pesa code is 10 letters and numbers, e.g. SJK4L9XQ2P. Copy it from your M-Pesa SMS.', tone: 'error' }); return; }
    setTillSubmitting(true);
    setTillMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${activePaymentModal.orderId}/till-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mpesaCode: code, phoneNumber: user?.phoneNumber })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { handleSessionExpired(); return; }
      if (!res.ok) { setTillMessage({ text: data.error || 'Could not submit the code.', tone: 'error' }); return; }
      if (data.status === 'PAID') {
        setActivePaymentModal(prev => ({ ...prev, status: 'PAID', receipt: code, reason: null }));
        showToast('Till payment confirmed. Thank you!', 'success');
        fetchMyOrders();
      } else {
        setTillMessage({ text: data.message, tone: data.status === 'SUBMITTED' ? 'info' : 'error' });
        fetchMyOrders();
      }
    } catch (err: any) {
      setTillMessage({ text: err.message || 'Network error. Please try again.', tone: 'error' });
    } finally { setTillSubmitting(false); }
  };

  const applyPromo = async (codeArg?: string, silent = false) => {
    const code = (codeArg ?? promoInput).trim().toUpperCase();
    if (!code) return;
    if (!token) { if (!silent) showToast('Log in to use a promo code.', 'error'); return; }
    setPromoChecking(true);
    try {
      const res = await fetch(`${API_BASE_URL}/promo/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code, subtotal: cartSubtotal })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid) { setPromoState({ code: data.code || code, discount: Number(data.discount) || 0, message: data.message }); if (!silent) showToast(data.message, 'success'); }
      else { setPromoState(null); if (!silent || data.message) showToast(data.message || 'Promo code not valid.', 'error'); }
    } catch (_) { if (!silent) showToast('Could not check the promo code.', 'error'); }
    finally { setPromoChecking(false); }
  };

  const staySignedIn = () => {
    try { localStorage.setItem('mwea_last_activity', String(Date.now())); } catch (_) { /* ignore */ }
    idleWarningRef.current = null; setIdleWarning(null);
    fetch(`${API_BASE_URL}/user/profile`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => {});
  };

  // ADMIN OPERATIONS
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          brandName: newProduct.brandName,
          variety: newProduct.variety,
          weightKg: Number(newProduct.weightKg),
          basePrice: Number(newProduct.basePrice),
          buyingPrice: newProduct.buyingPrice ? Number(newProduct.buyingPrice) : null,
          flashSalePrice: newProduct.flashSalePrice ? Number(newProduct.flashSalePrice) : null,
          stockQuantity: Number(newProduct.stockQuantity),
          imageUrl: newProduct.imageUrl,
          description: newProduct.description,
          isOrganic: newProduct.isOrganic
        })
      });
      if (res.ok) {
        showToast('New grain product added to catalog!', 'success');
        setNewProduct({ brandName: '', variety: '', weightKg: '', basePrice: '', buyingPrice: '', flashSalePrice: '', stockQuantity: '', imageUrl: '', description: '', isOrganic: false });
        fetchProducts();
      } else {
        const d = await res.json();
        showToast(d.error || 'Product creation failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingProduct) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editingProduct)
      });
      if (res.ok) {
        showToast('Product updated successfully!', 'success');
        setEditingProduct(null);
        fetchProducts();
      } else {
        await showApiError(res, 'Failed to update product');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!token || !confirm("Are you sure you want to permanently delete this catalog item?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Catalog item deleted.', 'info');
        fetchProducts();
      } else {
        await showApiError(res, 'Failed to delete product');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, newStatus: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Order #${orderId} status updated to ${newStatus}`, 'success');
        fetchAdminOrders();
      } else {
        await showApiError(res, 'Failed to update order status');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleManualPaymentOverride = async (orderId: number, isPaid: boolean, paidTag: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/payment-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isPaid, paidTag })
      });
      if (res.ok) {
        showToast(`Order #${orderId} payment tag updated to ${paidTag}`, 'success');
        fetchAdminOrders();
        fetchFinancialAnalytics(financeYear);
      } else {
        await showApiError(res, 'Failed to update payment status');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // ADMIN USER MANAGEMENT HANDLERS (EDIT, SUSPEND, DELETE)
  const handleSetUserRole = async (target: UserAccount, role: 'customer' | 'agent' | 'support') => {
    const labels: Record<string, string> = {
      agent: `Make ${target.fullName} an agent? They get a referral code and an agent dashboard.`,
      support: `Make ${target.fullName} customer care staff? They can view accounts, fix names and reactivate suspended accounts, nothing more.`,
      customer: `Return ${target.fullName} to a normal customer account?`
    };
    if (!confirm(labels[role])) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${target.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        const d = await res.json();
        showToast(d.message || 'Role updated.', 'success');
        fetchAdminUsers();
      } else {
        await showApiError(res, 'Could not change role');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editingUser)
      });
      if (res.ok) {
        showToast(`User account for ${editingUser.fullName} updated!`, 'success');
        setEditingUser(null);
        fetchAdminUsers();
      } else {
        const d = await res.json();
        showToast(d.error || 'User update failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleUserSuspension = async (userId: number, currentStatus: boolean) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/suspend`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isSuspended: !currentStatus })
      });
      if (res.ok) {
        showToast(`User account ${!currentStatus ? 'suspended' : 'reactivated'} successfully.`, 'warning');
        fetchAdminUsers();
      } else {
        await showApiError(res, 'Failed to change account status');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteUserAccount = async (userId: number) => {
    if (!token || !confirm("CRITICAL WARNING: Are you sure you want to permanently delete this user account?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('User account removed permanently.', 'info');
        fetchAdminUsers();
      } else {
        const d = await res.json();
        showToast(d.error || 'Failed to delete user', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleFlashSale = async (active: boolean, hours: number = 24) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/config/black-friday`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active, durationHours: hours })
      });
      if (res.ok) {
        showToast(active ? `Flash Harvest Sale Activated for ${hours} hours!` : 'Flash Sale Deactivated', 'success');
        fetchFlashSale();
        fetchProducts();
      } else {
        await showApiError(res, 'Failed to change flash sale');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveCountyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/config/counties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ county: countyOverrideForm.county, fee: Number(countyOverrideForm.fee) })
      });
      if (res.ok) {
        showToast(`Freight fee for ${countyOverrideForm.county} set to KES ${countyOverrideForm.fee}`, 'success');
        fetchCountiesConfig();
        setCountyOverrideForm({ county: 'Nairobi', fee: '' });
      } else {
        await showApiError(res, 'Failed to save freight fee');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveHeroSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/config/hero`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(heroSettings)
      });
      if (res.ok) {
        showToast('Storefront Hero configuration synchronized!', 'success');
      } else {
        await showApiError(res, 'Failed to save hero settings');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // CATALOG FILTER LOGIC
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.brandName?.toLowerCase().includes(shopSearch.toLowerCase()) ||
                            p.variety?.toLowerCase().includes(shopSearch.toLowerCase());
      const matchesVariety = selectedVariety === 'All' || p.variety === selectedVariety;
      const matchesWeight = selectedWeight === 'All' || String(p.weightKg) === selectedWeight;
      const effectivePrice = flashSale.active && p.flashSalePrice ? p.flashSalePrice : (p.basePrice || p.price || 0);
      const matchesPrice = effectivePrice <= maxPriceFilter;

      return matchesSearch && matchesVariety && matchesWeight && matchesPrice;
    });
  }, [products, shopSearch, selectedVariety, selectedWeight, maxPriceFilter, flashSale.active]);

  const varietiesList = useMemo(() => {
    const setV = new Set<string>();
    products.forEach(p => { if (p.variety) setV.add(p.variety); });
    return ['All', ...Array.from(setV)];
  }, [products]);

  const weightsList = useMemo(() => {
    const setW = new Set<string>();
    products.forEach(p => { if (p.weightKg) setW.add(String(p.weightKg)); });
    return ['All', ...Array.from(setW).sort((a,b) => Number(a) - Number(b))];
  }, [products]);

  const heroMediaList = useMemo(() => {
    const items = [];
    if (heroSettings.video1) items.push({ type: 'video', url: heroSettings.video1 });
    if (heroSettings.video2) items.push({ type: 'video', url: heroSettings.video2 });
    if (heroSettings.img1) items.push({ type: 'image', url: heroSettings.img1 });
    if (heroSettings.img2) items.push({ type: 'image', url: heroSettings.img2 });
    if (heroSettings.img3) items.push({ type: 'image', url: heroSettings.img3 });
    if (items.length === 0) {
      items.push({ type: 'image', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80' });
    }
    return items;
  }, [heroSettings]);

  const activeMedia = heroMediaList[activeHeroIndex % heroMediaList.length];

  return (
    <div className="min-h-screen bg-emerald-50/20 text-slate-800 font-sans flex flex-col antialiased pb-20 md:pb-0">
      
      {/* FLOATING TOAST NOTIFICATION CONTAINER */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`pointer-events-auto px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold text-white transition-all transform animate-in slide-in-from-top-4 ${
              toast.type === 'success' ? 'bg-emerald-800 border border-emerald-600' :
              toast.type === 'error' ? 'bg-rose-700 border border-rose-500' :
              toast.type === 'warning' ? 'bg-amber-600 border border-amber-400' : 'bg-slate-800 border border-slate-600'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-300" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-300" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-300" />}
            {toast.type === 'info' && <Bell className="w-5 h-5 text-slate-300" />}
            <span className="flex-1">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* TOP ANNOUNCEMENT TICKER */}
      {heroSettings.enableLiveTicker && (
        <div className="bg-emerald-950 text-emerald-200 text-xs py-2 px-4 flex items-center justify-between border-b border-emerald-800/80">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider">
                Live Notice
              </span>
              <p className="truncate font-semibold text-[11px]">{heroSettings.announcementTicker}</p>
            </div>
            <div className="hidden md:flex items-center gap-6 text-emerald-300 text-[11px] font-semibold">
              <span className="flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5" /> Hotline: {heroSettings.supportHotlineDisplay}
              </span>
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" /> {heroSettings.expressLogisticsNote}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* HEADER NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-sm">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <button onClick={() => setView('home')} className="flex items-center gap-3 text-left group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-700/20 group-hover:scale-105 transition-transform">
              <Leaf className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-700 bg-clip-text text-transparent">
                MWEA RICE HUB
              </h1>
              <p className="text-[9px] font-extrabold text-emerald-600 tracking-widest uppercase">Pure Kenyan Harvest</p>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 font-extrabold text-xs tracking-wide">
            <button 
              onClick={() => setView('home')} 
              className={`transition-all py-1.5 ${view === 'home' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-600 hover:text-emerald-700'}`}
            >
              Home
            </button>
            <button 
              onClick={() => setView('shop')} 
              className={`transition-all py-1.5 ${view === 'shop' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-600 hover:text-emerald-700'}`}
            >
              Grain Catalog
            </button>
            <button 
              onClick={() => setView('bulk')} 
              className={`transition-all py-1.5 flex items-center gap-1.5 ${view === 'bulk' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-600 hover:text-emerald-700'}`}
            >
              <Layers className="w-3.5 h-3.5" /> Bulk Order
            </button>
            {user && (
              <button 
                onClick={() => setView('profile')} 
                className={`transition-all py-1.5 ${view === 'profile' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-600 hover:text-emerald-700'}`}
              >
                My Orders & Points
              </button>
            )}
            {user?.role === 'agent' && (
              <button 
                onClick={() => setView('agent')} 
                className={`transition-all py-1.5 flex items-center gap-1.5 font-black ${view === 'agent' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-emerald-600 hover:text-emerald-700'}`}
              >
                <Briefcase className="w-4 h-4" /> Agent Dashboard
              </button>
            )}
            {user?.role === 'support' && (
              <button 
                onClick={() => setView('support')} 
                className={`transition-all py-1.5 flex items-center gap-1.5 font-black ${view === 'support' ? 'text-sky-700 border-b-2 border-sky-600' : 'text-sky-600 hover:text-sky-700'}`}
              >
                <Headphones className="w-4 h-4" /> Customer Care
              </button>
            )}
            {user?.role === 'admin' && (
              <button 
                onClick={() => setView('admin')} 
                className={`transition-all py-1.5 flex items-center gap-1.5 font-black ${view === 'admin' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-amber-600 hover:text-amber-700'}`}
              >
                <Shield className="w-4 h-4" /> Admin Console
              </button>
            )}
          </nav>

          {/* Desktop User Menu & Cart Trigger */}
          <div className="flex items-center gap-3">
            
            {/* Cart Trigger Button */}
            <button 
              onClick={() => setView('cart')} 
              className="relative p-2.5 rounded-2xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-all border border-emerald-200/50 flex items-center justify-center cursor-pointer"
              aria-label="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5 text-emerald-700" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>

            {/* User Account Capsule */}
            {user ? (
              <div className="hidden md:flex items-center gap-3 border-l border-slate-200 pl-4">
                <div className="text-right">
                  <p className="text-xs font-black text-slate-900">{user.fullName}</p>
                  <p className="text-[10px] font-bold text-emerald-600">{user.rewardPoints || 0} Points</p>
                </div>
                <button 
                  onClick={handleLogout} 
                  className="p-2 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Log Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setView('login')} 
                className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/20"
              >
                <LogIn className="w-4 h-4" /> Sign In
              </button>
            )}

            {/* Mobile Menu Toggle Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="md:hidden p-2.5 rounded-2xl text-slate-700 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-emerald-100 px-4 py-6 flex flex-col gap-3 animate-in slide-in-from-top-2">
            <button onClick={() => { setView('home'); setMobileMenuOpen(false); }} className="text-left font-bold py-2.5 text-slate-700 border-b border-slate-100 flex items-center justify-between">
              <span>Home</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
            <button onClick={() => { setView('shop'); setMobileMenuOpen(false); }} className="text-left font-bold py-2.5 text-slate-700 border-b border-slate-100 flex items-center justify-between">
              <span>Grain Catalog</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
            <button onClick={() => { setView('bulk'); setMobileMenuOpen(false); }} className="text-left font-bold py-2.5 text-slate-700 border-b border-slate-100 flex items-center justify-between">
              <span>Bulk Order</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
            {user ? (
              <>
                <button onClick={() => { setView('profile'); setMobileMenuOpen(false); }} className="text-left font-bold py-2.5 text-slate-700 border-b border-slate-100 flex items-center justify-between">
                  <span>My Orders & Points ({user.rewardPoints || 0} pts)</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
                {user.role === 'agent' && (
                  <button onClick={() => { setView('agent'); setMobileMenuOpen(false); }} className="text-left font-black py-2.5 text-emerald-600 border-b border-slate-100 flex items-center justify-between">
                    <span>Agent Dashboard</span>
                    <Briefcase className="w-4 h-4" />
                  </button>
                )}
                {user.role === 'support' && (
                  <button onClick={() => { setView('support'); setMobileMenuOpen(false); }} className="text-left font-black py-2.5 text-sky-600 border-b border-slate-100 flex items-center justify-between">
                    <span>Customer Care Desk</span>
                    <Headphones className="w-4 h-4" />
                  </button>
                )}
                {user.role === 'admin' && (
                  <button onClick={() => { setView('admin'); setMobileMenuOpen(false); }} className="text-left font-black py-2.5 text-amber-600 border-b border-slate-100 flex items-center justify-between">
                    <span>Admin Control Console</span>
                    <Shield className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="text-left font-bold py-2.5 text-rose-600 flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Sign Out ({user.fullName})
                </button>
              </>
            ) : (
              <button onClick={() => { setView('login'); setMobileMenuOpen(false); }} className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-center text-xs shadow-md">
                Sign In / Create Account
              </button>
            )}
          </div>
        )}
      </header>

      {/* MAIN VIEW CONTENT AREA */}
      <main className="flex-1">

        {/* =================================================================== */}
        {/* VIEW: HOME PAGE                                                     */}
        {/* =================================================================== */}
        {view === 'home' && (
          <div className="space-y-12 md:space-y-16">
            
            {/* HERO ROTATING BACKDROP BANNER */}
            <section className="relative w-full overflow-hidden bg-slate-950 text-white" style={{ minHeight: heroSettings.bannerHeight || '65vh' }}>
              
              {/* Media Renderer */}
              <div className="absolute inset-0 z-0 opacity-55">
                {activeMedia?.type === 'video' ? (
                  <iframe 
                    src={activeMedia.url} 
                    className="w-full h-full object-cover scale-125 pointer-events-none" 
                    allow="autoplay; muted; loop"
                    title="Hero Video Background"
                  />
                ) : (
                  <img 
                    src={activeMedia?.url} 
                    alt="Paddy Fields Harvest" 
                    className="w-full h-full object-cover transition-opacity duration-1000" 
                  />
                )}
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" 
                  style={{ opacity: (Number(heroSettings.overlayOpacity) || 40) / 100 }}
                />
              </div>

              {/* Hero Content Overlay */}
              <div className="relative z-10 container mx-auto px-4 h-full py-16 md:py-24 flex flex-col justify-center max-w-4xl space-y-6">
                
                {/* Badge Label */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-emerald-300 font-bold text-xs uppercase tracking-wider w-fit">
                  <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{heroSettings.badgeText}</span>
                </div>

                {/* Main Heading */}
                <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-tight">
                  {heroSettings.title}
                </h2>

                {/* Subtitle */}
                <p className="text-base md:text-xl text-slate-300 font-normal leading-relaxed max-w-2xl">
                  {heroSettings.subtitle}
                </p>

                {/* Call to Actions */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button 
                    onClick={() => setView('shop')} 
                    className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm sm:text-base transition-all shadow-xl shadow-emerald-950/50 flex items-center gap-3 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                  >
                    <span>{heroSettings.ctaButtonText}</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  {user && (
                    <button 
                      onClick={() => setView('profile')} 
                      className="px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold text-sm sm:text-base transition-all border border-white/20 cursor-pointer"
                    >
                      {heroSettings.secondaryButtonText}
                    </button>
                  )}
                </div>

                {/* Slide Indicators */}
                <div className="flex items-center gap-2 pt-6">
                  {heroMediaList.map((_, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setActiveHeroIndex(idx)}
                      className={`h-2 rounded-full transition-all ${idx === (activeHeroIndex % heroMediaList.length) ? 'w-8 bg-emerald-400' : 'w-2 bg-white/30'}`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </section>

            {/* FLASH HARVEST SALE COUNTDOWN SECTION */}
            {flashSale.active && (
              <section className="container mx-auto px-4">
                <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-red-700 rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-2 z-10 text-center md:text-left">
                    <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest text-amber-200">
                      Limited Time Harvest Event
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-black">🔥 FLASH HARVEST DISCOUNTS ACTIVE!</h3>
                    <p className="text-rose-100 text-xs sm:text-sm">Save big on 25kg Pishori & Basmati sacks. Direct farm pricing.</p>
                  </div>

                  <div className="flex items-center gap-4 bg-black/30 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 z-10">
                    <Clock className="w-8 h-8 text-amber-300 animate-pulse" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-200">Sale Closes In</p>
                      <p className="text-2xl sm:text-3xl font-mono font-black text-white">{formatCountdownMs(flashSale.msRemaining)}</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* FEATURED PRODUCTS GRID SECTION */}
            {/* PHONE PRIORITY: 2 products per row on small devices (grid-cols-2), 4 on laptops (lg:grid-cols-4) */}
            <section className="container mx-auto px-4 space-y-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-emerald-100 pb-4">
                <div>
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Handpicked Selections</span>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900">Featured Mwea Grain Sacks</h3>
                </div>
                <button 
                  onClick={() => setView('shop')} 
                  className="text-emerald-700 hover:text-emerald-800 font-extrabold text-xs sm:text-sm flex items-center gap-1 group cursor-pointer"
                >
                  <span>Explore Full Catalog ({products.length})</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* GRID: grid-cols-2 on small devices, lg:grid-cols-4 on laptops */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                {products.slice(0, 4).map((product) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    flashActive={flashSale.active}
                    onAddToCart={() => addToCart(product)}
                    onQuickView={() => setQuickViewProduct(product)}
                    onReviews={() => setReviewProduct(product)}
                  />
                ))}
              </div>
            </section>

            {/* STORE VALUE PROPOSITIONS */}
            <section className="bg-emerald-950 text-white py-14">
              <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                <div className="bg-emerald-900/40 p-8 rounded-3xl border border-emerald-800/60 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center mx-auto md:mx-0">
                    <Leaf className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold">100% Authentic Mwea Pishori</h4>
                  <p className="text-emerald-200 text-xs sm:text-sm leading-relaxed">Directly harvested from Kirinyaga paddy fields. Pure aroma guaranteed with zero blending.</p>
                </div>

                <div className="bg-emerald-900/40 p-8 rounded-3xl border border-emerald-800/60 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center mx-auto md:mx-0">
                    <Truck className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold">47 County Freight Logistics</h4>
                  <p className="text-emerald-200 text-xs sm:text-sm leading-relaxed">Streamlined door-to-door delivery across all Kenyan counties with automated rate calculations.</p>
                </div>

                <div className="bg-emerald-900/40 p-8 rounded-3xl border border-emerald-800/60 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center mx-auto md:mx-0">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold">Instant M-Pesa STK Push</h4>
                  <p className="text-emerald-200 text-xs sm:text-sm leading-relaxed">Safe, real-time automated payment verification powered by PayHero. Instant receipt verification.</p>
                </div>
              </div>
            </section>

          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW: GRAIN CATALOG / SHOP                                          */}
        {/* =================================================================== */}
        {view === 'shop' && (
          <div className="container mx-auto px-4 py-8 space-y-8">
            
            {/* Page Header */}
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Mwea Agricultural Grain Store</h2>
              <p className="text-slate-500 text-xs sm:text-sm">Select from premium long-grain aromatic rice varieties packaged in 5kg, 10kg, 25kg, and 50kg sacks.</p>
            </div>

            {/* Catalog Filter Controls */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-emerald-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search brand or variety..."
                  value={shopSearch}
                  onChange={(e) => setShopSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Rice Variety Filter */}
              <div>
                <select 
                  value={selectedVariety}
                  onChange={(e) => setSelectedVariety(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white cursor-pointer"
                >
                  <option value="All">All Varieties</option>
                  {varietiesList.filter(v => v !== 'All').map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Weight Filter */}
              <div>
                <select 
                  value={selectedWeight}
                  onChange={(e) => setSelectedWeight(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white cursor-pointer"
                >
                  <option value="All">All Weight Sacks</option>
                  {weightsList.filter(w => w !== 'All').map(w => (
                    <option key={w} value={w}>{w} kg Sack</option>
                  ))}
                </select>
              </div>

              {/* Price Range Filter Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>Max Price:</span>
                  <span className="text-emerald-700 font-extrabold">{formatKES(maxPriceFilter)}</span>
                </div>
                <input 
                  type="range"
                  min="500"
                  max="15000"
                  step="250"
                  value={maxPriceFilter}
                  onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

            </div>

            {/* CATALOG GRID */}
            {/* PHONE PRIORITY: 2 products per row on small devices (grid-cols-2), 4 on laptops (lg:grid-cols-4) */}
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-slate-100 max-w-md mx-auto">
                <Package className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-700">No matching rice products found</h3>
                <p className="text-xs text-slate-500">Try adjusting your search query or filter settings.</p>
                <button 
                  onClick={() => { setShopSearch(''); setSelectedVariety('All'); setSelectedWeight('All'); setMaxPriceFilter(15000); }}
                  className="px-6 py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                {filteredProducts.map(product => (
                  <ProductCard 
                    key={product.id}
                    product={product}
                    flashActive={flashSale.active}
                    onAddToCart={() => addToCart(product)}
                    onQuickView={() => setQuickViewProduct(product)}
                    onReviews={() => setReviewProduct(product)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW: BULK RICE ORDERS                                              */}
        {/* =================================================================== */}
        {view === 'bulk' && (
          <BulkOrderView products={products} addToCart={addToCart} setView={setView} showToast={showToast} />
        )}

        {/* =================================================================== */}
        {/* VIEW: SHOPPING CART & REGIONAL CHECKOUT                             */}
        {/* =================================================================== */}
        {view === 'cart' && (
          <div className="container mx-auto px-4 py-8 space-y-8">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Your Agricultural Order Cart</h2>

            {cart.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center space-y-6 border border-emerald-100 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <ShoppingCart className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-800">Your cart is empty</h3>
                  <p className="text-xs text-slate-500">Browse our fresh aromatic Pishori catalog and add grain sacks to proceed.</p>
                </div>
                <button 
                  onClick={() => setView('shop')}
                  className="px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  Explore Grain Catalog
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Cart Line Items List */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <span className="font-bold text-slate-700 text-sm">{cart.length} Product Line Items</span>
                      <button onClick={clearCart} className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" /> Clear Cart
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {cart.map(item => {
                        const p = item.product || {};
                        const unit = getCartLineUnit(item, flashSale.active, bulkCfg);
                        const lineIsBulk = !!item.bulk && isBulkQualified(bulkCfg, p, item.quantity);
                        const effectivePrice = unit.price;
                        const nextTier = (Array.isArray(p.wholesaleTiers) ? p.wholesaleTiers : []).filter((t: any) => t.minQty > item.quantity).sort((a: any, b: any) => a.minQty - b.minQty)[0];

                        return (
                          <div key={`${item.productId}-${item.bulk ? 'bulk' : 'shop'}`} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <img 
                                src={p.imageUrl || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80'} 
                                alt={p.brandName} 
                                className="w-14 h-14 rounded-2xl object-cover border border-slate-100"
                              />
                              <div>
                                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">{p.brandName}</h4>
                                <p className="text-[11px] text-slate-500">{p.variety} • {p.weightKg}kg Sack</p>
                                <p className="text-emerald-700 font-black text-xs sm:text-sm mt-0.5">{formatKES(effectivePrice)} {unit.bulk && <span className="ml-1 px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[9px] font-black uppercase">{unit.bulkPercent ? `Bulk -${unit.bulkPercent}%` : 'Bulk price'}</span>}</p>
                                {lineIsBulk && <p className="text-[10px] font-bold text-emerald-700">Bulk order · not limited by shelf stock</p>}
                                {item.bulk && !lineIsBulk && <p className="text-[10px] font-bold text-amber-600">Below {bulkRuleFor(bulkCfg, p.id).minKg}kg this is a normal order (normal price, stock limits apply)</p>}
                                {nextTier && <p className="text-[10px] font-bold text-sky-700">Add {nextTier.minQty - item.quantity} more to pay {formatKES(nextTier.price)} each</p>}
                              </div>
                            </div>

                            {/* Quantity Adjusters */}
                            <div className="flex items-center justify-between sm:justify-end gap-3">
                              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                <button 
                                  onClick={() => updateCartQuantity(item.productId, item.quantity - 1, !!item.bulk)}
                                  className="px-3 py-1 text-slate-600 hover:bg-slate-200 font-bold cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="px-3 py-1 font-bold text-xs text-slate-800">{item.quantity}</span>
                                <button 
                                  onClick={() => updateCartQuantity(item.productId, item.quantity + 1, !!item.bulk)}
                                  className="px-3 py-1 text-slate-600 hover:bg-slate-200 font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>

                              <button 
                                onClick={() => removeFromCart(item.productId, !!item.bulk)}
                                className="p-2 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Regional Freight Logistics & M-Pesa STK Checkout Summary */}
                <div className="space-y-6">
                  
                  {/* Delivery Location Selection (47 Counties) */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4">
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-emerald-600" /> Regional Freight Logistics
                    </h3>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Select County (47 Coverage)</label>
                        <select 
                          value={checkoutData.county}
                          onChange={(e) => setCheckoutData(prev => ({ ...prev, county: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                        >
                          <option value="" disabled>Choose your county…</option>
                          {ALL_47_COUNTIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Town</label>
                          <select 
                            value={checkoutData.town}
                            disabled={!checkoutData.county}
                            onChange={(e) => setCheckoutData(prev => ({ ...prev, town: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium bg-white cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
                          >
                            <option value="" disabled>Choose town…</option>
                            {getTownOptions(checkoutData.county).map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Location</label>
                          <select 
                            value={checkoutData.location}
                            disabled={!checkoutData.county}
                            onChange={(e) => setCheckoutData(prev => ({ ...prev, location: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium bg-white cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
                          >
                            <option value="" disabled>Choose location…</option>
                          {(REGIONAL_LOGISTICS_DATA[checkoutData.county as keyof typeof REGIONAL_LOGISTICS_DATA]?.locations || DEFAULT_REGIONAL_LOGISTICS.locations).map((l) => (
                              <option key={l} value={l}>{l}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Sublocation</label>
                          <select 
                            value={checkoutData.sublocation}
                            disabled={!checkoutData.county}
                            onChange={(e) => setCheckoutData(prev => ({ ...prev, sublocation: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium bg-white cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
                          >
                            <option value="" disabled>Choose sublocation…</option>
                           {(REGIONAL_LOGISTICS_DATA[checkoutData.county as keyof typeof REGIONAL_LOGISTICS_DATA]?.sublocations || DEFAULT_REGIONAL_LOGISTICS.sublocations).map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Street Landmark</label>
                          <input 
                            type="text"
                            value={checkoutData.shippingAddress}
                            onChange={(e) => setCheckoutData(prev => ({ ...prev, shippingAddress: e.target.value }))}
                            placeholder="Building, street or landmark"
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium"
                          />
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Payment Method & Checkout Trigger */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4">
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Payment Method</h3>

                    <div className="space-y-3">
                      <div className={`grid gap-2 ${paymentMethods.stkEnabled && paymentMethods.tillEnabled ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                        {paymentMethods.stkEnabled && (
                          <button type="button" onClick={() => setCheckoutData(prev => ({ ...prev, paymentMethod: 'mpesa_stk' }))}
                            className={`p-3.5 rounded-2xl border-2 text-left flex items-center gap-3 cursor-pointer transition-all ${checkoutData.paymentMethod === 'mpesa_stk' ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
                            <Smartphone className="w-6 h-6 text-emerald-600 shrink-0" />
                            <div className="min-w-0"><p className="font-extrabold text-xs text-slate-900">M-Pesa Express (STK Push)</p><p className="text-[10px] text-slate-500">A prompt appears on your phone</p></div>
                            {checkoutData.paymentMethod === 'mpesa_stk' && <CheckCircle className="w-5 h-5 text-emerald-600 ml-auto shrink-0" />}
                          </button>
                        )}
                        {paymentMethods.tillEnabled && (
                          <button type="button" onClick={() => { setCheckoutData(prev => ({ ...prev, paymentMethod: 'mpesa_till' })); setPromoState(null); setPromoInput(''); }}
                            className={`p-3.5 rounded-2xl border-2 text-left flex items-center gap-3 cursor-pointer transition-all ${checkoutData.paymentMethod === 'mpesa_till' ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
                            <CreditCard className="w-6 h-6 text-emerald-600 shrink-0" />
                            <div className="min-w-0"><p className="font-extrabold text-xs text-slate-900">Pay to Till {paymentMethods.tillNumber}</p><p className="text-[10px] text-slate-500">Buy Goods, then enter your M-Pesa code</p></div>
                            {checkoutData.paymentMethod === 'mpesa_till' && <CheckCircle className="w-5 h-5 text-emerald-600 ml-auto shrink-0" />}
                          </button>
                        )}
                        {!paymentMethods.stkEnabled && !paymentMethods.tillEnabled && <p className="text-xs font-bold text-rose-600">Payments are temporarily unavailable. Please try again shortly.</p>}
                      </div>

                      {checkoutData.paymentMethod === 'mpesa_stk' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">M-Pesa Phone Number</label>
                          <input 
                            type="tel"
                            inputMode="tel"
                            placeholder="e.g. 0722123456"
                            value={checkoutData.stkPhoneNumber}
                            onChange={(e) => setCheckoutData(prev => ({ ...prev, stkPhoneNumber: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      )}

                      {checkoutData.paymentMethod === 'mpesa_till' && (
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
                          <p className="font-black">How Till payment works</p>
                          <p>1. Place your order here. 2. On M-Pesa choose <b>Lipa na M-Pesa → Buy Goods</b> and pay to Till <b className="font-mono">{paymentMethods.tillNumber}</b>{paymentMethods.tillName ? ` (${paymentMethods.tillName})` : ''}. 3. Enter the M-Pesa code from your SMS and we confirm it.</p>
                        </div>
                      )}
                    </div>

                    {user && user.role !== 'agent' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Referral Code <span className="text-slate-400 font-medium">(optional)</span></label>
                        <input 
                          type="text"
                          value={referralInput}
                          onChange={(e) => setReferralInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                          placeholder="Agent referral code"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold tracking-widest focus:ring-2 focus:ring-emerald-500"
                        />
                        {referralCheck.state === 'valid' && <p className="text-[11px] font-bold text-emerald-600 mt-1">Referred by {referralCheck.agentName}.</p>}
                        {referralCheck.state === 'invalid' && <p className="text-[11px] font-bold text-rose-600 mt-1">Code not recognised.</p>}
                      </div>
                    )}

                    {checkoutData.paymentMethod === 'mpesa_till' ? (
                      <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 text-[11px] text-sky-900 space-y-1">
                        <p className="font-black flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> M-Pesa code verification</p>
                        <p>Promo codes aren't used with Till payments. Place your order, pay the Till above, then you'll be asked for your 10-character M-Pesa code (e.g. SJK4L9XQ2P) so we can confirm the payment straight away.</p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Promo Code <span className="text-slate-400 font-medium">(optional)</span></label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={promoInput}
                            disabled={!!promoState}
                            onChange={(e) => setPromoInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24))}
                            placeholder="Enter code"
                            className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold tracking-widest focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
                          />
                          {promoState ? (
                            <button type="button" onClick={() => { setPromoState(null); setPromoInput(''); }} className="px-4 rounded-xl bg-slate-100 text-slate-700 text-xs font-extrabold cursor-pointer">Remove</button>
                          ) : (
                            <button type="button" onClick={() => applyPromo()} disabled={promoChecking || promoInput.length < 3} className="px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer">{promoChecking ? '…' : 'Apply'}</button>
                          )}
                        </div>
                        {promoState && <p className="text-[11px] font-bold text-emerald-600 mt-1">{promoState.message}</p>}
                      </div>
                    )}

                    {/* Price Breakdown */}
                    <div className="border-t border-slate-100 pt-4 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600 font-semibold">
                        <span>Grain Subtotal:</span>
                        <span className="font-extrabold text-slate-800">{formatKES(cartSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 font-semibold">
                        <span>Total Sacks Weight:</span>
                        <span className="font-extrabold text-slate-800">{totalCartWeightKg} kg</span>
                      </div>
                      <div className="flex justify-between text-slate-600 font-semibold">
                        <span>Freight Delivery ({checkoutData.county}){bulkFreightFee !== undefined ? ' · bulk rate' : ''}:</span>
                        <span className="font-extrabold text-slate-800">{checkoutData.county ? formatKES(activeShippingFee) : 'Choose county'}</span>
                      </div>
                      {promoDiscount > 0 && (
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>Promo ({promoState?.code}):</span>
                          <span>-{formatKES(promoDiscount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Expected Reward Points:</span>
                        <span>+{expectedRewardPoints} pts</span>
                      </div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-900">
                        <span>Grand Total:</span>
                        <span className="text-emerald-700 text-base">{formatKES(cartGrandTotal)}</span>
                      </div>
                    </div>

                    {/* Submit Order Button */}
                    <button 
                      onClick={handlePlaceOrder}
                      disabled={isCheckingOut}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm transition-all shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isCheckingOut ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{checkoutData.paymentMethod === 'mpesa_till' ? 'Placing order...' : 'Dispatching STK Push...'}</span>
                        </>
                      ) : (
                        <>
                          <span>{checkoutData.paymentMethod === 'mpesa_till' ? `Place order · ${formatKES(cartGrandTotal)} to Till` : `Pay ${formatKES(cartGrandTotal)} via M-Pesa`}</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                  </div>

                </div>

              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW: USER PROFILE & ORDERS HISTORY                                */}
        {/* =================================================================== */}
        {view === 'profile' && user && (
          <div className="container mx-auto px-4 py-8 space-y-8">
            
            {/* User Profile Header */}
            <div className="bg-gradient-to-r from-emerald-950 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <span className="bg-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-black text-emerald-300 uppercase tracking-wider">
                  Valued Grain Customer
                </span>
                <h2 className="text-2xl sm:text-3xl font-black">{user.fullName}</h2>
                <p className="text-emerald-200 text-xs">{user.email || user.phoneNumber}</p>
              </div>

              <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Reward Balance</p>
                <p className="text-2xl sm:text-3xl font-black text-white">{user.rewardPoints || 0} <span className="text-xs font-normal">pts</span></p>
                <p className="text-[9px] text-emerald-200 mt-0.5">Earns 0.2 points per kg purchased</p>
              </div>
            </div>

            {/* Promotional SMS preference */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-slate-900 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-emerald-600" /> Offers by SMS</p>
                <p className="text-[11px] text-slate-500">Occasional discounts and bulk deals. You always get order, payment and security messages.</p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" disabled={marketingOptOut === null} checked={marketingOptOut === false} onChange={async (e) => {
                  const optedOut = !e.target.checked;
                  try {
                    const res = await fetch(`${API_BASE_URL}/user/marketing-preference`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ optedOut }) });
                    const d = await res.json();
                    if (res.ok) { setMarketingOptOut(!!d.optedOut); showToast(d.message, 'success'); } else showToast(d.error || 'Could not save', 'error');
                  } catch (err: any) { showToast(err.message, 'error'); }
                }} className="w-4 h-4 accent-emerald-600" />
                Send me offers
              </label>
            </div>

            {/* My Orders History */}
            <div className="space-y-4">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">Your Grain Purchase Orders</h3>

              {myOrders.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center space-y-3 border border-slate-100 max-w-md mx-auto">
                  <Package className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="text-slate-600 font-bold text-xs sm:text-sm">You have not placed any orders yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myOrders.map(order => {
                    const payInfo = extractPaymentInfo(order);

                    return (
                      <div key={order.id} className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4">
                        
                        {/* Order Banner Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                          <div>
                            <span className="text-xs font-black text-emerald-800">ORDER #{order.id}</span>
                            <p className="text-[10px] text-slate-400 font-semibold">{new Date(order.createdAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</p>
                          </div>

                          {/* CLICKABLE PAYMENT STATUS BADGE */}
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setViewPaymentDetailsModal(order)}
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                                payInfo.status === 'PAID' 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200' 
                                  : payInfo.status === 'FAILED'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                              }`}
                              title="Click to view full payment status details and failure logs"
                            >
                              {payInfo.status === 'PAID' && <CheckCircle className="w-3.5 h-3.5" />}
                              {payInfo.status === 'FAILED' && <AlertTriangle className="w-3.5 h-3.5" />}
                              {payInfo.status === 'PENDING' && <Clock className="w-3.5 h-3.5 animate-spin" />}
                              <span>Payment: {payInfo.status}</span>
                              <Eye className="w-3 h-3 ml-0.5 opacity-70" />
                            </button>

                            {/* Retry STK Push */}
                            {payInfo.status !== 'PAID' && order.status !== 'cancelled' && (
                              order.paymentDetails?.method === 'mpesa_till' ? (
                                <button 
                                  onClick={() => openTillModal(order)}
                                  className="px-3 py-1 rounded-full bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shadow-sm cursor-pointer"
                                >
                                  Pay / enter M-Pesa code
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleRetryStkPush(order.id, user.phoneNumber, order.grandTotal)}
                                  className="px-3 py-1 rounded-full bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shadow-sm cursor-pointer"
                                >
                                  Retry STK Push
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {/* Order Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1.5">
                            <p className="font-bold text-slate-700">Items Sourced:</p>
                            <ul className="space-y-1">
                              {Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                                <li key={idx} className="text-slate-600 font-medium">
                                  • {item.name || item.brandName} x{item.quantity} ({formatKES(item.priceAtPurchase || item.price)})
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* CLICKABLE FREIGHT SHIPPING ADDRESS BLOCK */}
                          <div 
                            onClick={() => setViewAddressModal(order)}
                            className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100/80 transition-colors group relative"
                            title="Click to view detailed county, town, and sublocation breakdown"
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-slate-700 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Freight Delivery Address:
                              </p>
                              <span className="text-[10px] font-bold text-emerald-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                View Location <Eye className="w-3 h-3" />
                              </span>
                            </div>
                            
                            <p className="text-slate-600 font-medium underline decoration-dotted underline-offset-4">
                              {formatShippingAddress(order.shippingAddress || order.county)}
                            </p>
                            
                            <div className="pt-2 border-t border-slate-200 mt-2 space-y-0.5">
                              {payInfo.receipt && (
                                <p className="text-emerald-700 font-black">M-Pesa Code: {payInfo.receipt}</p>
                              )}
                              {payInfo.reason && (
                                <p className="text-rose-600 font-semibold">Note: {payInfo.reason}</p>
                              )}
                              {order.paymentDetails?.promo?.code && (
                                <p className="text-emerald-700 font-bold">Promo {order.paymentDetails.promo.code}: -{formatKES(order.paymentDetails.promo.discount)}</p>
                              )}
                              {order.delivery && order.delivery.riderName && (
                                <p className="text-sky-700 font-bold">
                                  Rider: {order.delivery.riderName}{order.delivery.riderPhone ? ` · ${order.delivery.riderPhone}` : ''} ({String(order.delivery.status).replace(/_/g, ' ')})
                                </p>
                              )}
                              <p className="font-black text-slate-900 text-sm mt-1">Total: {formatKES(order.grandTotal)}</p>
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW: LOGIN / SIGNUP / FORGOT PASSWORD                              */}
        {/* =================================================================== */}
        {view === 'login' && (
          <div className="container mx-auto px-4 py-12 max-w-md">
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-emerald-100 space-y-6">
              
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                  <UserIcon className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">
                  {isForgotPassword 
                    ? 'Reset Password' 
                    : isLogin 
                    ? 'Customer Login' 
                    : 'Create Account'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isForgotPassword 
                    ? 'Enter your registered phone number or email to receive an OTP reset code' 
                    : isLogin 
                    ? 'Sign in to place agricultural grain orders' 
                    : 'Join Mwea Rice Hub for loyalty reward points'}
                </p>
              </div>

              {isForgotPassword ? (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 text-xs">
                  {resetStep === 'request' ? (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Phone Number or Email</label>
                      <input 
                        type="text"
                        required
                        value={formData.email || formData.phoneNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value, phoneNumber: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                        placeholder="0712345678 or name@example.com"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">6-Digit OTP Code</label>
                        <input 
                          type="text"
                          required
                          value={formData.resetToken}
                          onChange={(e) => setFormData(prev => ({ ...prev, resetToken: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-mono font-bold tracking-widest text-center focus:ring-2 focus:ring-emerald-500"
                          placeholder="123456"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">New Password</label>
                        <input 
                          type="password"
                          required
                          value={formData.newPassword}
                          onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                        />
                        <PasswordStrength value={formData.newPassword} />
                      </div>
                    </>
                  )}

                  <button 
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    {resetStep === 'request' ? 'Send OTP Code' : 'Update Password'}
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setIsForgotPassword(false)} 
                    className="w-full text-center text-xs font-bold text-slate-500 hover:text-emerald-600 cursor-pointer"
                  >
                    Back to Login
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
                  {!isLogin && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                      <input 
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                        placeholder="Jane Doe"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Phone Number or Email</label>
                    <input 
                      type="text"
                      required
                      value={formData.phoneNumber || formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value, email: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                      placeholder="0712345678 or name@example.com"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Password</label>
                    <input 
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {!isLogin && !signupOtpStep && <PasswordStrength value={formData.password} />}

                  {!isLogin && !signupOtpStep && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Referral Code <span className="text-slate-400 font-medium">(optional)</span></label>
                      <input 
                        type="text"
                        value={referralInput}
                        onChange={(e) => setReferralInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-mono font-bold tracking-widest focus:ring-2 focus:ring-emerald-500"
                        placeholder="e.g. MW7K3QX"
                      />
                      {referralCheck.state === 'valid' && <p className="text-[11px] font-bold text-emerald-600 mt-1">Code accepted — you are being referred by {referralCheck.agentName}.</p>}
                      {referralCheck.state === 'invalid' && <p className="text-[11px] font-bold text-rose-600 mt-1">This code was not recognised. You can still sign up without it.</p>}
                    </div>
                  )}

                  {!isLogin && !signupOtpStep && (
                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                      <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-600 cursor-pointer" />
                      <span className="text-[11px] text-slate-600 leading-snug">
                        I have read and agree to the{' '}
                        <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="font-black text-emerald-700 underline cursor-pointer">Terms and Conditions</button>
                        {' '}and how my personal data is used.
                      </span>
                    </label>
                  )}

                  {!isLogin && signupOtpStep && (
                    <div className="space-y-2">
                      {otpSentTo && <p className="text-[11px] text-slate-500 leading-snug p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">We sent a code to <b className="text-slate-800">{otpSentTo}</b>. If that is the wrong number, change it above and request a new code.</p>}
                      <label className="block font-bold text-slate-700 mb-1">6-Digit Verification Code</label>
                      <input 
                        type="text"
                        required
                        inputMode="numeric"
                        maxLength={6}
                        value={signupOtp}
                        onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-mono font-bold tracking-widest text-center focus:ring-2 focus:ring-emerald-500"
                        placeholder="123456"
                      />
                      <button 
                        type="button"
                        onClick={handleResendSignupOtp}
                        disabled={authBusy || resendWait > 0}
                        className="text-emerald-600 font-bold hover:underline cursor-pointer disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        {resendWait > 0 ? `Resend in ${resendWait}s` : 'Resend code'}
                      </button>
                    </div>
                  )}

                  {isLogin && (
                    <div className="text-right">
                      <button 
                        type="button"
                        onClick={() => setIsForgotPassword(true)}
                        className="text-emerald-600 font-bold hover:underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={authBusy}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    {authBusy ? (isLogin ? 'Signing in…' : (signupOtpStep ? 'Verifying…' : 'Sending your code…')) : (isLogin ? 'Sign In' : (signupOtpStep ? 'Verify & Create Account' : 'Register Account'))}
                  </button>

                  <div className="text-center pt-2">
                    <button 
                      type="button"
                      onClick={() => { setIsLogin(!isLogin); setSignupOtpStep(false); setSignupOtp(''); }}
                      className="text-xs font-bold text-slate-600 hover:text-emerald-600 cursor-pointer"
                    >
                      {isLogin ? "Don't have an account? Sign Up" : "Already registered? Sign In"}
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        )}

     {/* =================================================================== */}
        {/* VIEW: ADMINISTRATIVE DASHBOARD CONSOLE                             */}
        {/* DARK THEMED WITH TWO-PANEL ARCHITECTURE                             */}
        {/* =================================================================== */}
        {view === 'agent' && user?.role === 'agent' && (
          <AgentDashboard token={token} user={user} showToast={showToast} onSessionExpired={() => handleSessionExpired()} />
        )}
        {view === 'support' && user?.role === 'support' && (
          <SupportDashboard token={token} user={user} showToast={showToast} onSessionExpired={() => handleSessionExpired()} />
        )}

        {view === 'admin' && user?.role === 'admin' && (
          <div className="min-h-[85vh] bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
            <div className="container mx-auto space-y-6">
              
              {/* ADMIN CONSOLE HEADER */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-500" />
                    <span className="text-xs font-black text-amber-500 uppercase tracking-widest">Admin Control System</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">Storefront Console</h2>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleToggleFlashSale(!flashSale.active, 24)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      flashSale.active ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                    <span>{flashSale.active ? 'Flash Sale ACTIVE' : 'Start Flash Sale'}</span>
                  </button>
                </div>
              </div>

              <AdminMobileNav
                tabs={ADMIN_TABS}
                active={adminTab}
                onChange={(id) => setAdminTab(id as any)}
                badges={{ orders: adminOrders.filter((o: any) => o.status === 'pending' && (o.paymentDetails?.isPaid === true)).length }}
              />

              {/* TWO-PANEL ARCHITECTURE WITH STICKY SIDEBAR NAVIGATION */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* PANEL 1: STICKY DARK SIDEBAR NAVIGATION & QUICK CONTROL (3 Columns) */}
                <div className="hidden lg:block lg:col-span-3 bg-slate-900/90 rounded-3xl p-5 border border-slate-800 space-y-6 lg:sticky lg:top-24 lg:self-start z-30">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Navigation Panel</p>
                    <nav className="space-y-1.5">
                      {ADMIN_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = adminTab === tab.id;

                        return (
                          <button 
                            key={tab.id}
                            onClick={() => setAdminTab(tab.id as any)}
                            className={`w-full p-3 rounded-2xl text-left transition-all flex items-center gap-3 cursor-pointer ${
                              isActive 
                                ? 'bg-gradient-to-r from-emerald-800 to-teal-800 text-white font-extrabold shadow-lg border border-emerald-600/40' 
                                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                            }`}
                          >
                            <div className={`p-2 rounded-xl ${isActive ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold leading-none">{tab.label}</p>
                              <p className="text-[9px] text-slate-400 mt-1">{tab.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </nav>
                  </div>

                  {/* System Live Metrics Capsule */}
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Store Stats</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Catalog Items:</span>
                        <span className="font-extrabold text-white">{products.length}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Total Registered Users:</span>
                        <span className="font-extrabold text-emerald-400">{adminUsers.length}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Dispatched Orders:</span>
                        <span className="font-extrabold text-teal-400">{adminOrders.length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PANEL 2: MAIN WORKSPACE PANEL (9 Columns) */}
                <div className="lg:col-span-9 min-w-0 space-y-6">

                  {/* SUB-PANEL: INVENTORY CATALOG & ALL PRODUCTS EDITING */}
                  {adminTab === 'inventory' && (
                    <div className="space-y-6">
                      
                      {/* Add Product Form */}
                      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4">
                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                          <Plus className="w-5 h-5 text-emerald-400" /> Add New Grain Product
                        </h3>

                        <form onSubmit={handleCreateProduct} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                          <div>
                            <label className="block font-bold text-slate-400 mb-1">Brand Name</label>
                            <input 
                              type="text" 
                              required 
                              value={newProduct.brandName} 
                              onChange={(e) => setNewProduct(prev => ({ ...prev, brandName: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                              placeholder="Pure Mwea Pishori Grade 1"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-400 mb-1">Variety</label>
                            <input 
                              type="text" 
                              required 
                              value={newProduct.variety} 
                              onChange={(e) => setNewProduct(prev => ({ ...prev, variety: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                              placeholder="Aromatic Pishori"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-400 mb-1">Sack Weight (kg)</label>
                            <input 
                              type="number" 
                              required 
                              value={newProduct.weightKg} 
                              onChange={(e) => setNewProduct(prev => ({ ...prev, weightKg: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                              placeholder="25"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-400 mb-1">Selling Price (KES)</label>
                            <input 
                              type="number" 
                              required 
                              value={newProduct.basePrice} 
                              onChange={(e) => setNewProduct(prev => ({ ...prev, basePrice: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                              placeholder="3200"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-400 mb-1">Buying Price (KES)</label>
                            <input 
                              type="number" 
                              value={newProduct.buyingPrice} 
                              onChange={(e) => setNewProduct(prev => ({ ...prev, buyingPrice: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                              placeholder="2400"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-400 mb-1">Flash Sale Price</label>
                            <input 
                              type="number" 
                              value={newProduct.flashSalePrice} 
                              onChange={(e) => setNewProduct(prev => ({ ...prev, flashSalePrice: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                              placeholder="2900"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-400 mb-1">Stock Quantity</label>
                            <input 
                              type="number" 
                              required 
                              value={newProduct.stockQuantity} 
                              onChange={(e) => setNewProduct(prev => ({ ...prev, stockQuantity: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                              placeholder="100"
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-400 mb-1">Image URL</label>
                            <input 
                              type="text" 
                              value={newProduct.imageUrl} 
                              onChange={(e) => setNewProduct(prev => ({ ...prev, imageUrl: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                              placeholder="https://..."
                            />
                          </div>

                          <div className="sm:col-span-2 lg:col-span-4 text-right">
                            <button type="submit" className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer">
                              Create Catalog Entry
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Grain Catalog Table with Capability to Edit ALL Products */}
                      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                          <h4 className="font-extrabold text-sm text-white">Full Product Inventory ({products.length})</h4>
                          <span className="text-xs text-slate-400">Admin can edit every product detail</span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                              <tr>
                                <th className="p-4">ID</th>
                                <th className="p-4">Brand Name</th>
                                <th className="p-4">Weight</th>
                                <th className="p-4">Selling Price</th>
                                <th className="p-4">Buying Cost</th>
                                <th className="p-4">Stock</th>
                                <th className="p-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-medium">
                              {products.map(p => (
                                <tr key={p.id} className="hover:bg-slate-800/40">
                                  <td className="p-4 font-mono font-bold text-slate-500">#{p.id}</td>
                                  <td className="p-4 font-extrabold text-white">
                                    {p.brandName} <span className="text-slate-400 font-normal">({p.variety})</span>
                                  </td>
                                  <td className="p-4 text-slate-300">{p.weightKg} kg</td>
                                  <td className="p-4 font-black text-emerald-400">{formatKES(p.basePrice || p.price || 0)}</td>
                                  <td className="p-4 text-slate-400">{formatKES(p.buyingPrice || 0)}</td>
                                  <td className="p-4">
                                    <span className={`px-2.5 py-0.5 rounded-full font-bold ${p.stockQuantity <= 10 ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}`}>
                                      {p.stockQuantity} units
                                    </span>
                                  </td>
                                  <td className="p-4 text-right space-x-2">
                                    <button 
                                      onClick={() => setEditingProduct(p)} 
                                      className="px-3 py-1.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 font-bold border border-emerald-700/50 cursor-pointer"
                                    >
                                      Edit Product
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteProduct(p.id)} 
                                      className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* SUB-PANEL: ORDER DISPATCH & PAYMENT VERIFICATION */}
                  {adminTab === 'orders' && (
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                        <input 
                          type="text"
                          placeholder="Search by Order ID, Customer Name, or County..."
                          value={orderSearchQuery}
                          onChange={(e) => setOrderSearchQuery(e.target.value)}
                          className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white w-full sm:w-80"
                        />
                        <a 
                          href={`${API_BASE_URL}/admin/orders/export/csv`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 w-fit"
                        >
                          <Download className="w-4 h-4" /> Export Orders CSV
                        </a>
                      </div>

                      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                              <tr>
                                <th className="p-4">Order</th>
                                <th className="p-4">Customer</th>
                                <th className="p-4">Comprehensive Shipping Address</th>
                                <th className="p-4">Grand Total</th>
                                <th className="p-4">Payment Tag</th>
                                <th className="p-4">Dispatch Status</th>
                                <th className="p-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-medium">
                              {adminOrders
                                .filter(o => 
                                  String(o.id).includes(orderSearchQuery) ||
                                  (o.User?.fullName || '').toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
                                  (o.county || '').toLowerCase().includes(orderSearchQuery.toLowerCase())
                                )
                                .map(order => {
                                  const payInfo = extractPaymentInfo(order);

                                  return (
                                    <tr key={order.id} className="hover:bg-slate-800/40">
                                      <td className="p-4 font-mono font-bold text-white">#{order.id}</td>
                                      <td className="p-4">
                                        <p className="font-bold text-slate-200">{order.User?.fullName || 'Guest Customer'}</p>
                                        <p className="text-[10px] text-slate-400">{order.User?.phoneNumber || 'N/A'}</p>
                                      </td>

                                      {/* COMPREHENSIVE SHIPPING ADDRESS */}
                                      <td className="p-4 max-w-sm text-slate-300">
                                        <div className="flex flex-col gap-0.5">
                                          <div className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                                            <span className="font-bold text-emerald-400">{order.county || 'N/A County'}</span>
                                          </div>
                                          <span className="text-[11px] font-semibold text-slate-200 pl-4">
                                            {order.town || 'N/A Town'}, {order.location || 'N/A Location'}
                                          </span>
                                          <span className="text-[10px] text-slate-400 pl-4">
                                            {order.sublocation || 'N/A Sublocation'} — {order.streetAddress || 'N/A Street'}
                                          </span>
                                          <span className="text-[9px] text-slate-500 italic pl-4 truncate mt-1">
                                            Raw: {formatShippingAddress(order.shippingAddress)}
                                          </span>
                                        </div>
                                      </td>

                                      <td className="p-4 font-black text-emerald-400">{formatKES(order.grandTotal)}</td>

                                      {/* CLICKABLE PAYMENT TAG IN ADMIN TABLE */}
                                      <td className="p-4">
                                        <button 
                                          onClick={() => setViewPaymentDetailsModal(order)}
                                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform ${
                                            payInfo.status === 'PAID' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                                          }`}
                                          title="Click to view payment logs, failure reasons & dates"
                                        >
                                          <span>{payInfo.status} {payInfo.receipt ? `(${payInfo.receipt})` : ''}</span>
                                          <Eye className="w-3 h-3 text-slate-400" />
                                        </button>
                                      </td>

                                      <td className="p-4">
                                        <select 
                                          value={order.status}
                                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                          className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-white cursor-pointer"
                                        >
                                          <option value="pending">Pending</option>
                                          <option value="processing">Processing</option>
                                          <option value="dispatched">Dispatched</option>
                                          <option value="delivered">Delivered</option>
                                          <option value="cancelled">Cancelled</option>
                                        </select>
                                      </td>
                                      <td className="p-4 text-right space-x-1">
                                        {payInfo.status !== 'PAID' && (
                                          <button 
                                            onClick={() => handleManualPaymentOverride(order.id, true, 'PAID')}
                                            className="px-2.5 py-1 rounded-md bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                                          >
                                            Override Paid
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL: FINANCIAL ENGINE & REAL DATABASE GRAPH */}
                  {adminTab === 'finances' && (
                    <div className="space-y-6">
                      
                      {/* SUMMARY METRICS CARDS PLACED ON TOP ABOVE THE GRAPH */}
                      {financialData?.summary && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-1">
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase">Total Revenue Received</p>
                            <p className="text-2xl font-black text-emerald-400">{formatKES(financialData.summary.totalMoneyReceived)}</p>
                          </div>
                          <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-1">
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase">Net Farm Profit</p>
                            <p className="text-2xl font-black text-teal-400">{formatKES(financialData.summary.totalNetProfit)}</p>
                          </div>
                          <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-1">
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase">Grain Volume Sold</p>
                            <p className="text-2xl font-black text-white">{financialData.summary.totalKgSold} kg</p>
                          </div>
                          <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-1">
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase">Loyalty Points Issued</p>
                            <p className="text-2xl font-black text-amber-400">{financialData.summary.totalPointsAwarded} pts</p>
                          </div>
                        </div>
                      )}

                      {/* FINANCIAL GROWTH SVG CHART */}
                      <FinancialGrowthChart 
                        monthlyData={financialData?.monthlyBreakdown || []}
                        selectedYear={financeYear}
                        availableYears={financialData?.availableYears || [2024, 2025, 2026, 2027]}
                        isLoading={isFinanceLoading && !financialData}
                        onYearChange={(y) => {
                          setFinanceYear(y);
                          fetchFinancialAnalytics(y);
                        }}
                      />

                      {/* REAL-TIME MONTHLY PURCHASE AMOUNTS (SUCCESSFUL ORDERS) */}
                      {financialData?.monthlyBreakdown && (
                        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
                          <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                            <div>
                              <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-400" /> Monthly Financial Ledger ({financeYear})
                              </h4>
                              <p className="text-[10px] text-slate-400 mt-1">Real-time compilation of successful orders based on timestamps</p>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-900 text-slate-400 uppercase font-black border-b border-slate-800">
                                <tr>
                                  <th className="p-4">Month</th>
                                  <th className="p-4">Successful Orders</th>
                                  <th className="p-4">Volume Sold</th>
                                  <th className="p-4">Total Revenue</th>
                                  <th className="p-4 text-right">Net Profit</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 font-medium">
                                {financialData.monthlyBreakdown.map((month, idx) => (
                                  <tr key={idx} className="hover:bg-slate-800/40">
                                    <td className="p-4 font-bold text-white">{month.monthName}</td>
                                    <td className="p-4 text-slate-300">{month.orderCount} Orders</td>
                                    <td className="p-4 text-slate-300">{month.totalKgSold} kg</td>
                                    <td className="p-4 font-black text-emerald-400">{formatKES(month.totalRevenue)}</td>
                                    <td className="p-4 text-right font-black text-teal-400">{formatKES(month.netProfit)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                  {/* SUB-PANEL: USER CLEARANCE (DISPLAY ALL USERS, EDIT, SUSPEND, DELETE) */}
                  {adminTab === 'reports' && <AdminReportsPanel token={token} showToast={showToast} />}
                  {adminTab === 'stock' && <AdminStockPanel token={token} showToast={showToast} />}
                  {adminTab === 'expenses' && <AdminExpensesPanel token={token} showToast={showToast} />}
                  {adminTab === 'campaigns' && <AdminCampaignsPanel token={token} showToast={showToast} />}
                  {adminTab === 'reviews' && <AdminReviewsPanel token={token} showToast={showToast} />}
                  {adminTab === 'payments' && (
                    <div className="space-y-5">
                      <AdminPaymentsPanel token={token} showToast={showToast} />
                    </div>
                  )}
                  {adminTab === 'bulk' && <AdminBulkOrdersPanel token={token} showToast={showToast} products={products} countyFees={countyOverrides} />}
                  {adminTab === 'chat' && <AdminChatPanel token={token} showToast={showToast} />}
                  {adminTab === 'promos' && <AdminPromosPanel token={token} showToast={showToast} />}
                  {adminTab === 'dispatch' && <AdminDispatchPanel token={token} showToast={showToast} />}
                  {adminTab === 'system' && <AdminSystemPanel token={token} showToast={showToast} />}

                  {adminTab === 'agents' && (
                    <AdminAgentsPanel token={token} showToast={showToast} adminUsers={adminUsers} onUsersChanged={fetchAdminUsers} />
                  )}
                  {adminTab === 'activity' && (
                    <AdminActivityPanel token={token} showToast={showToast} socket={socket} />
                  )}

                  {adminTab === 'users' && (
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                        <input 
                          type="text"
                          placeholder="Search users by name, email, or phone number..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white w-full sm:w-80"
                        />
                        <span className="text-xs font-bold text-slate-400">
                          Total Account Directory: {adminUsers.length} Users
                        </span>
                      </div>

                      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                              <tr>
                                <th className="p-4">ID</th>
                                <th className="p-4">User Name</th>
                                <th className="p-4">Contact Info</th>
                                <th className="p-4">Role</th>
                                <th className="p-4">Points</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-medium">
                              {adminUsers
                                .filter(u => 
                                  u.fullName?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                                  u.phoneNumber?.includes(userSearchQuery) ||
                                  (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase())
                                )
                                .map(u => (
                                  <tr key={u.id} className="hover:bg-slate-800/40">
                                    <td className="p-4 font-mono font-bold text-slate-500">#{u.id}</td>
                                    <td className="p-4 font-extrabold text-white">{u.fullName}</td>
                                    <td className="p-4 text-slate-300">
                                      <p>{u.phoneNumber}</p>
                                      <p className="text-[10px] text-slate-500">{u.email || 'No email'}</p>
                                    </td>
                                    <td className="p-4">
                                      <span className={`px-2 py-0.5 rounded-md font-bold uppercase text-[9px] ${
                                        u.role === 'admin' ? 'bg-amber-950 text-amber-300 border border-amber-800' : u.role === 'agent' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : u.role === 'support' ? 'bg-sky-950 text-sky-300 border border-sky-800' : 'bg-slate-800 text-slate-300'
                                      }`}>
                                        {u.role}
                                      </span>
                                    </td>
                                    <td className="p-4 font-extrabold text-amber-400">{u.rewardPoints || 0} pts</td>
                                    <td className="p-4">
                                      {u.isSuspended ? (
                                        <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                                          Suspended
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                                          Active
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                      {/* Edit Detail */}
                                      <button 
                                        onClick={() => setEditingUser(u)} 
                                        className="p-1.5 text-slate-400 hover:text-emerald-400 cursor-pointer"
                                        title="Edit User Details"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>

                                      {/* Staff roles */}
                                      {u.role !== 'admin' && (
                                        <>
                                          <button
                                            onClick={() => handleSetUserRole(u, u.role === 'agent' ? 'customer' : 'agent')}
                                            className={`p-1.5 cursor-pointer ${u.role === 'agent' ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-400'}`}
                                            title={u.role === 'agent' ? 'Dismiss agent' : 'Make agent'}
                                          >
                                            <Briefcase className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => handleSetUserRole(u, u.role === 'support' ? 'customer' : 'support')}
                                            className={`p-1.5 cursor-pointer ${u.role === 'support' ? 'text-sky-400' : 'text-slate-500 hover:text-sky-400'}`}
                                            title={u.role === 'support' ? 'Remove customer care role' : 'Make customer care'}
                                          >
                                            <Headphones className="w-4 h-4" />
                                          </button>
                                        </>
                                      )}

                                      {/* Suspend / Reactivate */}
                                      <button 
                                        onClick={() => handleToggleUserSuspension(u.id, u.isSuspended || false)} 
                                        className={`p-1.5 cursor-pointer ${u.isSuspended ? 'text-emerald-400 hover:text-emerald-300' : 'text-amber-400 hover:text-amber-300'}`}
                                        title={u.isSuspended ? 'Reactivate Account' : 'Suspend Account'}
                                      >
                                        {u.isSuspended ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                      </button>

                                      {/* Delete Account */}
                                      <button 
                                        onClick={() => handleDeleteUserAccount(u.id)} 
                                        className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                                        title="Delete Account"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL: REGIONAL FREIGHT LOGISTICS MANAGER */}
                  {adminTab === 'config' && (
                    <div className="space-y-6">
                      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4">
                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-emerald-400" /> Regional Freight Fee Overrides (47 Counties)
                        </h3>

                        <form onSubmit={handleSaveCountyOverride} className="flex flex-col sm:flex-row items-end gap-4 text-xs">
                          <div className="flex-1">
                            <label className="block font-bold text-slate-400 mb-1">Select County</label>
                            <select 
                              value={countyOverrideForm.county}
                              onChange={(e) => setCountyOverrideForm(prev => ({ ...prev, county: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold cursor-pointer"
                            >
                              {ALL_47_COUNTIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex-1">
                            <label className="block font-bold text-slate-400 mb-1">Custom Transport Fee (KES)</label>
                            <input 
                              type="number" 
                              required 
                              value={countyOverrideForm.fee}
                              onChange={(e) => setCountyOverrideForm(prev => ({ ...prev, fee: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold"
                              placeholder="e.g. 450"
                            />
                          </div>

                          <button type="submit" className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer">
                            Save County Freight Rate
                          </button>
                        </form>
                      </div>

                      {/* Overrides List */}
                      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Freight Rates Overview</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {ALL_47_COUNTIES.slice(0, 16).map(county => {
                            const customFee = getCountyFee(countyOverrides, county);

                            return (
                              <div key={county} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-200">{county}</span>
                                <span className="font-mono font-black text-emerald-400">
                                  {customFee !== undefined ? formatKES(customFee) : formatKES(baseTransportFee)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL: HERO BACKDROP CONFIGURATION (10 EXPLICIT SETTINGS) */}
                  {adminTab === 'carousel' && (
                    <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-6">
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-emerald-400" /> Hero Backdrop & Advert Controls (10 Settings)
                      </h3>

                      <form onSubmit={handleSaveHeroSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">1. Main Hero Headline Title</label>
                          <input 
                            type="text" 
                            value={heroSettings.title} 
                            onChange={(e) => setHeroSettings(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-400 mb-1">2. Subtitle Tagline Text</label>
                          <input 
                            type="text" 
                            value={heroSettings.subtitle} 
                            onChange={(e) => setHeroSettings(prev => ({ ...prev, subtitle: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-400 mb-1">3. Badge Label Text</label>
                          <input 
                            type="text" 
                            value={heroSettings.badgeText} 
                            onChange={(e) => setHeroSettings(prev => ({ ...prev, badgeText: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-400 mb-1">4. Primary CTA Button Text</label>
                          <input 
                            type="text" 
                            value={heroSettings.ctaButtonText} 
                            onChange={(e) => setHeroSettings(prev => ({ ...prev, ctaButtonText: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-400 mb-1">5. Live Announcement Ticker Bar</label>
                          <input 
                            type="text" 
                            value={heroSettings.announcementTicker} 
                            onChange={(e) => setHeroSettings(prev => ({ ...prev, announcementTicker: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-400 mb-1">6. Support Hotline Display</label>
                          <input 
                            type="text" 
                            value={heroSettings.supportHotlineDisplay} 
                            onChange={(e) => setHeroSettings(prev => ({ ...prev, supportHotlineDisplay: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-400 mb-1">7. Background Video Embed 1 (YouTube URL)</label>
                          <input 
                            type="text" 
                            value={heroSettings.video1} 
                            onChange={(e) => setHeroSettings(prev => ({ ...prev, video1: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-400 mb-1">8. Background Backdrop Image URL 1</label>
                          <input 
                            type="text" 
                            value={heroSettings.img1} 
                            onChange={(e) => setHeroSettings(prev => ({ ...prev, img1: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-400 mb-1">9. Dark Overlay Opacity (%)</label>
                          <input 
                            type="number" 
                            value={heroSettings.overlayOpacity} 
                            onChange={(e) => setHeroSettings(prev => ({ ...prev, overlayOpacity: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-400 mb-1">10. Express Freight Note</label>
                          <input 
                            type="text" 
                            value={heroSettings.expressLogisticsNote} 
                            onChange={(e) => setHeroSettings(prev => ({ ...prev, expressLogisticsNote: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                          />
                        </div>

                        <div className="sm:col-span-2 text-right pt-2">
                          <button type="submit" className="px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg cursor-pointer">
                            Save & Synchronize Hero Setup
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* SUB-PANEL: AUDIT LOGS DISPLAY WITH VISUAL ENHANCEMENTS */}
                  {adminTab === 'logs' && (
                    <div className="space-y-6">
                      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                          <h4 className="font-extrabold text-sm text-white">System Security Audit Logs ({adminLogs.length})</h4>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-400 hidden sm:inline">Track user actions & administrative modifications</span>
                            <button 
                              onClick={fetchAdminLogs}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer flex items-center gap-1.5"
                            >
                              <RefreshCw className={`w-3 h-3 ${isLogsLoading ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-900 text-slate-400 uppercase font-black border-b border-slate-800">
                              <tr>
                                <th className="p-4">Timestamp</th>
                                <th className="p-4">User Account Name</th>
                                <th className="p-4">Action Event</th>
                                <th className="p-4">Module</th>
                                <th className="p-4">Details</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-medium">
                              {adminLogs.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="p-8 text-center text-slate-500">
                                    {isLogsLoading ? 'Loading audit logs...' : 'No audit log entries recorded yet.'}
                                  </td>
                                </tr>
                              )}
                              {adminLogs.map(log => {
                                // Determine badge color based on action type
                                const isDelete = log.action.toUpperCase().includes('DELETE') || log.action.toUpperCase().includes('REMOVE');
                                const isUpdate = log.action.toUpperCase().includes('UPDATE') || log.action.toUpperCase().includes('EDIT');
                                const isCreate = log.action.toUpperCase().includes('CREATE') || log.action.toUpperCase().includes('ADD');

                                return (
                                  <tr key={log.id} className="hover:bg-slate-800/40">
                                    <td className="p-4 font-mono text-slate-400 whitespace-nowrap">
                                      {new Date(log.timestamp).toLocaleString('en-KE')}
                                    </td>
                                    <td className="p-4 font-extrabold text-emerald-400">
                                      {log.performedByName || 'System Auto'}
                                    </td>
                                    <td className="p-4">
                                      <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider ${
                                        isDelete ? 'bg-rose-950/60 text-rose-400 border border-rose-800/50' :
                                        isUpdate ? 'bg-amber-950/60 text-amber-400 border border-amber-800/50' :
                                        isCreate ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50' :
                                        'bg-slate-800 text-slate-300 border border-slate-700'
                                      }`}>
                                        {log.action}
                                      </span>
                                    </td>
                                    <td className="p-4">
                                      <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[10px]">
                                        {log.module}
                                      </span>
                                    </td>
                                    <td className="p-4 text-slate-400 max-w-sm">
                                      <p className="truncate" title={log.details || '-'}>{log.details || '-'}</p>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

              </div>

            </div>
          </div>
        )}

      </main>

      {/* =================================================================== */}
      {/* MODAL 1: PAYHERO REAL-TIME PAYMENT VERIFICATION OVERLAY             */}
      {/* =================================================================== */}
      {activePaymentModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-emerald-100 text-center space-y-6 animate-in zoom-in-95">
            
            {activePaymentModal.status === 'PENDING' && activePaymentModal.method === 'mpesa_till' && (
              <div className="space-y-4 text-left">
                <div className="text-center space-y-1">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border-4 border-emerald-100"><CreditCard className="w-7 h-7" /></div>
                  <h3 className="text-xl font-black text-slate-900">Pay to our Till</h3>
                  <p className="text-[11px] text-slate-500">Order #{activePaymentModal.orderId}</p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Till number</p>
                  <button type="button" onClick={() => copyText(String(activePaymentModal.tillNumber || ''), showToast, 'Till number copied.')} className="text-3xl font-black font-mono tracking-widest text-emerald-900 cursor-pointer">{activePaymentModal.tillNumber}</button>
                  {activePaymentModal.tillName && <p className="text-[11px] font-bold text-emerald-800">{activePaymentModal.tillName}</p>}
                  <p className="text-sm font-black text-slate-900 pt-1">Amount: {formatKES(Math.ceil(activePaymentModal.amount))}</p>
                </div>
                <ol className="text-[11px] text-slate-600 list-decimal ml-4 space-y-0.5">
                  <li>Open M-Pesa, choose <b>Lipa na M-Pesa → Buy Goods and Services</b>.</li>
                  <li>Enter the Till number and the exact amount, then your PIN.</li>
                  <li>Type the code from the M-Pesa SMS below (10 letters/numbers).</li>
                </ol>
                <input
                  type="text"
                  value={tillCodeInput}
                  onChange={(e) => setTillCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                  placeholder="e.g. SJK4L9XQ2P"
                  autoCapitalize="characters"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-center font-mono font-black tracking-widest text-base focus:ring-2 focus:ring-emerald-500"
                />
                {tillMessage && (
                  <p className={`p-3 rounded-xl text-[11px] font-bold ${tillMessage.tone === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : tillMessage.tone === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>{tillMessage.text}</p>
                )}
                <button onClick={handleSubmitTillCode} disabled={tillSubmitting || tillCodeInput.length !== 10} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold text-xs shadow-md cursor-pointer">
                  {tillSubmitting ? 'Checking…' : 'Confirm my payment'}
                </button>
                <button onClick={() => { setActivePaymentModal(prev => ({ ...prev, isOpen: false })); setView('profile'); }} className="w-full text-[11px] font-bold text-slate-500 underline cursor-pointer">I will pay later (find this order in My Orders)</button>
              </div>
            )}

            {activePaymentModal.status === 'PENDING' && activePaymentModal.method !== 'mpesa_till' && (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border-4 border-amber-100">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900">Awaiting M-Pesa PIN</h3>
                  <p className="text-xs text-slate-500">
                    STK Push prompt dispatched to <span className="font-extrabold text-slate-800">{activePaymentModal.phoneNumber}</span>
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">
                  Amount: {formatKES(activePaymentModal.amount)}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRetryStkPush(activePaymentModal.orderId!, activePaymentModal.phoneNumber, activePaymentModal.amount)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-[11px] cursor-pointer">Did not get it? Resend</button>
                  <button onClick={() => setActivePaymentModal(prev => ({ ...prev, isOpen: false }))} className="py-2.5 px-4 rounded-xl bg-slate-100 text-slate-700 font-bold text-[11px] cursor-pointer">Close</button>
                </div>
                <p className="text-[10px] text-slate-400">We check with M-Pesa automatically. You can close this and see the result in My Orders.</p>
              </div>
            )}

            {activePaymentModal.status === 'PAID' && (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-4 border-emerald-200">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-emerald-800">Payment Verified!</h3>
                  <p className="text-xs text-slate-600 font-semibold">
                    M-Pesa Code: <span className="font-mono font-black text-emerald-700">{activePaymentModal.receipt || 'VERIFIED'}</span>
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setActivePaymentModal(prev => ({ ...prev, isOpen: false }));
                    setView('profile');
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md cursor-pointer"
                >
                  View Order Status in Profile
                </button>
              </div>
            )}

            {activePaymentModal.status === 'FAILED' && (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border-4 border-rose-200">
                  <XCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-rose-700">Payment Unsuccessful</h3>
                  <p className="text-xs text-slate-500">{activePaymentModal.reason || 'Handset prompt timed out or declined'}</p>
                </div>
                <div className="flex gap-2">
                  {activePaymentModal.method === 'mpesa_till' ? (
                    <button 
                      onClick={() => { setTillMessage(null); setActivePaymentModal(prev => ({ ...prev, status: 'PENDING', reason: null })); }}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                    >
                      Enter the code again
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleRetryStkPush(activePaymentModal.orderId!, activePaymentModal.phoneNumber, activePaymentModal.amount)}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                    >
                      Resend STK Push
                    </button>
                  )}
                  <button 
                    onClick={() => setActivePaymentModal(prev => ({ ...prev, isOpen: false }))}
                    className="py-3 px-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: CLICKABLE FREIGHT SHIPPING ADDRESS DETAILS MODAL          */}
      {/* =================================================================== */}
      {viewAddressModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-emerald-100 space-y-6 relative animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Freight Delivery Location</h3>
                  <p className="text-[10px] font-bold text-slate-400">Order #{viewAddressModal.id} Address Details</p>
                </div>
              </div>
              <button 
                onClick={() => setViewAddressModal(null)}
                className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">County</span>
                    <p className="font-extrabold text-slate-900 text-sm">{resolveAddress(viewAddressModal).county || 'Not Specified'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Town / District</span>
                    <p className="font-extrabold text-slate-900 text-sm">{resolveAddress(viewAddressModal).town || 'Not Specified'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100/80">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Location</span>
                    <p className="font-bold text-slate-800">{resolveAddress(viewAddressModal).location || 'Not Specified'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Sublocation</span>
                    <p className="font-bold text-slate-800">{resolveAddress(viewAddressModal).sublocation || 'Not Specified'}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-100/80">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Street / Landmark</span>
                  <p className="font-bold text-slate-900">{resolveAddress(viewAddressModal).street || 'Not Specified'}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Customer Information</span>
                <p className="font-black text-slate-900">{viewAddressModal.User?.fullName || (viewAddressModal.userId === user?.id ? user?.fullName : '') || 'Valued Customer'}</p>
                <p className="text-slate-600 font-mono text-[11px]">{viewAddressModal.User?.phoneNumber || (viewAddressModal.userId === user?.id ? user?.phoneNumber : '') || 'N/A'}</p>
              </div>
            </div>

            <button 
              onClick={() => setViewAddressModal(null)}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md cursor-pointer"
            >
              Close Location Details
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: CLICKABLE PAYMENT STATUS & REAL-TIME AUDIT LOGS MODAL       */}
      {/* =================================================================== */}
      {viewPaymentDetailsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-emerald-100 space-y-6 relative animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className={`p-2.5 rounded-2xl ${
                  extractPaymentInfo(viewPaymentDetailsModal).status === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                  extractPaymentInfo(viewPaymentDetailsModal).status === 'FAILED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Payment Status Logs</h3>
                  <p className="text-[10px] font-bold text-slate-400">Order #{viewPaymentDetailsModal.id} Real-time Audit</p>
                </div>
              </div>
              <button 
                onClick={() => setViewPaymentDetailsModal(null)}
                className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const payInfo = extractPaymentInfo(viewPaymentDetailsModal);
              const orderDate = new Date(viewPaymentDetailsModal.createdAt).toLocaleString('en-KE', { 
                dateStyle: 'medium', 
                timeStyle: 'medium' 
              });
              const paidDate = payInfo.paidAt ? new Date(payInfo.paidAt).toLocaleString('en-KE', { 
                dateStyle: 'medium', 
                timeStyle: 'medium' 
              }) : null;

              return (
                <div className="space-y-4 text-xs">
                  {/* Status Pill */}
                  <div className="flex items-center justify-between p-4 rounded-2xl border bg-slate-50">
                    <span className="font-extrabold text-slate-700">Payment Tag:</span>
                    <span className={`px-3 py-1 rounded-full font-black uppercase text-xs flex items-center gap-1.5 ${
                      payInfo.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                      payInfo.status === 'FAILED' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {payInfo.status === 'PAID' && <CheckCircle className="w-4 h-4" />}
                      {payInfo.status === 'FAILED' && <AlertTriangle className="w-4 h-4" />}
                      {payInfo.status === 'PENDING' && <Clock className="w-4 h-4 animate-spin" />}
                      {payInfo.status}
                    </span>
                  </div>

                  <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="flex justify-between items-center text-slate-600 font-medium">
                      <span>Payment Method:</span>
                      <span className="font-bold text-slate-900">{payInfo.method}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-slate-600 font-medium pt-2 border-t border-slate-200/60">
                      <span>M-Pesa Phone:</span>
                      <span className="font-mono font-bold text-slate-900">{viewPaymentDetailsModal.mpesaPhoneNumber || viewPaymentDetailsModal.User?.phoneNumber || 'N/A'}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600 font-medium pt-2 border-t border-slate-200/60">
                      <span>Total Amount:</span>
                      <span className="font-extrabold text-emerald-700 text-sm">{formatKES(viewPaymentDetailsModal.grandTotal)}</span>
                    </div>

                    {payInfo.receipt && (
                      <div className="flex justify-between items-center text-slate-600 font-medium pt-2 border-t border-slate-200/60">
                        <span>M-Pesa Receipt Code:</span>
                        <span className="font-mono font-black text-emerald-800 text-sm">{payInfo.receipt}</span>
                      </div>
                    )}

                    {payInfo.reason && (
                      <div className="pt-2 border-t border-slate-200/60 text-rose-600 space-y-1">
                        <span className="font-bold uppercase text-[10px]">Reason for Failed Payment:</span>
                        <p className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 font-semibold text-[11px] leading-relaxed">
                          {payInfo.reason}
                        </p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200/60 space-y-1 text-slate-500 text-[11px]">
                      <div className="flex justify-between">
                        <span>Order Created Log:</span>
                        <span className="font-mono font-bold text-slate-800">{orderDate}</span>
                      </div>
                      {paidDate && (
                        <div className="flex justify-between text-emerald-700">
                          <span>Payment Confirmation Log:</span>
                          <span className="font-mono font-bold">{paidDate}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {payInfo.status !== 'PAID' && (
                    <button 
                      onClick={() => {
                        const phone = viewPaymentDetailsModal.mpesaPhoneNumber || viewPaymentDetailsModal.User?.phoneNumber || '';
                        setViewPaymentDetailsModal(null);
                        handleRetryStkPush(viewPaymentDetailsModal.id, phone, viewPaymentDetailsModal.grandTotal);
                      }}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" /> Resend M-Pesa STK Push Prompt
                    </button>
                  )}
                </div>
              );
            })()}

            <button 
              onClick={() => setViewPaymentDetailsModal(null)}
              className="w-full py-3 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-extrabold text-xs cursor-pointer"
            >
              Close Payment Details
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: ADMIN PRODUCT EDIT MODAL (ALL PRODUCTS EDITABLE)           */}
      {/* =================================================================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-800 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white">Edit Catalog Item #{editingProduct.id}</h3>
              <button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1">Brand Name</label>
                <input 
                  type="text" 
                  value={editingProduct.brandName} 
                  onChange={(e) => setEditingProduct(prev => prev ? { ...prev, brandName: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Variety</label>
                  <input 
                    type="text" 
                    value={editingProduct.variety} 
                    onChange={(e) => setEditingProduct(prev => prev ? { ...prev, variety: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Weight (kg)</label>
                  <input 
                    type="number" 
                    value={editingProduct.weightKg} 
                    onChange={(e) => setEditingProduct(prev => prev ? { ...prev, weightKg: Number(e.target.value) } : null)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Base Selling Price (KES)</label>
                  <input 
                    type="number" 
                    value={editingProduct.basePrice || editingProduct.price} 
                    onChange={(e) => setEditingProduct(prev => prev ? { ...prev, basePrice: Number(e.target.value) } : null)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Buying Cost (KES)</label>
                  <input 
                    type="number" 
                    value={editingProduct.buyingPrice || ''} 
                    onChange={(e) => setEditingProduct(prev => prev ? { ...prev, buyingPrice: Number(e.target.value) } : null)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Stock Quantity</label>
                  <input 
                    type="number" 
                    value={editingProduct.stockQuantity} 
                    onChange={(e) => setEditingProduct(prev => prev ? { ...prev, stockQuantity: Number(e.target.value) } : null)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Flash Sale Price</label>
                  <input 
                    type="number" 
                    value={editingProduct.flashSalePrice || ''} 
                    onChange={(e) => setEditingProduct(prev => prev ? { ...prev, flashSalePrice: Number(e.target.value) } : null)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Image URL</label>
                <input 
                  type="text" 
                  value={editingProduct.imageUrl || ''} 
                  onChange={(e) => setEditingProduct(prev => prev ? { ...prev, imageUrl: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md cursor-pointer">
                Save Product Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 5: ADMIN USER ACCOUNT EDIT MODAL                              */}
      {/* =================================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-800 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white">Edit User Account #{editingUser.id}</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={editingUser.fullName} 
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, fullName: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Phone Number</label>
                <input 
                  type="text" 
                  value={editingUser.phoneNumber} 
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, phoneNumber: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={editingUser.email || ''} 
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, email: e.target.value } : null)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Role</label>
                  <select 
                    value={editingUser.role} 
                    onChange={(e) => setEditingUser(prev => prev ? { ...prev, role: e.target.value as any } : null)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold cursor-pointer"
                  >
                    <option value="customer">Customer</option>
                    <option value="admin">Admin</option>
                    <option value="logistics">Logistics</option>
                    <option value="support">Customer care</option>
                    <option value="agent">Agent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-400 mb-1">Reward Points</label>
                  <input 
                    type="number" 
                    value={editingUser.rewardPoints} 
                    onChange={(e) => setEditingUser(prev => prev ? { ...prev, rewardPoints: Number(e.target.value) } : null)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold"
                  />
                </div>
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md cursor-pointer">
                Save User Details
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 6: QUICK VIEW PRODUCT DETAILS MODAL                           */}
      {/* =================================================================== */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-emerald-100 space-y-6 relative animate-in zoom-in-95">
            <button 
              onClick={() => setQuickViewProduct(null)} 
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row gap-6">
              <img 
                src={quickViewProduct.imageUrl || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80'} 
                alt={quickViewProduct.brandName} 
                className="w-full sm:w-48 h-48 rounded-2xl object-cover border border-slate-100"
              />

              <div className="space-y-3 flex-1">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase">
                  {quickViewProduct.weightKg}kg Sack • {quickViewProduct.variety}
                </span>

                <h3 className="text-xl font-black text-slate-900">{quickViewProduct.brandName}</h3>

                <p className="text-2xl font-black text-emerald-700">
                  {formatKES(flashSale.active && quickViewProduct.flashSalePrice ? quickViewProduct.flashSalePrice : quickViewProduct.basePrice)}
                </p>
                {Array.isArray(quickViewProduct.wholesaleTiers) && quickViewProduct.wholesaleTiers.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100 text-[11px] text-sky-900 space-y-0.5">
                    <p className="font-black uppercase text-[10px]">Buying in bulk? Pay less per bag</p>
                    {quickViewProduct.wholesaleTiers.map((t, i) => <p key={i}>{t.minQty}+ bags: <b>{formatKES(t.price)}</b> each</p>)}
                  </div>
                )}
                <button type="button" onClick={() => { setReviewProduct(quickViewProduct); setQuickViewProduct(null); }} className="flex items-center gap-1.5 text-[11px] cursor-pointer hover:underline">
                  <StarRating value={quickViewProduct.ratingAvg || 0} size={13} />
                  <span className="font-bold text-slate-700">{(quickViewProduct.hasRating ?? ((quickViewProduct.ratingCount || 0) > 0)) ? (quickViewProduct.ratingAvg || 0).toFixed(1) : 'No reviews yet'}</span>
                </button>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {quickViewProduct.description || '100% Pure aromatic Mwea long-grain rice harvested directly from Kirinyaga paddy fields.'}
                </p>

                <button 
                  onClick={() => {
                    addToCart(quickViewProduct);
                    setQuickViewProduct(null);
                  }}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" /> Add To Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {idleWarning !== null && token && (
        <div className="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto"><Clock className="w-7 h-7" /></div>
            <h3 className="text-lg font-black text-slate-900">Are you still there?</h3>
            <p className="text-xs text-slate-600">For your security you will be signed out in <b className="text-rose-600">{idleWarning}s</b> because there has been no activity.</p>
            <div className="flex gap-2">
              <button onClick={staySignedIn} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer">Stay signed in</button>
              <button onClick={() => { setIdleWarning(null); idleWarningRef.current = null; handleLogout(); }} className="py-3 px-4 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer">Sign out</button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE PHONE PRIORITY BOTTOM QUICK UX NAVBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-emerald-100 px-6 py-2 flex items-center justify-around text-[10px] font-bold text-slate-600 shadow-2xl">
        <button onClick={() => setView('home')} className={`flex flex-col items-center gap-1 cursor-pointer ${view === 'home' ? 'text-emerald-700 font-black' : ''}`}>
          <Leaf className="w-5 h-5" />
          <span>Home</span>
        </button>

        <button onClick={() => setView('shop')} className={`flex flex-col items-center gap-1 cursor-pointer ${view === 'shop' ? 'text-emerald-700 font-black' : ''}`}>
          <Package className="w-5 h-5" />
          <span>Catalog</span>
        </button>

        <button onClick={() => setView('cart')} className={`relative flex flex-col items-center gap-1 cursor-pointer ${view === 'cart' ? 'text-emerald-700 font-black' : ''}`}>
          <ShoppingCart className="w-5 h-5" />
          <span>Cart</span>
          {cart.length > 0 && (
            <span className="absolute -top-1 right-2 bg-rose-600 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </button>

        <button onClick={() => setView(user ? 'profile' : 'login')} className={`flex flex-col items-center gap-1 cursor-pointer ${view === 'profile' || view === 'login' ? 'text-emerald-700 font-black' : ''}`}>
          <UserIcon className="w-5 h-5" />
          <span>{user ? 'Account' : 'Login'}</span>
        </button>
      </div>

      {/* FOOTER */}
      <ShoppingAssistantWidget
        token={token}
        user={user}
        onRequireLogin={() => { showToast('Please sign in or create an account to place your order. Your chat will continue afterwards.', 'info'); setView('login'); }}
        onOrdersChanged={() => { if (token) fetchMyOrders(); }}
        onPaymentStarted={({ orderId, method, phone, amount }) => {
          if (method === 'mpesa_till') { openTillModal({ id: orderId, grandTotal: amount, paymentDetails: {} }); return; }
          setActivePaymentModal({ isOpen: true, orderId, status: 'PENDING', receipt: null, reason: null, phoneNumber: phone || user?.phoneNumber || '', amount, isPolling: true, method: 'mpesa_stk' });
        }}
      />
      {twoFactor && <TwoFactorModal challenge={twoFactor} onSuccess={finishTwoFactorSignIn} onClose={() => setTwoFactor(null)} showToast={showToast} />}
      {reviewProduct && <ReviewsModal product={reviewProduct} token={token} user={user} onClose={() => setReviewProduct(null)} showToast={showToast} onChanged={fetchProducts} />}

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} onAccept={!user && !isLogin && !signupOtpStep ? () => { setAcceptedTerms(true); setShowTerms(false); } : undefined} />}

      <footer className="bg-slate-950 text-slate-400 text-xs py-12 border-t border-slate-900 mt-auto">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-emerald-400" />
              <span className="text-base font-black text-white">MWEA RICE HUB</span>
            </div>
            <p className="text-slate-500 leading-relaxed text-[11px]">
               Kenya's premier authentic Mwea long-grain aromatic rice store. Directly harvested, milled, and delivered to your doorstep.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-white uppercase tracking-wider text-[11px]">Navigation</p>
            <ul className="space-y-1.5 text-slate-400">
              <li><button onClick={() => setView('home')} className="hover:text-emerald-400 cursor-pointer">Home Storefront</button></li>
              <li><button onClick={() => setView('shop')} className="hover:text-emerald-400 cursor-pointer">Grain Catalog</button></li>
              <li><button onClick={() => setView('cart')} className="hover:text-emerald-400 cursor-pointer">Shopping Cart</button></li>
              <li><button onClick={() => setShowTerms(true)} className="hover:text-emerald-400 cursor-pointer">Terms &amp; Conditions</button></li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-white uppercase tracking-wider text-[11px]">47 County Regional Delivery</p>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Express freight logistics serving Nairobi, Kirinyaga, Kiambu, Mombasa, Nakuru, Kisumu, Eldoret, and all 47 counties.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-white uppercase tracking-wider text-[11px]">M-Pesa Express</p>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Instant automated payment verification powered by PayHero. Real-time STK push prompt.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 border-t border-slate-900 mt-8 pt-6 text-center text-slate-600 text-[10px]">
          © {new Date().getFullYear()} Mwea Rice Hub. All Rights Reserved. Pure Kenyan Harvest.
        </div>
      </footer>

    </div>
  );
}
