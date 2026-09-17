"use client";

/**
 * ============================================================================
 * MWEA RICE HUB - FULLSTACK ENTERPRISE E-COMMERCE & LOGISTICS PLATFORM
 * ============================================================================
 * 
 * File: app/page.tsx
 * Architecture: Next.js Client Component (React 18/19 + TypeScript + Tailwind CSS)
 * Features:
 *  - Real-Time M-Pesa STK Push Payment Gateway & Polling via PayHero Socket/API
 *  - Interactive 47-County Kenya Freight Logistics Calculator & Address Hierarchy
 *  - Live Dynamic SVG Financial Growth Engine & Database Aggregation Charts
 *  - Flash Sale Countdown Engine & Live Socket Synchronization
 *  - Comprehensive Admin Console (Inventory, Orders, Users, Finances, Hero, Audit Logs)
 *  - Account Reward Points System & Order History Tracking
 *  - Phone-First Mobile Responsive UI (2 Grid Columns on Mobile, 4 on Desktop)
 * 
 * ============================================================================
 */

import React, { 
  useState, 
  useEffect, 
  useMemo, 
  useCallback, 
  useRef, 
  ChangeEvent, 
  FormEvent 
} from 'react';
import { 
  ShoppingCart, 
  User as UserIcon, 
  LogIn, 
  Menu, 
  X, 
  Plus, 
  Trash2, 
  Shield, 
  Clock, 
  Search, 
  Edit, 
  Package, 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  Settings, 
  Leaf, 
  ChevronRight,
  ShoppingBag, 
  Users, 
  Image as ImageIcon, 
  Video, 
  Download,
  MapPin, 
  Eye, 
  RefreshCw, 
  LogOut, 
  Check, 
  AlertTriangle, 
  Smartphone, 
  Truck, 
  CreditCard, 
  BarChart2, 
  DollarSign, 
  Award, 
  Calendar, 
  Lock, 
  Unlock, 
  TrendingUp, 
  Filter, 
  FileText, 
  Percent, 
  Layers, 
  Globe, 
  Sliders, 
  Bell, 
  ArrowRight,
  ChevronDown, 
  ArrowUpRight, 
  HelpCircle, 
  Star, 
  PhoneCall,
  XCircle, 
  Zap, 
  Ban, 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  FileSpreadsheet,
  ChevronLeft,
  ArrowUpDown,
  Sparkles,
  Info,
  ExternalLink,
  Printer,
  Copy,
  Tag,
  Boxes,
  PieChart,
  Navigation,
  Headphones
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// ============================================================================
// SECTION 1: SYSTEM TYPES & INTERFACES
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

export interface PaymentDetails {
  isPaid?: boolean;
  paidTag?: 'PAID' | 'PENDING' | 'FAILED' | 'OVERRIDDEN';
  mpesaReceipt?: string | null;
  failureReason?: string | null;
  method?: string;
  paidAt?: string | null;
  rawCallback?: any;
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
  paymentDetails?: PaymentDetails;
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

export interface CarouselSlide {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl?: string;
  badge?: string;
  active: boolean;
}

// ============================================================================
// SECTION 2: CONSTANTS & KENYA REGIONAL LOGISTICS DATA
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

interface LogisticsHierarchy {
  towns: string[];
  locations: string[];
  sublocations: string[];
  streets: string[];
}

const REGIONAL_LOGISTICS_DATA: { [key: string]: LogisticsHierarchy } = {
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
  },
  "Uasin Gishu": {
    towns: ["Eldoret East", "Eldoret West", "Ainabkoi", "Kapseret", "Kesses", "Moiben", "Turbo"],
    locations: ["Eldoret CBD", "Elgon View", "Huruma", "Langas", "Pioneer", "Kipkenyo"],
    sublocations: ["Annex", "Kimumu", "Sirikwa", "West Indies", "Maili Nne", "Racecourse"],
    streets: ["Uganda Road", "Oloo Street", "Kipchoge Keino Avenue", "Nandi Road", "Eldoret-Iten Road"]
  },
  "Machakos": {
    towns: ["Machakos Town", "Mavoko / Syokimau", "Athi River", "Kangundo", "Matungulu", "Yatta"],
    locations: ["Syokimau", "Athi River EPZ", "Machakos CBD", "Katani", "Mlolongo", "Tala"],
    sublocations: ["Mwanawasa", "Gatwekera", "Sabaki", "Kinanie", "Kyumbi", "Kaseve"],
    streets: ["Mombasa Road Frontage", "Machakos-Kitui Road", "Mutituni Highway", "Katani Road", "Chumvi Junction"]
  },
  "Nyeri": {
    towns: ["Nyeri Town", "Karatina", "Othaya", "Mukurweini", "Tetu", "Kieni East", "Kieni West"],
    locations: ["CBD Nyeri", "Karatina Market", "Chinga", "Gakindu", "Naro Moru", "Endarasha"],
    sublocations: ["King'ong'o", "Majengo Nyeri", "Mathaithi", "Gatarakwa", "Mweiga Sub"],
    streets: ["Kimathi Way", "Gakere Road", "Karatina Highway", "Nyeri-Nanyuki Road", "Kenyatta Drive"]
  },
  "Murang'a": {
    towns: ["Kenol / Kabati", "Murang'a Town", "Maragua", "Kangaroo", "Kandara", "Gatanga"],
    locations: ["Township", "Makuyu", "Giriama", "Gatura", "Kirwara", "Kimorori"],
    sublocations: ["Sabasaba", "Kambiti", "Ichagaki", "Githumu", "Kirimiri"],
    streets: ["Nairobi-Nyeri Highway", "Uhuru Highway Murang'a", "Maragua Main Road", "Kenol Junction"]
  }
};

const DEFAULT_REGIONAL_LOGISTICS: LogisticsHierarchy = {
  towns: ["Central District / Town", "North District", "South District", "East District", "West District", "Municipal Center"],
  locations: ["Central Location", "Market Center", "Highway Junction", "Administrative Center", "Commercial Zone"],
  sublocations: ["Town Center Sub-location", "North Ward", "South Ward", "East Ward", "West Ward"],
  streets: ["Main Street / Highway", "Market Road", "Hospital Road", "School Lane", "Opposite Chief's Camp", "Supermarket Landmark"]
};

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Fallback Initial Catalog Items for Instant Loading
const INITIAL_FALLBACK_PRODUCTS: Product[] = [
  {
    id: 101,
    brandName: "Mwea Super Pishori Grade 1",
    variety: "Pure Pishori (Rice 217)",
    weightKg: 25,
    basePrice: 4800,
    buyingPrice: 3800,
    flashSalePrice: 4200,
    stockQuantity: 145,
    imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    description: "100% Pure long-grain aromatic Pishori rice freshly harvested from Tebere & Thiba irrigation schemes in Mwea, Kirinyaga County. Sun-dried and double polished.",
    millingGrade: "Grade 1 Super Aromatic",
    isOrganic: true
  },
  {
    id: 102,
    brandName: "Aromatic Basmati Supreme",
    variety: "Long-Grain Basmati",
    weightKg: 10,
    basePrice: 2150,
    buyingPrice: 1650,
    flashSalePrice: 1850,
    stockQuantity: 88,
    imageUrl: "https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=800&q=80",
    description: "Fluffy non-sticky long-grain Basmati rice. Expands up to twice its length upon cooking with delicate floral aroma.",
    millingGrade: "Export Grade Alpha",
    isOrganic: false
  },
  {
    id: 103,
    brandName: "Kilimo Organic Brown Rice",
    variety: "Wholegrain Pishori Brown",
    weightKg: 5,
    basePrice: 1250,
    buyingPrice: 900,
    flashSalePrice: 1050,
    stockQuantity: 42,
    imageUrl: "https://images.unsplash.com/photo-1596560548464-f010549b84d7?auto=format&fit=crop&w=800&q=80",
    description: "Nutrient-rich unpolished brown rice preserving full bran layers and natural mineral germ. High dietary fiber content.",
    millingGrade: "Unpolished Wholegrain",
    isOrganic: true
  },
  {
    id: 104,
    brandName: "Mwea Harvest Bulk Commercial Sack",
    variety: "Komboka Choice",
    weightKg: 50,
    basePrice: 8900,
    buyingPrice: 7100,
    flashSalePrice: 8100,
    stockQuantity: 30,
    imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    description: "Wholesale heavy-duty 50kg polypropylene bag designed for school caterers, restaurants, hotels, and retail store re-bagging.",
    millingGrade: "Standard Milling Grade 2",
    isOrganic: false
  }
];

// ============================================================================
// SECTION 3: UTILITY FUNCTIONS & FORMATTERS
// ============================================================================

const formatKES = (amount: number): string => {
  return new Intl.NumberFormat('en-KE', { 
    style: 'currency', 
    currency: 'KES', 
    maximumFractionDigits: 0 
  }).format(amount || 0);
};

const formatDateKE = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

const formatShippingAddress = (addr: any): string => {
  if (!addr) return 'Standard Regional Delivery';
  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object') {
    return addr.streetAddress 
      || addr.details 
      || addr.location 
      || [addr.town, addr.county].filter(Boolean).join(', ') 
      || JSON.stringify(addr);
  }
  return String(addr);
};

