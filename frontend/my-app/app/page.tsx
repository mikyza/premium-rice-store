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
  Compass, Navigation, Phone, KeyRound, MessageSquare
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
  createdAt?: string;
  updatedAt?: string;
}

export interface UserAccount {
  id: number;
  fullName: string;
  email?: string | null;
  phoneNumber: string;
  role: 'customer' | 'admin' | 'logistics';
  rewardPoints: number;
  isSuspended?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  ordersCount?: number;
  county?: string;
  town?: string;
  location?: string;
  sublocation?: string;
  streetAddress?: string;
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
  };
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
    towns: ["Nyali", "Mvita", "Kisauni", "Likoni", "Changamwe", "Jomvu", "Bamburi", "Tudor", "Kongowea", "Mikindani", "Shanzu", "Mtongwe", "Miritini"],
    locations: ["Old Town", "Tudor", "Ganjoni", "Tononoka", "Shimanzi", "Port Reitz", "Chaani", "Kipevu", "Jomvu Kuu", "Magongo", "Miritini", "Bamburi", "Mkomani", "Ziwa La Ng'ombe", "Majengo", "Mtongwe", "Likoni Central", "Bofu", "Shika Adabu"],
    sublocations: ["Bondeni", "Sparki", "Buxton", "Tudor Four", "Saba Saba", "Bombolulu", "Kisauni Stage", "Mwembe Tayari", "Kongowea Market", "Nyali Beach", "English Point", "Frere Town", "Utange", "Mtambo", "Barsheba", "Kiembeni", "Mwakirunge", "Kwa Jomvu", "Mikindani Estate", "Chaani West", "Shelly Beach", "Mtongwe Jetty"],
    streets: ["Moi Avenue", "Nkrumah Road", "Nyerere Avenue", "Digo Road", "Abdel Nasser Road", "Links Road", "Malindi Road (A7)", "Mama Ngina Drive", "Archbishop Makarios Road", "Fidel Castro Street", "Treasury Square Road", "Ronald Ngala Road", "Mbaraki Road", "Changamwe-Port Reitz Road", "Airport Road", "Magongo Road", "Jomvu-Miritini Highway", "Likoni Ferry Approach Road"]
  },
  "Kwale": {
    towns: ["Ukunda", "Diani", "Kwale Town", "Msambweni", "Lunga Lunga", "Kinango", "Tiwi", "Shimoni", "Vanga", "Samburu", "Majoreni", "Taru", "Mackinnon Road"],
    locations: ["Pongwe/Kikoneni", "Dzombo", "Mwereni", "Vanga", "Tiwi", "Kubo South", "Kubo North", "Ndavaya", "Puma", "Kinango", "Kasemeni", "Mwavumbo", "Samburu East", "Mackinnon Road", "Ramisi", "Gombato Bongwe", "Ukunda Ward"],
    sublocations: ["Diani Beach", "Bongwe", "Bofa", "Kwale Central", "Mwavumbo", "Dzombo", "Shimba Hills Area", "Gazi", "Bodo", "Kibuyuni", "Funzi", "Wasini Island", "Lunga Lunga Border", "Perani", "Kikoneni", "Mrima", "Kanana", "Matuga", "Vuga", "Kombani", "Waa", "Golini", "Mazeras", "Taru Center"],
    streets: ["Likoni-Lunga Lunga Highway (A14)", "Diani Beach Road", "Kwale-Ukunda Road (C106)", "Samburu-Kwale Road", "Lunga Lunga-Vanga Road", "Shimoni Road", "Kombani-Kwale Highway", "Hospital Road Kwale", "Diani Beach Bypass Road"]
  },
  "Kilifi": {
    towns: ["Kilifi Town", "Malindi", "Mtwapa", "Watamu", "Mariakani", "Kaloleni", "Vipingo", "Gongoni", "Mazeras", "Bamba", "Ganze", "Marafa"],
    locations: ["Tezo", "Sokoni", "Kibarani", "Dabaso", "Matsangoni", "Watamu", "Gede", "Kakuyuni", "Jilore", "Malindi Town", "Shella", "Marafa", "Magarini", "Gongoni", "Mambrui", "Rabai", "Mwawesa", "Ruruma", "Kaloleni", "Kayafungo", "Mwanamwingi", "Bamba", "Ganze", "Sokoke", "Jaribuni", "Junju", "Mtwapa", "Vipingo"],
    sublocations: ["Mnarani", "Mtwapa Creek", "Kibarani", "Watamu Village", "Chonyi", "Kilifi CBD", "Maweni", "Kanamai", "Majengo Mtwapa", "Kikambala", "Chasimba", "Dzitsoni", "Vitengeni", "Hell's Kitchen Sub", "Gongoni Salt Works", "Muyeye", "Sabaki", "Kibokoni Malindi", "Kisumu Ndogo Malindi", "Casuarina", "Jacaranda"],
    streets: ["Mombas-Malindi Highway (A7)", "Malindi-Garissa Road (C112)", "Mariakani-Kaloleni Road", "Mtwapa Mall Link Road", "Lamu Road Malindi", "Casuarina Road", "Watamu Road", "Kilifi Creek Bridge Approach", "Bamba-Kilifi Road", "Mariakani Highway"]
  },
  "Tana River": {
    towns: ["Hola", "Garsen", "Bura", "Madogo", "Kipini", "Bangale", "Wenje", "Tarasaa"],
    locations: ["Chewani", "Wayu", "Mikinduni", "Bura", "Bangale", "Madogo", "Hirimani", "Saka", "Kipini East", "Kipini West", "Salama", "Garsen Central", "Garsen South", "Garsen North", "Mwina", "Ngao"],
    sublocations: ["Hola Central", "Laza", "Zubaki", "Bura Stage", "Madogo Border", "Garsen South", "Kipini Center", "Masalani Bridge Approach", "Nanighi", "Chara", "Ngao Sub", "Matomba", "Wenje Center", "Kilelengwani"],
    streets: ["Garissa-Garsen Road (A3/B8)", "Garsen-Witu-Lamu Highway (C112)", "Hola Market Street", "River Road Hola", "Bura-Hola Road", "Madogo Junction"]
  },
  "Lamu": {
    towns: ["Lamu Town", "Mpeketoni", "Witu", "Kiunga", "Faza", "Pate", "Shela", "Matondoni", "Kizingitini"],
    locations: ["Shela", "Manda", "Matondoni", "Hindi", "Mokowe", "Hongwe", "Bahari", "Mapenya", "Witu", "Kiunga", "Faza", "Basuba", "Kiwayu"],
    sublocations: ["Shela Village", "Amu Old Town", "Lamu Fort Area", "Manda Island", "Mpeketoni Center", "Mokowe Jetty", "Hindi Center", "Lake Kenyatta Area", "Katsakairu", "Bargoni", "Ishakani", "Kiangwe", "Kizingitini Village", "Pate Island Sub"],
    streets: ["Lamu Seafront (Harbour Road)", "Shela Beach Walk", "Mpeketoni Main Road", "Mokowe Jetty Road", "Witu-Lamu Highway (C112)", "Hindi-Kiunga Road"]
  },
  "Taita-Taveta": {
    towns: ["Voi", "Taveta", "Wundanyi", "Mwatate", "Maungu", "Taveta Border", "Mackinnon Road", "Bura Taita"],
    locations: ["Kaloleni", "Ngolia", "Sagalla", "Marter", "Mbololo", "Bura", "Mwawatate", "Chavia", "Wusi/Kishamba", "Werugha", "Wundanyi/Mbale", "Mgange", "Chala", "Mahoo", "Bomani", "Mboghoni", "Mata"],
    sublocations: ["Voi CBD", "Ikanga", "Mwakingali", "Kariakor Voi", "Mwatate Junction", "Wundanyi Stage", "Taveta Border", "Kimorigho", "Eldoro", "Chala Center", "Taveta Market", "Kishushe", "Bura Mission", "Demwa", "Mbale", "Ronge Juu"],
    streets: ["Nairobi-Mombasa Highway (A109)", "Voi-Taveta-Holili Highway (A23)", "Wundanyi-Mwatate Road", "Taveta Main Market Street", "Voi Station Road", "Hospital Road Voi", "Biashara Street Voi"]
  },
  "Garissa": {
    towns: ["Garissa Town", "Dadaab", "Balambala", "Modogashe", "Masalani", "Bura East", "Hulugho", "Ijara"],
    locations: ["Galbet", "Waberi", "Iftin", "Township", "Saka", "Sankuri", "Balambala", "Liboi", "Dadaab", "Dertu", "Benane", "Modogashe", "Masalani", "Ijara", "Sangailu", "Hulugho"],
    sublocations: ["Bulla Jamhuria", "Bulla Medina", "Bulla Iftin", "Bulla Mzuri", "Bulla Power", "Dadaab Camp Area (Hagadera, Ifo, Dagahaley)", "Liboi Border", "Masalani Town", "Sankuri Stage", "Garissa CBD", "Bula Stage", "Jarrot"],
    streets: ["Kismayu Road", "Garissa-Thika Highway (A3)", "Posta Road Garissa", "Sankuri Road", "Garissa-Dadaab Road", "Modogashe Highway", "Market Street Garissa", "River Road Garissa"]
  },
  "Wajir": {
    towns: ["Wajir Town", "Habaswein", "Bute", "Eldas", "Tarbaj", "Buna", "Griftu", "Khorof Harar", "Diff"],
    locations: ["Township", "Wagberi", "Danoshi", "Bulla Kiria", "Barwaqo", "Bute", "Buna", "Korondile", "Gurar", "Eldas", "Elnur", "Tarbaj", "Sarman", "Wajir Bor", "Habaswein", "Diff", "Sabule"],
    sublocations: ["Wajir Central", "Wagberi Sub", "Bulla Jamhuria Wajir", "Habaswein Stage", "Wajir Bor", "Bute Center", "Eldas Center", "Tarbaj Town", "Diff Border", "Kutulo", "Buna Center", "Griftu Stage"],
    streets: ["Airport Road Wajir", "Wajir Main Market Street", "Isiolo-Wajir-Moyale Highway (A13)", "Mandera Road", "Habaswein Main Road", "Hospital Road Wajir"]
  },
  "Mandera": {
    towns: ["Mandera Town", "Elwak", "Rhamu", "Banissa", "Lafey", "Takaba", "Kutulo"],
    locations: ["Neboi", "Bulla Mpya", "Township", "Khalalio", "Hareri", "Rhamu", "Rhamu Dimtu", "Ashabito", "Banissa", "Derkhale", "Guba", "Takaba", "Dandu", "Elwak North", "Elwak South", "Lafey", "Warankara"],
    sublocations: ["Mandera CBD", "Bulla Jamhuria Mandera", "Bulla Power", "Elwak Stage", "Rhamu Center", "Banissa Town", "Border Post Sub", "Lafey Stage", "Ashabito Center", "Kutulo Town", "Shimbir Fatuma"],
    streets: ["Mandera Main Street", "Elwak-Mandera Highway (A13)", "Airstrip Road Mandera", "Rhamu Road", "Border Post Link Road", "Biashara Street Mandera"]
  },
  "Marsabit": {
    towns: ["Marsabit Town", "Moyale", "Laisamis", "North Horr", "Sololo", "Loiyangalani", "Kargi", "Dukana", "Kalacha"],
    locations: ["Karare", "Sagante/Jaldesa", "Township", "Manyatta", "Uran", "Obbu", "Heillu/Manyatta", "Golbo", "Sololo", "Laisamis", "Loglogo", "Karare", "Kargi/South Horr", "North Horr", "Dukana", "Maikona", "Loiyangalani"],
    sublocations: ["Marsabit Central", "Manyatta Otte", "Nagum", "Moyale Border", "Sololo Center", "Laisamis Stage", "Loiyangalani Town", "Kalacha Oasis Sub", "Kargi Center", "Turbi", "Odha", "Heilu"],
    streets: ["Isiolo-Marsabit-Moyale Highway (A2)", "Marsabit Market Road", "Moyale Main Street", "Airport Road Marsabit", "Laisamis Link Road", "North Horr Track"]
  },
  "Isiolo": {
    towns: ["Isiolo Town", "Garbatulla", "Merti", "Kinna", "Oldonyiro", "Ngaremara", "Archer's Post Border"],
    locations: ["Bulla Pesa", "Wabera", "Burat", "Ngaremara", "Oldonyiro", "Garbatulla", "Kinna", "Sericho", "Cherab", "Chari"],
    sublocations: ["Isiolo CBD", "Kulamawe", "Kula Mawe", "Bulla Pesa Sub", "Wabera Center", "Bula Mpya Isiolo", "Garbatulla Center", "Merti Stage", "Kinna Town", "Merti Center", "Bassa"],
    streets: ["Isiolo Main Highway (A2)", "Airport Road Isiolo", "Barclays Road Isiolo", "Garbatulla-Isiolo Road", "Meru-Isiolo Road", "Hospital Road Isiolo", "Market Street"]
  },
  "Meru": {
    towns: ["Meru Town", "Maua", "Timau", "Nanyuki Border", "Mikinduri", "Laare", "Nchiru", "Muthara", "Kianjai", "Imenti", "Igoji"],
    locations: ["Municipality", "Ntima East", "Ntima West", "Nyaki East", "Nyaki West", "Nkuene", "Abogeta East", "Abogeta West", "Abothuguchi", "Igoji East", "Igoji West", "Akithii", "Kianjai", "Akirang'ondu", "Nthambiro", "Amwathi", "Kangeta", "Ruiri/Rwarera"],
    sublocations: ["Makutano Meru", "Gakoromone", "Kinoru", "Gitimbine", "Kianjai Center", "Maua Town Center", "Nchiru (MUST Area)", "Timau Town", "Mikinduri Market", "Kangeta Stage", "Mujwa", "Katheri", "Muthara Town"],
    streets: ["Meru-Nanyuki Highway (A2/B6)", "Meru-Embu Highway (B6)", "Maua Road", "Tom Mboya Street Meru", "Kirinyaga Street Meru", "Meru-Mikinduri Road", "Makutano-Kianjai Road", "Kenyatta Highway Meru"]
  },
  "Tharaka-Nithi": {
    towns: ["Chuka", "Kathwana", "Chogoria", "Marimanti", "Kibugua", "Gatunga", "Mukothima", "Chera"],
    locations: ["Karingani", "Magumoni", "Mugwe", "Igambang'ombe", "Ganga", "Muthambi", "Mwimbi", "Chogoria", "Nkondi", "Gatunga", "Marimanti", "Mukothima"],
    sublocations: ["Chuka Town Center", "Lower Chuka", "Ndagani (Chuka Univ Area)", "Chogoria Hospital Sub", "Kathwana HQ", "Marimanti Stage", "Gatunga Center", "Kibugua Sub", "Kanwa", "Weru", "Mitheru"],
    streets: ["Nairobi-Meru Highway (B6)", "Chuka University Access Road", "Kathwana Main Street", "Chogoria-Chuka Road", "Marimanti-Gatunga Road", "Biashara Street Chuka"]
  },
  "Embu": {
    towns: ["Embu Town", "Runyenjes", "Siakago", "Kiritiri", "Ishiara", "Manyatta", "Kanja", "Kibugu"],
    locations: ["Kirimari", "Gakwebiri", "Ngandori", "Kieni", "Ruguru", "Gaturi", "Kyeni", "Kagaari", "Central Ward", "Mbeti North", "Mbeti South", "Mavuria", "Mvomoko", "Evurore"],
    sublocations: ["Embu CBD", "Kangaru", "Blue Valley", "Kamiu", "Njukiri", "Matakari", "Runyenjes Stage", "Kanja Center", "Kiritiri Town", "Ishiara Market", "Siakago Town", "Karaba Embu", "Ugweri"],
    streets: ["Embu-Meru Highway (B6)", "Embu-Nairobi Highway", "Kenyatta Avenue Embu", "Mama Ngina Street Embu", "Runyenjes Main Street", "Siakago-Kiritiri Road", "Kangaru School Road"]
  },
  "Kitui": {
    towns: ["Kitui Town", "Mwingi", "Mutomo", "Kabati", "Kwa Vonza", "Migwani", "Ikutha", "Kyuso", "Tseikuru", "Zombe"],
    locations: ["Township", "Kyangwithya West", "Kyangwithya East", "Mulango", "Miambani", "Central Mwingi", "Kivou", "Nguni", "Nuu", "Kyuso", "Tseikuru", "Mutomo", "Ikutha", "Mutha", "Kanziko", "Kauwi", "Nzambani"],
    sublocations: ["Kitui Central Sub", "Kalundu", "Kitisuru Kitui", "Mwingi CBD", "Kwa Vonza Center", "Kabati Stage", "Mutomo Town", "Kyuso Center", "Zombe Market", "Migwani Town", "Ikanga"],
    streets: ["Kitui-Machakos Road (C94)", "Mwingi-Garissa Highway (A3)", "Thika-Garissa Road via Kabati", "Biashara Street Kitui", "Kitui-Mutomo-Kibwezi Road", "Hospital Road Kitui"]
  },
  "Machakos": {
    towns: ["Machakos Town", "Mavoko / Syokimau", "Athi River", "Mlolongo", "Kangundo", "Tala", "Matuu", "Masii", "Wamunyu", "Kathiani"],
    locations: ["Syokimau/Mulei", "Athi River Town", "Katani", "Mlolongo", "Machakos Central", "Muvuti/Kiima-Kimwe", "Mutituni", "Kalama", "Kangundo Central", "Tala", "Matungulu North", "Ndithini", "Matuu", "Kivaa", "Masii", "Mwala"],
    sublocations: ["Sabaki", "Syokimau Phase 1-3", "Katani Center", "Kinanie", "Kyumbi (Chumvi)", "Machakos CBD", "Eastleigh Machakos", "Katheka Kai", "Tala Market", "Kangundo Town", "Matuu CBD", "Kaseve", "Masii Stage", "Devki Area"],
    streets: ["Mombasa Road (A104)", "Machakos-Kitui Road (C99)", "Machakos-Turnoff Highway", "Katani Road", "Syokimau Airport Road", "Tala-Kangundo Highway", "Garissa Road (Matuu)", "Machakos Bypass", "Mbagathi/Kyumbuni Road"]
  },
  "Makueni": {
    towns: ["Wote", "Mtito Andei", "Sultan Hamud", "Emali", "Kibwezi", "Makindu", "Nzoila", "Mukaa", "Mbooni", "Salama"],
    locations: ["Makueni/Wote", "Mbitini", "Kee", "Kako", "Mbooni", "Tulimani", "Kilome", "Mukaa", "Kasikeu", "Nguu/Masumba", "Makindu", "Kibwezi", "Mtito Andei", "Emali/Mulala", "Nzaui"],
    sublocations: ["Wote Town Center", "Unoa", "Kambi Mawe", "Emali Junction", "Kibwezi Sub", "Mtito Andei Stage", "Makindu Center", "Sultan Hamud Town", "Salama Stage", "Nunguni", "Kikima"],
    streets: ["Nairobi-Mombasa Highway (A109)", "Wote-Machakos Road", "Kibwezi-Kitui Highway (C94)", "Makindu Hospital Road", "Emali-Loitokitok Road", "Wote Market Street"]
  },
  "Nyandarua": {
    towns: ["Ol Kalou", "Engineer", "Mairo Inya", "Njabini", "Ndaragwa", "Miharati", "Ol Joro Orok", "Flyover"],
    locations: ["Karandi", "Kanjuiri", "Ol Kalou Central", "Kaimbaga", "Passenga", "Kipipiri", "Geta", "Githabai", "Njabini", "Engineer", "Magumu", "North Kinangop", "Ndaragwa", "Leshau Pondo"],
    sublocations: ["Ol Kalou CBD", "Engineer Center", "Njabini Stage", "Mairo Inya Sub", "Ol Joro Orok Center", "Miharati Town", "Ndaragwa Center", "Flyover Junction", "Wanjohi", "Murungaru"],
    streets: ["Gilgil-Nyahururu Highway (C77)", "Flyover-Engineer-Njabini Road", "Ol Kalou Main Street", "Njabini-Ol Kalou Road", "Ndaragwa-Nyahururu Road", "Stima Road Ol Kalou"]
  },
  "Nyeri": {
    towns: ["Nyeri Town", "Karatina", "Othaya", "Mukurweini", "Naro Moru", "Mweiga", "Giakanja", "Chaka", "Endarasha"],
    locations: ["Rware", "Gatitu/Aguthi", "Kimathi", "Thenguri", "Kirimukuyu", "Iria-ini (Mathira)", "Konyu", "Magutu", "Mahiga", "Iria-ini (Othaya)", "Chinga", "Karima", "Mukurwe Central", "Gakindu", "Rugi", "Kieni East", "Mweiga"],
    sublocations: ["Nyeri CBD", "King'ong'o", "Skuta", "Asian Quarter", "Kamakwa", "Nyamachaki", "Karatina Market Sub", "Othaya Town Center", "Chaka Market", "Naro Moru Town", "Mweiga Center", "Mukurweini Town", "Giakanja Stage"],
    streets: ["Kenyatta Road Nyeri", "Nyeri-Nanyuki Highway (B6)", "Karatina Main Street", "Gakere Road Nyeri", "Othaya-Nyeri Road", "Kimathi Way", "Kanisa Road", "Mukurweini Road"]
  },
  "Kirinyaga": {
    towns: ["Wang'uru (Mwea)", "Kerugoya", "Kutus", "Sagana", "Baricho", "Kagio", "Kianyaga", "Kagumo", "Diffathas"],
    locations: ["Tebere", "Mutithi", "Murinduko", "Nyangati", "Kerugoya", "Mutira", "Inoi", "Kinyaga", "Baricho", "Kiine", "Kariti"],
    sublocations: ["Wang'uru Center", "Thiba", "Kangai", "Kerugoya Town Center", "Kagumo Sub", "Kutus Sub", "Sagana Town", "Baricho Market", "Kianyaga Sub", "Mutithi Sub", "Kiburu", "Kiandai"],
    streets: ["Mwea-Embu Highway (B6)", "Kerugoya-Kutus Road (C73)", "Nairobi-Nyeri Highway (A2 / Sagana Highway)", "Kutus-Kianyaga Road", "Kerugoya-Kagumo Road", "Kerugoya Hospital Road"]
  },
  "Murang'a": {
    towns: ["Murang'a Town", "Kenol", "Maragua", "Kangema", "Thika Greens", "Kigumo", "Kiria-ini", "Kandara", "Saba Saba", "Makuyu"],
    locations: ["Township (Murang'a)", "Mbiri", "Mugoiri", "Murarandia", "Kinyona", "Kigumo", "Kangari", "Ithiru", "Gaichanjiru", "Muruka", "Ruchu", "Nginda", "Makuyu", "Kamahuha", "Kiru", "Gitugi"],
    sublocations: ["Murang'a Town Center", "Kenol Sub", "Maragua Town", "Kangema Stage", "Kiria-ini Center", "Kigumo Market", "Kandara Town", "Saba Saba Center", "Mukuyu", "Mitheru", "Gaturi"],
    streets: ["Thika-Murang'a Highway (C71)", "Kenol-Sagana Highway (A2)", "Murang'a-Kangema Road", "Murang'a-Kiria-ini Road", "Maragua Main Street", "Kandara-Kenol Road", "Cathedral Road Murang'a"]
  },
  "Kiambu": {
    towns: ["Thika", "Ruiru", "Kikuyu", "Limuru", "Kiambu Town", "Juja", "Karuri (Banana/Ruaka)", "Kabete", "Githunguri", "Lari", "Gatundu"],
    locations: ["Thika Township", "Kamenu", "Hospital Ward", "Ruiru Central", "Kahawa Sukari", "Kahawa Wendani", "Biashara (Kikuyu)", "Karai", "Limuru Central", "Tigoni", "Township (Kiambu)", "Ndumberi", "Juja Central", "Kalimoni", "Karuri", "Muchatha", "Ndenderu", "Kabete", "Githunguri", "Gatundu"],
    sublocations: ["Witeithie", "Makongeni", "Section 9 Thika", "Membley", "Ruiru CBD", "Ruaka Center", "Banana Hill", "Muchatha", "Gachie", "Kihara", "Ndenderu", "Kimbo", "Kahawa Sukari", "Kahawa Wendani", "Kenyatta Road (Juja)", "Kamwangi", "Tigoni Sub"],
    streets: ["Thika Superhighway (A2)", "Northern Bypass", "Eastern Bypass", "Western Bypass", "Kiambu Road", "Limuru Road", "Kamiti Road", "Thika Garissa Road", "Waiyaki Way (Kikuyu)", "Banana-Raini Road", "Biashara Street Thika"]
  },
  "Turkana": {
    towns: ["Lodwar", "Kakuma", "Lokichogio", "Lokichar", "Kalokol", "Lokori", "Kainuk", "Lokitaung"],
    locations: ["Township (Lodwar)", "Kanamkemer", "Kalokol", "Kakuma", "Letea", "Songot", "Lokichogio", "Lokichar", "Katilu", "Kainuk", "Lokori", "Lokitaung", "Lapur"],
    sublocations: ["Lodwar CBD", "Kanamkemer Sub", "Kakuma Camp Area (Camp 1-4)", "Kalokol Lake Port", "Lokichar Junction", "Kainuk Center", "Lokichogio Town", "Lokori Center", "Katilu Scheme Area"],
    streets: ["Kitale-Lodwar-Nadapal Highway (A1)", "Lodwar Main Street", "Kakuma Main Road", "Airport Road Lodwar", "Lokichogio Border Track"]
  },
  "West Pokot": {
    towns: ["Kapenguria", "Makutano Pokot", "Chepareria", "Sigor", "Kacheliba", "Ortum", "Kabichbich", "Alale"],
    locations: ["Kapenguria", "Mnagei", "Riwo", "Kipkomo", "Chepareria", "Batei", "Wei Wei", "Lomut", "Sekerr", "Kacheliba", "Suam", "Alale"],
    sublocations: ["Kapenguria CBD", "Makutano Stage", "Chepareria Center", "Sigor Sub", "Ortum Center", "Kacheliba Border", "Suam Border Post", "Kabichbich Center", "Muruny"],
    streets: ["Kitale-Lodwar Highway (A1)", "Makutano Main Road", "Chepareria Street", "Kapenguria-Sigor Road", "Suam Border Road"]
  },
  "Samburu": {
    towns: ["Maralal", "Baragoi", "Wamba", "Archers Post", "Suguta Marmar", "South Horr"],
    locations: ["Maralal Central", "Loosuk", "Suguta Marmar", "Waso", "Wamba", "Lodokejek", "Archers Post", "El-Barta", "Baragoi", "Ndoto", "South Horr"],
    sublocations: ["Maralal CBD", "Lolkunono", "Wamba Center", "Archers Post Junction", "Baragoi Stage", "Suguta Marmar Town", "South Horr Center", "Maralal Safari Lodge Area"],
    streets: ["Nyahururu-Maralal Road (C78)", "Maralal Main Street", "Isiolo-Archers Post Highway (A2)", "Baragoi Main Track"]
  },
  "Trans-Nzoia": {
    towns: ["Kitale", "Kiminini", "Endebess", "Saboti", "Cherangany/Kipkeikei", "Sibanga", "Suwerwa", "Kitalale"],
    locations: ["Hospital Ward", "Bidii", "Tuwan", "Matisi", "Kiminini", "Waitaluk", "Nabiswa", "Endebess", "Matumbei", "Saboti", "Machewa", "Sinyerere", "Cherangany", "Kwanza", "Keiyo"],
    sublocations: ["Kitale CBD", "Milimani Kitale", "Tuwan Estate", "Matisi Sub", "Kipkaren", "Kiminini Town", "Endebess Center", "Saboti Town", "Sibanga Market", "Bondeni Kitale"],
    streets: ["Kenyatta Street Kitale", "Kitale-Eldoret Highway (A1)", "Kitale-Webuye Road", "Kitale-Endebess Road", "Station Road Kitale", "Lwakhakha Road"]
  },
  "Uasin Gishu": {
    towns: ["Eldoret", "Turbo", "Moiben", "Kesses", "Burnt Forest", "Ziwa", "Matunda", "Kipkaren"],
    locations: ["Eldoret CBD", "Elgon View", "Huruma", "Langas", "Pioneer", "Kipkenyo", "Kapyemit", "Kimumu", "Kapsoya", "Kapsaret", "Megun", "Ngeria", "Tarakwa", "Moiben", "Sergoit", "Ziwa", "Turbo", "Tapsagoi", "Kipkaren"],
    sublocations: ["Annex", "Kimumu", "Sirikwa", "West Indies", "Maili Nne", "Racecourse", "Action Estate", "Hillside", "Block 10", "Munyaka", "Yamumbi", "Burnt Forest Town", "Kapseret Stage", "Cheptiret"],
    streets: ["Uganda Road (A104)", "Oloo Street", "Kipchoge Keino Avenue", "Nandi Road", "Eldoret-Iten Road", "Kisumu Road Eldoret", "Eldoret Bypass", "Uganda Highway Frontage"]
  },
  "Elgeyo-Marakwet": {
    towns: ["Iten", "Tambach", "Kapsowar", "Chebiemit", "Flourspar", "Chepkorio", "Nyaru", "Bugar"],
    locations: ["Iten/Tambach", "Kamariny", "Chepkorio", "Soy North", "Soy South", "Kapsowar", "Chebiemit", "Lelan", "Sambirir", "Endo", "Arror"],
    sublocations: ["Iten Viewpoint Sub", "Iten CBD", "Tambach Stage", "Kapsowar Center", "Chebiemit Sub", "Chepkorio Center", "Nyaru Junction", "Flourspar Mining Area", "Tot Market"],
    streets: ["Eldoret-Iten Highway (C51)", "Iten-Kapsowar Road", "Iten Viewpoint Road", "Tambach Escarpment Road", "Nyaru-Ravine Road"]
  },
  "Nandi": {
    towns: ["Kapsabet", "Nandi Hills", "Mosoriot", "Kobujoi", "Kilibwoni", "Maraba", "Serem", "Chemase"],
    locations: ["Kapsabet Township", "Chepterit", "Chemundu", "Kilibwoni", "Nandi Hills Town", "Lessos", "Tindinyo", "Kobujoi", "Kemeloi", "Aldai", "Kabiyet", "Sangalo", "Tinderet", "Songhor"],
    sublocations: ["Kapsabet CBD", "Nandi Hills Center", "Mosoriot University Sub", "Kapsabet Stage", "Kamatargui", "Baraton (UEAB Area)", "Chemelil Border", "Serem Market", "Chepterit Stage"],
    streets: ["Eldoret-Kapsabet Road (C39)", "Kapsabet-Chavakali Road", "Nandi Hills Main Street", "Kapsabet-Eldama Ravine Road", "Hospital Road Kapsabet"]
  },
  "Baringo": {
    towns: ["Kabarnet", "Eldama Ravine", "Marigat", "Mogotio", "Chemulingot", "Kabartonjo", "Tenges"],
    locations: ["Kabarnet Township", "Kapropita", "Sacho", "Tenges", "Eldama Ravine Central", "Lembus", "Mumberes", "Marigat", "Mukutani", "Mogotio", "Emining", "Kabartonjo", "Bartabwa", "Ribkwo", "Silale"],
    sublocations: ["Kabarnet CBD", "Eldama Ravine Town", "Marigat Junction", "Mogotio Sub", "Chemulingot Center", "Kabartonjo Stage", "Kiamariga", "Timboroa Border", "Lake Baringo Area (Kampi ya Samaki)"],
    streets: ["Nakuru-Kabarnet Highway (B4)", "Eldama Ravine-Nakuru Road", "Marigat-Baringo Road", "Kabarnet-Kabartonjo Road", "Ravine Main Street"]
  },
  "Laikipia": {
    towns: ["Nanyuki", "Nyahururu", "Rumuruti", "Kinamba", "Doldol", "Ol Joret", "Sipili", "Wiyumirerie"],
    locations: ["Nanyuki Central", "Thingithu", "Igwamiti", "Salama", "Rumuruti Township", "Ol-Moran", "Sosian", "Mukogodo East", "Mukogodo West", "Umande", "Segera"],
    sublocations: ["Nanyuki CBD", "Majengo Nanyuki", "Likii", "Thingithu Sub", "Nyahururu Town Sub", "Rumuruti Center", "Sipili Market", "Doldol Stage", "Kinamba Town", "Equator Area Nanyuki"],
    streets: ["Nairobi-Nanyuki Highway (A2)", "Kenyatta Way Nanyuki", "Nyahururu-Nakuru Road (C77)", "Nanyuki-Doldol Road", "Rumuruti-Nyahururu Highway"]
  },
  "Nakuru": {
    towns: ["Nakuru", "Naivasha", "Gilgil", "Molo", "Njoro", "Subukia", "Mai Mahiu", "Bahati", "Elburgon", "Rongai"],
    locations: ["Nakuru CBD", "Milimani", "Section 58", "Kiamunyi", "Lanet", "Free Area", "Nakuru East", "Nakuru West", "Naivasha East", "Naivasha Central", "Viwandani", "Mai Mahiu", "Gilgil Township", "Elementaita", "Molo Township", "Njoro", "Lare", "Subukia", "Bahati"],
    sublocations: ["Shabab", "White House", "Barnabas", "Pipeline Nakuru", "Freehold", "Kaptembwa", "Bondeni", "Lake View Naivasha", "Longonot", "Gilgil Town Center", "Molo Center", "Egerton University Sub", "Njoro Stage", "Kabatini"],
    streets: ["Kenyatta Avenue Nakuru", "Oginga Odinga Road", "Government Road", "Kanu Street", "Nairobi-Nakuru Highway (A104)", "Moi South Lake Road (Naivasha)", "Nakuru-Eldoret Highway", "Bondeni Road"]
  },
  "Narok": {
    towns: ["Narok Town", "Kilgoris", "Ololulunga", "Nairagie Enkare", "Ntulele", "Lolgorian", "Emurua Dikirr"],
    locations: ["Township (Narok)", "Nkoidila", "Olekurto", "Olokurto", "Ololulunga", "Melelo", "Ntulele", "Mosiro", "Kilgoris Central", "Keyian", "Lolgorian", "Shankoe", "Emurua Dikirr"],
    sublocations: ["Narok CBD", "Stadium Area Narok", "Kilgoris Center", "Ololulunga Stage", "Maasai Mara Gateway (Talek, Sekenani)", "Ntulele Center", "Nairagie Enkare Town", "Lolgorian Sub"],
    streets: ["Nairobi-Narok Highway (B3)", "Narok-Bomet Road (B3)", "Narok-Mau Narok Road", "Kilgoris Main Street", "Sekenani Road", "Hospital Road Narok"]
  },
  "Kajiado": {
    towns: ["Kitengela", "Ongata Rongai", "Ngong", "Kajiado Town", "Loitokitok", "Namanga", "Isinya", "Kiserian", "Bisil"],
    locations: ["Nkaimurunya", "Ongata Rongai", "Ngong Central", "Olkeri", "Kitengela", "Oloosirkon/Sholinke", "Isinya", "Kajiado Central", "Dalalekutuk", "Matapato North", "Matapato South", "Oloitokitok", "Rombo", "Entonet", "Kiserian"],
    sublocations: ["Kitengela CBD", "Acacia", "Rongai Stage", "Ngong Vet", "Kiserian Town", "Namanga Border Post", "Loitokitok Town", "Isinya Center", "Mile 46", "Sultan Hamud Border", "Bisil Town"],
    streets: ["Namanga Highway (A104)", "Magadi Road", "Ngong Road Extension", "Kitengela-Acacia Road", "Kiserian-Isinya Road", "Loitokitok-Emali Road", "Old Namanga Road"]
  },
  "Kericho": {
    towns: ["Kericho Town", "Litein", "Kipkelion", "Londiani", "Kapsoit", "Sondu Border", "Kabianga"],
    locations: ["Ainamoi", "Kapsoit", "Kipchebor", "Belgut", "Kabianga", "Seretut", "Litein", "Cheplanget", "Cheborge", "Kipkelion", "Chilchila", "Londiani", "Kedowa", "Soin", "Sigowet"],
    sublocations: ["Kericho CBD", "Nyagacho", "Litein Center", "Kapsoit Stage", "Londiani Junction", "Kabianga University Area", "Sondu Market Sub", "Brooke Center", "Chepseon"],
    streets: ["Nakuru-Kericho Highway (B3)", "Moi Road Kericho", "Kericho-Kisumu Highway (B1)", "Kericho-Litein Road", "Temple Road Kericho", "Hospital Road Kericho"]
  },
  "Bomet": {
    towns: ["Bomet Town", "Sotik", "Longisa", "Mulot", "Chepalungu", "Silibwet", "Tenwek", "Mogogosiek"],
    locations: ["Township (Bomet)", "Silibwet", "Ndaraweta", "Longisa", "Kipreres", "Sotik Central", "Ndanai/Abosi", "Kipsonoi", "Sigor", "Kongasis", "Mogogosiek", "Kimulot"],
    sublocations: ["Bomet CBD", "Sotik Center", "Longisa Stage", "Mulot Border", "Tenwek Hospital Sub", "Silibwet Market", "Chebole", "Ndanai Town", "Mogogosiek Center"],
    streets: ["Narok-Bomet Highway (B3)", "Bomet-Kericho Road", "Sotik Main Street", "Tenwek Road", "Bomet-Sotik Highway", "Market Road Bomet"]
  },
  "Kakamega": {
    towns: ["Kakamega Town", "Mumias", "Malava", "Butere", "Lugari", "Lumakanda", "Khwisero", "Navakholo", "Shinyalu"],
    locations: ["Township (Kakamega)", "Lurambi", "Shirere", "Mahiakalo", "Mumias Central", "Mumias North", "Malava Township", "South Kabras", "Butere Township", "Marama Central", "Kisa Central", "Bunyala", "Lumakanda", "Lugari", "Shinyalu", "Ikolomani"],
    sublocations: ["Kakamega CBD", "Kefinco", "Approved Kakamega", "Joyland", "Amalemba", "Mumias Center", "Shibale", "Malava Stage", "Butere Town", "Lumakanda Center", "Khwisero Sub", "Iguhu"],
    streets: ["Kisumu-Kakamega Highway (A1)", "Mumias-Kakamega Road", "Canon Awori Street", "Kakamega-Webuye Highway", "Mumias Main Street", "Hospital Road Kakamega"]
  },
  "Vihiga": {
    towns: ["Mbale", "Chavakali", "Luanda", "Hamisi", "Majengo Vihiga", "Serem", "Jeptulu"],
    locations: ["Maragoli Central", "Mbale", "Sabatia West", "Lyaduywa/Izava", "Chavakali", "Luanda Township", "Luanda South", "Emuhaya Central", "Hamisi", "Shiru", "Gisambai", "Jepkoyai"],
    sublocations: ["Mbale CBD", "Chavakali Market Sub", "Luanda Stage", "Majengo Junction", "Mungoma", "Kaimosi Complex Area", "Mudete", "Gambogi", "Lunyerere", "Maseno Border"],
    streets: ["Kisumu-Kakamega Highway (A1)", "Luanda-Majengo Road", "Mbale Main Street", "Chavakali-Kaimosi Road", "C39 Highway"]
  },
  "Bungoma": {
    towns: ["Bungoma Town", "Webuye", "Kimilili", "Chwele", "Sirisia", "Kanduyi", "Malaba Border (Bungoma side)", "Kapsokwony", "Cheptais"],
    locations: ["Township (Bungoma)", "Bukembe West", "Khalaba", "Webuye East", "Webuye West", "Misikhu", "Kimilili Township", "Maeni", "Chwele", "Mukweya", "Sirisia", "Kapsokwony", "Cheptais", "Tongaren"],
    sublocations: ["Bungoma CBD", "Kanduyi Junction", "Webuye Town Sub", "National Housing Estate Bungoma", "Kimilili Center", "Chwele Market Sub", "Malakisi", "Cheptais Town", "Kapsokwony Stage", "Kamukuywa"],
    streets: ["Eldoret-Malaba Highway (A104)", "Mumias-Bungoma Road", "Webuye Highway", "Bungoma-Kimilili Road", "Station Road Bungoma", "Cathedral Road"]
  },
  "Busia": {
    towns: ["Busia Town", "Malaba", "Nambale", "Funyula", "Port Victoria", "Bumala", "Amukura", "Matayos"],
    locations: ["Township (Busia)", "Burumba", "Matayos South", "Malaba Central", "Malaba North", "Ang'urai", "Nambale Township", "Bukhayo Central", "Funyula Central", "Bwiri", "Bunyala Central", "Bunyala South"],
    sublocations: ["Busia Border", "Custom Area", "Burumba Estate", "Malaba Border Sub", "Nambale Center", "Port Victoria Sub", "Bumala Market", "Ang'orom", "Amukura Town", "Sio Port"],
    streets: ["Kisumu-Busia Highway (B1)", "Eldoret-Malaba Highway (A104)", "Customs Road Busia", "Port Victoria Road", "Busia-Nambale Road", "Border Post Link"]
  },
  "Siaya": {
    towns: ["Siaya Town", "Bondo", "Ugunja", "Yala", "Usenge", "Ndori", "Akala", "Aram"],
    locations: ["Township (Siaya)", "Alego Central", "Yimbo East", "Yimbo West", "Bondo Township", "Sakwa", "Central Gem", "Yala Township", "Ugunja", "Ugenya", "Rarieda", "Uyoma"],
    sublocations: ["Siaya CBD", "Rabango", "Mulaha", "Bondo Town Sub", "Usenge Beach/Port", "Ugunja Center", "Yala Stage", "Ndori Junction", "Aram Market", "Nyadorera", "Luanda Kotieno"],
    streets: ["Kisumu-Bondo Highway (C28)", "Siaya-Rang'ala Road", "Bondo-Usenge Road", "Siaya-Bondo Road", "Hospital Road Siaya", "Luanda Kotieno Link"]
  },
  "Kisumu": {
    towns: ["Kisumu City", "Muhoroni", "Maseno", "Ahero", "Kombewa", "Awasi"],
    locations: ["Kisumu Central", "Kaloleni", "Kisumu East", "Kajulu", "Kisumu West", "North Seme", "South Seme", "Nyando", "Ahero", "Kobura", "Muhoroni Township", "Miwani", "Chemelil"],
    sublocations: ["Milimani Kisumu", "Kisumu CBD", "Kondele", "Mamboleo", "Manyatta", "Nyawita", "Migosi", "Polyview", "Tom Mboya", "Riat", "Nyamasaria", "Otonglo", "Kibos", "Maseno Town", "Ahero Center", "Muhoroni Town"],
    streets: ["Oginga Odinga Street", "Jomo Kenyatta Highway", "Accra Street", "Nyerere Road", "Kisumu-Kakamega Road (A1)", "Kisumu-Busia Road", "Otieno Oyoo Street", "Nairobi Road (Nyamasaria Frontage)"]
  },
  "Homa Bay": {
    towns: ["Homa Bay Town", "Oyugis", "Mbita", "Kendu Bay", "Ndhiwa", "Sindo", "Rangwe", "Rodi Kopany"],
    locations: ["Township (Homa Bay)", "Homa Bay Central", "Kasipul", "Karachuonyo", "Kendu West", "Mbita Township", "Rusinga East/West", "Ndhiwa Township", "Kanyamwa", "Suba Central", "Gwassi North"],
    sublocations: ["Homa Bay CBD", "Shauri Yako", "Sofia", "Oyugis Center", "Mbita Point Sub", "Rusinga Island Area", "Kendu Bay Stage", "Ndhiwa Town", "Rodi Kopany Junction", "Sindo Town", "Mfangano Island Sub"],
    streets: ["Kisumu-Homa Bay Highway", "Homa Bay-Mbita Road", "Oyugis-Kisii Road", "Homa Bay-Rodi Kopany Road", "Pier Road Homa Bay", "Kendu Bay Main Street"]
  },
  "Migori": {
    towns: ["Migori Town", "Rongo", "Awendo", "Isebania", "Kehancha", "Sori", "Macalder", "Muhuru Bay"],
    locations: ["Suna East", "Suna West", "Kakrao", "Rongo Township", "Central Kamagambo", "Awendo Township", "North Sakwa", "Kuria West", "Kehancha", "Kuria East", "Nyatike", "Karungu"],
    sublocations: ["Migori CBD", "Kakrao Sub", "Oruba", "Rongo Center", "Awendo Sare (Sony Sugar Area)", "Isebania Border Post", "Kehancha Town", "Sori Karungu Bay", "Muhuru Beach Sub"],
    streets: ["Kisii-Migori-Isebania Highway (A1)", "Rongo Highway", "Sony Sugar Road", "Kehancha-Migori Road", "Isebania Border Link", "Suna Market Street"]
  },
  "Kisii": {
    towns: ["Kisii Town", "Ogembo", "Suneka", "Keroka Border", "Tabaka", "Gesusu", "Nyamache", "Marani"],
    locations: ["Kitutu Chache North/South", "Nyaribari Chache", "Township (Kisii)", "Nyaribari Masaba", "Bomachoge Borabu", "Ogembo Township", "Bonchari", "Suneka", "Bobasi", "Nyamache", "South Mugirango", "Tabaka"],
    sublocations: ["Kisii CBD", "Nyanchwa", "Daraja Mbili", "Mosocho", "Jogoo Estate", "Nyambera", "Ogembo Center", "Suneka Town", "Tabaka Soapstone Area", "Keroka Kisii side", "Nyamache Market"],
    streets: ["Kisumu-Kisii Highway (A1)", "Kisii-Kilgoris Road", "Hospital Road Kisii", "Ogembo Main Street", "Kisii-Keroka Highway", "Market Street Kisii", "Manga Road"]
  },
  "Nyamira": {
    towns: ["Nyamira Town", "Keroka", "Nyamira North (Ekerenyo)", "Manga", "Rigoma", "Kebirigo", "Nyansiongo"],
    locations: ["West Mugirango", "Township (Nyamira)", "Kebirigo", "North Mugirango", "Ekerenyo", "Borabu", "Nyansiongo", "Kitutu Masaba", "Manga", "Rigoma"],
    sublocations: ["Nyamira CBD", "Kebirigo Center", "Keroka Nyamira side", "Ekerenyo Stage", "Manga Sub", "Rigoma Market", "Nyansiongo Town", "Sang'anyi", "Chepilat"],
    streets: ["Kisii-Chemosit Highway", "Nyamira-Keroka Road", "Main Street Nyamira", "Kebirigo-Nyamira Highway", "Hospital Road Nyamira"]
  },
  "Nairobi": {
    towns: ["Westlands", "Kasarani", "Lang'ata", "Starehe", "Dagoretti", "Embakasi", "Makadara", "Kamukunji", "Roysambu", "Mathare", "Kibra"],
    locations: ["Kilimani", "Kasarani Central", "Karen", "CBD", "Upper Hill", "Industrial Area", "Eastleigh", "Buruburu", "South C", "Runda", "Lavington", "Westlands Central", "Parklands", "Embakasi East/West/Central", "Roysambu", "Kahawa West", "Kibera", "Pumwani", "Pangani"],
    sublocations: ["Mwiki", "Roysambu Sub", "Lavington", "Hurlingham", "South B", "Imara Daima", "Kileleshwa", "Parklands", "Donholm", "Pipeline", "Utawala", "Ruai", "Kayole", "Komarock", "Zimmerman", "Kahawa West", "Githurai 44", "Highridge", "Kangemi", "Kawangware"],
    streets: ["Moi Avenue", "Kenyatta Avenue", "Waiyaki Way (A104)", "Thika Superhighway", "Ngong Road", "Enterprise Road", "Argwings Kodhek Road", "Jogoo Road", "Mombasa Road", "Lang'ata Road", "Uhuru Highway", "Peponi Road", "Kiambu Road", "Ring Road Kilimani"]
  }
};

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
// 4. ADMIN LOCATION INSPECTOR MODAL COMPONENT
// ============================================================================

