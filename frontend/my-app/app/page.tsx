"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  ShoppingCart, User as UserIcon, LogIn, Menu, X, Plus, 
  Trash2, Shield, Clock, Search, Edit, Package, Activity, 
  CheckCircle, AlertCircle, Settings, Leaf, ChevronRight, ChevronLeft,
  ShoppingBag, Users, Image as ImageIcon, Video, Download,
  MapPin, Eye, RefreshCw, LogOut, Check, AlertTriangle, 
  Smartphone, Truck, CreditCard, BarChart2, DollarSign, 
  Award, Calendar, Lock, Unlock, TrendingUp, Filter, 
  FileText, Percent, Layers, Globe, Sliders, Bell, ArrowRight,
  UserCheck, UserX, Ban, HelpCircle, ChevronDown, MoreVertical,
  ArrowUpRight, ArrowDownRight, RefreshCcw, Save, ExternalLink
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// ============================================================================
// 1. TYPES & INTERFACES DEFINITIONS
// ============================================================================

export interface Product {
  id: number;
  brandName: string;
  variety: string;
  weightKg: number;
  basePrice: number;
  price?: number;
  buyingPrice?: number;
  flashSalePrice?: number;
  stockQuantity: number;
  imageUrl: string;
  description?: string;
  isOrganic?: boolean;
  grade?: string;
  originLocation?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  productId: number;
  quantity: number;
  product: Product;
}