const extractPaymentInfo = (order: any) => {
  if (!order) return { status: 'PENDING', isPaid: false, receipt: null, reason: null, method: 'M-Pesa STK', paidAt: null };
  
  const pd = order.paymentDetails || {};
  const isPaid = pd.isPaid === true 
    || pd.paidTag === 'PAID' 
    || order.status === 'paid' 
    || order.status === 'completed' 
    || order.status === 'delivered';
  
  const tag = pd.paidTag 
    || (isPaid ? 'PAID' : (pd.failureReason || order.status === 'payment_failed' ? 'FAILED' : 'PENDING'));
  
  return {
    status: tag as 'PAID' | 'PENDING' | 'FAILED' | 'OVERRIDDEN',
    isPaid: isPaid,
    receipt: pd.mpesaReceipt || pd.rawCallback?.mpesa_code || null,
    reason: pd.failureReason || null,
    method: pd.method || 'M-Pesa STK',
    paidAt: pd.paidAt || null
  };
};

const formatCountdownMs = (ms: number): string => {
  if (ms <= 0) return '00:00:00';
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const calculatePointsEarned = (weightKg: number): number => {
  return Number((weightKg * 0.2).toFixed(2));
};

// ============================================================================
// SECTION 4: SVG FINANCIAL GROWTH CHART ENGINE
// Custom visualizer rendering database monthly revenue/profit timelines
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

  // Normalize full 12-month timeline ensuring empty months are represented
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

  // Determine dynamic scale bound for dynamic graph bounds
  const maxValue = useMemo(() => {
    let max = 0;
    fullYearMonths.forEach(m => {
      const val = metric === 'revenue' ? m.totalRevenue : metric === 'profit' ? m.netProfit : m.totalKgSold;
      if (val > max) max = val;
    });
    return max > 0 ? max * 1.18 : 10000;
  }, [fullYearMonths, metric]);

  const svgWidth = 850;
  const svgHeight = 290;
  const paddingX = 55;
  const paddingY = 45;
  const graphWidth = svgWidth - paddingX * 2;
  const graphHeight = svgHeight - paddingY * 2;

  // Calculate coordinates for SVG line pathing
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
      
      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xl font-black text-white">Database Financial Growth Engine</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time monthly revenue, profit margin & volume aggregation from verified orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Year Switcher */}
          <div className="flex items-center gap-2 bg-slate-800/90 px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-bold">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">Year:</span>
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
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs font-bold">
            <button 
              onClick={() => setMetric('revenue')}
              className={`px-3 py-1.5 rounded-lg transition-all ${metric === 'revenue' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Revenue
            </button>
            <button 
              onClick={() => setMetric('profit')}
              className={`px-3 py-1.5 rounded-lg transition-all ${metric === 'profit' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Net Profit
            </button>
            <button 
              onClick={() => setMetric('kg')}
              className={`px-3 py-1.5 rounded-lg transition-all ${metric === 'kg' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Volume (Kg)
            </button>
          </div>
        </div>
      </div>

      {/* SVG Interactive Canvas */}
      <div className="relative w-full overflow-x-auto">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
            <span>Calculating financial ledger statistics from database...</span>
          </div>
        ) : (
          <div className="min-w-[700px]">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
              <defs>
                <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Reference Lines */}
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
                      x={paddingX - 10} 
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

              {/* Gradient Area Fill */}
              <path 
                d={areaD} 
                fill={metric === 'revenue' ? "url(#emeraldGrad)" : metric === 'profit' ? "url(#tealGrad)" : "url(#amberGrad)"} 
              />

              {/* Line Curve */}
              <path 
                d={pathD} 
                fill="none" 
                stroke={metric === 'revenue' ? "#10b981" : metric === 'profit' ? "#14b8a6" : "#f59e0b"} 
                strokeWidth="3.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />

              {/* Interactive Points */}
              {points.map((p, idx) => {
                const isEmpty = p.val === 0;

                return (
                  <g key={idx} className="group cursor-pointer">
                    {/* Vertical Guideline */}
                    <line 
                      x1={p.x} 
                      y1={paddingY} 
                      x2={p.x} 
                      y2={svgHeight - paddingY} 
                      stroke="#1e293b" 
                      strokeWidth="1"
                      className="group-hover:stroke-slate-500 transition-colors"
                    />

                    {isEmpty ? (
                      /* Empty Month Visual Indicator */
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
                      /* Active Month Marker */
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

                    {/* Month X-Axis Label */}
                    <text 
                      x={p.x} 
                      y={svgHeight - paddingY + 22} 
                      fill={isEmpty ? "#64748b" : "#f8fafc"} 
                      fontSize="11" 
                      fontWeight={isEmpty ? "500" : "800"} 
                      textAnchor="middle"
                    >
                      {p.month}
                    </text>

                    {/* Hover Tooltip Box */}
                    <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <rect 
                        x={p.x - 70} 
                        y={p.y - 58} 
                        width="140" 
                        height="48" 
                        rx="10" 
                        fill="#022c22" 
                        stroke="#10b981" 
                        strokeWidth="1.5" 
                      />
                      <text x={p.x} y={p.y - 40} fill="#ffffff" fontSize="10" fontWeight="800" textAnchor="middle">
                        {p.month} {selectedYear} ({p.orders} Orders)
                      </text>
                      <text x={p.x} y={p.y - 24} fill="#34d399" fontSize="11" fontWeight="900" textAnchor="middle">
                        {isEmpty ? 'No Orders Logged' : metric === 'kg' ? `${p.val} kg Sold` : formatKES(p.val)}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Monthly Breakdown Matrix */}
      <div className="pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            12-Month Ledger Breakdown Matrix ({selectedYear})
          </h4>
          <span className="text-[10px] text-slate-500 font-mono">Real-time DB Sync</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {fullYearMonths.map((m) => {
            const isEmpty = m.totalRevenue === 0;

            return (
              <div 
                key={m.monthIndex} 
                className={`p-3 rounded-2xl border transition-all ${
                  isEmpty 
                    ? 'bg-slate-950/40 border-slate-800/80 text-slate-500' 
                    : 'bg-slate-800/70 border-emerald-900/50 text-slate-100 hover:border-emerald-500/50'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                  <span>{m.monthName}</span>
                  {isEmpty ? (
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                      0
                    </span>
                  ) : (
                    <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800/50 font-bold">
                      {m.orderCount} ord
                    </span>
                  )}
                </div>

                <div className="text-xs sm:text-sm font-extrabold text-white">
                  {isEmpty ? '-' : formatKES(m.totalRevenue)}
                </div>

                {!isEmpty && (
                  <div className="flex justify-between items-center text-[10px] mt-1 text-slate-400 border-t border-slate-700/50 pt-1">
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
// SECTION 5: REUSABLE PRODUCT CARD COMPONENT
// Dual-column prioritized on phones (grid-cols-2), 4-column on desktop
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
    <div className="group relative bg-white rounded-3xl p-3 sm:p-4 border border-emerald-100 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 flex flex-col justify-between h-full">
      
      {/* Media Box & Dynamic Floating Badges */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-emerald-50/50 mb-3">
        <img 
          src={product.imageUrl || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80'} 
          alt={product.brandName} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Dynamic Weight Badge */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start z-10">
          <span className="bg-emerald-950/90 text-emerald-200 font-black text-[10px] px-2.5 py-0.5 rounded-full backdrop-blur-md uppercase tracking-wider shadow-sm border border-emerald-700/50">
            {product.weightKg}kg Sack
          </span>
          {product.isOrganic && (
            <span className="bg-teal-700/90 text-white font-bold text-[9px] px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 shadow-sm">
              <Leaf className="w-2.5 h-2.5" /> Organic
            </span>
          )}
        </div>

        {hasDiscount && (
          <div className="absolute top-2 right-2 bg-rose-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-md animate-pulse">
            FLASH SALE
          </div>
        )}

        {/* Quick View Interactive Overlay */}
        <button 
          onClick={onQuickView}
          className="absolute inset-x-3 bottom-3 py-2 rounded-xl bg-white/95 text-slate-800 text-xs font-extrabold shadow-lg opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-1.5 backdrop-blur-sm cursor-pointer hover:bg-emerald-600 hover:text-white"
          aria-label="Quick View Details"
        >
          <Eye className="w-3.5 h-3.5" /> Quick View
        </button>
      </div>

      {/* Item Metadata */}
      <div className="space-y-2 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-1 text-[11px] text-emerald-700 font-bold">
            <span className="truncate">{product.variety}</span>
            <span className="text-[10px] text-slate-400 font-medium">Mwea Grade 1</span>
          </div>

          <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 mt-0.5 group-hover:text-emerald-800 transition-colors">
            {product.brandName}
          </h3>
        </div>

        {/* Pricing & Stock Status */}
        <div className="pt-2 border-t border-slate-100 space-y-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm sm:text-base font-black text-emerald-800">
              {formatKES(effectivePrice)}
            </span>
            {hasDiscount && (
              <span className="text-[11px] text-slate-400 line-through font-semibold">
                {formatKES(originalPrice)}
              </span>
            )}
          </div>

          {/* Stock Availability Indicator */}
          <div className="flex items-center justify-between text-[10px] sm:text-[11px]">
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
                <Check className="w-3 h-3" /> Stocked ({product.stockQuantity})
              </span>
            )}

            <span className="text-[10px] text-slate-400 font-semibold">
              +{calculatePointsEarned(product.weightKg)} Pts
            </span>
          </div>
        </div>

        {/* Cart Dispatch Button */}
        <button 
          onClick={onAddToCart}
          disabled={isOutOfStock}
          className="w-full mt-2 py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>{isOutOfStock ? 'Sold Out' : 'Add To Cart'}</span>
        </button>
      </div>

    </div>
  );
};

// ============================================================================
// SECTION 6: QUICK VIEW MODAL COMPONENT
// ============================================================================

interface QuickViewModalProps {
  product: Product | null;
  flashActive?: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, qty: number) => void;
}

const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  flashActive = false,
  onClose,
  onAddToCart
}) => {
  const [qty, setQty] = useState(1);

  if (!product) return null;

  const effectivePrice = flashActive && product.flashSalePrice ? product.flashSalePrice : (product.basePrice || product.price || 0);
  const originalPrice = product.basePrice || product.price || 0;
  const hasDiscount = flashActive && product.flashSalePrice && product.flashSalePrice < originalPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative border border-emerald-100 overflow-hidden max-h-[90vh] overflow-y-auto space-y-6">
        
        {/* Close Modal Trigger */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Image Frame */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-emerald-50 border border-emerald-100">
            <img 
              src={product.imageUrl || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80'} 
              alt={product.brandName} 
              className="w-full h-full object-cover"
            />
            {product.isOrganic && (
              <span className="absolute top-3 left-3 bg-teal-700 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                <Leaf className="w-3 h-3" /> Certified Organic Harvest
              </span>
            )}
          </div>

          {/* Detailed Product Specifications */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">
                {product.variety}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {product.brandName}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {product.description || 'Premium long-grain aromatic rice directly grown and double-milled in Mwea, Kenya.'}
              </p>
            </div>

            <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Weight Packaging:</span>
                <span className="text-emerald-800 font-extrabold">{product.weightKg} kg Poly Bag</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Milling Grade:</span>
                <span className="text-emerald-800 font-extrabold">{product.millingGrade || 'Grade 1 Super Aromatic'}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Reward Points:</span>
                <span className="text-teal-700 font-extrabold">+{calculatePointsEarned(product.weightKg)} Points</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-black text-emerald-800">
                  {formatKES(effectivePrice)}
                </span>
                {hasDiscount && (
                  <span className="text-sm text-slate-400 line-through font-semibold">
                    {formatKES(originalPrice)}
                  </span>
                )}
              </div>

              {/* Quantity Selector & Add To Cart Button */}
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                  <button 
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="px-3.5 py-2 font-bold text-slate-600 hover:bg-slate-200"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 font-black text-xs text-slate-800">{qty}</span>
                  <button 
                    onClick={() => setQty(qty + 1)}
                    className="px-3.5 py-2 font-bold text-slate-600 hover:bg-slate-200"
                  >
                    +
                  </button>
                </div>

                <button 
                  onClick={() => {
                    onAddToCart(product, qty);
                    onClose();
                  }}
                  disabled={product.stockQuantity <= 0}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-extrabold text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Add {qty} To Cart</span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

// ============================================================================
// SECTION 7: MAIN APPLICATION COMPONENT
// ============================================================================

export default function PremiumRiceStore() {
  // ROUTING & VIEW STATES
  const [view, setView] = useState<'home' | 'shop' | 'cart' | 'login' | 'admin' | 'profile'>('home');
  const [user, setUser] = useState<UserAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // CATALOG & STORE DATA STATES
  const [products, setProducts] = useState<Product[]>(INITIAL_FALLBACK_PRODUCTS);
  const [carousel, setCarousel] = useState<CarouselSlide[]>([]);
  
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
  const [countyOverrides, setCountyOverrides] = useState<{ [key: string]: number }>({});
  const [socket, setSocket] = useState<Socket | null>(null);

  // REAL-TIME PAYHERO PAYMENT STATUS MODAL STATE
  const [activePaymentModal, setActivePaymentModal] = useState<{
    isOpen: boolean;
    orderId: string | number | null;
    status: 'PENDING' | 'PAID' | 'FAILED' | 'OVERRIDDEN';
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
  
  // AUTH FORM STATES
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'reset'>('request');
  const [formData, setFormData] = useState({ phoneNumber: '', email: '', password: '', fullName: '', resetToken: '', newPassword: '' });
  
  // ADMIN PANEL NAVIGATION & DATA STATES
  const [adminTab, setAdminTab] = useState<'inventory' | 'orders' | 'finances' | 'users' | 'config' | 'hero' | 'logs'>('inventory');
  const [newProduct, setNewProduct] = useState({ 
    brandName: '', variety: '', weightKg: '', basePrice: '', buyingPrice: '', flashSalePrice: '', stockQuantity: '', imageUrl: '', description: '', isOrganic: false 
  });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserAccount[]>([]);
  const [adminLogs, setAdminLogs] = useState<AuditLog[]>([]);
  const [financialData, setFinancialData] = useState<FinancialAnalyticsResponse | null>(null);
  const [financeYear, setFinanceYear] = useState<number>(new Date().getFullYear());
  
  // SEARCH & FILTER STATES
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  
  // CATALOG FILTERING STATES
  const [shopSearch, setShopSearch] = useState('');
  const [selectedVariety, setSelectedVariety] = useState<string>('All');
  const [selectedWeight, setSelectedWeight] = useState<string>('All');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(15000);
  const [onlyOrganic, setOnlyOrganic] = useState<boolean>(false);
  
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
    const delay = currentMedia?.type === 'video' ? 8000 : 4500;

    const timeoutId = setTimeout(() => {
      setActiveHeroIndex(prev => prev + 1);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [activeHeroIndex, heroSettings]);

  // CASCADE REGIONAL LOGISTICS SELECTION WHEN COUNTY CHANGES
  useEffect(() => {
    const currentData = REGIONAL_LOGISTICS_DATA[checkoutData.county] || DEFAULT_REGIONAL_LOGISTICS;
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
  // SECTION 8: API FETCHERS & DISPATCHERS
  // ============================================================================

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/products/catalog`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setProducts(data);
        }
      }
    } catch (err) {
      console.error("Failed to load catalog, using default fallback data:", err);
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

  // CART OPERATIONS
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
    return calculatePointsEarned(totalCartWeightKg);
  }, [totalCartWeightKg]);

  // AUTH HANDLERS
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLogin ? '/user/login' : '/user/signup';
    
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (res.ok && data.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        showToast(isLogin ? `Welcome back, ${data.user.fullName}!` : 'Account created successfully!', 'success');
        setView(data.user.role === 'admin' ? 'admin' : 'home');
      } else {
        showToast(data.error || 'Authentication failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Server authentication error', 'error');
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetStep === 'request') {
      try {
        const res = await fetch(`${API_BASE_URL}/user/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email })
        });
        const data = await res.json();
        if (res.ok) {
          showToast(data.message || 'OTP sent to your email address.', 'success');
          setResetStep('reset');
        } else {
          showToast(data.error || 'Failed to request OTP', 'error');
        }
      } catch (err: any) {
        showToast(err.message || 'Failed to dispatch password reset request', 'error');
      }
    } else {
      try {
        const res = await fetch(`${API_BASE_URL}/user/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
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
    setView('home');
    showToast('Logged out successfully.', 'info');
  };

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

    if (checkoutData.paymentMethod === 'mpesa_stk' && !checkoutData.stkPhoneNumber) {
      showToast('Please enter your M-Pesa phone number for STK Push prompt.', 'error');
      return;
    }

    setIsCheckingOut(true);

    try {
      const payload = {
        cartItems: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
        paymentMethod: checkoutData.paymentMethod,
        mpesaPhoneNumber: checkoutData.stkPhoneNumber,
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
        setActivePaymentModal({
          isOpen: true,
          orderId: data.id,
          status: initialPaymentInfo.status as any,
          receipt: initialPaymentInfo.receipt,
          reason: initialPaymentInfo.reason,
          phoneNumber: checkoutData.stkPhoneNumber || user?.phoneNumber || 'N/A',
          amount: cartGrandTotal,
          isPolling: true
        });

        if (data.stkPromptSent) {
          showToast('STK Push dispatched to handset! Enter M-Pesa PIN to complete.', 'success');
        } else {
          showToast(`Order #${data.id} placed successfully. Verifying status...`, 'success');
        }
      } else {
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
      const res = await fetch(`${API_BASE_URL}/payments/stkpush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          phoneNumber: phone,
          amount
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('STK push prompt resent to handset.', 'success');
        setActivePaymentModal({
          isOpen: true,
          orderId,
          status: 'PENDING',
          receipt: null,
          reason: null,
          phoneNumber: phone,
          amount,
          isPolling: true
        });
      } else {
        showToast(data.error || 'Failed to dispatch STK Push', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'STK Push dispatch error', 'error');
    }
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
        showToast('Failed to update product', 'error');
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
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // CSV EXPORTER FOR FINANCIAL ANALYTICS
  const handleExportFinancialCSV = () => {
    if (!financialData) return;
    const headers = ["Month Index", "Month Name", "Year", "Total Revenue (KES)", "Buying Costs (KES)", "Net Profit (KES)", "Total Kg Sold", "Order Count"];
    const rows = financialData.monthlyBreakdown.map(m => [
      m.monthIndex + 1,
      m.monthName,
      m.year,
      m.totalRevenue,
      m.totalBuyingCost,
      m.netProfit,
      m.totalKgSold,
      m.orderCount
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mwea_rice_hub_financial_report_${financialData.year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Financial report downloaded as CSV file.", "success");
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
      const matchesOrganic = !onlyOrganic || p.isOrganic === true;

      return matchesSearch && matchesVariety && matchesWeight && matchesPrice && matchesOrganic;
    });
  }, [products, shopSearch, selectedVariety, selectedWeight, maxPriceFilter, onlyOrganic, flashSale.active]);

  const filteredAdminOrders = useMemo(() => {
    return adminOrders.filter(o => {
      const matchesSearch = String(o.id).includes(orderSearchQuery) ||
                            o.User?.fullName?.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
                            o.mpesaPhoneNumber?.includes(orderSearchQuery) ||
                            o.county?.toLowerCase().includes(orderSearchQuery.toLowerCase());
      const matchesStatus = orderStatusFilter === 'ALL' || o.status.toUpperCase() === orderStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [adminOrders, orderSearchQuery, orderStatusFilter]);

  const filteredAdminUsers = useMemo(() => {
    return adminUsers.filter(u => 
      u.fullName?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.phoneNumber?.includes(userSearchQuery)
    );
  }, [adminUsers, userSearchQuery]);

  const filteredAdminLogs = useMemo(() => {
    return adminLogs.filter(l => 
      l.performedByName?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      l.action?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      l.module?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      l.details?.toLowerCase().includes(logSearchQuery.toLowerCase())
    );
  }, [adminLogs, logSearchQuery]);

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
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased pb-20 md:pb-0">
      
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
            {user && (
              <button 
                onClick={() => setView('profile')} 
                className={`transition-all py-1.5 ${view === 'profile' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-600 hover:text-emerald-700'}`}
              >
                My Orders & Points
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
                  className="p-2 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Log Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setView('login')} 
                className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
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
            {user ? (
              <>
                <button onClick={() => { setView('profile'); setMobileMenuOpen(false); }} className="text-left font-bold py-2.5 text-slate-700 border-b border-slate-100 flex items-center justify-between">
                  <span>My Orders & Points ({user.rewardPoints || 0} pts)</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
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
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-emerald-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              
              {/* Search Bar */}
              <div className="relative lg:col-span-1">
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

              {/* Organic Toggle Checkbox */}
              <div className="flex items-center justify-start sm:justify-center">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-extrabold text-slate-700">
                  <input 
                    type="checkbox"
                    checked={onlyOrganic}
                    onChange={(e) => setOnlyOrganic(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="flex items-center gap-1 text-emerald-800">
                    <Leaf className="w-3.5 h-3.5" /> Organic Harvest Only
                  </span>
                </label>
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
                  onClick={() => { setShopSearch(''); setSelectedVariety('All'); setSelectedWeight('All'); setMaxPriceFilter(15000); setOnlyOrganic(false); }}
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
                  />
                ))}
              </div>
            )}
          </div>
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
                        const effectivePrice = flashSale.active && p.flashSalePrice ? p.flashSalePrice : (p.basePrice || p.price || 0);

                        return (
                          <div key={item.productId} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <img 
                                src={p.imageUrl || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80'} 
                                alt={p.brandName} 
                                className="w-14 h-14 rounded-2xl object-cover border border-slate-100"
                              />
                              <div>
                                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">{p.brandName}</h4>
                                <p className="text-[11px] text-slate-500">{p.variety} • {p.weightKg}kg Sack</p>
                                <p className="text-emerald-700 font-black text-xs sm:text-sm mt-0.5">{formatKES(effectivePrice)}</p>
                              </div>
                            </div>

                            {/* Quantity Adjusters */}
                            <div className="flex items-center justify-between sm:justify-end gap-3">
                              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                <button 
                                  onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                                  className="px-3 py-1 text-slate-600 hover:bg-slate-200 font-bold cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="px-3 py-1 font-bold text-xs text-slate-800">{item.quantity}</span>
                                <button 
                                  onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                                  className="px-3 py-1 text-slate-600 hover:bg-slate-200 font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>

                              <button 
                                onClick={() => removeFromCart(item.productId)}
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
                            onChange={(e) => setCheckoutData(prev => ({ ...prev, town: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium bg-white cursor-pointer"
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
                            onChange={(e) => setCheckoutData(prev => ({ ...prev, location: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium bg-white cursor-pointer"
                          >
                            {(REGIONAL_LOGISTICS_DATA[checkoutData.county]?.locations || DEFAULT_REGIONAL_LOGISTICS.locations).map(l => (
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
                            onChange={(e) => setCheckoutData(prev => ({ ...prev, sublocation: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium bg-white cursor-pointer"
                          >
                            {(REGIONAL_LOGISTICS_DATA[checkoutData.county]?.sublocations || DEFAULT_REGIONAL_LOGISTICS.sublocations).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Street / Landmark</label>
                          <select 
                            value={checkoutData.shippingAddress}
                            onChange={(e) => setCheckoutData(prev => ({ ...prev, shippingAddress: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium bg-white cursor-pointer"
                          >
                            {(REGIONAL_LOGISTICS_DATA[checkoutData.county]?.streets || DEFAULT_REGIONAL_LOGISTICS.streets).map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Gateway & Order Summary Box */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4">
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-600" /> Order Summary & M-Pesa STK
                    </h3>

                    {/* Phone Number Input for M-Pesa STK Push */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700">
                        M-Pesa Express Phone Number (254...)
                      </label>
                      <input 
                        type="text"
                        placeholder="254712345678"
                        value={checkoutData.stkPhoneNumber}
                        onChange={(e) => setCheckoutData(prev => ({ ...prev, stkPhoneNumber: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="text-[10px] text-slate-500">An STK prompt will automatically pop up on this phone handset to enter M-Pesa PIN.</p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 text-xs font-semibold">
                      <div className="flex justify-between text-slate-600">
                        <span>Items Subtotal:</span>
                        <span className="font-bold text-slate-900">{formatKES(cartSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Freight Transport ({checkoutData.county}):</span>
                        <span className="font-bold text-slate-900">{formatKES(activeShippingFee)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Earned Loyalty Points:</span>
                        <span>+{expectedRewardPoints} Pts</span>
                      </div>
                      <div className="flex justify-between text-sm sm:text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                        <span>Grand Total:</span>
                        <span className="text-emerald-800">{formatKES(cartGrandTotal)}</span>
                      </div>
                    </div>

                    <button 
                      onClick={handlePlaceOrder}
                      disabled={isCheckingOut}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm transition-all shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isCheckingOut ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Dispatching STK Push...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 text-amber-300" />
                          <span>Pay {formatKES(cartGrandTotal)} via M-Pesa STK</span>
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
        {/* VIEW: AUTHENTICATION (LOGIN / SIGNUP / FORGOT PASSWORD)             */}
        {/* =================================================================== */}
        {view === 'login' && (
          <div className="container mx-auto px-4 py-12 flex justify-center">
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-emerald-100 max-w-md w-full space-y-6">
              
              {/* Header */}
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                  <UserIcon className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">
                  {isForgotPassword ? 'Reset Your Password' : isLogin ? 'Welcome Back' : 'Create Mwea Hub Account'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isForgotPassword ? 'Enter your registered email to receive an OTP code.' : 'Access pure farm-direct grain pricing and order tracking.'}
                </p>
              </div>

              {/* Forgot Password Flow */}
              {isForgotPassword ? (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 text-xs font-semibold">
                  <div>
                    <label className="block text-slate-700 mb-1">Email Address</label>
                    <input 
                      type="email"
                      required
                      placeholder="user@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {resetStep === 'reset' && (
                    <>
                      <div>
                        <label className="block text-slate-700 mb-1">OTP Verification Code</label>
                        <input 
                          type="text"
                          required
                          placeholder="123456"
                          value={formData.resetToken}
                          onChange={(e) => setFormData({ ...formData, resetToken: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 mb-1">New Account Password</label>
                        <input 
                          type="password"
                          required
                          placeholder="••••••••"
                          value={formData.newPassword}
                          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </>
                  )}

                  <button 
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-xs shadow-md hover:bg-emerald-700 cursor-pointer"
                  >
                    {resetStep === 'request' ? 'Send OTP Code' : 'Update Password'}
                  </button>

                  <button 
                    type="button"
                    onClick={() => { setIsForgotPassword(false); setResetStep('request'); }}
                    className="w-full text-center text-slate-500 hover:text-slate-800 text-xs font-bold pt-2 cursor-pointer"
                  >
                    Back to Login
                  </button>
                </form>
              ) : (
                /* Login / Signup Form */
                <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs font-semibold">
                  {!isLogin && (
                    <div>
                      <label className="block text-slate-700 mb-1">Full Legal Name</label>
                      <input 
                        type="text"
                        required
                        placeholder="John Doe"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-700 mb-1">M-Pesa Phone Number</label>
                    <input 
                      type="text"
                      required
                      placeholder="254712345678"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {!isLogin && (
                    <div>
                      <label className="block text-slate-700 mb-1">Email Address (Optional)</label>
                      <input 
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-slate-700">Account Password</label>
                      {isLogin && (
                        <button 
                          type="button" 
                          onClick={() => setIsForgotPassword(true)}
                          className="text-emerald-700 hover:underline text-[11px]"
                        >
                          Forgot?
                        </button>
                      )}
                    </div>
                    <input 
                      type="password"
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-xs shadow-md hover:bg-emerald-700 cursor-pointer"
                  >
                    {isLogin ? 'Sign In To Account' : 'Register New Account'}
                  </button>

                  <div className="pt-2 text-center">
                    <button 
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-slate-600 hover:text-emerald-700 text-xs font-bold cursor-pointer"
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
        {/* VIEW: CUSTOMER PROFILE & ORDER HISTORY                              */}
        {/* =================================================================== */}
        {view === 'profile' && user && (
          <div className="container mx-auto px-4 py-8 space-y-8">
            
            {/* Account Profile Header Card */}
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2">
                <span className="bg-emerald-500/30 text-emerald-300 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-400/20">
                  {user.role === 'admin' ? 'Administrator' : 'Verified Customer'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black">{user.fullName}</h2>
                <p className="text-xs text-emerald-200">Phone: {user.phoneNumber} {user.email && `• ${user.email}`}</p>
              </div>

              {/* Reward Points Box */}
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Reward Balance</p>
                <p className="text-3xl font-black text-amber-300">{user.rewardPoints || 0} Pts</p>
                <p className="text-[10px] text-emerald-200">Earn 0.2 Pts per 1kg purchased</p>
              </div>
            </div>

            {/* User Order History Table */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4">
              <h3 className="text-xl font-black text-slate-900">Your Agricultural Order Receipts</h3>

              {myOrders.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No previous order history recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase">
                        <th className="py-3 px-2">Order #</th>
                        <th className="py-3 px-2">Date</th>
                        <th className="py-3 px-2">Delivery Address</th>
                        <th className="py-3 px-2">Grand Total</th>
                        <th className="py-3 px-2">Payment Status</th>
                        <th className="py-3 px-2">Fulfillment</th>
                        <th className="py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold">
                      {myOrders.map(order => {
                        const payInfo = extractPaymentInfo(order);

                        return (
                          <tr key={order.id} className="hover:bg-slate-50/50">
                            <td className="py-4 px-2 font-black text-slate-900">#{order.id}</td>
                            <td className="py-4 px-2 text-slate-600">{formatDateKE(order.createdAt)}</td>
                            <td className="py-4 px-2 max-w-xs truncate text-slate-600">
                              <button 
                                onClick={() => setViewAddressModal(order)}
                                className="text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="truncate">{order.county} ({order.town})</span>
                              </button>
                            </td>
                            <td className="py-4 px-2 font-black text-slate-900">{formatKES(order.grandTotal)}</td>
                            <td className="py-4 px-2">
                              <button 
                                onClick={() => setViewPaymentDetailsModal(order)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold cursor-pointer border ${
                                  payInfo.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                  payInfo.status === 'FAILED' ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}
                              >
                                {payInfo.status} {payInfo.receipt && `(${payInfo.receipt})`}
                              </button>
                            </td>
                            <td className="py-4 px-2">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                order.status === 'delivered' ? 'bg-emerald-950 text-emerald-300' :
                                order.status === 'dispatched' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-4 px-2">
                              {payInfo.status !== 'PAID' && (
                                <button 
                                  onClick={() => handleRetryStkPush(order.id, order.mpesaPhoneNumber || user.phoneNumber, order.grandTotal)}
                                  className="px-3 py-1 rounded-xl bg-amber-600 text-white font-bold text-[10px] hover:bg-amber-700 cursor-pointer"
                                >
                                  Retry STK
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW: ADMIN CONSOLE DASHBOARD                                       */}
        {/* =================================================================== */}
        {view === 'admin' && user?.role === 'admin' && (
          <div className="container mx-auto px-4 py-8 space-y-8">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-black text-amber-600 uppercase tracking-widest flex items-center gap-1">
                  <Shield className="w-4 h-4" /> System Management Control
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Mwea Rice Hub Admin Console</h2>
              </div>

              {/* Flash Sale Global Switch Button */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleToggleFlashSale(!flashSale.active, 24)}
                  className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer ${
                    flashSale.active 
                      ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>{flashSale.active ? 'Stop Flash Sale' : 'Trigger Flash Sale (24h)'}</span>
                </button>
              </div>
            </div>

            {/* Admin Console Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-xs font-extrabold">
              <button 
                onClick={() => setAdminTab('inventory')}
                className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${adminTab === 'inventory' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Inventory ({products.length})
              </button>
              <button 
                onClick={() => setAdminTab('orders')}
                className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${adminTab === 'orders' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Orders ({adminOrders.length})
              </button>
              <button 
                onClick={() => setAdminTab('finances')}
                className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${adminTab === 'finances' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Financial Analytics Engine
              </button>
              <button 
                onClick={() => setAdminTab('users')}
                className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${adminTab === 'users' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Users Directory ({adminUsers.length})
              </button>
              <button 
                onClick={() => setAdminTab('config')}
                className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${adminTab === 'config' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                47 County Freight Config
              </button>
              <button 
                onClick={() => setAdminTab('hero')}
                className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${adminTab === 'hero' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Hero & Banner Backdrop
              </button>
              <button 
                onClick={() => setAdminTab('logs')}
                className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${adminTab === 'logs' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Audit Logs ({adminLogs.length})
              </button>
            </div>

            {/* TAB 1: INVENTORY MANAGEMENT */}
            {adminTab === 'inventory' && (
              <div className="space-y-8">
                
                {/* Create Product Form */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
                  <h3 className="text-lg font-black text-slate-900">Add New Grain Product</h3>

                  <form onSubmit={handleCreateProduct} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-bold">
                    <div>
                      <label className="block text-slate-700 mb-1">Brand Name</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Mwea Super Pishori" 
                        value={newProduct.brandName} 
                        onChange={(e) => setNewProduct({ ...newProduct, brandName: e.target.value })} 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1">Variety</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Pure Pishori" 
                        value={newProduct.variety} 
                        onChange={(e) => setNewProduct({ ...newProduct, variety: e.target.value })} 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1">Weight (Kg Sack)</label>
                      <input 
                        type="number" 
                        required 
                        placeholder="25" 
                        value={newProduct.weightKg} 
                        onChange={(e) => setNewProduct({ ...newProduct, weightKg: e.target.value })} 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1">Selling Price (KES)</label>
                      <input 
                        type="number" 
                        required 
                        placeholder="4800" 
                        value={newProduct.basePrice} 
                        onChange={(e) => setNewProduct({ ...newProduct, basePrice: e.target.value })} 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1">Buying Cost (KES)</label>
                      <input 
                        type="number" 
                        placeholder="3800" 
                        value={newProduct.buyingPrice} 
                        onChange={(e) => setNewProduct({ ...newProduct, buyingPrice: e.target.value })} 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1">Flash Sale Price (Optional)</label>
                      <input 
                        type="number" 
                        placeholder="4200" 
                        value={newProduct.flashSalePrice} 
                        onChange={(e) => setNewProduct({ ...newProduct, flashSalePrice: e.target.value })} 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1">Stock Quantity</label>
                      <input 
                        type="number" 
                        required 
                        placeholder="100" 
                        value={newProduct.stockQuantity} 
                        onChange={(e) => setNewProduct({ ...newProduct, stockQuantity: e.target.value })} 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1">Image URL</label>
                      <input 
                        type="text" 
                        placeholder="https://..." 
                        value={newProduct.imageUrl} 
                        onChange={(e) => setNewProduct({ ...newProduct, imageUrl: e.target.value })} 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>

                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-slate-700 mb-1">Description</label>
                      <input 
                        type="text" 
                        placeholder="Brief product description..." 
                        value={newProduct.description} 
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700">
                        <input 
                          type="checkbox" 
                          checked={newProduct.isOrganic} 
                          onChange={(e) => setNewProduct({ ...newProduct, isOrganic: e.target.checked })} 
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" 
                        />
                        <span>Is Organic Certified</span>
                      </label>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4 pt-2">
                      <button 
                        type="submit" 
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md cursor-pointer"
                      >
                        Publish Catalog Product
                      </button>
                    </div>
                  </form>
                </div>

                {/* Inventory Table */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4 overflow-x-auto">
                  <h3 className="text-lg font-black text-slate-900">Current Catalog Inventory</h3>

                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase font-black">
                        <th className="py-3 px-2">ID</th>
                        <th className="py-3 px-2">Brand & Variety</th>
                        <th className="py-3 px-2">Weight</th>
                        <th className="py-3 px-2">Selling Price</th>
                        <th className="py-3 px-2">Buying Price</th>
                        <th className="py-3 px-2">Flash Price</th>
                        <th className="py-3 px-2">Stock</th>
                        <th className="py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold">
                      {products.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-3 px-2 font-mono text-slate-400">#{p.id}</td>
                          <td className="py-3 px-2">
                            <p className="font-extrabold text-slate-900">{p.brandName}</p>
                            <p className="text-[10px] text-slate-500">{p.variety}</p>
                          </td>
                          <td className="py-3 px-2">{p.weightKg} kg</td>
                          <td className="py-3 px-2 font-black text-emerald-800">{formatKES(p.basePrice || p.price || 0)}</td>
                          <td className="py-3 px-2 text-slate-500">{p.buyingPrice ? formatKES(p.buyingPrice) : '-'}</td>
                          <td className="py-3 px-2 text-rose-600 font-bold">{p.flashSalePrice ? formatKES(p.flashSalePrice) : '-'}</td>
                          <td className="py-3 px-2 font-bold">{p.stockQuantity}</td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setEditingProduct(p)} 
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                title="Edit Product"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteProduct(p.id)} 
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                                title="Delete Product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

            {/* TAB 2: ORDER FULFILLMENT MANAGEMENT */}
            {adminTab === 'orders' && (
              <div className="space-y-6">
                
                {/* Search & Status Filters */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search Order ID, Customer Phone or County..." 
                      value={orderSearchQuery} 
                      onChange={(e) => setOrderSearchQuery(e.target.value)} 
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
                    {['ALL', 'PENDING', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED'].map(st => (
                      <button 
                        key={st} 
                        onClick={() => setOrderStatusFilter(st)}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${orderStatusFilter === st ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orders List Table */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-black uppercase">
                        <th className="py-3 px-2">Order #</th>
                        <th className="py-3 px-2">Customer Info</th>
                        <th className="py-3 px-2">County Logistics</th>
                        <th className="py-3 px-2">Total Amount</th>
                        <th className="py-3 px-2">PayHero Status</th>
                        <th className="py-3 px-2">Order Status</th>
                        <th className="py-3 px-2">Override</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold">
                      {filteredAdminOrders.map(order => {
                        const payInfo = extractPaymentInfo(order);

                        return (
                          <tr key={order.id} className="hover:bg-slate-50">
                            <td className="py-4 px-2 font-black text-slate-900">#{order.id}</td>
                            <td className="py-4 px-2">
                              <p className="font-extrabold text-slate-900">{order.User?.fullName || 'Guest Customer'}</p>
                              <p className="text-[10px] text-slate-500">{order.mpesaPhoneNumber || order.User?.phoneNumber || 'N/A'}</p>
                            </td>
                            <td className="py-4 px-2">
                              <button 
                                onClick={() => setViewAddressModal(order)}
                                className="text-emerald-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                <span>{order.county}</span>
                              </button>
                            </td>
                            <td className="py-4 px-2 font-black text-slate-900">{formatKES(order.grandTotal)}</td>
                            <td className="py-4 px-2">
                              <button 
                                onClick={() => setViewPaymentDetailsModal(order)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold cursor-pointer border ${
                                  payInfo.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                  payInfo.status === 'FAILED' ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}
                              >
                                {payInfo.status}
                              </button>
                            </td>
                            <td className="py-4 px-2">
                              <select 
                                value={order.status}
                                onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                              >
                                <option value="pending">pending</option>
                                <option value="processing">processing</option>
                                <option value="dispatched">dispatched</option>
                                <option value="delivered">delivered</option>
                                <option value="cancelled">cancelled</option>
                              </select>
                            </td>
                            <td className="py-4 px-2">
                              <button 
                                onClick={() => handleManualPaymentOverride(order.id, !payInfo.isPaid, payInfo.isPaid ? 'PENDING' : 'PAID')}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold cursor-pointer"
                              >
                                {payInfo.isPaid ? 'Mark Unpaid' : 'Override Paid'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* TAB 3: FINANCIAL ANALYTICS ENGINE */}
            {adminTab === 'finances' && (
              <div className="space-y-8">
                
                {/* Financial KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-1 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Money Received</p>
                    <p className="text-2xl font-black text-emerald-800">
                      {financialData ? formatKES(financialData.summary.totalMoneyReceived) : 'KES 0'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold">Verified Paid Customer Orders</p>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-1 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Net Profit</p>
                    <p className="text-2xl font-black text-teal-700">
                      {financialData ? formatKES(financialData.summary.totalNetProfit) : 'KES 0'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold">Margin After Buying Costs</p>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-1 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grain Volume Sold</p>
                    <p className="text-2xl font-black text-amber-600">
                      {financialData ? `${financialData.summary.totalKgSold} kg` : '0 kg'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold">Total Sacks Dispatched</p>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-1 shadow-sm flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reports</p>
                      <p className="text-sm font-extrabold text-slate-800">Export Ledger</p>
                    </div>
                    <button 
                      onClick={handleExportFinancialCSV}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Export CSV
                    </button>
                  </div>
                </div>

                {/* Database Financial Growth SVG Chart */}
                <FinancialGrowthChart 
                  monthlyData={financialData?.monthlyBreakdown || []}
                  selectedYear={financeYear}
                  availableYears={financialData?.availableYears || [2024, 2025, 2026, 2027]}
                  onYearChange={(y) => {
                    setFinanceYear(y);
                    fetchFinancialAnalytics(y);
                  }}
                />

              </div>
            )}

            {/* TAB 4: USERS DIRECTORY */}
            {adminTab === 'users' && (
              <div className="space-y-6">
                
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search User by Name, Email or Phone..." 
                      value={userSearchQuery} 
                      onChange={(e) => setUserSearchQuery(e.target.value)} 
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-black uppercase">
                        <th className="py-3 px-2">ID</th>
                        <th className="py-3 px-2">Full Name</th>
                        <th className="py-3 px-2">Phone Number</th>
                        <th className="py-3 px-2">Email</th>
                        <th className="py-3 px-2">Role</th>
                        <th className="py-3 px-2">Points</th>
                        <th className="py-3 px-2">Status</th>
                        <th className="py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold">
                      {filteredAdminUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="py-3 px-2 font-mono text-slate-400">#{u.id}</td>
                          <td className="py-3 px-2 font-extrabold text-slate-900">{u.fullName}</td>
                          <td className="py-3 px-2">{u.phoneNumber}</td>
                          <td className="py-3 px-2 text-slate-500">{u.email || '-'}</td>
                          <td className="py-3 px-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${u.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-2 font-bold text-emerald-700">{u.rewardPoints} Pts</td>
                          <td className="py-3 px-2">
                            {u.isSuspended ? (
                              <span className="text-rose-600 font-bold">Suspended</span>
                            ) : (
                              <span className="text-emerald-700 font-bold">Active</span>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setEditingUser(u)} 
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                title="Edit User"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleToggleUserSuspension(u.id, !!u.isSuspended)} 
                                className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 cursor-pointer"
                                title="Suspend/Reactivate"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteUserAccount(u.id)} 
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                                title="Delete User"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

            {/* TAB 5: 47 COUNTY FREIGHT CONFIG */}
            {adminTab === 'config' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Override Form */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
                  <h3 className="text-lg font-black text-slate-900">Set County Transport Freight Rate</h3>

                  <form onSubmit={handleSaveCountyOverride} className="space-y-4 text-xs font-bold">
                    <div>
                      <label className="block text-slate-700 mb-1">Select Kenyan County (47 Coverage)</label>
                      <select 
                        value={countyOverrideForm.county}
                        onChange={(e) => setCountyOverrideForm({ ...countyOverrideForm, county: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        {ALL_47_COUNTIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1">Custom Delivery Freight Fee (KES)</label>
                      <input 
                        type="number" 
                        required 
                        placeholder="350" 
                        value={countyOverrideForm.fee} 
                        onChange={(e) => setCountyOverrideForm({ ...countyOverrideForm, fee: e.target.value })} 
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md cursor-pointer"
                    >
                      Save Freight Rate Override
                    </button>
                  </form>
                </div>

                {/* Active Overrides Table */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
                  <h3 className="text-lg font-black text-slate-900">Active Regional Freight Rates</h3>

                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-black uppercase">
                          <th className="py-2.5 px-2">County</th>
                          <th className="py-2.5 px-2">Freight Fee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold">
                        {Object.entries(countyOverrides).map(([county, fee]) => (
                          <tr key={county}>
                            <td className="py-2.5 px-2 font-bold text-slate-800">{county}</td>
                            <td className="py-2.5 px-2 font-black text-emerald-800">{formatKES(Number(fee))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 6: HERO BACKDROP CONFIG */}
            {adminTab === 'hero' && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
                <h3 className="text-lg font-black text-slate-900">Configure Storefront Hero Backdrop</h3>

                <form onSubmit={handleSaveHeroSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
                  <div className="md:col-span-2">
                    <label className="block text-slate-700 mb-1">Hero Title Heading</label>
                    <input 
                      type="text" 
                      value={heroSettings.title} 
                      onChange={(e) => setHeroSettings({ ...heroSettings, title: e.target.value })} 
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-slate-700 mb-1">Hero Subtitle</label>
                    <input 
                      type="text" 
                      value={heroSettings.subtitle} 
                      onChange={(e) => setHeroSettings({ ...heroSettings, subtitle: e.target.value })} 
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">Video Backdrop URL 1 (YouTube Embed)</label>
                    <input 
                      type="text" 
                      value={heroSettings.video1} 
                      onChange={(e) => setHeroSettings({ ...heroSettings, video1: e.target.value })} 
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">Video Backdrop URL 2</label>
                    <input 
                      type="text" 
                      value={heroSettings.video2} 
                      onChange={(e) => setHeroSettings({ ...heroSettings, video2: e.target.value })} 
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">Image Backdrop URL 1</label>
                    <input 
                      type="text" 
                      value={heroSettings.img1} 
                      onChange={(e) => setHeroSettings({ ...heroSettings, img1: e.target.value })} 
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">Image Backdrop URL 2</label>
                    <input 
                      type="text" 
                      value={heroSettings.img2} 
                      onChange={(e) => setHeroSettings({ ...heroSettings, img2: e.target.value })} 
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">Announcement Ticker Text</label>
                    <input 
                      type="text" 
                      value={heroSettings.announcementTicker} 
                      onChange={(e) => setHeroSettings({ ...heroSettings, announcementTicker: e.target.value })} 
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">Support Hotline Display</label>
                    <input 
                      type="text" 
                      value={heroSettings.supportHotlineDisplay} 
                      onChange={(e) => setHeroSettings({ ...heroSettings, supportHotlineDisplay: e.target.value })} 
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div className="md:col-span-2 pt-2">
                    <button 
                      type="submit" 
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md cursor-pointer"
                    >
                      Synchronize Hero Backdrop Settings
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 7: AUDIT LOGS */}
            {adminTab === 'logs' && (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search Audit Trail by User, Action or Module..." 
                      value={logSearchQuery} 
                      onChange={(e) => setLogSearchQuery(e.target.value)} 
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-black uppercase">
                        <th className="py-3 px-2">Timestamp</th>
                        <th className="py-3 px-2">User</th>
                        <th className="py-3 px-2">Module</th>
                        <th className="py-3 px-2">Action</th>
                        <th className="py-3 px-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold">
                      {filteredAdminLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-3 px-2 font-mono text-slate-500">{formatDateKE(log.timestamp)}</td>
                          <td className="py-3 px-2 font-bold text-slate-800">{log.performedByName}</td>
                          <td className="py-3 px-2"><span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] uppercase font-mono">{log.module}</span></td>
                          <td className="py-3 px-2 font-bold text-emerald-700">{log.action}</td>
                          <td className="py-3 px-2 text-slate-500 truncate max-w-xs">{log.details || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* QUICK VIEW POPUP MODAL */}
      <QuickViewModal 
        product={quickViewProduct}
        flashActive={flashSale.active}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={addToCart}
      />

      {/* REAL-TIME PAYHERO PAYMENT STATUS MODAL */}
      {activePaymentModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 text-center border border-emerald-100">
            
            {activePaymentModal.status === 'PENDING' && (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border-4 border-amber-100 animate-pulse">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900">Awaiting M-Pesa PIN Input</h3>
                  <p className="text-xs text-slate-500">
                    STK Push dispatched to <span className="font-extrabold text-slate-800">{activePaymentModal.phoneNumber}</span> for <span className="font-extrabold text-emerald-700">{formatKES(activePaymentModal.amount)}</span>.
                  </p>
                </div>
              </div>
            )}

            {activePaymentModal.status === 'PAID' && (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border-4 border-emerald-200">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900">Payment Confirmed!</h3>
                  <p className="text-xs font-mono bg-emerald-50 text-emerald-800 py-1 px-3 rounded-lg border border-emerald-200 font-bold inline-block">
                    M-Pesa Receipt #{activePaymentModal.receipt || 'VERIFIED'}
                  </p>
                  <p className="text-xs text-slate-500 pt-2">Your grain order has been dispatched to warehouse packing logistics.</p>
                </div>
              </div>
            )}

            {activePaymentModal.status === 'FAILED' && (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto border-4 border-rose-200">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900">Payment Unsuccessful</h3>
                  <p className="text-xs text-rose-600 font-semibold">{activePaymentModal.reason || 'Handset prompt declined or timed out.'}</p>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              {activePaymentModal.status === 'FAILED' && (
                <button 
                  onClick={() => handleRetryStkPush(activePaymentModal.orderId!, activePaymentModal.phoneNumber, activePaymentModal.amount)}
                  className="flex-1 py-3 rounded-xl bg-amber-600 text-white font-extrabold text-xs shadow-md hover:bg-amber-700 cursor-pointer"
                >
                  Retry STK Push
                </button>
              )}
              <button 
                onClick={() => setActivePaymentModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-extrabold text-xs shadow-md hover:bg-black cursor-pointer"
              >
                Close Window
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CLICKABLE ADDRESS DETAILS POPUP MODAL */}
      {viewAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-emerald-100 relative">
            <button 
              onClick={() => setViewAddressModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-emerald-800 font-black text-base border-b border-slate-100 pb-3">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <span>Logistics Delivery Breakdown</span>
            </div>

            <div className="space-y-2 text-xs font-semibold text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-400">County:</span>
                <span className="font-extrabold text-slate-900">{viewAddressModal.county}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Town:</span>
                <span className="font-extrabold text-slate-900">{viewAddressModal.town || 'Central'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Location:</span>
                <span className="font-extrabold text-slate-900">{viewAddressModal.location || 'Central'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Sublocation:</span>
                <span className="font-extrabold text-slate-900">{viewAddressModal.sublocation || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Street / Landmark:</span>
                <span className="font-extrabold text-slate-900">{viewAddressModal.streetAddress || 'Main Street'}</span>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block mb-1">Full Dispatch Address String:</span>
                <p className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800">
                  {formatShippingAddress(viewAddressModal.shippingAddress)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER ROLE/POINTS ADMIN MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 relative">
            <button 
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-black text-slate-900">Edit User Account</h3>

            <form onSubmit={handleSaveUserEdit} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={editingUser.fullName} 
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })} 
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Account Role</label>
                <select 
                  value={editingUser.role} 
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })} 
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="customer">customer</option>
                  <option value="admin">admin</option>
                  <option value="logistics">logistics</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Reward Points Balance</label>
                <input 
                  type="number" 
                  value={editingUser.rewardPoints} 
                  onChange={(e) => setEditingUser({ ...editingUser, rewardPoints: Number(e.target.value) })} 
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" 
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md cursor-pointer"
                >
                  Save User Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FOOTER SECTION */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-800 text-xs mt-auto">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-black text-lg">
              <Leaf className="w-5 h-5 text-emerald-500" />
              <span>MWEA RICE HUB</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Direct farm gate distribution of authentic Kirinyaga County Pishori rice across Kenya. Guaranteed non-blended aromatic quality.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-black uppercase text-[11px] tracking-wider">Quick Navigation</h4>
            <ul className="space-y-1.5 font-semibold">
              <li><button onClick={() => setView('home')} className="hover:text-emerald-400">Home Storefront</button></li>
              <li><button onClick={() => setView('shop')} className="hover:text-emerald-400">Grain Catalog</button></li>
              <li><button onClick={() => setView('cart')} className="hover:text-emerald-400">Regional Checkout</button></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-black uppercase text-[11px] tracking-wider">47 County Logistics</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Automated express door-to-door delivery across Nairobi, Kiambu, Nakuru, Kirinyaga, Mombasa, Kisumu, Eldoret, Machakos, and all surrounding counties.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-white font-black uppercase text-[11px] tracking-wider">Customer Care</h4>
            <p className="text-[11px]">Hotline: {heroSettings.supportHotlineDisplay}</p>
            <p className="text-[11px]">PayHero M-Pesa STK Verified</p>
            <p className="text-[10px] text-emerald-500 font-bold pt-2">© 2026 Mwea Rice Hub. All Rights Reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