interface AdminLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationDetails: {
    county: string;
    town?: string;
    location?: string;
    sublocation?: string;
    streetAddress?: string;
    shippingAddress?: string;
    userName?: string;
    phoneNumber?: string;
    orderId?: number | string;
  } | null;
}

const AdminLocationModal: React.FC<AdminLocationModalProps> = ({
  isOpen,
  onClose,
  locationDetails
}) => {
  if (!isOpen || !locationDetails) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-emerald-500/40 w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 relative overflow-hidden">
        {/* Header decoration */}
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 text-emerald-400">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                Geographic Location Inspector
                {locationDetails.orderId && (
                  <span className="text-xs bg-emerald-950 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-800">
                    Order #{locationDetails.orderId}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">Complete user-entered delivery address breakdown</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User context header */}
        {(locationDetails.userName || locationDetails.phoneNumber) && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-between">
            <div>
              <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Customer / Recipient</div>
              <div className="text-lg font-black text-white">{locationDetails.userName || 'Customer'}</div>
            </div>
            {locationDetails.phoneNumber && (
              <a 
                href={`tel:${locationDetails.phoneNumber}`} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-colors"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>{locationDetails.phoneNumber}</span>
              </a>
            )}
          </div>
        )}

        {/* Geographic location fields breakdown grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-start gap-3">
            <MapPin className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase">County</div>
              <div className="text-base font-extrabold text-emerald-300">{locationDetails.county || 'Not Specified'}</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-start gap-3">
            <Navigation className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase">Town / District</div>
              <div className="text-base font-extrabold text-teal-300">{locationDetails.town || 'Not Specified'}</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-start gap-3">
            <Globe className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase">Location / Ward</div>
              <div className="text-base font-extrabold text-slate-200">{locationDetails.location || 'Not Specified'}</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-start gap-3">
            <Layers className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase">Sublocation / Estate</div>
              <div className="text-base font-extrabold text-slate-200">{locationDetails.sublocation || 'Not Specified'}</div>
            </div>
          </div>

        </div>

        {/* Detailed street & shipping address text */}
        <div className="space-y-3 mb-6">
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
            <div className="text-xs text-amber-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-amber-400" />
              <span>Street Address / Specific Landmark</span>
            </div>
            <div className="text-sm font-bold text-white">
              {locationDetails.streetAddress || 'No detailed street address entered'}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-700/60">
            <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              <span>Full Compiled Delivery String</span>
            </div>
            <div className="text-sm font-mono text-emerald-200 leading-relaxed">
              {locationDetails.shippingAddress || [
                locationDetails.streetAddress,
                locationDetails.sublocation,
                locationDetails.location,
                locationDetails.town,
                locationDetails.county
              ].filter(Boolean).join(', ')}
            </div>
          </div>
        </div>

        {/* Footer Close CTA */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm transition-all shadow-lg shadow-emerald-600/30"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. CUSTOM FINANCIAL GROWTH CHART COMPONENT (SVG-BASED)
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
            <h3 className="text-xl font-black text-white">Mwea Rice Financial Engine</h3>
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
// 6. REUSABLE PRODUCT CARD COMPONENT
// Prioritizes phone screen priority (2 items per row on small devices, 4 on desktop)
// ============================================================================

interface ProductCardProps {
  product: Product;
  flashActive?: boolean;
  onAddToCart: () => void;
  onQuickView: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  flashActive = false,
  onAddToCart,
  onQuickView
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
        />

        {/* Dynamic Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start z-10">
          <span className="bg-emerald-900/90 text-emerald-200 font-black text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md uppercase tracking-wider shadow-sm">
            {product.weightKg}kg Sack
          </span>
          {product.isOrganic && (
            <span className="bg-teal-700/90 text-white font-bold text-[9px] px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1">
              <Leaf className="w-2.5 h-2.5" /> Organic
            </span>
          )}
        </div>

        {hasDiscount && (
          <div className="absolute top-2 right-2 bg-rose-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-md animate-pulse">
            SALE
          </div>
        )}

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
// 7. MAIN APPLICATION COMPONENT (MWEA RICE STORE)
// ============================================================================

export default function MweaRiceStore() {
  // ROUTING & VIEW STATES
  const [view, setView] = useState<'home' | 'shop' | 'cart' | 'login' | 'admin' | 'profile'>('home');
  const [user, setUser] = useState<UserAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // CATALOG & STORE DATA STATES
  const [products, setProducts] = useState<Product[]>([]);
  const [carousel, setCarousel] = useState<any[]>([]);
  
  // HERO BACKDROP CONFIGURATION
  const [heroSettings, setHeroSettings] = useState<HeroSettings>({
    title: 'Direct From Mwea Paddy Fields',
    subtitle: '100% Pure Aromatic Pishori Rice harvested and delivered straight to your doorstep across Kenya.',
    video1: 'https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI',
    video2: '',
    img1: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80',
    img2: 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=1600&q=80',
    img3: '',
    ctaButtonText: 'Explore Mwea Rice Catalog',
    secondaryButtonText: 'Track Order Status',
    badgeText: '🌾 Pure Kenya Mwea Harvest',
    overlayOpacity: '40',
    announcementTicker: '🔥 Mwea Rice Direct: Special Wholesale Discounts Active Across All 47 Counties!',
    themeAccentColor: 'emerald',
    heroLayoutMode: 'split-banner',
    enableLiveTicker: true,
    promoBadgeColor: 'rose',
    bannerHeight: '65vh',
    featuredTagLabel: 'Certified Pure Mwea Harvest',
    customerTrustBadgeText: 'Verified Mwea Milling Standards',
    supportHotlineDisplay: '+254 700 000000',
    expressLogisticsNote: 'Same-day dispatch available for Nairobi, Kiambu & Kirinyaga'
  });
  
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  
  const [flashSale, setFlashSale] = useState({ active: false, endTime: null as string | null, msRemaining: 0 });
  const [baseTransportFee, setBaseTransportFee] = useState(250);
  const [countyOverrides, setCountyOverrides] = useState<{ [key: string]: number }>({});
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
  
  // ADMIN LOCATION INSPECTOR MODAL STATE
  const [adminLocationInspector, setAdminLocationInspector] = useState<{
    isOpen: boolean;
    data: {
      county: string;
      town?: string;
      location?: string;
      sublocation?: string;
      streetAddress?: string;
      shippingAddress?: string;
      userName?: string;
      phoneNumber?: string;
      orderId?: number | string;
    } | null;
  }>({
    isOpen: false,
    data: null
  });

  // REGIONAL CHECKOUT DATA STATE
  const [checkoutData, setCheckoutData] = useState({
    county: 'Nairobi',
    town: 'Westlands',
    location: 'CBD',
    sublocation: 'Mwiki',
    shippingAddress: 'Moi Avenue',
    paymentMethod: 'mpesa_stk',
    stkPhoneNumber: ''
  });
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  // AUTH FORM & OTP SMS STATES
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'reset'>('request');
  
  // Signup OTP step control
  const [signupStep, setSignupStep] = useState<'details' | 'verify_otp'>('details');
  const [signupOtp, setSignupOtp] = useState('');
  const [isSendingSignupOtp, setIsSendingSignupOtp] = useState(false);
  const [isVerifyingSignupOtp, setIsVerifyingSignupOtp] = useState(false);

  // Password reset SMS state
  const [resetOtp, setResetOtp] = useState('');
  const [isSendingResetOtp, setIsSendingResetOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // General auth form data
  const [formData, setFormData] = useState({ 
    phoneNumber: '', 
    email: '', 
    password: '', 
    fullName: '', 
    resetToken: '', 
    newPassword: '' 
  });
  
  // ADMIN PANEL NAVIGATION & DATA STATES
  const [adminTab, setAdminTab] = useState<'inventory' | 'orders' | 'finances' | 'users' | 'config' | 'carousel' | 'logs'>('inventory');
  const [newProduct, setNewProduct] = useState({ 
    brandName: '', variety: '', weightKg: '', basePrice: '', buyingPrice: '', flashSalePrice: '', stockQuantity: '', imageUrl: '', description: '', isOrganic: false 
  });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserAccount[]>([]);
  const [adminLogs, setAdminLogs] = useState<AuditLog[]>([]);
  const [financialData, setFinancialData] = useState<FinancialAnalyticsResponse | null>(null);
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

  const getAccountCartKey = (u: UserAccount | null) => {
    return u ? `mwea_rice_cart_${u.id || u.phoneNumber}` : 'mwea_rice_cart_guest';
  };

  // OTP Countdown timer tick
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

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
    const currentData = REGIONAL_LOGISTICS_DATA[checkoutData.county as keyof typeof REGIONAL_LOGISTICS_DATA] || DEFAULT_REGIONAL_LOGISTICS;
    setCheckoutData(prev => ({
      ...prev,
      town: currentData.towns[0] || 'Central Town',
      location: currentData.locations[0] || 'Main Location',
      sublocation: currentData.sublocations[0] || 'Sub-location',
      shippingAddress: currentData.streets[0] || 'Main Street'
    }));
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

    let newSocket: Socket | null = null;
    try {
      newSocket = io(SOCKET_URL);
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
  // 8. API FETCHERS & DISPATCHERS
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
        setAdminUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch user directory:", err);
    }
  };

  const fetchAdminLogs = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminLogs(data);
      }
    } catch (err) {
      console.error("Failed to load system audit logs:", err);
    }
  };

  const fetchFinancialAnalytics = async (year: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/analytics/finances?year=${year}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFinancialData(data);
      }
    } catch (err) {
      console.error("Failed to load financial engine analytics:", err);
    }
  };

  // CART CALCULATIONS
  const addToCart = (product: Product, qty: number = 1) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.productId === product.id);
      if (existing) {
        return prevCart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + qty } : item);
      }
      return [...prevCart, { productId: product.id, quantity: qty, product }];
    });
    showToast(`Added ${product.brandName} (${product.weightKg}kg) to cart!`, 'success');
  };

  const updateCartQuantity = (productId: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => item.productId === productId ? { ...item, quantity: qty } : item));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
    showToast('Item removed from cart.', 'info');
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const p = item.product || {};
      const effectivePrice = flashSale.active && p.flashSalePrice ? p.flashSalePrice : (p.basePrice || p.price || 0);
      return sum + (effectivePrice * item.quantity);
    }, 0);
  }, [cart, flashSale.active]);

  const totalCartWeightKg = useMemo(() => {
    return cart.reduce((sum, item) => {
      const p = item.product || {};
      return sum + ((p.weightKg || 0) * item.quantity);
    }, 0);
  }, [cart]);

  const activeShippingFee = useMemo(() => {
    const selectedCounty = checkoutData.county;
    if (countyOverrides && countyOverrides[selectedCounty] !== undefined) {
      return Number(countyOverrides[selectedCounty]);
    }
    return baseTransportFee;
  }, [checkoutData.county, countyOverrides, baseTransportFee]);

  const cartGrandTotal = useMemo(() => {
    return cartSubtotal + (cart.length > 0 ? activeShippingFee : 0);
  }, [cartSubtotal, cart.length, activeShippingFee]);

  const expectedRewardPoints = useMemo(() => {
    return Number((totalCartWeightKg * 0.2).toFixed(2));
  }, [totalCartWeightKg]);

  // ============================================================================
  // 9. AUTH HANDLERS (SMS OTP REGISTER & SMS OTP PASSWORD RESET)
  // ============================================================================

  // Step 1: Send SMS OTP for New Member Registration
  const handleRequestSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phoneNumber || !formData.fullName || !formData.password) {
      showToast('Please fill in your full name, phone number, and password.', 'error');
      return;
    }

    setIsSendingSignupOtp(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/signup/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber: formData.phoneNumber,
          fullName: formData.fullName,
          email: formData.email 
        })
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || `SMS OTP sent to ${formData.phoneNumber}`, 'success');
        setSignupStep('verify_otp');
        setResendCountdown(60);
      } else {
        showToast(data.error || 'Failed to send registration SMS OTP', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Server connection error during OTP dispatch', 'error');
    } finally {
      setIsSendingSignupOtp(false);
    }
  };

  // Step 2: Verify SMS OTP & Create Account
  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupOtp) {
      showToast('Please enter the SMS OTP code sent to your phone.', 'error');
      return;
    }

    setIsVerifyingSignupOtp(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/signup/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: formData.phoneNumber,
          otp: signupOtp,
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password
        })
      });
      const data = await res.json();

      if (res.ok && data.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        showToast(`Registration complete! Welcome to Mwea Rice, ${data.user.fullName}!`, 'success');
        setSignupStep('details');
        setSignupOtp('');
        setView(data.user.role === 'admin' ? 'admin' : 'home');
      } else {
        showToast(data.error || 'Invalid OTP verification code', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Server error during account verification', 'error');
    } finally {
      setIsVerifyingSignupOtp(false);
    }
  };

  // Standard Direct Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phoneNumber || !formData.password) {
      showToast('Please enter your phone number and password.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber: formData.phoneNumber, 
          password: formData.password 
        })
      });
      const data = await res.json();

      if (res.ok && data.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        showToast(`Welcome back, ${data.user.fullName}!`, 'success');
        setView(data.user.role === 'admin' ? 'admin' : 'home');
      } else {
        showToast(data.error || 'Invalid phone number or password', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Server authentication error', 'error');
    }
  };

  // Step 1: Password Reset - Send SMS OTP using Phone Number
  const handleRequestPasswordResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phoneNumber) {
      showToast('Please enter the phone number associated with your Mwea Rice account.', 'error');
      return;
    }

    setIsSendingResetOtp(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: formData.phoneNumber })
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || `Password reset SMS OTP sent to ${formData.phoneNumber}`, 'success');
        setResetStep('reset');
        setResendCountdown(60);
      } else {
        showToast(data.error || 'Failed to dispatch password reset OTP', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Server connection error', 'error');
    } finally {
      setIsSendingResetOtp(false);
    }
  };

  // Step 2: Verify SMS OTP & Reset Password
  const handleResetPasswordWithPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phoneNumber || !resetOtp || !formData.newPassword) {
      showToast('Please fill in your phone number, the SMS OTP code, and your new password.', 'error');
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: formData.phoneNumber,
          otp: resetOtp,
          newPassword: formData.newPassword
        })
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || 'Password reset successful! Please log in with your new password.', 'success');
        setIsForgotPassword(false);
        setIsLogin(true);
        setResetStep('request');
        setResetOtp('');
        setFormData(prev => ({ ...prev, password: '', newPassword: '' }));
      } else {
        showToast(data.error || 'Failed to reset password. Check your OTP.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Server password reset error', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // LOGOUT HANDLER
  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showToast('Logged out successfully.', 'info');
    setView('home');
  };

  // ============================================================================
  // 10. CHECKOUT & PAYHERO M-PESA STK PUSH HANDLER
  // ============================================================================

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      showToast('Your shopping cart is empty.', 'error');
      return;
    }

    if (!checkoutData.stkPhoneNumber) {
      showToast('Please provide an M-Pesa phone number for payment.', 'error');
      return;
    }

    setIsCheckingOut(true);
    try {
      const compiledAddress = [
        checkoutData.shippingAddress,
        checkoutData.sublocation,
        checkoutData.location,
        checkoutData.town,
        checkoutData.county
      ].filter(Boolean).join(', ');

      const orderPayload = {
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          priceAtPurchase: flashSale.active && item.product?.flashSalePrice ? item.product.flashSalePrice : (item.product?.basePrice || item.product?.price || 0)
        })),
        paymentMethod: checkoutData.paymentMethod,
        mpesaPhoneNumber: checkoutData.stkPhoneNumber,
        county: checkoutData.county,
        town: checkoutData.town,
        location: checkoutData.location,
        sublocation: checkoutData.sublocation,
        streetAddress: checkoutData.shippingAddress,
        shippingAddress: compiledAddress,
        shippingFee: activeShippingFee,
        grandTotal: cartGrandTotal
      };

      const res = await fetch(`${API_BASE_URL}/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();

      if (res.ok) {
        showToast('Order created! Initiating PayHero M-Pesa STK Push prompt...', 'success');
        clearCart();
        
        // Launch PayHero Realtime Status Modal
        setActivePaymentModal({
          isOpen: true,
          orderId: data.orderId || data.order?.id,
          status: 'PENDING',
          receipt: null,
          reason: null,
          phoneNumber: checkoutData.stkPhoneNumber,
          amount: cartGrandTotal,
          isPolling: true
        });

        if (token) fetchMyOrders();
        setView('profile');
      } else {
        showToast(data.error || 'Failed to process checkout order', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Server error during checkout submission', 'error');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // ============================================================================
  // 11. ADMIN ACTIONS (LOCATION INSPECTOR, PRODUCT CRUD, USER & CONFIG)
  // ============================================================================

  const handleOpenLocationInspector = (loc: {
    county: string;
    town?: string;
    location?: string;
    sublocation?: string;
    streetAddress?: string;
    shippingAddress?: string;
    userName?: string;
    phoneNumber?: string;
    orderId?: number | string;
  }) => {
    setAdminLocationInspector({
      isOpen: true,
      data: loc
    });
  };

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
          imageUrl: newProduct.imageUrl || null,
          description: newProduct.description || '',
          isOrganic: newProduct.isOrganic
        })
      });

      if (res.ok) {
        showToast('New Mwea Rice product added to catalog!', 'success');
        setNewProduct({ brandName: '', variety: '', weightKg: '', basePrice: '', buyingPrice: '', flashSalePrice: '', stockQuantity: '', imageUrl: '', description: '', isOrganic: false });
        fetchProducts();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to add product', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving product', 'error');
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
        showToast('Failed to update product details', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating product', 'error');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!token || !confirm("Are you sure you want to remove this product from catalog?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showToast('Product deleted from store', 'info');
        fetchProducts();
      }
    } catch (err: any) {
      showToast('Failed to delete product', 'error');
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        showToast(`Order #${orderId} status set to ${status.toUpperCase()}`, 'success');
        fetchAdminOrders();
      }
    } catch (err: any) {
      showToast('Failed to update order status', 'error');
    }
  };

  const handleToggleUserSuspension = async (userId: number, currentSuspended: boolean) => {
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/suspend`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isSuspended: !currentSuspended })
      });

      if (res.ok) {
        showToast(`User account ${!currentSuspended ? 'suspended' : 'reactivated'}!`, 'info');
        fetchAdminUsers();
      }
    } catch (err: any) {
      showToast('Failed to change user account status', 'error');
    }
  };

  const handleSaveCountyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !countyOverrideForm.county || !countyOverrideForm.fee) return;

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
        showToast(`Transport fee for ${countyOverrideForm.county} set to KES ${countyOverrideForm.fee}`, 'success');
        fetchCountiesConfig();
        setCountyOverrideForm({ county: 'Nairobi', fee: '' });
      }
    } catch (err: any) {
      showToast('Failed to update county delivery rate', 'error');
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
        showToast('Mwea Rice homepage hero configurations saved!', 'success');
        fetchHero();
      }
    } catch (err: any) {
      showToast('Failed to update hero configurations', 'error');
    }
  };

  // CATALOG FILTER COMPUTATIONS
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = shopSearch === '' || 
        p.brandName.toLowerCase().includes(shopSearch.toLowerCase()) || 
        p.variety.toLowerCase().includes(shopSearch.toLowerCase());

      const matchesVariety = selectedVariety === 'All' || p.variety.toLowerCase() === selectedVariety.toLowerCase();
      const matchesWeight = selectedWeight === 'All' || String(p.weightKg) === selectedWeight;
      const effectivePrice = flashSale.active && p.flashSalePrice ? p.flashSalePrice : (p.basePrice || p.price || 0);
      const matchesPrice = effectivePrice <= maxPriceFilter;

      return matchesSearch && matchesVariety && matchesWeight && matchesPrice;
    });
  }, [products, shopSearch, selectedVariety, selectedWeight, maxPriceFilter, flashSale.active]);

  const uniqueVarieties = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.variety) set.add(p.variety); });
    return Array.from(set);
  }, [products]);

  const uniqueWeights = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.weightKg) set.add(String(p.weightKg)); });
    return Array.from(set);
  }, [products]);

  // Active Hero Media Computation
  const mediaList = useMemo(() => {
    return [
      { type: 'video', url: heroSettings?.video1 },
      { type: 'video', url: heroSettings?.video2 },
      { type: 'image', url: heroSettings?.img1 },
      { type: 'image', url: heroSettings?.img2 },
      { type: 'image', url: heroSettings?.img3 }
    ].filter(item => item.url && item.url.trim() !== '');
  }, [heroSettings]);

  const currentMedia = mediaList.length > 0 ? mediaList[activeHeroIndex % mediaList.length] : null;

  // ============================================================================
  // 12. RENDER LAYOUT
  // ============================================================================

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white flex flex-col">
      
      {/* TOAST FLOATING NOTIFICATIONS CONTAINER */}
      <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none max-w-sm w-full px-4 sm:px-0">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border backdrop-blur-md flex items-start gap-3 transition-all transform translate-x-0 animate-bounce-in ${
              toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200' :
              toast.type === 'error' ? 'bg-rose-950/90 border-rose-500 text-rose-200' :
              toast.type === 'warning' ? 'bg-amber-950/90 border-amber-500 text-amber-200' :
              'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Bell className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />}
            
            <div className="text-xs font-bold leading-relaxed flex-1">{toast.message}</div>
          </div>
        ))}
      </div>

      {/* GLOBAL HEADER / NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-emerald-900/50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Brand Logo & Title */}
          <div 
            onClick={() => setView('home')} 
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Leaf className="w-6 h-6 text-emerald-400 group-hover:rotate-12 transition-transform" />
              </div>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                Mwea Rice <span className="text-emerald-400 font-extrabold text-xs px-2 py-0.5 bg-emerald-950 rounded-full border border-emerald-800">DIRECT</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium block">Pure Aromatic Pishori Harvest</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700/60 text-xs font-bold">
            <button 
              onClick={() => setView('home')} 
              className={`px-4 py-2 rounded-xl transition-all ${view === 'home' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}`}
            >
              Home
            </button>
            <button 
              onClick={() => setView('shop')} 
              className={`px-4 py-2 rounded-xl transition-all ${view === 'shop' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}`}
            >
              Grain Catalog
            </button>
            <button 
              onClick={() => setView('cart')} 
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${view === 'cart' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}`}
            >
              <span>Cart</span>
              {cart.length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>

            {user?.role === 'admin' && (
              <button 
                onClick={() => setView('admin')} 
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${view === 'admin' ? 'bg-teal-600 text-white shadow-md' : 'text-teal-400 hover:text-white hover:bg-slate-700/50'}`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Hub</span>
              </button>
            )}
          </nav>

          {/* User Account Controls & Cart Quick Trigger */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setView('profile')}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all"
                >
                  <UserIcon className="w-4 h-4 text-emerald-400" />
                  <span>{user.fullName.split(' ')[0]}</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-800/80">
                    {user.rewardPoints || 0} pts
                  </span>
                </button>

                <button 
                  onClick={handleLogout}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => { setIsLogin(true); setView('login'); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In / Join</span>
              </button>
            )}
          </div>

          {/* Mobile Navigation Toggle Button */}
          <div className="flex md:hidden items-center gap-2">
            <button 
              onClick={() => setView('cart')} 
              className="p-2.5 rounded-xl bg-slate-800 text-emerald-400 relative"
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>

            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl bg-slate-800 text-slate-200"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-6 space-y-3 animate-fade-in">
            <button 
              onClick={() => { setView('home'); setMobileMenuOpen(false); }} 
              className="w-full text-left px-4 py-3 rounded-xl bg-slate-800/80 font-bold text-sm text-slate-200"
            >
              Home
            </button>
            <button 
              onClick={() => { setView('shop'); setMobileMenuOpen(false); }} 
              className="w-full text-left px-4 py-3 rounded-xl bg-slate-800/80 font-bold text-sm text-slate-200"
            >
              Grain Catalog
            </button>
            <button 
              onClick={() => { setView('cart'); setMobileMenuOpen(false); }} 
              className="w-full text-left px-4 py-3 rounded-xl bg-slate-800/80 font-bold text-sm text-slate-200 flex items-center justify-between"
            >
              <span>Shopping Cart</span>
              <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {cart.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            </button>

            {user?.role === 'admin' && (
              <button 
                onClick={() => { setView('admin'); setMobileMenuOpen(false); }} 
                className="w-full text-left px-4 py-3 rounded-xl bg-teal-950 border border-teal-800 font-bold text-sm text-teal-300"
              >
                Admin Hub
              </button>
            )}

            {user ? (
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <button 
                  onClick={() => { setView('profile'); setMobileMenuOpen(false); }}
                  className="w-full text-left px-4 py-3 rounded-xl bg-emerald-950/60 border border-emerald-800 font-bold text-sm text-emerald-300"
                >
                  My Account ({user.fullName})
                </button>
                <button 
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full text-left px-4 py-3 rounded-xl bg-rose-950/60 border border-rose-800 font-bold text-sm text-rose-300"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button 
                onClick={() => { setIsLogin(true); setView('login'); setMobileMenuOpen(false); }}
                className="w-full py-3 rounded-xl bg-emerald-600 font-extrabold text-sm text-white text-center shadow-lg"
              >
                Sign In / Register
              </button>
            )}
          </div>
        )}
      </header>

      {/* ANNOUNCEMENT TICKER BANNER */}
      {heroSettings?.enableLiveTicker && (
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-emerald-200 text-xs font-bold py-2.5 px-4 border-b border-emerald-800/40 overflow-hidden">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <span className="bg-rose-600 text-white font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider shrink-0 animate-pulse">
              ANNOUNCEMENT
            </span>
            <marquee className="text-slate-200 font-medium">
              {heroSettings?.announcementTicker}
            </marquee>
          </div>
        </div>
      )}

      {/* MAIN VIEW ROUTING CONTAINER */}
      <main className="flex-1">

        {/* ==================================================================== */}
        {/* VIEW 1: HOMEPAGE */}
        {/* ==================================================================== */}
        {view === 'home' && (
          <div className="space-y-16 pb-16">
            
            {/* DYNAMIC HERO BACKDROP SECTION */}
            <section className="relative overflow-hidden bg-slate-950 border-b border-slate-800" style={{ minHeight: heroSettings?.bannerHeight || '65vh' }}>
              
              {/* Media Background Renderer */}
              <div className="absolute inset-0 z-0">
                {currentMedia?.type === 'video' ? (
                  <iframe 
                    src={currentMedia.url} 
                    className="w-full h-full object-cover scale-125 pointer-events-none opacity-40"
                    allow="autoplay; encrypted-media"
                    title="Mwea Paddy Background"
                  />
                ) : currentMedia?.type === 'image' ? (
                  <img 
                    src={currentMedia.url} 
                    alt="Mwea Paddy Harvest" 
                    className="w-full h-full object-cover opacity-40 transition-opacity duration-1000"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950" />
                )}

                <div 
                  className="absolute inset-0 bg-slate-950" 
                  style={{ opacity: (Number(heroSettings?.overlayOpacity || 40) / 100) }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              </div>

              {/* Hero Content Overlay */}
              <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 flex flex-col justify-center h-full">
                <div className="max-w-2xl space-y-6">
                  
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-black tracking-wider uppercase backdrop-blur-md shadow-xl">
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
                    <span>{heroSettings?.badgeText}</span>
                  </div>

                  <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
                    {heroSettings?.title}
                  </h1>

                  <p className="text-base sm:text-xl text-slate-300 font-medium leading-relaxed">
                    {heroSettings?.subtitle}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 pt-4">
                    <button 
                      onClick={() => setView('shop')}
                      className="px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-emerald-600/30 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                      <span>{heroSettings?.ctaButtonText}</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>

                    <button 
                      onClick={() => {
                        if (user) setView('profile');
                        else { setIsLogin(true); setView('login'); }
                      }}
                      className="px-8 py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 font-extrabold text-sm sm:text-base backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                    >
                      {heroSettings?.secondaryButtonText}
                    </button>
                  </div>

                  {/* Trust indicator badges */}
                  <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-6 text-xs text-slate-400 font-semibold">
                    <span className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span>{heroSettings?.customerTrustBadgeText}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-teal-400" />
                      <span>{heroSettings?.expressLogisticsNote}</span>
                    </span>
                  </div>

                </div>
              </div>
            </section>

            {/* FLASH SALE TIMER BANNER */}
            {flashSale.active && (
              <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-amber-950 border border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                  <div className="space-y-2 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 bg-rose-600 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
                      <Zap className="w-4 h-4" /> FLASH SALE ACTIVE
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white">
                      Mwea Paddy Harvest Dispatched At Wholesale Prices!
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300">
                      Limited stock allocations running live across Kenya. Order now before prices return to base rate.
                    </p>
                  </div>

                  <div className="bg-slate-950/80 border border-rose-500/30 px-6 py-4 rounded-2xl text-center shadow-inner">
                    <div className="text-[10px] text-rose-300 font-bold uppercase tracking-widest mb-1">Offer Ends In</div>
                    <div className="text-2xl sm:text-3xl font-mono font-black text-rose-400 tracking-wider">
                      {formatCountdownMs(flashSale.msRemaining)}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* FEATURED PRODUCTS CATALOG PREVIEW */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-emerald-400 font-black text-xs uppercase tracking-widest">
                    Pure Grade Mwea Grain Selection
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-black text-white mt-1">
                    Featured Rice Harvest Sacks
                  </h2>
                </div>

                <button 
                  onClick={() => setView('shop')}
                  className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-extrabold text-sm transition-colors group"
                >
                  <span>View All Grade Allocations</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Grid of Product Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {products.slice(0, 8).map(product => (
                  <ProductCard 
                    key={product.id}
                    product={product}
                    flashActive={flashSale.active}
                    onAddToCart={() => addToCart(product)}
                    onQuickView={() => setQuickViewProduct(product)}
                  />
                ))}
              </div>
            </section>

            {/* WHY CHOOSE MWEA RICE DIRECT */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 space-y-8">
                <div className="text-center max-w-2xl mx-auto space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    Why Kenya Trusts Mwea Rice Direct
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Harvested from the fertile soils of Kirinyaga County, milled under strict grade control standards.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 w-fit">
                      <Leaf className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white">100% Pure Mwea Pishori</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Zero blend guarantee. Every single sack delivers genuine long-grain aromatic rice grown directly in Kirinyaga paddy fields.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">
                    <div className="p-3 bg-teal-500/10 rounded-xl text-teal-400 w-fit">
                      <Truck className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white">All 47 Counties Doorstep Express</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Integrated regional logistics network delivering direct to your house or business anywhere in Kenya with real-time tracking.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 w-fit">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Instant M-Pesa Verification</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Seamless PayHero STK push triggers prompt directly on your mobile handset with instant automated receipt confirmation.
                    </p>
                  </div>
                </div>
              </div>
            </section>

          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 2: GRAIN CATALOG / SHOP */}
        {/* ==================================================================== */}
        {view === 'shop' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
            
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black text-white">
                Mwea Rice Harvest Catalog
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Filter by grain variety, bag weight, or maximum price threshold.
              </p>
            </div>

            {/* Filter Bar Controls */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Search Box */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input 
                    type="text" 
                    placeholder="Search brand or variety..." 
                    value={shopSearch}
                    onChange={(e) => setShopSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Variety Dropdown */}
                <div>
                  <select 
                    value={selectedVariety}
                    onChange={(e) => setSelectedVariety(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="All">All Varieties</option>
                    {uniqueVarieties.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                {/* Weight Dropdown */}
                <div>
                  <select 
                    value={selectedWeight}
                    onChange={(e) => setSelectedWeight(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="All">All Bag Weights</option>
                    {uniqueWeights.map(w => (
                      <option key={w} value={w}>{w} kg Sacks</option>
                    ))}
                  </select>
                </div>

                {/* Max Price Filter */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400">
                    <span>Max Price:</span>
                    <span className="text-emerald-400">{formatKES(maxPriceFilter)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="500" 
                    max="20000" 
                    step="250" 
                    value={maxPriceFilter}
                    onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

              </div>
            </div>

            {/* Catalog Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-3xl space-y-3">
                <Package className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-sm text-slate-400">No Mwea Rice products match your selected filter criteria.</p>
                <button 
                  onClick={() => { setShopSearch(''); setSelectedVariety('All'); setSelectedWeight('All'); setMaxPriceFilter(15000); }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {filteredProducts.map(product => (
                  <ProductCard 
                    key={product.id}
                    product={product}
                    flashActive={flashSale.active}
                    onAddToCart={() => addToCart(product)}
                    onQuickView={() => setQuickViewProduct(product)}
                  />
                ))}
              </div>
            )}

          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 3: SHOPPING CART & REGIONAL CHECKOUT */}
        {/* ==================================================================== */}
        {view === 'cart' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
            <h1 className="text-3xl font-black text-white">Your Shopping Basket</h1>

            {cart.length === 0 ? (
              <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto" />
                <h2 className="text-xl font-bold text-white">Your cart is currently empty</h2>
                <p className="text-xs text-slate-400">Explore our catalog to add fresh Mwea Pishori sacks.</p>
                <button 
                  onClick={() => setView('shop')}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-xs"
                >
                  Browse Catalog
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Cart Items List */}
                <div className="lg:col-span-7 space-y-4">
                  {cart.map(item => {
                    const p = item.product || {};
                    const price = flashSale.active && p.flashSalePrice ? p.flashSalePrice : (p.basePrice || p.price || 0);

                    return (
                      <div key={item.productId} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <img 
                          src={p.imageUrl || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80'} 
                          alt={p.brandName} 
                          className="w-16 h-16 object-cover rounded-xl shrink-0"
                        />

                        <div className="flex-1">
                          <h3 className="font-bold text-white text-sm">{p.brandName}</h3>
                          <div className="text-xs text-slate-400">{p.variety} • {p.weightKg}kg Sack</div>
                          <div className="text-sm font-extrabold text-emerald-400 mt-1">{formatKES(price)}</div>
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                          <button 
                            onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                            className="p-1 hover:text-rose-400 text-slate-400"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold px-2">{item.quantity}</span>
                          <button 
                            onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                            className="p-1 hover:text-emerald-400 text-slate-400"
                          >
                            +
                          </button>
                        </div>

                        <button 
                          onClick={() => removeFromCart(item.productId)}
                          className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}

                  <div className="flex justify-between items-center pt-2">
                    <button 
                      onClick={clearCart}
                      className="text-xs text-rose-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear Entire Cart
                    </button>
                  </div>
                </div>

                {/* Regional Checkout Summary Card */}
                <div className="lg:col-span-5 bg-slate-900 border border-emerald-900/60 rounded-3xl p-6 space-y-6 shadow-2xl h-fit">
                  <h2 className="text-xl font-black text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-emerald-400" />
                    <span>Regional Kenya Delivery</span>
                  </h2>

                  <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                    
                    {/* County Selector */}
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Select County (47 Counties)</label>
                      <select 
                        value={checkoutData.county}
                        onChange={(e) => setCheckoutData(prev => ({ ...prev, county: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      >
                        {ALL_47_COUNTIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Cascading Town, Location, Sublocation */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Town / Sub-County</label>
                        <select 
                          value={checkoutData.town}
                          onChange={(e) => setCheckoutData(prev => ({ ...prev, town: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                        >
                          {((REGIONAL_LOGISTICS_DATA[checkoutData.county as County] || DEFAULT_REGIONAL_LOGISTICS).towns).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Location / Ward</label>
                        <select 
                          value={checkoutData.location}
                          onChange={(e) => setCheckoutData(prev => ({ ...prev, location: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                        >
                          {((REGIONAL_LOGISTICS_DATA[checkoutData.county as County] || DEFAULT_REGIONAL_LOGISTICS).locations).map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Sublocation / Estate</label>
                        <select 
                          value={checkoutData.sublocation}
                          onChange={(e) => setCheckoutData(prev => ({ ...prev, sublocation: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                        >
                          {((REGIONAL_LOGISTICS_DATA[checkoutData.county as County] || DEFAULT_REGIONAL_LOGISTICS).sublocations).map(sl => (
                            <option key={sl} value={sl}>{sl}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Street / Landmark</label>
                        <input 
                          type="text" 
                          value={checkoutData.shippingAddress}
                          onChange={(e) => setCheckoutData(prev => ({ ...prev, shippingAddress: e.target.value }))}
                          placeholder="Building, house number or landmark"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                          required
                        />
                      </div>
                    </div>

                    {/* M-Pesa STK Push Phone Number Input */}
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">M-Pesa Express Phone Number</label>
                      <input 
                        type="tel" 
                        value={checkoutData.stkPhoneNumber}
                        onChange={(e) => setCheckoutData(prev => ({ ...prev, stkPhoneNumber: e.target.value }))}
                        placeholder="e.g. 0712345678"
                        className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2.5 text-xs text-emerald-300 font-mono font-bold focus:outline-none"
                        required
                      />
                    </div>

                    {/* Cost Calculations Breakdown */}
                    <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Cart Grain Subtotal:</span>
                        <span className="font-bold text-white">{formatKES(cartSubtotal)}</span>
                      </div>

                      <div className="flex justify-between text-slate-400">
                        <span>Shipping ({checkoutData.county}):</span>
                        <span className="font-bold text-teal-400">{formatKES(activeShippingFee)}</span>
                      </div>

                      <div className="flex justify-between text-slate-400">
                        <span>Expected Reward Points:</span>
                        <span className="font-bold text-amber-400">+{expectedRewardPoints} pts</span>
                      </div>

                      <div className="flex justify-between items-baseline text-base font-black text-white pt-2 border-t border-slate-800">
                        <span>Grand Total:</span>
                        <span className="text-emerald-400 text-xl">{formatKES(cartGrandTotal)}</span>
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={isCheckingOut}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:bg-slate-800 cursor-pointer"
                    >
                      {isCheckingOut ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Smartphone className="w-5 h-5" />
                          <span>Pay With M-Pesa STK Push</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 4: AUTHENTICATION (REGISTER & RESET PASSWORD VIA PHONE SMS OTP) */}
        {/* ==================================================================== */}
        {view === 'login' && (
          <div className="max-w-md mx-auto px-4 py-16">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              
              {/* Top Header */}
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <Leaf className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-black text-white">
                  {isForgotPassword 
                    ? 'Reset Password via SMS' 
                    : isLogin 
                    ? 'Sign In to Mwea Rice' 
                    : 'Register New Member'}
                </h1>
                <p className="text-xs text-slate-400">
                  {isForgotPassword 
                    ? 'Enter your phone number to receive an SMS OTP reset code' 
                    : isLogin 
                    ? 'Enter your phone number and password' 
                    : 'Create your account with instant SMS OTP phone verification'}
                </p>
              </div>

              {/* ---------------------------------------------------------------- */}
              {/* MODE A: FORGOT PASSWORD FLOW (PHONE NUMBER + SMS OTP) */}
              {/* ---------------------------------------------------------------- */}
              {isForgotPassword ? (
                <div>
                  {resetStep === 'request' ? (
                    <form onSubmit={handleRequestPasswordResetOtp} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">Registered Phone Number</label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input 
                            type="tel" 
                            placeholder="e.g. 0712345678" 
                            value={formData.phoneNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={isSendingResetOtp}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSendingResetOtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                        <span>Send Reset SMS OTP Code</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleResetPasswordWithPhone} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">Phone Number</label>
                        <input 
                          type="tel" 
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-emerald-400 block mb-1">SMS OTP Verification Code</label>
                        <input 
                          type="text" 
                          placeholder="Enter 6-digit SMS code" 
                          value={resetOtp}
                          onChange={(e) => setResetOtp(e.target.value)}
                          className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2.5 text-center text-sm font-mono font-bold text-emerald-300 tracking-widest"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">New Password</label>
                        <input 
                          type="password" 
                          placeholder="••••••••" 
                          value={formData.newPassword}
                          onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
                          required
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={isResettingPassword}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isResettingPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                        <span>Verify OTP & Set New Password</span>
                      </button>

                      {resendCountdown > 0 ? (
                        <div className="text-center text-[11px] text-slate-400">
                          Resend SMS OTP in <span className="text-emerald-400 font-bold">{resendCountdown}s</span>
                        </div>
                      ) : (
                        <button 
                          type="button" 
                          onClick={handleRequestPasswordResetOtp}
                          className="w-full text-center text-[11px] text-emerald-400 font-bold hover:underline"
                        >
                          Resend SMS OTP Code
                        </button>
                      )}
                    </form>
                  )}

                  <div className="pt-4 border-t border-slate-800 text-center">
                    <button 
                      onClick={() => { setIsForgotPassword(false); setIsLogin(true); setResetStep('request'); }}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </div>
              ) : isLogin ? (
                /* ---------------------------------------------------------------- */
                /* MODE B: STANDARD LOGIN FLOW */
                /* ---------------------------------------------------------------- */
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input 
                        type="tel" 
                        placeholder="e.g. 0712345678" 
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-300">Password</label>
                      <button 
                        type="button"
                        onClick={() => { setIsForgotPassword(true); setResetStep('request'); }}
                        className="text-[11px] text-emerald-400 font-bold hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <input 
                      type="password" 
                      placeholder="••••••••" 
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                      required
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg transition-all cursor-pointer"
                  >
                    Sign In
                  </button>

                  <div className="pt-4 border-t border-slate-800 text-center">
                    <span className="text-xs text-slate-400">New to Mwea Rice? </span>
                    <button 
                      type="button"
                      onClick={() => { setIsLogin(false); setSignupStep('details'); }}
                      className="text-xs text-emerald-400 font-bold hover:underline"
                    >
                      Register with SMS OTP
                    </button>
                  </div>
                </form>
              ) : (
                /* ---------------------------------------------------------------- */
                /* MODE C: NEW MEMBER REGISTRATION WITH SMS OTP */
                /* ---------------------------------------------------------------- */
                <div>
                  {signupStep === 'details' ? (
                    <form onSubmit={handleRequestSignupOtp} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">Full Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Michael Njoroge" 
                          value={formData.fullName}
                          onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">Phone Number (SMS OTP Dispatch)</label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input 
                            type="tel" 
                            placeholder="e.g. 0712345678" 
                            value={formData.phoneNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">Email Address (Optional)</label>
                        <input 
                          type="email" 
                          placeholder="e.g. name@example.com" 
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">Create Password</label>
                        <input 
                          type="password" 
                          placeholder="••••••••" 
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          required
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={isSendingSignupOtp}
                        className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSendingSignupOtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                        <span>Send SMS Registration OTP</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifySignupOtp} className="space-y-4">
                      <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-center">
                        <div className="text-[11px] text-slate-400">SMS OTP sent to:</div>
                        <div className="text-sm font-mono font-bold text-emerald-300">{formData.phoneNumber}</div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-emerald-400 block mb-1">Enter 6-Digit SMS Verification OTP</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 123456" 
                          value={signupOtp}
                          onChange={(e) => setSignupOtp(e.target.value)}
                          className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2.5 text-center text-base font-mono font-extrabold text-emerald-300 tracking-widest"
                          required
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={isVerifyingSignupOtp}
                        className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isVerifyingSignupOtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>Verify SMS OTP & Complete Registration</span>
                      </button>

                      <div className="flex justify-between items-center text-xs pt-2">
                        <button 
                          type="button" 
                          onClick={() => setSignupStep('details')}
                          className="text-slate-400 hover:text-white"
                        >
                          ← Change Details
                        </button>

                        {resendCountdown > 0 ? (
                          <span className="text-slate-400 font-mono">Resend in {resendCountdown}s</span>
                        ) : (
                          <button 
                            type="button"
                            onClick={handleRequestSignupOtp}
                            className="text-emerald-400 font-bold hover:underline"
                          >
                            Resend SMS OTP
                          </button>
                        )}
                      </div>
                    </form>
                  )}

                  <div className="pt-4 border-t border-slate-800 text-center">
                    <span className="text-xs text-slate-400">Already have an account? </span>
                    <button 
                      type="button"
                      onClick={() => setIsLogin(true)}
                      className="text-xs text-emerald-400 font-bold hover:underline"
                    >
                      Sign In
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 5: USER PROFILE & ORDER HISTORY */}
        {/* ==================================================================== */}
        {view === 'profile' && user && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
            
            {/* Profile Overview Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-black">
                  {user.fullName.charAt(0)}
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white">{user.fullName}</h1>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                    <span>{user.phoneNumber}</span>
                    {user.email && <span>• {user.email}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <Award className="w-8 h-8 text-amber-400" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mwea Reward Points</div>
                  <div className="text-xl font-black text-amber-300">{user.rewardPoints || 0} Points</div>
                </div>
              </div>
            </div>

            {/* My Orders Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                <span>My Grain Orders History</span>
              </h2>

              {myOrders.length === 0 ? (
                <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
                  <p className="text-xs text-slate-400">You haven't placed any orders yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myOrders.map(order => {
                    const payInfo = extractPaymentInfo(order);

                    return (
                      <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                          <div>
                            <span className="text-xs font-mono font-bold text-emerald-400">Order #{order.id}</span>
                            <span className="text-xs text-slate-500 ml-3">{new Date(order.createdAt).toLocaleDateString()}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                              payInfo.isPaid ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-amber-950 text-amber-300 border-amber-800'
                            }`}>
                              {payInfo.status}
                            </span>

                            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              {order.status}
                            </span>
                          </div>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-2">
                          {(order.items || []).map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <span className="text-slate-300 font-semibold">{item.brandName || item.name || 'Mwea Rice Sack'} ({item.quantity}x)</span>
                              <span className="font-mono text-slate-400">{formatKES(item.priceAtPurchase * item.quantity)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Address & Total */}
                        <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          
                          {/* Clickable Location Address to trigger Location Inspector */}
                          <button 
                            onClick={() => handleOpenLocationInspector({
                              county: order.county,
                              town: order.town,
                              location: order.location,
                              sublocation: order.sublocation,
                              streetAddress: order.streetAddress,
                              shippingAddress: order.shippingAddress,
                              userName: user.fullName,
                              phoneNumber: user.phoneNumber,
                              orderId: order.id
                            })}
                            className="text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 text-left transition-colors"
                          >
                            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="underline font-medium">{formatShippingAddress(order.shippingAddress)}</span>
                          </button>

                          <div className="text-right">
                            <span className="text-slate-400">Grand Total: </span>
                            <span className="text-base font-black text-emerald-400">{formatKES(order.grandTotal)}</span>
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

        {/* ==================================================================== */}
        {/* VIEW 6: ADMIN HUB & CONTROL PANEL (WITH FULL LOCATION INSPECTOR) */}
        {/* ==================================================================== */}
        {view === 'admin' && user?.role === 'admin' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
            
            {/* Top Admin Navigation Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <h1 className="text-3xl font-black text-white flex items-center gap-2">
                  <Shield className="w-7 h-7 text-emerald-400" />
                  <span>Mwea Rice Admin Engine</span>
                </h1>
                <p className="text-xs text-slate-400">Full system oversight: Catalog, Orders, User Locations, and Financial Engine</p>
              </div>

              {/* Admin Navigation Tabs */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
                <button 
                  onClick={() => setAdminTab('inventory')}
                  className={`px-3.5 py-2 rounded-xl transition-all ${adminTab === 'inventory' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Inventory
                </button>
                <button 
                  onClick={() => setAdminTab('orders')}
                  className={`px-3.5 py-2 rounded-xl transition-all ${adminTab === 'orders' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Orders & Delivery Locations
                </button>
                <button 
                  onClick={() => setAdminTab('users')}
                  className={`px-3.5 py-2 rounded-xl transition-all ${adminTab === 'users' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  User Directory
                </button>
                <button 
                  onClick={() => setAdminTab('finances')}
                  className={`px-3.5 py-2 rounded-xl transition-all ${adminTab === 'finances' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Financial Engine
                </button>
                <button 
                  onClick={() => setAdminTab('config')}
                  className={`px-3.5 py-2 rounded-xl transition-all ${adminTab === 'config' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  System Config
                </button>
              </div>
            </div>

            {/* TAB 1: INVENTORY MANAGEMENT */}
            {adminTab === 'inventory' && (
              <div className="space-y-8">
                
                {/* Add New Product Form */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <h2 className="text-lg font-extrabold text-white">Add New Mwea Rice Product</h2>

                  <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <input 
                      type="text" 
                      placeholder="Brand Name (e.g. Mwea Pure Pishori)" 
                      value={newProduct.brandName}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, brandName: e.target.value }))}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      required
                    />

                    <input 
                      type="text" 
                      placeholder="Variety (e.g. Grade 1 Aromatic)" 
                      value={newProduct.variety}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, variety: e.target.value }))}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      required
                    />

                    <input 
                      type="number" 
                      placeholder="Weight in Kg (e.g. 5, 10, 25)" 
                      value={newProduct.weightKg}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, weightKg: e.target.value }))}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      required
                    />

                    <input 
                      type="number" 
                      placeholder="Base Price (KES)" 
                      value={newProduct.basePrice}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, basePrice: e.target.value }))}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      required
                    />

                    <input 
                      type="number" 
                      placeholder="Buying Price (for Net Profit calc)" 
                      value={newProduct.buyingPrice}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, buyingPrice: e.target.value }))}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    />

                    <input 
                      type="number" 
                      placeholder="Flash Sale Price (Optional)" 
                      value={newProduct.flashSalePrice}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, flashSalePrice: e.target.value }))}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    />

                    <input 
                      type="number" 
                      placeholder="Stock Quantity" 
                      value={newProduct.stockQuantity}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, stockQuantity: e.target.value }))}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      required
                    />

                    <input 
                      type="url" 
                      placeholder="Image URL" 
                      value={newProduct.imageUrl}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, imageUrl: e.target.value }))}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    />

                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="organicCheck"
                        checked={newProduct.isOrganic}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, isOrganic: e.target.checked }))}
                        className="accent-emerald-500 w-4 h-4"
                      />
                      <label htmlFor="organicCheck" className="text-slate-300 font-bold">Certified Organic</label>
                    </div>

                    <div className="md:col-span-3">
                      <button 
                        type="submit"
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md"
                      >
                        Publish to Store Catalog
                      </button>
                    </div>
                  </form>
                </div>

                {/* Existing Catalog Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                      <tr>
                        <th className="p-4">Product</th>
                        <th className="p-4">Variety</th>
                        <th className="p-4">Weight</th>
                        <th className="p-4">Price</th>
                        <th className="p-4">Stock</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {products.map(p => (
                        <tr key={p.id} className="hover:bg-slate-800/50">
                          <td className="p-4 font-bold text-white flex items-center gap-2">
                            <img src={p.imageUrl || ''} alt="" className="w-8 h-8 rounded-lg object-cover bg-slate-800" />
                            <span>{p.brandName}</span>
                          </td>
                          <td className="p-4 text-slate-300">{p.variety}</td>
                          <td className="p-4 font-bold text-emerald-400">{p.weightKg} kg</td>
                          <td className="p-4 text-white font-mono">{formatKES(p.basePrice)}</td>
                          <td className="p-4 font-bold text-amber-400">{p.stockQuantity} units</td>
                          <td className="p-4 text-right space-x-2">
                            <button 
                              onClick={() => setEditingProduct(p)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* TAB 2: ORDERS MANAGEMENT & USER LOCATION INSPECTOR */}
            {adminTab === 'orders' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input 
                      type="text" 
                      placeholder="Filter orders by ID, user, county..." 
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                      <tr>
                        <th className="p-4">Order ID</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Entered Location Details</th>
                        <th className="p-4">Total</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {adminOrders
                        .filter(o => 
                          String(o.id).includes(orderSearchQuery) || 
                          o.county?.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
                          o.User?.fullName?.toLowerCase().includes(orderSearchQuery.toLowerCase())
                        )
                        .map(order => (
                          <tr key={order.id} className="hover:bg-slate-800/50">
                            <td className="p-4 font-mono font-bold text-emerald-400">#{order.id}</td>
                            <td className="p-4 font-bold text-white">
                              <div>{order.User?.fullName || 'Guest Customer'}</div>
                              <div className="text-[10px] text-slate-400">{order.mpesaPhoneNumber || order.User?.phoneNumber}</div>
                            </td>
                            
                            {/* Detailed Location Button */}
                            <td className="p-4">
                              <button 
                                onClick={() => handleOpenLocationInspector({
                                  county: order.county,
                                  town: order.town,
                                  location: order.location,
                                  sublocation: order.sublocation,
                                  streetAddress: order.streetAddress,
                                  shippingAddress: order.shippingAddress,
                                  userName: order.User?.fullName,
                                  phoneNumber: order.mpesaPhoneNumber || order.User?.phoneNumber,
                                  orderId: order.id
                                })}
                                className="px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-bold text-[11px] flex items-center gap-1.5 transition-colors"
                              >
                                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Inspect Location ({order.county})</span>
                              </button>
                            </td>

                            <td className="p-4 font-mono font-bold text-white">{formatKES(order.grandTotal)}</td>
                            <td className="p-4">
                              <select 
                                value={order.status}
                                onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-extrabold text-slate-200"
                              >
                                <option value="pending">PENDING</option>
                                <option value="processing">PROCESSING</option>
                                <option value="dispatched">DISPATCHED</option>
                                <option value="delivered">DELIVERED</option>
                                <option value="cancelled">CANCELLED</option>
                              </select>
                            </td>

                            <td className="p-4 text-right">
                              <span className="text-[10px] font-mono text-slate-400">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: USER DIRECTORY & USER LOCATIONS */}
            {adminTab === 'users' && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                      <tr>
                        <th className="p-4">User</th>
                        <th className="p-4">Phone Number</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Reward Points</th>
                        <th className="p-4">Default Location</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {adminUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-800/50">
                          <td className="p-4 font-bold text-white">{u.fullName}</td>
                          <td className="p-4 font-mono text-slate-300">{u.phoneNumber}</td>
                          <td className="p-4 uppercase font-bold text-emerald-400">{u.role}</td>
                          <td className="p-4 font-bold text-amber-300">{u.rewardPoints || 0} pts</td>
                          
                          {/* Location inspection trigger for user default address */}
                          <td className="p-4">
                            <button 
                              onClick={() => handleOpenLocationInspector({
                                county: u.county || 'Nairobi',
                                town: u.town,
                                location: u.location,
                                sublocation: u.sublocation,
                                streetAddress: u.streetAddress,
                                userName: u.fullName,
                                phoneNumber: u.phoneNumber
                              })}
                              className="text-xs text-teal-400 hover:underline font-bold flex items-center gap-1"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span>View Entered Location</span>
                            </button>
                          </td>

                          <td className="p-4 text-right">
                            <button 
                              onClick={() => handleToggleUserSuspension(u.id, !!u.isSuspended)}
                              className={`px-3 py-1 rounded-lg font-bold text-[10px] ${
                                u.isSuspended ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                              }`}
                            >
                              {u.isSuspended ? 'Reactivate' : 'Suspend'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: FINANCIAL ENGINE */}
            {adminTab === 'finances' && (
              <FinancialGrowthChart 
                monthlyData={financialData?.monthlyBreakdown || []}
                selectedYear={financeYear}
                availableYears={financialData?.availableYears || [2024, 2025, 2026, 2027]}
                onYearChange={(yr) => { setFinanceYear(yr); fetchFinancialAnalytics(yr); }}
              />
            )}

            {/* TAB 5: SYSTEM CONFIGURATION */}
            {adminTab === 'config' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* County Shipping Override Form */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <h2 className="text-lg font-bold text-white">County Transport Rates Override</h2>

                  <form onSubmit={handleSaveCountyOverride} className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1 font-bold">Select County</label>
                      <select 
                        value={countyOverrideForm.county}
                        onChange={(e) => setCountyOverrideForm(prev => ({ ...prev, county: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      >
                        {ALL_47_COUNTIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1 font-bold">Override Delivery Fee (KES)</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 350" 
                        value={countyOverrideForm.fee}
                        onChange={(e) => setCountyOverrideForm(prev => ({ ...prev, fee: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                        required
                      />
                    </div>

                    <button 
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold"
                    >
                      Save Transport Rate
                    </button>
                  </form>
                </div>

                {/* Homepage Hero Settings Form */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <h2 className="text-lg font-bold text-white">Homepage Hero Banner Controls</h2>

                  <form onSubmit={handleSaveHeroSettings} className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1 font-bold">Main Banner Title</label>
                      <input 
                        type="text" 
                        value={heroSettings.title}
                        onChange={(e) => setHeroSettings(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1 font-bold">Live Ticker Announcement</label>
                      <input 
                        type="text" 
                        value={heroSettings.announcementTicker}
                        onChange={(e) => setHeroSettings(prev => ({ ...prev, announcementTicker: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold"
                    >
                      Save Hero Settings
                    </button>
                  </form>
                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* ==================================================================== */}
      {/* GLOBAL MODALS */}
      {/* ==================================================================== */}

      {/* 1. ADMIN LOCATION INSPECTOR MODAL */}
      <AdminLocationModal 
        isOpen={adminLocationInspector.isOpen}
        onClose={() => setAdminLocationInspector({ isOpen: false, data: null })}
        locationDetails={adminLocationInspector.data}
      />

      {/* 2. PAYHERO REAL-TIME STK PUSH PAYMENT STATUS MODAL */}
      {activePaymentModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-emerald-500/40 w-full max-w-md rounded-3xl p-6 shadow-2xl text-center space-y-6">
            
            {activePaymentModal.status === 'PENDING' ? (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <Smartphone className="w-8 h-8 animate-bounce" />
                </div>
                <h3 className="text-xl font-black text-white">M-Pesa Prompt Dispatched!</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Please check handset <span className="font-mono font-bold text-emerald-300">{activePaymentModal.phoneNumber}</span> and enter your M-Pesa PIN to complete payment of <span className="font-bold text-white">{formatKES(activePaymentModal.amount)}</span>.
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Polling PayHero backend status...</span>
                </div>
              </div>
            ) : activePaymentModal.status === 'PAID' ? (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-white">Payment Confirmed!</h3>
                <p className="text-xs text-slate-300">
                  M-Pesa Receipt Code: <span className="font-mono font-black text-emerald-300">{activePaymentModal.receipt || 'CONFIRMED'}</span>
                </p>
                <button 
                  onClick={() => setActivePaymentModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-extrabold text-xs"
                >
                  Close & View Order Status
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center mx-auto text-rose-400">
                  <XCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-white">Payment Cancelled</h3>
                <p className="text-xs text-slate-300">
                  Reason: {activePaymentModal.reason || 'Transaction declined on handset'}
                </p>
                <button 
                  onClick={() => setActivePaymentModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-full py-3 rounded-2xl bg-slate-800 text-slate-200 font-extrabold text-xs"
                >
                  Dismiss
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* QUICK VIEW PRODUCT MODAL */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 relative">
            <button 
              onClick={() => setQuickViewProduct(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <img 
              src={quickViewProduct.imageUrl || ''} 
              alt={quickViewProduct.brandName} 
              className="w-full h-48 object-cover rounded-2xl"
            />

            <div>
              <span className="text-xs text-emerald-400 font-bold uppercase">{quickViewProduct.variety}</span>
              <h3 className="text-xl font-black text-white">{quickViewProduct.brandName}</h3>
              <p className="text-xs text-slate-400 mt-1">{quickViewProduct.description || '100% Pure Grade Aromatic Mwea Pishori Harvest.'}</p>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <span className="text-xl font-black text-emerald-400">{formatKES(quickViewProduct.basePrice)}</span>
              <button 
                onClick={() => { addToCart(quickViewProduct); setQuickViewProduct(null); }}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs"
              >
                Add To Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-800 py-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <span className="text-lg font-black text-white flex items-center gap-2">
              <Leaf className="w-5 h-5 text-emerald-400" /> Mwea Rice Direct
            </span>
            <p className="text-slate-400">
              Direct paddy field harvesting and grain distribution across all 47 Counties of Kenya.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white mb-3 uppercase tracking-wider">Quick Navigation</h4>
            <ul className="space-y-2">
              <li><button onClick={() => setView('home')} className="hover:text-white">Home Page</button></li>
              <li><button onClick={() => setView('shop')} className="hover:text-white">Grain Catalog</button></li>
              <li><button onClick={() => setView('cart')} className="hover:text-white">Shopping Cart</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-3 uppercase tracking-wider">Logistics & Support</h4>
            <ul className="space-y-2">
              <li>Kirinyaga Milling Depot</li>
              <li>Hotline: {heroSettings?.supportHotlineDisplay}</li>
              <li>PayHero M-Pesa STK push integrated</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-3 uppercase tracking-wider">Mwea Rice Direct</h4>
            <p className="text-slate-500">
              © {new Date().getFullYear()} Mwea Rice. All rights reserved. Kirinyaga County, Kenya.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