export interface UserAccount {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: 'admin' | 'customer' | 'staff';
  status: 'active' | 'suspended' | 'pending';
  rewardPoints: number;
  county?: string;
  town?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface OrderItem {
  id?: number;
  productId: number;
  brandName: string;
  variety: string;
  quantity: number;
  priceAtPurchase: number;
}

export interface PaymentDetails {
  isPaid: boolean;
  paidTag: 'PAID' | 'PENDING' | 'FAILED';
  mpesaReceipt?: string;
  failureReason?: string;
  method?: string;
  paidAt?: string;
}

export interface Order {
  id: number;
  userId: number;
  User?: UserAccount;
  items: OrderItem[];
  grandTotal: number;
  shippingFee: number;
  county: string;
  town?: string;
  location?: string;
  sublocation?: string;
  streetAddress?: string;
  shippingAddress: string;
  status: 'pending' | 'processing' | 'dispatched' | 'delivered' | 'cancelled';
  paymentDetails: PaymentDetails;
  createdAt: string;
}

export interface AuditLogEntry {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  action: string;
  resource: string;
  ipAddress: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  details: string;
}

export interface MonthlyFinancialMetric {
  month: string;
  year: number;
  totalRevenue: number;
  buyingCost: number;
  netProfit: number;
  bagsSold: number;
  unitsPurchased: number;
  growthPercentage: number;
}

export interface LogisticsCountyConfig {
  countyName: string;
  baseFee: number;
  deliveryEstDays: string;
  isActive: boolean;
  towns: string[];
  locations: string[];
  sublocations: string[];
  streets: string[];
}

export interface HeroSettingsConfig {
  title: string;
  subtitle: string;
  video1: string;
  video2: string;
  img1: string;
  img2: string;
  img3: string;
  ctaButtonText: string;
  badgeText: string;
  overlayOpacity: string;
  secondaryButtonText: string;
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

// ============================================================================
// 2. CONSTANTS, MOCK DATA & REGIONAL DATA
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL 
  ? `${process.env.NEXT_PUBLIC_API_URL}/api` 
  : 'https://premium-rice-store-7.onrender.com/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL 
  || 'https://premium-rice-store-7.onrender.com';

const ALL_47_COUNTIES = [
  "Mombasa", "Kwale", "Kilifi", "Tana River", "Lamu", "Taita-Taveta", "Garissa", "Wajir", "Mandera", "Marsabit", 
  "Isiolo", "Meru", "Tharaka-Nithi", "Embu", "Kitui", "Machakos", "Makueni", "Nyandarua", "Nyeri", "Kirinyaga", 
  "Murang'a", "Kiambu", "Turkana", "West Pokot", "Samburu", "Trans-Nzoia", "Uasin Gishu", "Elgeyo-Marakwet", "Nandi", "Baringo", 
  "Laikipia", "Nakuru", "Narok", "Kajiado", "Kericho", "Bomet", "Kakamega", "Vihiga", "Bungoma", "Busia", 
  "Siaya", "Kisumu", "Homa Bay", "Migori", "Kisii", "Nyamira", "Nairobi"
];

const REGIONAL_LOGISTICS_DATA: { [key: string]: { towns: string[], locations: string[], sublocations: string[], streets: string[] } } = {
  "Nairobi": {
    towns: ["Westlands", "Kasarani", "Lang'ata", "Starehe", "Dagoretti", "Embakasi", "Makadara", "Kamukunji", "Roysambu", "Mathare"],
    locations: ["Kilimani", "Kasarani Central", "Karen", "CBD", "Upper Hill", "Industrial Area", "Eastleigh", "Buruburu", "South C", "Runda"],
    sublocations: ["Mwiki", "Roysambu Sub", "Lavington", "Hurlingham", "South B", "Imara Daima", "Kileleshwa", "Parklands", "Donholm", "Pipeline"],
    streets: ["Moi Avenue", "Kenyatta Avenue", "Waiyaki Way", "Thika Road Landmark", "Ngong Road", "Enterprise Road", "Argwings Kodhek", "Jogoo Road", "Mombasa Road"]
  },
  "Kirinyaga": {
    towns: ["Mwea East", "Mwea West", "Kerugoya", "Sagana", "Wanguru", "Gichugu", "Ndia"],
    locations: ["Tebere", "Nyumpa", "Thiba", "Murinduko", "Mutithi", "Kagio", "Kutus"],
    sublocations: ["Kimbimbi", "Nice Digital City", "Ngurubani", "Makutano", "Kagio Center", "Difatha", "Wamumu"],
    streets: ["Wanguru Main Street", "Rice Mills Road", "Sagana Highway", "Kimbimbi Stage", "Hospital Road", "Kutus Main Highway", "Embu-Nairobi Road"]
  },
  "Kiambu": {
    towns: ["Thika", "Ruiru", "Githunguri", "Kikuyu", "Limuru", "Kiambu Town", "Juja", "Kabete"],
    locations: ["Juja Central", "Kahawa Wendani", "Kahawa Sukari", "Ndumberi", "Banana", "Ruaka", "Kiambaa"],
    sublocations: ["Witeithie", "Membley", "Zimmerman Border", "Muchatha", "Tigoni", "Gachie", "Anmer"],
    streets: ["Superhighway Frontage", "Biashara Street", "Garissa Road", "Northern Bypass", "Kamiti Road", "Limuru Road", "Thika Main Street"]
  },
  "Mombasa": {
    towns: ["Nyali", "Mvita", "Kisauni", "Likoni", "Changamwe", "Jomvu"],
    locations: ["Bamburi", "Tudor", "Ganjoni", "Port Reitz", "Kongowea", "Shanzu", "Buxton"],
    sublocations: ["Mkomani", "Tononoka", "Mikindani", "Bamburi Mtambo", "Nyali Beach", "Magaoni", "Chaani"],
    streets: ["Moi Avenue Mombasa", "Nkrumah Road", "Links Road", "Malindi Road", "Mama Ngina Drive", "Digo Road", "Nyerere Avenue"]
  },
  "Nakuru": {
    towns: ["Nakuru East", "Nakuru West", "Naivasha", "Gilgil", "Molo", "Njoro", "Subukia"],
    locations: ["Lanet", "Milimani", "Section 58", "Kiamunyi", "Mai Mahiu", "Kenyatta West"],
    sublocations: ["Free Area", "Shabab", "White House", "Barnabas", "Pipeline Nakuru", "Karatunga"],
    streets: ["Kenyatta Avenue Nakuru", "Oginga Odinga Road", "Government Road", "Kanu Street", "Nairobi-Nakuru Highway"]
  },
  "Kisumu": {
    towns: ["Kisumu Central", "Kisumu East", "Kisumu West", "Nyando", "Muhoroni", "Seme"],
    locations: ["Milimani Kisumu", "Mamboleo", "Kenyatta", "Nyamasaria", "Otonglo", "Kondele"],
    sublocations: ["Manyatta", "Nyawita", "Migosi", "Polyview", "Tom Mboya", "Riat"],
    streets: ["Oginga Odinga Street", "Jomo Kenyatta Highway", "Accra Street", "Nyerere Road", "Kakamega Road"]
  }
};

const DEFAULT_REGIONAL_LOGISTICS = {
  towns: ["Central District / Town", "North District", "South District", "East District", "West District", "Municipal Center"],
  locations: ["Central Location", "Market Center", "Highway Junction", "Administrative Center", "Commercial Zone"],
  sublocations: ["Town Center Sub-location", "North Ward", "South Ward", "East Ward", "West Ward"],
  streets: ["Main Street / Highway", "Market Road", "Hospital Road", "School Lane", "Opposite Chief's Camp", "Supermarket Landmark"]
};

// Initial Sample Products
const INITIAL_PRODUCTS: Product[] = [
  {
    id: 101,
    brandName: "Royal Mwea Pishori Supreme",
    variety: "Pure Aromatic Pishori",
    weightKg: 25,
    basePrice: 3850,
    buyingPrice: 2800,
    flashSalePrice: 3450,
    stockQuantity: 140,
    imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    description: "100% Pure Grade-1 Grade aromatic long grain rice harvested directly from Kirinyaga Mwea paddy fields.",
    isOrganic: true,
    grade: "Grade 1 Super Premium",
    originLocation: "Mwea Tebere Section 3"
  },
  {
    id: 102,
    brandName: "Kilele Long Grain Basmati",
    variety: "Basmati Extra Long",
    weightKg: 10,
    basePrice: 1750,
    buyingPrice: 1300,
    flashSalePrice: 1550,
    stockQuantity: 85,
    imageUrl: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80",
    description: "Slender non-sticky aged basmati rice grains ideal for pilau and biryani dishes.",
    isOrganic: false,
    grade: "Grade 1 Export Quality",
    originLocation: "Ahero Irrigation Scheme"
  },
  {
    id: 103,
    brandName: "Kilimo Pure Mwea Special",
    variety: "Pure Aromatic Pishori",
    weightKg: 5,
    basePrice: 890,
    buyingPrice: 650,
    flashSalePrice: 790,
    stockQuantity: 210,
    imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    description: "Convenient 5kg family size bag of fragrant Mwea rice with sweet distinct aroma.",
    isOrganic: true,
    grade: "Grade 1",
    originLocation: "Mwea Wanguru"
  },
  {
    id: 104,
    brandName: "Gold Harvest Sindano Premium",
    variety: "Sindano Long Grain",
    weightKg: 50,
    basePrice: 6200,
    buyingPrice: 4700,
    flashSalePrice: 5800,
    stockQuantity: 42,
    imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    description: "Wholesale 50kg commercial bag tailored for restaurants, schools, and catering enterprises.",
    isOrganic: false,
    grade: "Commercial Grade A",
    originLocation: "Bura Irrigation Scheme"
  },
  {
    id: 105,
    brandName: "Mwea Pearl Fragrant Brown Rice",
    variety: "Whole Grain Brown Pishori",
    weightKg: 5,
    basePrice: 1100,
    buyingPrice: 780,
    flashSalePrice: 950,
    stockQuantity: 60,
    imageUrl: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80",
    description: "Unpolished nutrient-rich brown rice packed with dietary fiber and natural vitamins.",
    isOrganic: true,
    grade: "Organic Whole Grain",
    originLocation: "Mwea Organic Zone"
  },
  {
    id: 106,
    brandName: "Safari Jasmine Scented Grain",
    variety: "Jasmine Long Grain",
    weightKg: 10,
    basePrice: 1650,
    buyingPrice: 1200,
    flashSalePrice: 1480,
    stockQuantity: 95,
    imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    description: "Soft cooking fragrant jasmine grain with velvety texturing.",
    isOrganic: false,
    grade: "Grade 1 Scented",
    originLocation: "Tana River Valley"
  }
];

// Initial Sample Users
const INITIAL_USERS: UserAccount[] = [
  {
    id: 1,
    fullName: "Admin Officer Maina",
    email: "admin@mwearicehub.co.ke",
    phoneNumber: "0712345678",
    role: "admin",
    status: "active",
    rewardPoints: 450,
    county: "Nairobi",
    town: "Westlands",
    createdAt: "2026-01-10T08:30:00Z",
    lastLoginAt: "2026-09-15T12:00:00Z"
  },
  {
    id: 2,
    fullName: "Grace Wanjiru Mwangi",
    email: "gwanjiru@gmail.com",
    phoneNumber: "0722112233",
    role: "customer",
    status: "active",
    rewardPoints: 120,
    county: "Kirinyaga",
    town: "Kerugoya",
    createdAt: "2026-02-14T10:15:00Z",
    lastLoginAt: "2026-09-14T16:45:00Z"
  },
  {
    id: 3,
    fullName: "David Ochieng Otieno",
    email: "dochieng@yahoo.com",
    phoneNumber: "0733445566",
    role: "customer",
    status: "active",
    rewardPoints: 85,
    county: "Kisumu",
    town: "Kisumu Central",
    createdAt: "2026-03-01T11:20:00Z",
    lastLoginAt: "2026-09-10T09:12:00Z"
  },
  {
    id: 4,
    fullName: "Samuel Kipchumba Bett",
    email: "skbett@outlook.com",
    phoneNumber: "0711998877",
    role: "customer",
    status: "suspended",
    rewardPoints: 10,
    county: "Uasin Gishu",
    town: "Eldoret",
    createdAt: "2026-04-12T14:00:00Z",
    lastLoginAt: "2026-08-20T11:00:00Z"
  },
  {
    id: 5,
    fullName: "Amina Hassan Mohamed",
    email: "amina.m@gmail.com",
    phoneNumber: "0700554433",
    role: "customer",
    status: "active",
    rewardPoints: 210,
    county: "Mombasa",
    town: "Nyali",
    createdAt: "2026-05-05T09:00:00Z",
    lastLoginAt: "2026-09-15T10:30:00Z"
  }
];

// Initial Monthly Financial Performance Graph Data
const INITIAL_FINANCIAL_MONTHS: MonthlyFinancialMetric[] = [
  { month: "Jan", year: 2026, totalRevenue: 420000, buyingCost: 290000, netProfit: 130000, bagsSold: 140, unitsPurchased: 160, growthPercentage: 8.5 },
  { month: "Feb", year: 2026, totalRevenue: 510000, buyingCost: 350000, netProfit: 160000, bagsSold: 175, unitsPurchased: 190, growthPercentage: 12.2 },
  { month: "Mar", year: 2026, totalRevenue: 480000, buyingCost: 330000, netProfit: 150000, bagsSold: 160, unitsPurchased: 170, growthPercentage: -5.8 },
  { month: "Apr", year: 2026, totalRevenue: 630000, buyingCost: 430000, netProfit: 200000, bagsSold: 210, unitsPurchased: 230, growthPercentage: 31.2 },
  { month: "May", year: 2026, totalRevenue: 720000, buyingCost: 490000, netProfit: 230000, bagsSold: 245, unitsPurchased: 260, growthPercentage: 14.3 },
  { month: "Jun", year: 2026, totalRevenue: 690000, buyingCost: 470000, netProfit: 220000, bagsSold: 230, unitsPurchased: 250, growthPercentage: -4.1 },
  { month: "Jul", year: 2026, totalRevenue: 810000, buyingCost: 550000, netProfit: 260000, bagsSold: 275, unitsPurchased: 290, growthPercentage: 17.4 },
  { month: "Aug", year: 2026, totalRevenue: 950000, buyingCost: 640000, netProfit: 310000, bagsSold: 320, unitsPurchased: 350, growthPercentage: 17.2 },
  { month: "Sep", year: 2026, totalRevenue: 1080000, buyingCost: 720000, netProfit: 360000, bagsSold: 365, unitsPurchased: 400, growthPercentage: 13.6 }
];

// Initial Audit Trail Logs with explicit User Names
const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 9001,
    userId: 1,
    userName: "Admin Officer Maina",
    userEmail: "admin@mwearicehub.co.ke",
    action: "UPDATE_PRODUCT_CATALOG",
    resource: "Product #101 (Royal Mwea Pishori)",
    ipAddress: "197.232.88.12",
    severity: "info",
    timestamp: "2026-09-15 13:42:10",
    details: "Modified base price from KES 3,900 to KES 3,850 and adjusted stock to 140 units."
  },
  {
    id: 9002,
    userId: 2,
    userName: "Grace Wanjiru Mwangi",
    userEmail: "gwanjiru@gmail.com",
    action: "PLACE_ORDER_STK",
    resource: "Order #5502",
    ipAddress: "41.215.170.4",
    severity: "info",
    timestamp: "2026-09-15 12:15:44",
    details: "Initiated PayHero M-Pesa STK push for 2x Royal Mwea 25kg sacks to Kerugoya."
  },
  {
    id: 9003,
    userId: 1,
    userName: "Admin Officer Maina",
    userEmail: "admin@mwearicehub.co.ke",
    action: "SUSPEND_USER_ACCOUNT",
    resource: "User Account #4 (Samuel Kipchumba Bett)",
    ipAddress: "197.232.88.12",
    severity: "warning",
    timestamp: "2026-09-14 16:20:05",
    details: "Suspended user account pending verification of payment disputes."
  },
  {
    id: 9004,
    userId: 5,
    userName: "Amina Hassan Mohamed",
    userEmail: "amina.m@gmail.com",
    action: "UPDATE_SHIPPING_ADDRESS",
    resource: "User Profile #5",
    ipAddress: "102.166.40.91",
    severity: "info",
    timestamp: "2026-09-14 11:05:19",
    details: "Updated primary delivery county preference to Mombasa Nyali."
  },
  {
    id: 9005,
    userId: 1,
    userName: "Admin Officer Maina",
    userEmail: "admin@mwearicehub.co.ke",
    action: "OVERRIDE_REGIONAL_FREIGHT",
    resource: "Logistics Config (Mombasa County)",
    ipAddress: "197.232.88.12",
    severity: "warning",
    timestamp: "2026-09-13 14:00:00",
    details: "Updated base regional freight rate for Mombasa county from KES 450 to KES 400."
  }
];

