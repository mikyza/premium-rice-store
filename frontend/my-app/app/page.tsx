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
  XCircle, Zap, Ban, UserCheck, UserX, ShieldAlert, FileSpreadsheet
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
    towns: ["Nyali", "Mvita", "Kisauni", "Likoni", "Changamwe", "Jomvu"],
    locations: ["Bamburi", "Tudor", "Ganjoni", "Port Reitz", "Kongowea", "Shanzu", "Buxton"],
    sublocations: ["Mkomani", "Tononoka", "Mikindani", "Bamburi Mtambo", "Nyali Beach", "Magaoni", "Chaani"],
    streets: ["Moi Avenue Mombasa", "Nkrumah Road", "Links Road", "Malindi Road", "Mama Ngina Drive", "Digo Road", "Nyerere Avenue"]
  },
  "Kwale": {
    towns: ["Ukunda", "Diani", "Msambweni", "Lunga Lunga", "Kinango", "Kwale Town"],
    locations: ["Gombato", "Pongwe", "Tiwi", "Ramisi", "Mwereni", "Vanga"],
    sublocations: ["Diani Complex", "Bongwe", "Kwale Central", "Mwavumbo", "Dzombo"],
    streets: ["Diani Beach Road", "Lunga Lunga Highway", "Kwale-Ukunda Road", "Hospital Road"]
  },
  "Kilifi": {
    towns: ["Kilifi Town", "Malindi", "Mtwapa", "Watamu", "Mariakani", "Kaloleni"],
    locations: ["Tezo", "Gede", "Sokoni", "Takaungu", "Rabai", "Mambrui"],
    sublocations: ["Mtwapa Creek", "Kibarani", "Watamu Beach Sub", "Mnarani", "Chonyi"],
    streets: ["Mombasa-Malindi Highway", "Mtwapa Mall Road", "Mariakani Highway", "Lamamu Road"]
  },
  "Tana River": {
    towns: ["Hola", "Garsen", "Bura", "Madogo"],
    locations: ["Wayu", "Chewani", "Kipini", "Wenje", "Nia"],
    sublocations: ["Hola Central", "Garsen South", "Bura Stage", "Madogo Border"],
    streets: ["Garissa-Garsen Road", "Hola Market Street", "River Road Hola"]
  },
  "Lamu": {
    towns: ["Lamu Town", "Mpeketoni", "Amu", "Kiunga", "Witu"],
    locations: ["Shela", "Matondoni", "Ipren", "Hongwe", "Bahari"],
    sublocations: ["Shela Village", "Mpeketoni Center", "Lamu Fort Area", "Manda Island"],
    streets: ["Lamu Seafront", "Mpeketoni Main Road", "Shela Beach Walk"]
  },
  "Taita-Taveta": {
    towns: ["Voi", "Taveta", "Wundanyi", "Mwatate"],
    locations: ["Kaloleni Voi", "Mbololo", "Chala", "Bura Taita", "Werugha"],
    sublocations: ["Voi CBD", "Taveta Border", "Wundanyi Stage", "Mwatate Junction"],
    streets: ["Nairobi-Mombasa Highway (Voi)", "Taveta Road", "Voi Main Market Street"]
  },
  "Garissa": {
    towns: ["Garissa Town", "Dadaab", "Balambala", "Modogashe", "Masalani"],
    locations: ["Bullas", "Galbet", "Iftin", "Waberi", "Sankuri"],
    sublocations: ["Bulla Jamhuria", "Bulla Medina", "Dadaab Camp Area", "Garissa Market Sub"],
    streets: ["Kismayu Road", "Posta Road Garissa", "Sankuri Road", "Garissa-Thika Highway"]
  },
  "Wajir": {
    towns: ["Wajir Town", "Bute", "Habaswein", "Eldas", "Tarbaj"],
    locations: ["Township", "Garbaharey", "Diif", "Kutulo", "Bura"],
    sublocations: ["Wajir Central", "Habaswein Stage", "Wajir Bor", "Bute Center"],
    streets: ["Airport Road Wajir", "Main Market Street", "Moyale Highway"]
  },
  "Mandera": {
    towns: ["Mandera Town", "Elwak", "Rhamu", "Banissa", "Lafey"],
    locations: ["Neboi", "Bulla Mpya", "Khalalio", "Ashabito", "Warankara"],
    sublocations: ["Mandera CBD", "Elwak Stage", "Rhamu Center", "Border Post Sub"],
    streets: ["Mandera Main Street", "Elwak Highway", "Airstrip Road Mandera"]
  },
  "Marsabit": {
    towns: ["Marsabit Town", "Moyale", "Laisamis", "North Horr", "Sololo"],
    locations: ["Nagum", "Manyatta", "Heillu", "Kargi", "Loiyangalani"],
    sublocations: ["Marsabit Central", "Moyale Border", "Laisamis Stage", "Sololo Center"],
    streets: ["Isiolo-Moyale Highway", "Marsabit Market Road", "Moyale Main Street"]
  },
  "Isiolo": {
    towns: ["Isiolo Town", "Garbatulla", "Merti", "Oldonyiro"],
    locations: ["Bulla Pesa", "Wabera", "Burat", "Kinna", "Cherab"],
    sublocations: ["Isiolo CBD", "Kulamawe", "Garbatulla Center", "Merti Stage"],
    streets: ["Isiolo Main Highway", "Barclays Road Isiolo", "Airport Road Isiolo"]
  },
  "Meru": {
    towns: ["Meru Town", "Maua", "Nanyuki Border", "Timau", "Ntankiri", "Mikinduri"],
    locations: ["Municipality", "Igoji", "Mitunguu", "Laare", "Gituamba"],
    sublocations: ["Makutano Meru", "Gakoromone", "Kinoru", "Maua Town Center", "Kianjai"],
    streets: ["Meru-Nanyuki Highway", "Tom Mboya Street Meru", "Maua Road", "Meru-Embu Highway"]
  },
  "Tharaka-Nithi": {
    towns: ["Chuka", "Kathwana", "Chogoria", "Marimanti"],
    locations: ["Karingani", "Magumoni", "Ganga", "Muthambi", "Tharaka North"],
    sublocations: ["Chuka Town Center", "Chogoria Hospital Sub", "Kathwana HQ", "Marimanti Stage"],
    streets: ["Nairobi-Meru Highway (Chuka)", "Chuka University Road", "Kathwana Main Street"]
  },
  "Embu": {
    towns: ["Embu Town", "Runyenjes", "Siakago", "Kiritiri"],
    locations: ["Kamiu", "Blue Valley", "Kangaru", "Kyeni", "Mbeere North"],
    sublocations: ["Embu CBD", "Kangaru School Sub", "Runyenjes Stage", "Matakari"],
    streets: ["Embu-Meru Highway", "Kenyatta Avenue Embu", "Mama Ngina Street Embu"]
  },
  "Kitui": {
    towns: ["Kitui Town", "Mwingi", "Mutomo", "Kabati", "Kwa Vonza"],
    locations: ["Township", "Kyuso", "Nuuta", "Migwani", "Ikutha"],
    sublocations: ["Kitui Central Sub", "Mwingi CBD", "Kwa Vonza Center", "Kabati Stage"],
    streets: ["Kitui-Machakos Road", "Mwingi-Garissa Highway", "Biashara Street Kitui"]
  },
  "Machakos": {
    towns: ["Machakos Town", "Mavoko / Syokimau", "Athi River", "Kangundo", "Matungulu", "Yatta"],
    locations: ["Syokimau", "Athi River EPZ", "Machakos CBD", "Katani", "Mlolongo", "Tala"],
    sublocations: ["Mwanawasa", "Gatwekera", "Sabaki", "Kinanie", "Kyumbi", "Kaseve"],
    streets: ["Mombasa Road Frontage", "Machakos-Kitui Road", "Mutituni Highway", "Katani Road", "Chumvi Junction"]
  },
  "Makueni": {
    towns: ["Wote", "Mtito Andei", "Sultan Hamud", "Emali", "Kibwezi"],
    locations: ["Kee", "Mbooni", "Kilome", "Nguu", "Makindu"],
    sublocations: ["Wote Town Center", "Emali Junction", "Kibwezi Sub", "Mtito Andei Stage"],
    streets: ["Nairobi-Mombasa Highway (Emali)", "Wote-Machakos Road", "Kibwezi-Kitui Road"]
  },
  "Nyandarua": {
    towns: ["Ol Kalou", "Engineer", "Mairo Inya", "Njabini", "Ndaragwa"],
    locations: ["Karandi", "Kinangop", "Kipipiri", "Ol Joro Orok", "Passenga"],
    sublocations: ["Ol Kalou CBD", "Engineer Center", "Njabini Stage", "Mairo Inya Sub"],
    streets: ["Gilgil-Nyahururu Highway", "Ol Kalou Main Street", "Flyover-Engineer Road"]
  },
  "Nyeri": {
    towns: ["Nyeri Town", "Karatina", "Othaya", "Mukurweini", "Naro Moru"],
    locations: ["Kimathi", "Rware", "Mathira East", "Tetu", "Kieni West"],
    sublocations: ["Nyeri CBD", "Karatina Market Sub", "Othaya Town", "King'ong'o", "Skuta"],
    streets: ["Kenyatta Road Nyeri", "Nyeri-Nanyuki Highway", "Karatina Main Street", "Gakere Road"]
  },
  "Kirinyaga": {
    towns: ["Mwea East", "Mwea West", "Kerugoya", "Sagana", "Wanguru", "Gichugu", "Ndia"],
    locations: ["Tebere", "Nyumpa", "Thiba", "Murinduko", "Mutithi", "Kagio", "Kutus"],
    sublocations: ["Kimbimbi", "Nice Digital City", "Ngurubani", "Makutano", "Kagio Center", "Difatha", "Wamumu"],
    streets: ["Wanguru Main Street", "Rice Mills Road", "Sagana Highway", "Kimbimbi Stage", "Hospital Road", "Kutus Main Highway", "Embu-Nairobi Road"]
  },
  "Murang'a": {
    towns: ["Murang'a Town", "Kenol", "Maragua", "Kangema", "Gatanga", "Kiriaini"],
    locations: ["Township", "Kandara", "Kigumo", "Kahuro", "Mathioya"],
    sublocations: ["Kenol Kabati", "Murang'a CBD", "Maragua Sub", "Kangema Stage"],
    streets: ["Thika-Murang'a Road", "Kenol-Sagana Highway", "Uhuru Highway Murang'a"]
  },
  "Kiambu": {
    towns: ["Thika", "Ruiru", "Githunguri", "Kikuyu", "Limuru", "Kiambu Town", "Juja", "Kabete"],
    locations: ["Juja Central", "Kahawa Wendani", "Kahawa Sukari", "Ndumberi", "Banana", "Ruaka", "Kiambaa"],
    sublocations: ["Witeithie", "Membley", "Zimmerman Border", "Muchatha", "Tigoni", "Gachie", "Anmer"],
    streets: ["Superhighway Frontage", "Biashara Street", "Garissa Road", "Northern Bypass", "Kamiti Road", "Limuru Road", "Thika Main Street"]
  },
  "Turkana": {
    towns: ["Lodwar", "Kakuma", "Lokichogio", "Lokichar", "Kalokol"],
    locations: ["Township", "Turkana South", "Loima", "Turkana West", "Central"],
    sublocations: ["Lodwar CBD", "Kakuma Camp Area", "Lokichar Junction", "Kalokol Lake Sub"],
    streets: ["Kitale-Lodwar Highway", "Lodwar Main Street", "Kakuma Main Road"]
  },
  "West Pokot": {
    towns: ["Kapenguria", "Makutano Pokot", "Chepareria", "Sigor", "Kacheliba"],
    locations: ["Riwo", "Kipkomo", "Pokot South", "Wei Wei", "Batei"],
    sublocations: ["Kapenguria CBD", "Makutano Stage", "Chepareria Center", "Sigor Sub"],
    streets: ["Kitale-Lodwar Highway (Kapenguria)", "Makutano Main Road", "Chepareria Street"]
  },
  "Samburu": {
    towns: ["Maralal", "Baragoi", "Wamba", "Archers Post"],
    locations: ["Maralal Central", "Suguta Marmar", "Samburu East", "Samburu North"],
    sublocations: ["Maralal CBD", "Wamba Center", "Archers Post Junction", "Baragoi Stage"],
    streets: ["Nyahururu-Maralal Road", "Maralal Main Street", "Archers Post Highway"]
  },
  "Trans-Nzoia": {
    towns: ["Kitale", "Kiminini", "Endebess", "Saboti", "Cherangany"],
    locations: ["Hospital Ward", "Bidii", "Kwanza", "Keiyo", "Machewa"],
    sublocations: ["Kitale CBD", "Kipkaren", "Kiminini Town", "Endebess Center", "Milimani Kitale"],
    streets: ["Kenyatta Street Kitale", "Kitale-Eldoret Highway", "Kitale-Webuye Road"]
  },
  "Uasin Gishu": {
    towns: ["Eldoret East", "Eldoret West", "Ainabkoi", "Kapseret", "Kesses", "Moiben", "Turbo"],
    locations: ["Eldoret CBD", "Elgon View", "Huruma", "Langas", "Pioneer", "Kipkenyo"],
    sublocations: ["Annex", "Kimumu", "Sirikwa", "West Indies", "Maili Nne", "Racecourse"],
    streets: ["Uganda Road", "Oloo Street", "Kipchoge Keino Avenue", "Nandi Road", "Eldoret-Iten Road"]
  },
  "Elgeyo-Marakwet": {
    towns: ["Iten", "Tambach", "Kapsowar", "Chebiemit", "Flourspar"],
    locations: ["Keiyo North", "Keiyo South", "Marakwet East", "Marakwet West"],
    sublocations: ["Iten Viewpoint Sub", "Kapsowar Center", "Tambach Stage", "Chebiemit Sub"],
    streets: ["Eldoret-Iten Highway", "Iten Viewpoint Road", "Kapsowar Main Street"]
  },
  "Nandi": {
    towns: ["Kapsabet", "Nandi Hills", "Mosoriot", "Kilibwoni", "Kobujoi"],
    locations: ["Township", "Chesumei", "Aldai", "Tinderet", "Emgwen"],
    sublocations: ["Kapsabet CBD", "Nandi Hills Center", "Mosoriot University Sub", "Kapsabet Stage"],
    streets: ["Eldoret-Kapsabet Road", "Chavakali Road", "Nandi Hills Main Street"]
  },
  "Baringo": {
    towns: ["Kabarnet", "Eldama Ravine", "Marigat", "Mogotio", "Chemulingot"],
    locations: ["Township", "Baringo Central", "Baringo South", "Tiaty", "Mogotio Central"],
    sublocations: ["Kabarnet CBD", "Eldama Ravine Town", "Marigat Junction", "Mogotio Sub"],
    streets: ["Nakuru-Kabarnet Highway", "Eldama Ravine Main Road", "Marigat-Baringo Road"]
  },
  "Laikipia": {
    towns: ["Nanyuki", "Nyahururu", "Rumuruti", "Kinamba", "Doldol"],
    locations: ["Nanyuki Central", "Igwamiti", "Laikipia West", "Laikipia North", "Umande"],
    sublocations: ["Nanyuki CBD", "Nyahururu Town Sub", "Rumuruti Center", "Majengo Nanyuki"],
    streets: ["Nairobi-Nanyuki Highway", "Kenyatta Way Nanyuki", "Nyahururu-Nakuru Road"]
  },
  "Nakuru": {
    towns: ["Nakuru East", "Nakuru West", "Naivasha", "Gilgil", "Molo", "Njoro", "Subukia"],
    locations: ["Lanet", "Milimani", "Section 58", "Kiamunyi", "Mai Mahiu", "Kenyatta West"],
    sublocations: ["Free Area", "Shabab", "White House", "Barnabas", "Pipeline Nakuru", "Karatunga"],
    streets: ["Kenyatta Avenue Nakuru", "Oginga Odinga Road", "Government Road", "Kanu Street", "Nairobi-Nakuru Highway"]
  },
  "Narok": {
    towns: ["Narok Town", "Kilgoris", "Mai Mahiu Border", "Ololulunga", "Nairagie Enkare"],
    locations: ["Township", "Narok North", "Narok South", "Transmara", "Narok West"],
    sublocations: ["Narok CBD", "Kilgoris Center", "Ololulunga Stage", "Maasai Mara Gateway"],
    streets: ["Nairobi-Narok Highway", "Narok-Bomet Road", "Kilgoris Main Street"]
  },
  "Kajiado": {
    towns: ["Kitengela", "Ongata Rongai", "Ngong", "Kajiado Town", "Loitokitok", "Namanga"],
    locations: ["Nkaimurunya", "Oloitokitok", "Isinya", "Kajiado Central", "Purko"],
    sublocations: ["Kitengela CBD", "Rongai Stage", "Ngong Vet", "Namanga Border", "Mile 46"],
    streets: ["Namanga Highway", "Magadi Road", "Ngong Road Extension", "Kitengela-Acacia Road"]
  },
  "Kericho": {
    towns: ["Kericho Town", "Litein", "Kipkelion", "Londiani", "Kapsoit"],
    locations: ["Ainamoi", "Belgut", "Buret", "Soin/Sigowet", "Kipkelion East"],
    sublocations: ["Kericho CBD", "Litein Center", "Kapsoit Stage", "Londiani Junction"],
    streets: ["Nakuru-Kericho Highway", "Moi Road Kericho", "Kericho-Kisumu Highway"]
  },
  "Bomet": {
    towns: ["Bomet Town", "Sotik", "Longisa", "Mulot", "Chepalungu"],
    locations: ["Township", "Bomet Central", "Sotik East", "Konoin", "Sigor Bomet"],
    sublocations: ["Bomet CBD", "Sotik Center", "Longisa Stage", "Mulot Border"],
    streets: ["Narok-Bomet Highway", "Bomet-Kericho Road", "Sotik Main Street"]
  },
  "Kakamega": {
    towns: ["Kakamega Town", "Mumias", "Malava", "Butere", "Lugari", "Lumakanda"],
    locations: ["Township", "Lurambi", "Mumias West", "Ikolomani", "Shinyalu"],
    sublocations: ["Kakamega CBD", "Mumias Center", "Kefinco", "Approved Kakamega", "Malava Stage"],
    streets: ["Kisumu-Kakamega Highway", "Mumias-Kakamega Road", "Canon Awori Street"]
  },
  "Vihiga": {
    towns: ["Mbale", "Chavakali", "Luanda", "Hamisi", "Majengo Vihiga"],
    locations: ["Sabatia", "Emuhaya", "Luanda Central", "Vihiga Ward", "Hamisi Central"],
    sublocations: ["Mbale CBD", "Chavakali Market Sub", "Luanda Stage", "Majengo Junction"],
    streets: ["Kisumu-Kakamega Highway (Chavakali)", "Luanda-Majengo Road", "Mbale Main Street"]
  },
  "Bungoma": {
    towns: ["Bungoma Town", "Webuye", "Kimilili", "Chwele", "Sirisia", "Kanduyi"],
    locations: ["Kanduyi", "Webuye East", "Webuye West", "Tongaren", "Mt Elgon"],
    sublocations: ["Bungoma CBD", "Webuye Town Sub", "Kimilili Center", "Chwele Market Sub"],
    streets: ["Eldoret-Malaba Highway", "Mumias-Bungoma Road", "Webuye Highway"]
  },
  "Busia": {
    towns: ["Busia Town", "Malaba", "Nambale", "Funyula", "Port Victoria"],
    locations: ["Matayos", "Teso North", "Teso South", "Budalangi", "Samia"],
    sublocations: ["Busia Border", "Malaba Border Sub", "Nambale Center", "Port Victoria Sub"],
    streets: ["Kisumu-Busia Highway", "Eldoret-Malaba Highway", "Customs Road Busia"]
  },
  "Siaya": {
    towns: ["Siaya Town", "Bondo", "Ugunja", "Yala", "Usenge"],
    locations: ["Alego Usonga", "Gem", "Rarieda", "Ugenya", "Bondo Central"],
    sublocations: ["Siaya CBD", "Bondo Town Sub", "Ugunja Center", "Yala Stage"],
    streets: ["Kisumu-Bondo Highway", "Siaya-Rang'ala Road", "Bondo-Usenge Road"]
  },
  "Kisumu": {
    towns: ["Kisumu Central", "Kisumu East", "Kisumu West", "Nyando", "Muhoroni", "Seme"],
    locations: ["Milimani Kisumu", "Mamboleo", "Kenyatta", "Nyamasaria", "Otonglo", "Kondele"],
    sublocations: ["Manyatta", "Nyawita", "Migosi", "Polyview", "Tom Mboya", "Riat"],
    streets: ["Oginga Odinga Street", "Jomo Kenyatta Highway", "Accra Street", "Nyerere Road", "Kakamega Road"]
  },
  "Homa Bay": {
    towns: ["Homa Bay Town", "Oyugis", "Mbita", "Kendu Bay", "Ndhiwa"],
    locations: ["Township", "Kasipul", "Kabondo Kasipul", "Suba North", "Rangwe"],
    sublocations: ["Homa Bay CBD", "Oyugis Center", "Mbita Point Sub", "Kendu Bay Stage"],
    streets: ["Kisumu-Homa Bay Highway", "Homa Bay-Mbita Road", "Oyugis-Kisii Road"]
  },
  "Migori": {
    towns: ["Migori Town", "Rongo", "Awendo", "Isebania", "Kehancha"],
    locations: ["Suna East", "Suna West", "Kuria West", "Kuria East", "Nyatike"],
    sublocations: ["Migori CBD", "Rongo Center", "Awendo Sare", "Isebania Border"],
    streets: ["Kisii-Migori-Isebania Highway", "Rongo Highway", "Sony Sugar Road"]
  },
  "Kisii": {
    towns: ["Kisii Town", "Ogembo", "Suneka", "Keroka Border", "Tabaka"],
    locations: ["Kitutu Chache", "Nyaribari Chache", "Bomachoge", "Bonchari", "Bobasi"],
    sublocations: ["Kisii CBD", "Nyanchwa", "Daraja Mbili", "Mosocho", "Ogembo Center"],
    streets: ["Kisumu-Kisii Highway", "Kisii-Kilgoris Road", "Hospital Road Kisii", "Ogembo Main Street"]
  },
  "Nyamira": {
    towns: ["Nyamira Town", "Keroka", "Nyyamira North", "Manga", "Ekerenyo"],
    locations: ["West Mugirango", "North Mugirango", "Borabu", "Kitutu Masaba"],
    sublocations: ["Nyamira CBD", "Keroka Center Sub", "Ekerenyo Stage", "Manga Sub"],
    streets: ["Kisii-Chemosit Highway", "Nyamira-Keroka Road", "Main Street Nyamira"]
  },
  "Nairobi": {
    towns: ["Westlands", "Kasarani", "Lang'ata", "Starehe", "Dagoretti", "Embakasi", "Makadara", "Kamukunji", "Roysambu", "Mathare"],
    locations: ["Kilimani", "Kasarani Central", "Karen", "CBD", "Upper Hill", "Industrial Area", "Eastleigh", "Buruburu", "South C", "Runda"],
    sublocations: ["Mwiki", "Roysambu Sub", "Lavington", "Hurlingham", "South B", "Imara Daima", "Kileleshwa", "Parklands", "Donholm", "Pipeline"],
    streets: ["Moi Avenue", "Kenyatta Avenue", "Waiyaki Way", "Thika Road Landmark", "Ngong Road", "Enterprise Road", "Argwings Kodhek", "Jogoo Road", "Mombasa Road"]
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
// 6. MAIN APPLICATION COMPONENT (PREMIUM RICE STORE)
// ============================================================================

export default function PremiumRiceStore() {
  // ROUTING & VIEW STATES
  const [view, setView] = useState<'home' | 'shop' | 'cart' | 'login' | 'admin' | 'profile'>('home');
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

  // ADMIN USER MANAGEMENT HANDLERS (EDIT, SUSPEND, DELETE)
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
                            {(REGIONAL_LOGISTICS_DATA[checkoutData.county as keyof typeof REGIONAL_LOGISTICS_DATA]?.towns || DEFAULT_REGIONAL_LOGISTICS.towns).map((t) => (
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
                            onChange={(e) => setCheckoutData(prev => ({ ...prev, sublocation: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium bg-white cursor-pointer"
                          >
                            {(REGIONAL_LOGISTICS_DATA[checkoutData.county]?.sublocations || DEFAULT_REGIONAL_LOGISTICS.sublocations).map(s => (
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
                            placeholder="Building or Landmark"
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium"
                          />
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Payment Method & Checkout Trigger */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4">
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">M-Pesa STK Push Payment</h3>

                    <div className="space-y-3">
                      <div className="p-4 rounded-2xl border-2 border-emerald-600 bg-emerald-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-6 h-6 text-emerald-600" />
                          <div>
                            <p className="font-extrabold text-xs text-slate-900">M-Pesa Express (PayHero STK)</p>
                            <p className="text-[10px] text-slate-500">Automated payment prompt sent to your handset</p>
                          </div>
                        </div>
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">M-Pesa Phone Number</label>
                        <input 
                          type="text"
                          placeholder="e.g. 0712345678"
                          value={checkoutData.stkPhoneNumber}
                          onChange={(e) => setCheckoutData(prev => ({ ...prev, stkPhoneNumber: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

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
                        <span>Freight Delivery ({checkoutData.county}):</span>
                        <span className="font-extrabold text-slate-800">{formatKES(activeShippingFee)}</span>
                      </div>
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
                          <span>Dispatching STK Push...</span>
                        </>
                      ) : (
                        <>
                          <span>Pay {formatKES(cartGrandTotal)} via M-Pesa</span>
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
                            {payInfo.status !== 'PAID' && (
                              <button 
                                onClick={() => handleRetryStkPush(order.id, user.phoneNumber, order.grandTotal)}
                                className="px-3 py-1 rounded-full bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shadow-sm cursor-pointer"
                              >
                                Retry STK Push
                              </button>
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
                              <span className="text-[10px] font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
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
                    ? 'Enter your registered email to receive an OTP reset code' 
                    : isLogin 
                    ? 'Sign in to place agricultural grain orders' 
                    : 'Join Mwea Rice Hub for loyalty reward points'}
                </p>
              </div>

              {isForgotPassword ? (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 text-xs">
                  {resetStep === 'request' ? (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                      <input 
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                        placeholder="yourname@gmail.com"
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
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    {isLogin ? 'Sign In' : 'Register Account'}
                  </button>

                  <div className="text-center pt-2">
                    <button 
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
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

              {/* TWO-PANEL ARCHITECTURE WITH STICKY SIDEBAR NAVIGATION */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* PANEL 1: STICKY DARK SIDEBAR NAVIGATION & QUICK CONTROL (3 Columns) */}
                <div className="lg:col-span-3 bg-slate-900/90 rounded-3xl p-5 border border-slate-800 space-y-6 lg:sticky lg:top-24 lg:self-start z-30">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Navigation Panel</p>
                    <nav className="space-y-1.5">
                      {[
                        { id: 'inventory', label: 'Grain Catalog', icon: Package, desc: 'Edit all products' },
                        { id: 'orders', label: 'Order Dispatch', icon: ShoppingBag, desc: 'Real-time pipeline' },
                        { id: 'finances', label: 'Financial Engine', icon: DollarSign, desc: 'Real DB growth graph' },
                        { id: 'users', label: 'User Clearance', icon: Users, desc: 'Edit, suspend, delete' },
                        { id: 'config', label: 'Regional Freight', icon: MapPin, desc: '47 county shipping rates' },
                        { id: 'carousel', label: 'Hero Backdrop', icon: Sliders, desc: 'UI/UX & advert control' },
                        { id: 'logs', label: 'Audit Logs', icon: FileText, desc: 'User account logs' }
                      ].map(tab => {
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
                <div className="lg:col-span-9 space-y-6">

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
                                <th className="p-4">Shipping Address</th>
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

                                      {/* CLICKABLE SHIPPING ADDRESS IN ADMIN TABLE */}
                                      <td className="p-4 max-w-xs truncate text-slate-300">
                                        <button 
                                          onClick={() => setViewAddressModal(order)}
                                          className="text-left hover:text-emerald-400 font-medium underline decoration-dotted underline-offset-2 flex items-center gap-1 cursor-pointer"
                                          title="Click to view full county, town, and sublocation breakdown"
                                        >
                                          <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                                          <span className="truncate">{formatShippingAddress(order.shippingAddress || order.county)}</span>
                                        </button>
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
                        onYearChange={(y) => {
                          setFinanceYear(y);
                          fetchFinancialAnalytics(y);
                        }}
                      />

                    </div>
                  )}

                  {/* SUB-PANEL: USER CLEARANCE (DISPLAY ALL USERS, EDIT, SUSPEND, DELETE) */}
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
                                        u.role === 'admin' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-slate-800 text-slate-300'
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
                            const customFee = countyOverrides[county];

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

                  {/* SUB-PANEL: AUDIT LOGS DISPLAY WITH USER NAMES */}
                  {adminTab === 'logs' && (
                    <div className="space-y-6">
                      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                          <h4 className="font-extrabold text-sm text-white">System Security Audit Logs ({adminLogs.length})</h4>
                          <span className="text-xs text-slate-400">Track user actions & administrative modifications</span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                              <tr>
                                <th className="p-4">Timestamp</th>
                                <th className="p-4">User Account Name</th>
                                <th className="p-4">Action Event</th>
                                <th className="p-4">Module</th>
                                <th className="p-4">Details</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-medium">
                              {adminLogs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-800/40">
                                  <td className="p-4 font-mono text-slate-400">
                                    {new Date(log.timestamp).toLocaleString('en-KE')}
                                  </td>
                                  <td className="p-4 font-extrabold text-emerald-400">
                                    {log.performedByName || 'System Auto'}
                                  </td>
                                  <td className="p-4 font-bold text-white">{log.action}</td>
                                  <td className="p-4">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[10px]">
                                      {log.module}
                                    </span>
                                  </td>
                                  <td className="p-4 text-slate-400 max-w-xs truncate">{log.details || '-'}</td>
                                </tr>
                              ))}
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
            
            {activePaymentModal.status === 'PENDING' && (
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
                  <button 
                    onClick={() => handleRetryStkPush(activePaymentModal.orderId!, activePaymentModal.phoneNumber, activePaymentModal.amount)}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                  >
                    Resend STK Push
                  </button>
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
                    <p className="font-extrabold text-slate-900 text-sm">{viewAddressModal.county || 'Not Specified'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Town / District</span>
                    <p className="font-extrabold text-slate-900 text-sm">{viewAddressModal.town || 'Not Specified'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100/80">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Location</span>
                    <p className="font-bold text-slate-800">{viewAddressModal.location || 'Not Specified'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Sublocation</span>
                    <p className="font-bold text-slate-800">{viewAddressModal.sublocation || 'Not Specified'}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-100/80">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Street / Landmark</span>
                  <p className="font-bold text-slate-900">{viewAddressModal.streetAddress || viewAddressModal.shippingAddress || 'Not Specified'}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Customer Information</span>
                <p className="font-black text-slate-900">{viewAddressModal.User?.fullName || 'Valued Customer'}</p>
                <p className="text-slate-600 font-mono text-[11px]">{viewAddressModal.User?.phoneNumber || viewAddressModal.mpesaPhoneNumber || 'N/A'}</p>
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