// Helper Utility to format Currency KES
const formatKES = (amount: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(amount || 0);
};

// Helper Utility to Format Shipping Address cleanly
const formatShippingAddress = (addr: any) => {
  if (!addr) return 'Standard Regional Delivery';
  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object') {
    return addr.streetAddress || addr.details || addr.location || [addr.town, addr.county].filter(Boolean).join(', ') || JSON.stringify(addr);
  }
  return String(addr);
};

// Extract clean payment status tag and details
const extractPaymentInfo = (order: any) => {
  if (!order) return { status: 'PENDING', isPaid: false, receipt: null, reason: null, method: 'M-Pesa STK' };
  
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

// ============================================================================
// 3. SUB-COMPONENTS (CHARTS, MODALS, CARDS)
// ============================================================================

/**
 * FINANCIAL MONTHLY GROWTH CHART (SVG & CSS Bar Graph)
 */
const FinancialGrowthChart: React.FC<{
  data: MonthlyFinancialMetric[];
  selectedMetric: 'revenue' | 'profit' | 'bags';
  onMetricChange: (m: 'revenue' | 'profit' | 'bags') => void;
}> = ({ data, selectedMetric, onMetricChange }) => {
  const maxVal = useMemo(() => {
    return Math.max(...data.map(d => {
      if (selectedMetric === 'revenue') return d.totalRevenue;
      if (selectedMetric === 'profit') return d.netProfit;
      return d.bagsSold;
    }), 1);
  }, [data, selectedMetric]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <BarChart2 className="w-4 h-4" />
            <span>Monthly Product Purchase Growth Engine</span>
          </div>
          <h4 className="text-xl font-black text-white mt-1">Product Purchasing & Revenue Graph</h4>
        </div>

        {/* Metric Selector Buttons */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          <button 
            onClick={() => onMetricChange('revenue')} 
            className={`px-3 py-1.5 rounded-lg transition-all ${selectedMetric === 'revenue' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Revenue (KES)
          </button>
          <button 
            onClick={() => onMetricChange('profit')} 
            className={`px-3 py-1.5 rounded-lg transition-all ${selectedMetric === 'profit' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Net Profit
          </button>
          <button 
            onClick={() => onMetricChange('bags')} 
            className={`px-3 py-1.5 rounded-lg transition-all ${selectedMetric === 'bags' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Grains Sold (Sacks)
          </button>
        </div>
      </div>

      {/* Bar Chart Visualization */}
      <div className="pt-4">
        <div className="h-64 flex items-end justify-between gap-2 sm:gap-4 px-2">
          {data.map((item, idx) => {
            const currentVal = selectedMetric === 'revenue' 
              ? item.totalRevenue 
              : selectedMetric === 'profit' 
              ? item.netProfit 
              : item.bagsSold;

            const heightPct = Math.round((currentVal / maxVal) * 100);

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                
                {/* Tooltip Hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-14 bg-slate-950 text-white text-[10px] p-2 rounded-xl border border-slate-700 shadow-2xl pointer-events-none z-20 whitespace-nowrap text-center">
                  <p className="font-bold text-emerald-400">{item.month} {item.year}</p>
                  <p className="font-extrabold">{selectedMetric === 'bags' ? `${item.bagsSold} Sacks` : formatKES(currentVal)}</p>
                  <p className="text-slate-400 text-[9px]">Cost: {formatKES(item.buyingCost)}</p>
                </div>

                {/* Growth indicator percentage */}
                <span className={`text-[10px] font-extrabold ${item.growthPercentage >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {item.growthPercentage >= 0 ? `+${item.growthPercentage}%` : `${item.growthPercentage}%`}
                </span>

                {/* Vertical Bar */}
                <div className="w-full bg-slate-800 rounded-t-xl overflow-hidden h-48 flex items-end">
                  <div 
                    style={{ height: `${heightPct}%` }}
                    className={`w-full transition-all duration-700 rounded-t-xl group-hover:brightness-125 ${
                      selectedMetric === 'revenue' 
                        ? 'bg-gradient-to-t from-emerald-700 to-emerald-400' 
                        : selectedMetric === 'profit' 
                        ? 'bg-gradient-to-t from-teal-700 to-teal-300' 
                        : 'bg-gradient-to-t from-amber-600 to-amber-400'
                    }`}
                  />
                </div>

                {/* Month Label */}
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart Footer Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-800 pt-4 text-xs">
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
          <span className="text-slate-500 font-bold">Peak Selling Month</span>
          <p className="text-white font-extrabold text-sm mt-0.5">September 2026 (365 Sacks)</p>
        </div>
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
          <span className="text-slate-500 font-bold">Average Monthly Growth</span>
          <p className="text-emerald-400 font-extrabold text-sm mt-0.5">+12.4% MoM</p>
        </div>
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
          <span className="text-slate-500 font-bold">YTD Total Profit</span>
          <p className="text-teal-400 font-extrabold text-sm mt-0.5">{formatKES(data.reduce((acc, curr) => acc + curr.netProfit, 0))}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * RESPONSIVE PRODUCT CARD COMPONENT
 * Small screens: 2 per row (grid-cols-2)
 * Large screens: 4 per row (lg:grid-cols-4)
 */
const ProductCard: React.FC<{
  product: Product;
  flashActive: boolean;
  onAddToCart: () => void;
  onQuickView: () => void;
}> = ({ product, flashActive, onAddToCart, onQuickView }) => {
  const effectivePrice = flashActive && product.flashSalePrice 
    ? product.flashSalePrice 
    : (product.basePrice || product.price || 0);

  const discountAmount = product.basePrice && product.flashSalePrice && flashActive
    ? Math.round(((product.basePrice - product.flashSalePrice) / product.basePrice) * 100)
    : null;

  return (
    <div className="group bg-white rounded-3xl border border-emerald-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden relative transform hover:-translate-y-1">
      
      {/* Badges Overlay */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
        {discountAmount && (
          <span className="bg-rose-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full shadow-md uppercase tracking-wider animate-pulse">
            {discountAmount}% OFF
          </span>
        )}
        {product.isOrganic && (
          <span className="bg-emerald-700 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
            <Leaf className="w-2.5 h-2.5" /> Pure Mwea
          </span>
        )}
      </div>

      <div>
        {/* Product Image Wrapper */}
        <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-slate-100 cursor-pointer" onClick={onQuickView}>
          <img 
            src={product.imageUrl || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80'} 
            alt={product.brandName} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/0 transition-colors" />
          
          <button 
            onClick={(e) => { e.stopPropagation(); onQuickView(); }}
            className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-md p-2 rounded-xl text-slate-700 hover:text-emerald-700 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            title="Quick View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>

        {/* Content Section */}
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span>{product.variety}</span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">{product.weightKg} kg Sack</span>
          </div>

          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2 hover:text-emerald-700 cursor-pointer" onClick={onQuickView}>
            {product.brandName}
          </h3>

          <p className="text-[11px] text-slate-500 line-clamp-1">
            {product.description || "Direct from Mwea irrigation paddy fields."}
          </p>
        </div>
      </div>

      {/* Pricing & CTA Button */}
      <div className="p-4 pt-0 border-t border-slate-100 mt-2 space-y-3">
        <div className="flex items-baseline justify-between pt-3">
          <div>
            <span className="text-lg sm:text-xl font-black text-emerald-800">
              {formatKES(effectivePrice)}
            </span>
            {flashActive && product.basePrice && product.flashSalePrice && (
              <span className="text-xs font-semibold text-slate-400 line-through ml-2">
                {formatKES(product.basePrice)}
              </span>
            )}
          </div>
          <span className={`text-[10px] font-bold ${product.stockQuantity > 10 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : 'Out of Stock'}
          </span>
        </div>

        <button 
          onClick={onAddToCart}
          disabled={product.stockQuantity <= 0}
          className="w-full py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm transition-all shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Add To Cart</span>
        </button>
      </div>

    </div>
  );
};

/**
 * EDIT PRODUCT MODAL (ADMIN CATALOGUE EDIT FOR ALL PRODUCTS)
 */
const EditProductModal: React.FC<{
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Product) => void;
}> = ({ product, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState<Product>({ ...product });

  useEffect(() => {
    setFormData({ ...product });
  }, [product]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative my-8">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <Edit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Edit Catalog Grain Product</h3>
              <p className="text-xs text-slate-400">Modify product details for Product ID #{product.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Brand Name</label>
              <input 
                type="text" 
                required
                value={formData.brandName}
                onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Rice Variety</label>
              <input 
                type="text" 
                required
                value={formData.variety}
                onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Sack Weight (kg)</label>
              <input 
                type="number" 
                required
                value={formData.weightKg}
                onChange={(e) => setFormData({ ...formData, weightKg: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Selling Base Price (KES)</label>
              <input 
                type="number" 
                required
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 font-bold text-emerald-400"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Buying Cost (KES)</label>
              <input 
                type="number" 
                value={formData.buyingPrice || ''}
                onChange={(e) => setFormData({ ...formData, buyingPrice: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Flash Sale Price (Optional KES)</label>
              <input 
                type="number" 
                value={formData.flashSalePrice || ''}
                onChange={(e) => setFormData({ ...formData, flashSalePrice: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Stock Quantity Available</label>
              <input 
                type="number" 
                required
                value={formData.stockQuantity}
                onChange={(e) => setFormData({ ...formData, stockQuantity: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Image URL</label>
            <input 
              type="text" 
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">Description & Characteristics</label>
            <textarea 
              rows={3}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              <Save className="w-4 h-4" /> Save Changes
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

/**
 * EDIT USER MODAL (USER CLEARANCE SECTION)
 */
const EditUserModal: React.FC<{
  user: UserAccount | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: UserAccount) => void;
}> = ({ user, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState<UserAccount | null>(user);

  useEffect(() => {
    setFormData(user ? { ...user } : null);
  }, [user]);

  if (!isOpen || !formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600/20 text-teal-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Edit User Account</h3>
              <p className="text-xs text-slate-400">User Clearance System ID #{formData.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          <div>
            <label className="block font-bold text-slate-300 mb-1">Full Name</label>
            <input 
              type="text" 
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Email Address</label>
              <input 
                type="email" 
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Phone Number</label>
              <input 
                type="text" 
                required
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">System Role</label>
              <select 
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-teal-500 font-bold"
              >
                <option value="customer">Customer</option>
                <option value="staff">Staff Dispatcher</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Loyalty Reward Points</label>
              <input 
                type="number" 
                value={formData.rewardPoints}
                onChange={(e) => setFormData({ ...formData, rewardPoints: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-bold focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-300 mb-1">County Location</label>
              <select 
                value={formData.county || 'Nairobi'}
                onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-teal-500"
              >
                {ALL_47_COUNTIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">Account Status</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-teal-500 font-bold"
              >
                <option value="active">Active Clearance</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending Verification</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold flex items-center gap-2 shadow-lg shadow-teal-600/30"
            >
              <Save className="w-4 h-4" /> Save User Profile
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

/**
 * QUICK VIEW PRODUCT MODAL
 */
const QuickViewModal: React.FC<{
  product: Product | null;
  onClose: () => void;
  onAddToCart: (p: Product) => void;
}> = ({ product, onClose, onAddToCart }) => {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white text-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative overflow-hidden">
        
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 text-slate-400 hover:text-slate-800 rounded-full bg-slate-100">
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="h-64 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
            <img src={product.imageUrl} alt={product.brandName} className="w-full h-full object-cover" />
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                {product.variety}
              </span>
              <h3 className="text-2xl font-black text-slate-900 mt-2">{product.brandName}</h3>
              <p className="text-xs text-slate-500 mt-1">Weight Sack: <strong className="text-slate-800">{product.weightKg} kg</strong></p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {product.description || "100% Authentic aromatic Kenya agricultural produce processed and bagged under strict Mwea milling standards."}
            </p>

            <div className="border-t border-b border-slate-100 py-3 flex items-center justify-between">
              <div>
                <span className="text-2xl font-black text-emerald-800">{formatKES(product.basePrice)}</span>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                In Stock ({product.stockQuantity} available)
              </span>
            </div>

            <button 
              onClick={() => { onAddToCart(product); onClose(); }}
              className="w-full py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm transition-all shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" /> Add To Shopping Cart
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

// ============================================================================
// 4. MAIN APPLICATION COMPONENT
// ============================================================================

export default function PremiumRiceStore() {
  // Navigation & Primary App State
  const [view, setView] = useState<'home' | 'shop' | 'cart' | 'login' | 'admin' | 'profile'>('home');
  const [user, setUser] = useState<UserAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Products & Hero Dynamic State
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [carousel, setCarousel] = useState<any[]>([]);
  const [heroSettings, setHeroSettings] = useState<HeroSettingsConfig>({
    title: 'Direct From Mwea Paddy Fields',
    subtitle: '100% Pure Aromatic Pishori Rice harvested and delivered straight to your doorstep across Kenya.',
    video1: 'https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI',
    video2: '',
    img1: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80',
    img2: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=1600&q=80',
    img3: '',
    ctaButtonText: 'Explore Grain Catalog',
    badgeText: '🌾 Pure Kenya Agricultural Harvest',
    overlayOpacity: '40',
    secondaryButtonText: 'Track Order Status',
    announcementTicker: '🔥 Special 25kg & 50kg Wholesale Discounts Active Across All 47 Counties!',
    themeAccentColor: 'emerald',
    heroLayoutMode: 'split-banner',
    enableLiveTicker: true,
    promoBadgeColor: 'rose',
    bannerHeight: '65vh',
    featuredTagLabel: 'Certified Organic',
    customerTrustBadgeText: 'Verified Mwea Milling Standards',
    supportHotlineDisplay: '+254 700 000000',
    expressLogisticsNote: 'Same-day dispatch available for Nairobi & Kiambu regions'
  });
  
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  
  // Flash Sale Engine State
  const [flashSale, setFlashSale] = useState({ active: true, endTime: null as string | null, msRemaining: 86400000 });
  const [baseTransportFee, setBaseTransportFee] = useState(250);
  const [countyOverrides, setCountyOverrides] = useState<{ [key: string]: number }>({
    "Nairobi": 200,
    "Kirinyaga": 150,
    "Mombasa": 400,
    "Kisumu": 350
  });

  // Admin Workspace Controls State
  const [adminTab, setAdminTab] = useState<'inventory' | 'orders' | 'finances' | 'users' | 'freight' | 'logs' | 'hero'>('inventory');
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserAccount[]>(INITIAL_USERS);
  const [adminLogs, setAdminLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [financialMetrics, setFinancialMetrics] = useState<MonthlyFinancialMetric[]>(INITIAL_FINANCIAL_MONTHS);
  const [selectedGraphMetric, setSelectedGraphMetric] = useState<'revenue' | 'profit' | 'bags'>('revenue');

  // Interactive Modals State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  
  // Search & Filtering States
  const [shopSearch, setShopSearch] = useState('');
  const [selectedVariety, setSelectedVariety] = useState<string>('All');
  const [selectedWeight, setSelectedWeight] = useState<string>('All');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(10000);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Checkout Logistics Form State
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

  // Authentication Form State
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'reset'>('request');
  const [formData, setFormData] = useState({ phoneNumber: '', email: '', password: '', fullName: '', resetToken: '', newPassword: '' });

  // Real-Time Payment Modal State
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

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Local Storage Cart Sync
  useEffect(() => {
    try {
      const key = user ? `mwea_cart_${user.id}` : 'mwea_cart_guest';
      const saved = localStorage.getItem(key);
      if (saved) setCart(JSON.parse(saved));
    } catch (err) {
      console.error("Failed to parse cart local storage", err);
    }
  }, [user]);

  useEffect(() => {
    try {
      const key = user ? `mwea_cart_${user.id}` : 'mwea_cart_guest';
      localStorage.setItem(key, JSON.stringify(cart));
    } catch (err) {
      console.error("Failed to store cart state", err);
    }
  }, [cart, user]);

  // Handle County logistics selection cascade
  useEffect(() => {
    const data = REGIONAL_LOGISTICS_DATA[checkoutData.county] || DEFAULT_REGIONAL_LOGISTICS;
    setCheckoutData(prev => ({
      ...prev,
      town: data.towns[0] || 'Central Town',
      location: data.locations[0] || 'Main Location',
      sublocation: data.sublocations[0] || 'Sub-location',
      shippingAddress: data.streets[0] || 'Main Street'
    }));
  }, [checkoutData.county]);

  // Flash Sale Timer Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setFlashSale(prev => ({
        ...prev,
        msRemaining: Math.max(0, prev.msRemaining - 1000)
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // CART CALCULATIONS
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const p = item.product || {};
      const eff = flashSale.active && p.flashSalePrice ? p.flashSalePrice : (p.basePrice || p.price || 0);
      return sum + (eff * item.quantity);
    }, 0);
  }, [cart, flashSale.active]);

  const totalCartWeightKg = useMemo(() => {
    return cart.reduce((sum, item) => sum + ((item.product?.weightKg || 0) * item.quantity), 0);
  }, [cart]);

  const activeShippingFee = useMemo(() => {
    if (countyOverrides && countyOverrides[checkoutData.county] !== undefined) {
      return Number(countyOverrides[checkoutData.county]);
    }
    return baseTransportFee;
  }, [checkoutData.county, countyOverrides, baseTransportFee]);

  const cartGrandTotal = useMemo(() => {
    return cartSubtotal + (cart.length > 0 ? activeShippingFee : 0);
  }, [cartSubtotal, cart.length, activeShippingFee]);

  const addToCart = (product: Product, qty: number = 1) => {
    setCart(prev => {
      const exist = prev.find(i => i.productId === product.id);
      if (exist) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, { productId: product.id, quantity: qty, product }];
    });
    showToast(`Added ${product.brandName} to shopping cart!`, 'success');
  };

  const updateCartQuantity = (productId: number, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.productId !== productId));
      showToast('Item removed from cart.', 'success');
      return;
    }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
  };

  const clearCart = () => {
    setCart([]);
    showToast('Shopping cart cleared.', 'success');
  };

  // USER CLEARANCE MANAGEMENT ACTIONS
  const handleSaveUserClearance = (updatedUser: UserAccount) => {
    setAdminUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    setEditingUser(null);
    showToast(`User ${updatedUser.fullName} clearance details updated successfully!`, 'success');

    // Add Audit Trail Log
    const newLog: AuditLogEntry = {
      id: Date.now(),
      userId: user?.id || 1,
      userName: user?.fullName || "Admin Officer Maina",
      userEmail: user?.email || "admin@mwearicehub.co.ke",
      action: "UPDATE_USER_CLEARANCE",
      resource: `User #${updatedUser.id} (${updatedUser.fullName})`,
      ipAddress: "197.232.88.12",
      severity: "info",
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      details: `Updated role to ${updatedUser.role}, status to ${updatedUser.status}, points to ${updatedUser.rewardPoints}.`
    };
    setAdminLogs(prev => [newLog, ...prev]);
  };

  const handleToggleUserSuspend = (userId: number) => {
    setAdminUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const nextStatus = u.status === 'suspended' ? 'active' : 'suspended';
        showToast(`User ${u.fullName} account status set to ${nextStatus.toUpperCase()}`, nextStatus === 'suspended' ? 'error' : 'success');
        
        // Log Audit Trail
        const newLog: AuditLogEntry = {
          id: Date.now(),
          userId: user?.id || 1,
          userName: user?.fullName || "Admin Officer Maina",
          userEmail: user?.email || "admin@mwearicehub.co.ke",
          action: nextStatus === 'suspended' ? "SUSPEND_USER_ACCOUNT" : "RESTORE_USER_ACCOUNT",
          resource: `User #${u.id} (${u.fullName})`,
          ipAddress: "197.232.88.12",
          severity: "warning",
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          details: `Changed clearance account status to ${nextStatus}.`
        };
        setAdminLogs(l => [newLog, ...l]);

        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  const handleDeleteUserAccount = (userId: number, fullName: string) => {
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE user clearance account for ${fullName}? This cannot be undone.`)) return;

    setAdminUsers(prev => prev.filter(u => u.id !== userId));
    showToast(`User account for ${fullName} deleted from database.`, 'success');

    const newLog: AuditLogEntry = {
      id: Date.now(),
      userId: user?.id || 1,
      userName: user?.fullName || "Admin Officer Maina",
      userEmail: user?.email || "admin@mwearicehub.co.ke",
      action: "DELETE_USER_ACCOUNT",
      resource: `User #${userId} (${fullName})`,
      ipAddress: "197.232.88.12",
      severity: "critical",
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      details: `Permanently purged user clearance record from system.`
    };
    setAdminLogs(l => [newLog, ...l]);
  };

  // GRAIN CATALOGUE EDIT ACTION (FOR ALL PRODUCTS)
  const handleSaveProductEdit = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    setEditingProduct(null);
    showToast(`Product ${updatedProduct.brandName} updated in grain catalog!`, 'success');

    const newLog: AuditLogEntry = {
      id: Date.now(),
      userId: user?.id || 1,
      userName: user?.fullName || "Admin Officer Maina",
      userEmail: user?.email || "admin@mwearicehub.co.ke",
      action: "UPDATE_GRAIN_CATALOG",
      resource: `Product #${updatedProduct.id} (${updatedProduct.brandName})`,
      ipAddress: "197.232.88.12",
      severity: "info",
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      details: `Updated product parameters: Base Price KES ${updatedProduct.basePrice}, Stock ${updatedProduct.stockQuantity} sacks.`
    };
    setAdminLogs(l => [newLog, ...l]);
  };

  // ORDER PLACEMENT
  const handlePlaceOrder = () => {
    if (!token && !user) {
      showToast('Please login or register to finalize order.', 'error');
      setView('login');
      return;
    }

    if (cart.length === 0) {
      showToast('Cart is empty!', 'error');
      return;
    }

    setIsCheckingOut(true);

    setTimeout(() => {
      const newOrderId = Math.floor(1000 + Math.random() * 9000);
      const newOrder: Order = {
        id: newOrderId,
        userId: user?.id || 1,
        User: user || INITIAL_USERS[0],
        items: cart.map(i => ({
          productId: i.productId,
          brandName: i.product.brandName,
          variety: i.product.variety,
          quantity: i.quantity,
          priceAtPurchase: i.product.basePrice
        })),
        grandTotal: cartGrandTotal,
        shippingFee: activeShippingFee,
        county: checkoutData.county,
        town: checkoutData.town,
        location: checkoutData.location,
        sublocation: checkoutData.sublocation,
        streetAddress: checkoutData.shippingAddress,
        shippingAddress: `${checkoutData.shippingAddress}, ${checkoutData.sublocation}, ${checkoutData.town}, ${checkoutData.county}`,
        status: 'pending',
        paymentDetails: {
          isPaid: true,
          paidTag: 'PAID',
          mpesaReceipt: `QKH${Math.floor(100000 + Math.random() * 900000)}`,
          method: 'M-Pesa STK Push',
          paidAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString()
      };

      setMyOrders(prev => [newOrder, ...prev]);
      setAdminOrders(prev => [newOrder, ...prev]);
      setCart([]);
      setIsCheckingOut(false);

      showToast(`Order #${newOrderId} placed successfully via M-Pesa STK!`, 'success');
      setView('profile');
    }, 1500);
  };

  // AUTH HANDLERS
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      const found = INITIAL_USERS.find(u => u.email === formData.email || u.phoneNumber === formData.phoneNumber) || INITIAL_USERS[0];
      setUser(found);
      setToken("mock_jwt_token_2026");
      showToast(`Welcome back, ${found.fullName}!`, 'success');
      setView(found.role === 'admin' ? 'admin' : 'home');
    } else {
      const newUser: UserAccount = {
        id: Date.now(),
        fullName: formData.fullName || "New Customer",
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        role: "customer",
        status: "active",
        rewardPoints: 50,
        county: "Nairobi",
        createdAt: new Date().toISOString()
      };
      setUser(newUser);
      setToken("mock_jwt_token_2026");
      setAdminUsers(prev => [...prev, newUser]);
      showToast('Account created successfully! Earned 50 welcome points.', 'success');
      setView('home');
    }
  };

  // Catalog Filters
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.brandName.toLowerCase().includes(shopSearch.toLowerCase()) || p.variety.toLowerCase().includes(shopSearch.toLowerCase());
      const matchVariety = selectedVariety === 'All' || p.variety === selectedVariety;
      const matchWeight = selectedWeight === 'All' || String(p.weightKg) === selectedWeight;
      const eff = flashSale.active && p.flashSalePrice ? p.flashSalePrice : (p.basePrice || p.price || 0);
      const matchPrice = eff <= maxPriceFilter;
      return matchSearch && matchVariety && matchWeight && matchPrice;
    });
  }, [products, shopSearch, selectedVariety, selectedWeight, maxPriceFilter, flashSale.active]);

  const filteredUsers = useMemo(() => {
    return adminUsers.filter(u => 
      u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.phoneNumber.includes(userSearchQuery) ||
      (u.county || '').toLowerCase().includes(userSearchQuery.toLowerCase())
    );
  }, [adminUsers, userSearchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      
      {/* Toast Alert System */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-extrabold transition-all transform animate-bounce ${
          toast.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-rose-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* TOP LIVE ANNOUNCEMENT TICKER */}
      {heroSettings.enableLiveTicker && (
        <div className="bg-emerald-950 text-emerald-200 text-[11px] py-2 px-4 border-b border-emerald-900 flex items-center justify-between">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="bg-emerald-600 text-white font-black px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider shrink-0">Official Ticker</span>
              <p className="truncate font-medium text-emerald-300">{heroSettings.announcementTicker}</p>
            </div>
            <div className="hidden md:flex items-center gap-6 text-emerald-400 text-[11px] shrink-0 font-semibold">
              <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Support: {heroSettings.supportHotlineDisplay}</span>
              <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> {heroSettings.expressLogisticsNote}</span>
            </div>
          </div>
        </div>
      )}

      {/* MAIN NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-sm">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          
          {/* Logo */}
          <button onClick={() => setView('home')} className="flex items-center gap-3 group text-left">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-800 via-emerald-700 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-800/20 group-hover:scale-105 transition-transform">
              <Leaf className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-700 bg-clip-text text-transparent">
                MWEA RICE HUB
              </h1>
              <p className="text-[10px] font-black text-emerald-700 tracking-widest uppercase">Pure Kenyan Harvest</p>
            </div>
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 font-bold text-sm">
            <button 
              onClick={() => setView('home')} 
              className={`transition-all py-1 ${view === 'home' ? 'text-emerald-700 border-b-2 border-emerald-700' : 'text-slate-600 hover:text-emerald-700'}`}
            >
              Home
            </button>
            <button 
              onClick={() => setView('shop')} 
              className={`transition-all py-1 ${view === 'shop' ? 'text-emerald-700 border-b-2 border-emerald-700' : 'text-slate-600 hover:text-emerald-700'}`}
            >
              Grain Catalog
            </button>
            {user && (
              <button 
                onClick={() => setView('profile')} 
                className={`transition-all py-1 ${view === 'profile' ? 'text-emerald-700 border-b-2 border-emerald-700' : 'text-slate-600 hover:text-emerald-700'}`}
              >
                My Orders & Points
              </button>
            )}
            {user?.role === 'admin' && (
              <button 
                onClick={() => setView('admin')} 
                className={`transition-all py-1 flex items-center gap-1.5 font-extrabold ${view === 'admin' ? 'text-emerald-700 border-b-2 border-emerald-700' : 'text-emerald-800 hover:text-emerald-900 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200'}`}
              >
                <Shield className="w-4 h-4 text-emerald-700" /> Admin Console
              </button>
            )}
          </nav>

          {/* User Account / Cart Controls */}
          <div className="flex items-center gap-3">
            
            {/* Cart Button */}
            <button 
              onClick={() => setView('cart')} 
              className="relative p-2.5 rounded-2xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors flex items-center justify-center border border-emerald-100"
              aria-label="Cart"
            >
              <ShoppingCart className="w-5 h-5 text-emerald-800" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>

            {/* Profile or Sign in */}
            {user ? (
              <div className="hidden md:flex items-center gap-3 border-l border-slate-200 pl-3">
                <div className="text-right">
                  <p className="text-xs font-black text-slate-900">{user.fullName}</p>
                  <p className="text-[10px] font-bold text-emerald-700">{user.rewardPoints} Loyalty Pts</p>
                </div>
                <button 
                  onClick={() => { setUser(null); setToken(null); showToast('Signed out.'); setView('home'); }} 
                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setView('login')} 
                className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 transition-all"
              >
                <LogIn className="w-4 h-4" /> Customer Sign In
              </button>
            )}

            {/* Mobile Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 flex flex-col gap-3">
            <button onClick={() => { setView('home'); setMobileMenuOpen(false); }} className="text-left font-bold py-2 text-slate-700 border-b border-slate-100">
              Home
            </button>
            <button onClick={() => { setView('shop'); setMobileMenuOpen(false); }} className="text-left font-bold py-2 text-slate-700 border-b border-slate-100">
              Grain Catalog
            </button>
            {user ? (
              <>
                <button onClick={() => { setView('profile'); setMobileMenuOpen(false); }} className="text-left font-bold py-2 text-slate-700 border-b border-slate-100">
                  My Orders & Points ({user.rewardPoints} pts)
                </button>
                {user.role === 'admin' && (
                  <button onClick={() => { setView('admin'); setMobileMenuOpen(false); }} className="text-left font-extrabold py-2 text-emerald-800 border-b border-slate-100">
                    Admin Console
                  </button>
                )}
                <button onClick={() => { setUser(null); setToken(null); setMobileMenuOpen(false); setView('home'); }} className="text-left font-bold py-2 text-rose-600">
                  Sign Out ({user.fullName})
                </button>
              </>
            ) : (
              <button onClick={() => { setView('login'); setMobileMenuOpen(false); }} className="w-full py-3 rounded-xl bg-emerald-700 text-white font-bold text-center">
                Sign In / Register Account
              </button>
            )}
          </div>
        )}
      </header>

      {/* VIEW ROUTER */}
      <main className="flex-1">

        {/* ==================================================== */}
        {/* VIEW: HOME PAGE                                      */}
        {/* ==================================================== */}
        {view === 'home' && (
          <div className="space-y-16">
            
            {/* HERO ROTATING BANNER */}
            <section className="relative w-full overflow-hidden bg-slate-950 text-white" style={{ minHeight: heroSettings.bannerHeight || '65vh' }}>
              <div className="absolute inset-0 z-0 opacity-50">
                <img 
                  src={heroSettings.img1} 
                  alt="Mwea Rice Paddy" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
              </div>

              <div className="relative z-10 container mx-auto px-4 h-full py-20 flex flex-col justify-center max-w-4xl space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-extrabold text-xs uppercase tracking-wider w-fit">
                  <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{heroSettings.badgeText}</span>
                </div>

                <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
                  {heroSettings.title}
                </h2>

                <p className="text-base sm:text-xl text-slate-300 font-normal leading-relaxed max-w-2xl">
                  {heroSettings.subtitle}
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button 
                    onClick={() => setView('shop')} 
                    className="px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base transition-all shadow-xl shadow-emerald-900/40 flex items-center gap-3"
                  >
                    <span>{heroSettings.ctaButtonText}</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  <button 
                    onClick={() => setView('shop')} 
                    className="px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold text-base transition-all border border-white/20"
                  >
                    View 25kg Sacks
                  </button>
                </div>
              </div>
            </section>

            {/* FLASH HARVEST EVENT BANNER */}
            {flashSale.active && (
              <section className="container mx-auto px-4">
                <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-950 rounded-3xl p-8 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 border border-emerald-700/50">
                  <div className="space-y-2 text-center md:text-left">
                    <span className="bg-emerald-500/30 text-emerald-200 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                      Limited Harvest Promotion
                    </span>
                    <h3 className="text-3xl font-black">🌾 FLASH DISCOUNT EVENT ACTIVE</h3>
                    <p className="text-emerald-100 text-sm">Save on all pure Mwea aromatic Pishori and Basmati bulk purchases today.</p>
                  </div>

                  <div className="flex items-center gap-4 bg-slate-950/60 p-5 rounded-2xl border border-emerald-500/30">
                    <Clock className="w-8 h-8 text-emerald-400 animate-spin" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Offer Closes In</p>
                      <p className="text-3xl font-mono font-black text-white">23:59:45</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* FEATURED PRODUCTS (2-COL MOBILE, 4-COL DESKTOP) */}
            <section className="container mx-auto px-4 space-y-6">
              <div className="flex items-end justify-between border-b border-slate-200 pb-4">
                <div>
                  <span className="text-xs font-extrabold text-emerald-700 uppercase tracking-widest">Selected Varieties</span>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900">Featured Grain Sacks</h3>
                </div>
                <button onClick={() => setView('shop')} className="text-emerald-700 hover:text-emerald-800 font-extrabold text-xs sm:text-sm flex items-center gap-1">
                  <span>View All ({products.length})</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* GRID: 2 COLUMNS ON MOBILE, 4 COLUMNS ON DESKTOP */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {products.slice(0, 4).map((product) => (
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

          </div>
        )}

        {/* ==================================================== */}
        {/* VIEW: GRAIN CATALOG / SHOP                           */}
        {/* ==================================================== */}
        {view === 'shop' && (
          <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900">Mwea Agricultural Grain Store</h2>
              <p className="text-slate-500 text-sm">Select pure long-grain aromatic rice packaged in 5kg, 10kg, 25kg, and 50kg sacks.</p>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Search Grain</label>
                <input 
                  type="text"
                  placeholder="e.g. Pishori or Basmati..."
                  value={shopSearch}
                  onChange={(e) => setShopSearch(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Variety</label>
                <select 
                  value={selectedVariety}
                  onChange={(e) => setSelectedVariety(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-600 font-bold"
                >
                  <option value="All">All Varieties</option>
                  <option value="Pure Aromatic Pishori">Pure Aromatic Pishori</option>
                  <option value="Basmati Extra Long">Basmati Extra Long</option>
                  <option value="Sindano Long Grain">Sindano Long Grain</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Sack Weight</label>
                <select 
                  value={selectedWeight}
                  onChange={(e) => setSelectedWeight(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-600 font-bold"
                >
                  <option value="All">All Weights</option>
                  <option value="5">5 kg Sack</option>
                  <option value="10">10 kg Sack</option>
                  <option value="25">25 kg Sack</option>
                  <option value="50">50 kg Sack</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Max Price: {formatKES(maxPriceFilter)}</label>
                <input 
                  type="range"
                  min="500"
                  max="10000"
                  step="250"
                  value={maxPriceFilter}
                  onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                  className="w-full accent-emerald-700 mt-2"
                />
              </div>
            </div>

            {/* CATALOG GRID: 2 COLUMNS SMALL DEVICES, 4 COLUMNS DESKTOP */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
          </div>
        )}

        {/* ==================================================== */}
        {/* VIEW: SHOPPING CART & CHECKOUT                       */}
        {/* ==================================================== */}
        {view === 'cart' && (
          <div className="container mx-auto px-4 py-8 space-y-8 max-w-5xl">
            <h2 className="text-3xl font-black text-slate-900">Your Shopping Cart</h2>

            {cart.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-slate-200 max-w-md mx-auto">
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-lg font-bold">Your cart is currently empty</h3>
                <button onClick={() => setView('shop')} className="px-6 py-2.5 rounded-2xl bg-emerald-700 text-white font-extrabold text-xs">
                  Browse Grain Store
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Cart Items List */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <span className="font-extrabold text-slate-800 text-sm">{cart.length} Product Lines</span>
                      <button onClick={clearCart} className="text-xs font-bold text-rose-600 hover:underline">Clear Cart</button>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {cart.map(item => (
                        <div key={item.productId} className="py-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <img src={item.product.imageUrl} alt={item.product.brandName} className="w-14 h-14 rounded-2xl object-cover border" />
                            <div>
                              <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{item.product.brandName}</h4>
                              <p className="text-[11px] text-slate-500">{item.product.weightKg}kg • {formatKES(item.product.basePrice)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button onClick={() => updateCartQuantity(item.productId, item.quantity - 1)} className="px-2.5 py-1 bg-slate-100 rounded-lg font-bold text-xs">-</button>
                            <span className="font-bold text-xs px-2">{item.quantity}</span>
                            <button onClick={() => updateCartQuantity(item.productId, item.quantity + 1)} className="px-2.5 py-1 bg-slate-100 rounded-lg font-bold text-xs">+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Checkout & Logistics Form */}
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm space-y-4">
                    <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                      <Truck className="w-5 h-5 text-emerald-700" /> Regional Freight Delivery
                    </h3>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Destination County (47 Covered)</label>
                        <select 
                          value={checkoutData.county}
                          onChange={(e) => setCheckoutData({ ...checkoutData, county: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                        >
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
                            onChange={(e) => setCheckoutData({ ...checkoutData, town: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                          >
                            {(REGIONAL_LOGISTICS_DATA[checkoutData.county]?.towns || DEFAULT_REGIONAL_LOGISTICS.towns).map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Location</label>
                          <select 
                            value={checkoutData.location}
                            onChange={(e) => setCheckoutData({ ...checkoutData, location: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                          >
                            {(REGIONAL_LOGISTICS_DATA[checkoutData.county]?.locations || DEFAULT_REGIONAL_LOGISTICS.locations).map(l => (
                              <option key={l} value={l}>{l}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">M-Pesa Mobile Number</label>
                        <input 
                          type="text"
                          placeholder="e.g. 0712345678"
                          value={checkoutData.stkPhoneNumber}
                          onChange={(e) => setCheckoutData({ ...checkoutData, stkPhoneNumber: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-bold"
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Grain Subtotal:</span>
                        <span className="font-bold">{formatKES(cartSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Freight Rate ({checkoutData.county}):</span>
                        <span className="font-bold">{formatKES(activeShippingFee)}</span>
                      </div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-black text-slate-900">
                        <span>Grand Total:</span>
                        <span className="text-emerald-800">{formatKES(cartGrandTotal)}</span>
                      </div>
                    </div>

                    <button 
                      onClick={handlePlaceOrder}
                      disabled={isCheckingOut}
                      className="w-full py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm shadow-lg shadow-emerald-700/20"
                    >
                      {isCheckingOut ? 'Processing Order...' : `Pay ${formatKES(cartGrandTotal)} via M-Pesa`}
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* VIEW: USER PROFILE & ORDERS                          */}
        {/* ==================================================== */}
        {view === 'profile' && user && (
          <div className="container mx-auto px-4 py-8 space-y-8 max-w-4xl">
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-3xl p-8 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <span className="bg-emerald-500/30 text-emerald-200 px-3 py-1 rounded-full text-xs font-bold uppercase">Customer Profile</span>
                <h2 className="text-3xl font-black mt-2">{user.fullName}</h2>
                <p className="text-emerald-200 text-xs mt-1">{user.email} • {user.phoneNumber}</p>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-2xl border border-emerald-500/30 text-center min-w-[150px]">
                <p className="text-[10px] font-bold uppercase text-emerald-300">Reward Points</p>
                <p className="text-3xl font-black text-white">{user.rewardPoints}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-black text-slate-900">Your Grain Purchase Orders</h3>

              {myOrders.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl border text-center text-slate-500 text-xs">
                  No orders placed yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {myOrders.map(o => (
                    <div key={o.id} className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm space-y-3 text-xs">
                      <div className="flex justify-between items-center border-b pb-3">
                        <span className="font-extrabold text-emerald-800">ORDER #{o.id}</span>
                        <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold">PAID</span>
                      </div>
                      <p className="font-bold text-slate-800">Delivery: {o.shippingAddress}</p>
                      <p className="font-black text-slate-900 text-sm">Total: {formatKES(o.grandTotal)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* VIEW: AUTHENTICATION (LOGIN / REGISTER)              */}
        {/* ==================================================== */}
        {view === 'login' && (
          <div className="container mx-auto px-4 py-16 max-w-md">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-emerald-100 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center mx-auto">
                  <UserIcon className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black">{isLogin ? 'Customer Login' : 'Create Account'}</h2>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
                {!isLogin && (
                  <div>
                    <label className="block font-bold mb-1">Full Name</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border" 
                      placeholder="Jane Doe"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold mb-1">Email or Phone Number</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.email || formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value, phoneNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border" 
                    placeholder="0712345678 or admin@mwearicehub.co.ke"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Password</label>
                  <input 
                    type="password" 
                    required 
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border" 
                  />
                </div>

                <button type="submit" className="w-full py-3.5 rounded-xl bg-emerald-700 text-white font-extrabold text-sm shadow-md">
                  {isLogin ? 'Sign In' : 'Register Account'}
                </button>

                <div className="text-center pt-2">
                  <button type="button" onClick={() => setIsLogin(!isLogin)} className="font-bold text-emerald-700">
                    {isLogin ? "Don't have an account? Sign Up" : "Already registered? Sign In"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* VIEW: ADMINISTRATIVE CONSOLE (DARK THEMED 2-PANEL)   */}
        {/* ==================================================== */}
        {view === 'admin' && user?.role === 'admin' && (
          <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
            
            {/* ------------------------------------------------ */}
            {/* PANEL 1: LEFT ADMIN SIDEBAR PANEL                */}
            {/* ------------------------------------------------ */}
            <aside className="w-full md:w-72 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between space-y-8 shrink-0">
              <div className="space-y-6">
                
                {/* Admin Header Badge */}
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-sm">Mwea Admin</h3>
                    <p className="text-[10px] text-emerald-400 font-bold uppercase">System Console v3.2</p>
                  </div>
                </div>

                {/* Tab Switcher Navigation */}
                <nav className="space-y-1 text-xs font-bold">
                  {[
                    { id: 'inventory', label: 'Grain Catalog Edit', icon: Package },
                    { id: 'finances', label: 'Financial Growth Engine', icon: DollarSign },
                    { id: 'users', label: 'User Clearance System', icon: Users },
                    { id: 'orders', label: 'Order Dispatch', icon: ShoppingBag },
                    { id: 'freight', label: 'Regional Freight', icon: MapPin },
                    { id: 'logs', label: 'System Audit Logs', icon: FileText },
                    { id: 'hero', label: 'Hero Config', icon: Sliders }
                  ].map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button 
                        key={tab.id}
                        onClick={() => setAdminTab(tab.id as any)}
                        className={`w-full px-4 py-3 rounded-2xl flex items-center gap-3 transition-all ${
                          adminTab === tab.id 
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-black' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>

              </div>

              {/* Admin Footer Status */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-2 text-[11px]">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  <span>Real-Time Engine Active</span>
                </div>
                <p className="text-slate-500">Connected User: {user.fullName}</p>
              </div>
            </aside>

            {/* ------------------------------------------------ */}
            {/* PANEL 2: MAIN WORKSPACE PANEL                    */}
            {/* ------------------------------------------------ */}
            <main className="flex-1 p-6 sm:p-10 space-y-8 overflow-y-auto">
              
              {/* TAB: INVENTORY CATALOG EDIT (EDIT ALL PRODUCTS) */}
              {adminTab === 'inventory' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="text-2xl font-black text-white">Grain Catalog Management</h2>
                      <p className="text-xs text-slate-400">Admin capability to edit all product details and stock balances.</p>
                    </div>

                    <button 
                      onClick={() => setEditingProduct(products[0])} 
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 w-fit"
                    >
                      <Plus className="w-4 h-4" /> Edit Selected Grain
                    </button>
                  </div>

                  {/* Catalog Table */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                        <tr>
                          <th className="p-4">ID</th>
                          <th className="p-4">Brand Name</th>
                          <th className="p-4">Variety</th>
                          <th className="p-4">Weight</th>
                          <th className="p-4">Base Selling</th>
                          <th className="p-4">Buying Cost</th>
                          <th className="p-4">Stock</th>
                          <th className="p-4 text-right">Edit Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium">
                        {products.map(p => (
                          <tr key={p.id} className="hover:bg-slate-800/50">
                            <td className="p-4 font-bold text-slate-500">#{p.id}</td>
                            <td className="p-4 font-extrabold text-white">{p.brandName}</td>
                            <td className="p-4 text-slate-300">{p.variety}</td>
                            <td className="p-4 text-slate-300">{p.weightKg} kg</td>
                            <td className="p-4 font-black text-emerald-400">{formatKES(p.basePrice)}</td>
                            <td className="p-4 text-slate-400">{formatKES(p.buyingPrice || 0)}</td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                                {p.stockQuantity} Sacks
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => setEditingProduct(p)} 
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white font-bold transition-all flex items-center gap-1.5 ml-auto"
                              >
                                <Edit className="w-3.5 h-3.5" /> Edit Product
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: FINANCIAL ENGINE & GROWTH GRAPH */}
              {adminTab === 'finances' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-black text-white">Financial Growth & Metrics Engine</h2>
                    <p className="text-xs text-slate-400">Monthly breakdown of grain sales, revenue metrics, and growth graph.</p>
                  </div>

                  {/* FINANCIAL GRAPH COMPONENT */}
                  <FinancialGrowthChart 
                    data={financialMetrics}
                    selectedMetric={selectedGraphMetric}
                    onMetricChange={setSelectedGraphMetric}
                  />

                  {/* Monthly Table Data */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                        <tr>
                          <th className="p-4">Month</th>
                          <th className="p-4">Total Revenue</th>
                          <th className="p-4">Buying Cost</th>
                          <th className="p-4">Net Profit</th>
                          <th className="p-4">Sacks Sold</th>
                          <th className="p-4">MoM Growth</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium">
                        {financialMetrics.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/50">
                            <td className="p-4 font-black text-white">{m.month} {m.year}</td>
                            <td className="p-4 font-extrabold text-emerald-400">{formatKES(m.totalRevenue)}</td>
                            <td className="p-4 text-slate-400">{formatKES(m.buyingCost)}</td>
                            <td className="p-4 font-black text-teal-300">{formatKES(m.netProfit)}</td>
                            <td className="p-4 text-white font-bold">{m.bagsSold} Sacks</td>
                            <td className="p-4 font-extrabold text-emerald-400">+{m.growthPercentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: USER CLEARANCE SECTION */}
              {adminTab === 'users' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="text-2xl font-black text-white">User Clearance & Directory</h2>
                      <p className="text-xs text-slate-400">Display all users with full details, edit capabilities, suspension & account deletion.</p>
                    </div>

                    <input 
                      type="text" 
                      placeholder="Search users by name, email, phone..." 
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 w-full sm:w-80"
                    />
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                        <tr>
                          <th className="p-4">User Details</th>
                          <th className="p-4">Role</th>
                          <th className="p-4">County</th>
                          <th className="p-4">Points</th>
                          <th className="p-4">Clearance Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium">
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="hover:bg-slate-800/50">
                            <td className="p-4">
                              <p className="font-extrabold text-white text-sm">{u.fullName}</p>
                              <p className="text-[11px] text-slate-400">{u.email} • {u.phoneNumber}</p>
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                u.role === 'admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="p-4 text-slate-300">{u.county || 'N/A'}</td>
                            <td className="p-4 font-black text-emerald-400">{u.rewardPoints} pts</td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                u.status === 'active' 
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}>
                                {u.status}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => setEditingUser(u)}
                                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                                  title="Edit User Details"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleToggleUserSuspend(u.id)}
                                  className={`p-2 rounded-xl ${u.status === 'suspended' ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40' : 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/40'}`}
                                  title={u.status === 'suspended' ? 'Reactivate Account' : 'Suspend Account'}
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteUserAccount(u.id, u.fullName)}
                                  className="p-2 rounded-xl bg-rose-600/20 text-rose-400 hover:bg-rose-600/40"
                                  title="Delete Account"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: SYSTEM AUDIT LOGS WITH USER ACCOUNT NAMES */}
              {adminTab === 'logs' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-black text-white">System Audit Logs</h2>
                    <p className="text-xs text-slate-400">Displays all administrative and security logs mapped with user account names.</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                        <tr>
                          <th className="p-4">Timestamp</th>
                          <th className="p-4">User Account Name</th>
                          <th className="p-4">Action</th>
                          <th className="p-4">Resource Target</th>
                          <th className="p-4">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium">
                        {adminLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-800/50">
                            <td className="p-4 text-slate-400 font-mono text-[11px]">{log.timestamp}</td>
                            <td className="p-4">
                              <p className="font-extrabold text-white">{log.userName}</p>
                              <p className="text-[10px] text-slate-500">{log.userEmail}</p>
                            </td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-emerald-400 font-bold border border-slate-700">
                                {log.action}
                              </span>
                            </td>
                            <td className="p-4 text-slate-300 font-semibold">{log.resource}</td>
                            <td className="p-4 text-slate-400 max-w-xs">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: REGIONAL FREIGHT LOGISTICS */}
              {adminTab === 'freight' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-black text-white">Regional Freight System (47 Counties)</h2>
                    <p className="text-xs text-slate-400">Configure county transport base rates and regional logistics multipliers.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {ALL_47_COUNTIES.slice(0, 6).map(c => (
                      <div key={c} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="font-extrabold text-white text-sm">{c} County</h4>
                          <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">Active Logistics</span>
                        </div>
                        <p className="text-xs text-slate-400">Base Transport Fee: <strong className="text-emerald-400">{formatKES(countyOverrides[c] || baseTransportFee)}</strong></p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </main>
          </div>
        )}

      </main>

      {/* QUICK VIEW & EDIT MODALS */}
      <QuickViewModal 
        product={quickViewProduct} 
        onClose={() => setQuickViewProduct(null)} 
        onAddToCart={(p) => addToCart(p)} 
      />

      {editingProduct && (
        <EditProductModal 
          product={editingProduct} 
          isOpen={!!editingProduct} 
          onClose={() => setEditingProduct(null)} 
          onSave={handleSaveProductEdit} 
        />
      )}

      {editingUser && (
        <EditUserModal 
          user={editingUser} 
          isOpen={!!editingUser} 
          onClose={() => setEditingUser(null)} 
          onSave={handleSaveUserClearance} 
        />
      )}

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 text-xs py-10 border-t border-slate-900 mt-auto">
        <div className="container mx-auto px-4 text-center space-y-3">
          <p className="font-bold text-slate-300">© 2026 Mwea Rice Hub. Pure Kenyan Agricultural Harvest.</p>
          <p className="text-[11px] text-slate-600">All 47 Counties Regional Logistics & PayHero Instant M-Pesa STK Integration Active.</p>
        </div>
      </footer>

    </div>
  );
}
