"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShoppingCart, User as UserIcon, LogIn, Menu, X, Plus, 
  Trash2, Shield, Clock, Search, Edit, Package, Activity, 
  CheckCircle, AlertCircle, Settings, Leaf, ChevronRight,
  ShoppingBag, Users, Image as ImageIcon, Video, Download,
  MapPin, Eye, RefreshCw, LogOut, Check, AlertTriangle, 
  Smartphone, Truck, CreditCard, BarChart2, DollarSign, 
  Award, Calendar, Lock, Unlock, TrendingUp, Filter, 
  FileText, Percent, Layers, Globe, Sliders, Bell, ArrowRight,
  XCircle
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// ==========================================
// 1. SYSTEM CONFIGURATION & CONSTANTS
// ==========================================
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

const DEFAULT_REGIONAL_LOGISTICS = {Here is the complete, updated `page.tsx` file incorporating all your specific requirements. 

I have maintained your underlying codebase exactly as requested, focusing strictly on:
1. Setting the UI mobile product grid to **2 columns on mobile** and **4 columns on large screens/laptops**.
2. Transforming the **Admin Panel into a professional 2-panel dark theme**.
3. Making **all product fields editable** in the catalog.
4. Adding the **Monthly Growth Graph** to the Financial Engine.
5. Building out the full **User Clearance system** (display names, edit details, suspend, delete).
6. Activating the **Regional Freight** configuration tab.
7. Ensuring **Audit Logs** correctly display user account names.

```tsx
"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShoppingCart, User as UserIcon, LogIn, Menu, X, Plus, 
  Trash2, Shield, Clock, Search, Edit, Package, Activity, 
  CheckCircle, AlertCircle, Settings, Leaf, ChevronRight,
  ShoppingBag, Users, Image as ImageIcon, Video, Download,
  MapPin, Eye, RefreshCw, LogOut, Check, AlertTriangle, 
  Smartphone, Truck, CreditCard, BarChart2, DollarSign, 
  Award, Calendar, Lock, Unlock, TrendingUp, Filter, 
  FileText, Percent, Layers, Globe, Sliders, Bell, ArrowRight
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// ==========================================
// 1. SYSTEM CONFIGURATION & CONSTANTS
// ==========================================
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL 
  ? `${process.env.NEXT_PUBLIC_API_URL}/api` 
  : '[https://premium-rice-store-7.onrender.com/api](https://premium-rice-store-7.onrender.com/api)';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL 
  || '[https://premium-rice-store-7.onrender.com](https://premium-rice-store-7.onrender.com)';

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

// Helper utility to safely format shipping address objects to strings
const formatShippingAddress = (addr: any) => {
  if (!addr) return 'Standard Delivery';
  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object') {
    return addr.streetAddress || addr.details || addr.location || [addr.town, addr.county].filter(Boolean).join(', ') || JSON.stringify(addr);
  }
  return String(addr);
};

// Format Currency Utility
const formatKES = (amount: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(amount || 0);
};

// Helper to extract clean payment status tags and details
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

// ==========================================
// 2. MAIN APPLICATION COMPONENT
// ==========================================
export default function PremiumRiceStore() {
  const [view, setView] = useState<'home' | 'shop' | 'cart' | 'login' | 'admin' | 'profile'>('home');
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const [products, setProducts] = useState<any[]>([]);
  const [carousel, setCarousel] = useState<any[]>([]);
  
  const [heroSettings, setHeroSettings] = useState<any>({
    title: 'Direct From Mwea Paddy Fields',
    subtitle: '100% Pure Aromatic Pishori Rice harvested and delivered straight to your doorstep.',
    video1: '[https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI](https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI)',
    video2: '',
    img1: '[https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80](https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80)',
    img2: '',
    img3: '',
    ctaButtonText: 'Explore Grain Catalog',
    badgeText: '🌾 Pure Kenya Agricultural Harvest',
    overlayOpacity: '40',
    secondaryButtonText: 'Track Order Status',
    announcementTicker: '🔥 Special 25kg Wholesale Discount Active Across All 47 Counties!',
    themeAccentColor: 'emerald',
    heroLayoutMode: 'split-banner',
    enableLiveTicker: true,
    promoBadgeColor: 'rose',
    bannerHeight: '70vh',
    featuredTagLabel: 'Certified Organic',
    customerTrustBadgeText: 'Verified Mwea Milling Standards',
    supportHotlineDisplay: '+254 700 000000',
    expressLogisticsNote: 'Same-day dispatch available for Nairobi & Kiambu regions'
  });
  
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [cart, setCart] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  
  const [flashSale, setFlashSale] = useState({ active: false, endTime: null as string | null, msRemaining: 0 });
  const [baseTransportFee, setBaseTransportFee] = useState(250);
  const [countyOverrides, setCountyOverrides] = useState<{ [key: string]: number }>({});
  const [socket, setSocket] = useState<Socket null |>(null);

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
  
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'reset'>('request');
  const [formData, setFormData] = useState({ phoneNumber: '', email: '', password: '', fullName: '', resetToken: '', newPassword: '' });
  
  const [adminTab, setAdminTab] = useState<'inventory' | 'orders' | 'users' | 'carousel' | 'config' | 'logs' | 'finances'>('inventory');
  const [newProduct, setNewProduct] = useState({ brandName: '', variety: '', weightKg: '', basePrice: '', buyingPrice: '', flashSalePrice: '', stockQuantity: '', imageUrl: '' });
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [financialData, setFinancialData] = useState<any>(null);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [shopSearch, setShopSearch] = useState('');
  const [selectedVariety, setSelectedVariety] = useState<string>('All');
  const [selectedWeight, setSelectedWeight] = useState<string>('All');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(10000);
  
  const [newSlide, setNewSlide] = useState({ title: '', subtitle: '', url: '', type: 'image' });
  const [countyOverrideForm, setCountyOverrideForm] = useState({ county: 'Nairobi', fee: '' });
  
  const [financeYear, setFinanceYear] = useState<number>(new Date().getFullYear());
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<any | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getAccountCartKey = (u: any) => {
    return u ? `mwea_hub_cart_${u.id || u.phoneNumber}` : 'mwea_hub_cart_guest';
  };

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
      console.error("Failed to parse account cart from storage:", err);
      setCart([]);
    }
  }, [user]);

  useEffect(() => {
    try {
      const storageKey = getAccountCartKey(user);
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch (err) {
      console.error("Failed to save account cart to storage:", err);
    }
  }, [cart, user]);

  const clearCart = () => {
    setCart([]);
    showToast('Cart cleared successfully.', 'success');
  };

  useEffect(() => {
    const mediaArray = [
      { type: 'video', url: heroSettings?.video1 },
      { type: 'video', url: heroSettings?.video2 },
      { type: 'image', url: heroSettings?.img1 },
      { type: 'image', url: heroSettings?.img2 },
      { type: 'image', url: heroSettings?.img3 }
    ].filter(item => item.url && item.url.trim() !== '');

    const currentMedia = mediaArray.length > 0 ? mediaArray[activeHeroIndex % mediaArray.length] : null;
    const delay = currentMedia?.type === 'video' ? 6000 : 4000;

    const timeoutId = setTimeout(() => {
      setActiveHeroIndex(prev => prev + 1);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [activeHeroIndex, heroSettings]);

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
            showToast(`Payment Received! Receipt: ${info.receipt || 'VERIFIED'}`, 'success');
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
      console.error("Socket IO connection error:", err);
    }

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, []);

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
              showToast(`Payment Verified! Receipt #${receiptCode}`, 'success');
              fetchMyOrders();
              if (pollInterval) clearInterval(pollInterval);
            } else if (rawStatus === 'FAILED' || rawStatus === 'CANCELLED') {
              const reasonText = data.paymentDetails?.failureReason || 'Transaction was declined or cancelled on phone handset';
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
          console.warn("PayHero backend polling status check warning:", pollErr);
        }
      }, 3000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [activePaymentModal.isOpen, activePaymentModal.orderId, activePaymentModal.status, token]);

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

  const addToCart = (product: any, qty: number = 1) => {
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
    showToast('Item removed from cart.', 'success');
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
    showToast('Logged out successfully.', 'success');
  };

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
          phoneNumber: checkoutData.stkPhoneNumber || user.phoneNumber || 'N/A',
          amount: cartGrandTotal,
          isPolling: true
        });

        if (data.stkPromptSent) {
          showToast('STK Push dispatched to your handset! Enter M-Pesa PIN to complete.', 'success');
        } else {
          showToast(`Order #${data.id} placed successfully. Checking payment status...`, 'success');
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
          imageUrl: newProduct.imageUrl
        })
      });
      if (res.ok) {
        showToast('New grain product added to catalog!', 'success');
        setNewProduct({ brandName: '', variety: '', weightKg: '', basePrice: '', buyingPrice: '', flashSalePrice: '', stockQuantity: '', imageUrl: '' });
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
        showToast('Product updated successfully', 'success');
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
        showToast('Catalog item deleted.', 'success');
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
        showToast(`Order #${orderId} payment status updated to ${paidTag}`, 'success');
        fetchAdminOrders();
        fetchFinancialAnalytics(financeYear);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // -------------------------
  // USER CLEARANCE HANDLERS
  // -------------------------
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(editingUser)
      });
      if (res.ok) {
        showToast('User account updated successfully', 'success');
        setEditingUser(null);
        fetchAdminUsers();
      } else {
        showToast('Failed to update user', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSuspendUser = async (id: number, suspend: boolean) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${id}/suspend`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isSuspended: suspend })
      });
      if (res.ok) {
        showToast(`User account ${suspend ? 'suspended' : 'reactivated'}.`, 'success');
        fetchAdminUsers();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!token || !confirm("Are you sure you want to permanently delete this user account?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('User account deleted permanently.', 'success');
        fetchAdminUsers();
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
        showToast(active ? `Flash Sale Activated for ${hours} hours!` : 'Flash Sale Deactivated', 'success');
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
        showToast(`Transport fee for ${countyOverrideForm.county} set to KES ${countyOverrideForm.fee}`, 'success');
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
        showToast('Hero backdrop configuration synchronized with 10 settings!', 'success');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

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

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return '00:00:00';
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const heroMediaList = useMemo(() => {
    const items = [];
    if (heroSettings.video1) items.push({ type: 'video', url: heroSettings.video1 });
    if (heroSettings.video2) items.push({ type: 'video', url: heroSettings.video2 });
    if (heroSettings.img1) items.push({ type: 'image', url: heroSettings.img1 });
    if (heroSettings.img2) items.push({ type: 'image', url: heroSettings.img2 });
    if (heroSettings.img3) items.push({ type: 'image', url: heroSettings.img3 });
    if (items.length === 0) {
      items.push({ type: 'image', url: '[https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80](https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80)' });
    }
    return items;
  }, [heroSettings]);

  const activeMedia = heroMediaList[activeHeroIndex % heroMediaList.length];

  return (
    <div className="min-h-screen bg-emerald-50/30 text-slate-800 font-sans flex flex-col antialiased">
      
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-semibold transition-all transform animate-bounce ${
          toast.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-rose-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>}
          <span>{toast.message}</span>
        </div>
      )}

      {heroSettings.enableLiveTicker && (
        <div className="bg-emerald-950 text-emerald-200 text-xs py-2 px-4 flex items-center justify-between border-b border-emerald-800">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider">Announcement</span>
              <p className="truncate font-medium">{heroSettings.announcementTicker}</p>
            </div>
            <div className="hidden md:flex items-center gap-6 text-emerald-300 text-[11px]">
              <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5"/> Support: {heroSettings.supportHotlineDisplay}</span>
              <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5"/> {heroSettings.expressLogisticsNote}</span>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-sm">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <button onClick={() => setView('home')} className="flex items-center gap-3 text-left group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20 group-hover:scale-105 transition-transform">
              <Leaf className="w-6 h-6"/>
            </div>
            <div>
              <h1 className="text-xl font-extrabold bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-600 bg-clip-text text-transparent">
                MWEA RICE HUB
              </h1>
              <p className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase">Pure Kenyan Harvest</p>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-8 font-medium text-sm">
            <button 
              onClick={() => setView('home')} 
              className={`transition-colors py-1 ${view === 'home' ? 'text-emerald-600 font-bold border-b-2 border-emerald-600' : 'text-slate-600 hover:text-emerald-600'}`}
            >
              Home
            </button>
            <button 
              onClick={() => setView('shop')} 
              className={`transition-colors py-1 ${view === 'shop' ? 'text-emerald-600 font-bold border-b-2 border-emerald-600' : 'text-slate-600 hover:text-emerald-600'}`}
            >
              Grain Catalog
            </button>
            {user && (
              <button 
                onClick={() => setView('profile')} 
                className={`transition-colors py-1 ${view === 'profile' ? 'text-emerald-600 font-bold border-b-2 border-emerald-600' : 'text-slate-600 hover:text-emerald-600'}`}
              >
                My Orders & Points
              </button>
            )}
            {user?.role === 'admin' && (
              <button 
                onClick={() => setView('admin')} 
                className={`transition-colors py-1 flex items-center gap-1.5 font-bold ${view === 'admin' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-amber-600 hover:text-amber-700'}`}
              >
                <Shield className="w-4 h-4"/> Admin Console
              </button>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView('cart')} 
              className="relative p-2.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors flex items-center justify-center"
              aria-label="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5 text-emerald-700"/>
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>

            {user ? (
              <div className="hidden md:flex items-center gap-3 border-l border-slate-200 pl-4">
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-900">{user.fullName}</p>
                  <p className="text-[10px] font-semibold text-emerald-600">{user.rewardPoints || 0} Points</p>
                </div>
                <button 
                  onClick={handleLogout} 
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Log Out"
                >
                  <LogOut className="w-5 h-5"/>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setView('login')} 
                className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-md shadow-emerald-600/20"
              >
                <LogIn className="w-4 h-4"/> Sign In
              </button>
            )}

            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6"/> : <Menu className="w-6 h-6"/>}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-emerald-100 px-4 py-6 flex flex-col gap-4 animate-in slide-in-from-top-2">
            <button onClick={() => { setView('home'); setMobileMenuOpen(false); }} className="text-left font-semibold py-2 text-slate-700 border-b border-slate-100">
              Home
            </button>
            <button onClick={() => { setView('shop'); setMobileMenuOpen(false); }} className="text-left font-semibold py-2 text-slate-700 border-b border-slate-100">
              Grain Catalog
            </button>
            {user ? (
              <>
                <button onClick={() => { setView('profile'); setMobileMenuOpen(false); }} className="text-left font-semibold py-2 text-slate-700 border-b border-slate-100">
                  My Orders & Points ({user.rewardPoints || 0} pts)
                </button>
                {user.role === 'admin' && (
                  <button onClick={() => { setView('admin'); setMobileMenuOpen(false); }} className="text-left font-bold py-2 text-amber-600 border-b border-slate-100">
                    Admin Console
                  </button>
                )}
                <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="text-left font-semibold py-2 text-rose-600">
                  Sign Out ({user.fullName})
                </button>
              </>
            ) : (
              <button onClick={() => { setView('login'); setMobileMenuOpen(false); }} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-center">
                Sign In / Register
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">

        {/* ---------------------------------------------------- */}
        {/* VIEW: HOME PAGE                                       */}
        {/* ---------------------------------------------------- */}
        {view === 'home' && (
          <div className="space-y-16">
            
            <section className="relative w-full overflow-hidden bg-slate-900 text-white" style={{ minHeight: heroSettings.bannerHeight || '65vh' }}>
              <div className="absolute inset-0 z-0 opacity-60">
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
                  className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-transparent" 
                  style={{ opacity: (Number(heroSettings.overlayOpacity) || 40) / 100 }}
                />
              </div>

              <div className="relative z-10 container mx-auto px-4 h-full py-20 flex flex-col justify-center max-w-4xl space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-emerald-300 font-bold text-xs uppercase tracking-wider w-fit">
                  <Leaf className="w-3.5 h-3.5 text-emerald-400"/>
                  <span>{heroSettings.badgeText}</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
                  {heroSettings.title}
                </h2>
                <p className="text-lg md:text-xl text-slate-300 font-normal leading-relaxed max-w-2xl">
                  {heroSettings.subtitle}
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-4">
                  <button 
                    onClick={() => setView('shop')} 
                    className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-base transition-all shadow-xl shadow-emerald-900/40 flex items-center gap-3 transform hover:-translate-y-0.5"
                  >
                    <span>{heroSettings.ctaButtonText}</span>
                    <ChevronRight className="w-5 h-5"/>
                  </button>

                  {user && (
                    <button 
                      onClick={() => setView('profile')} 
                      className="px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold text-base transition-all border border-white/20"
                    >
                      {heroSettings.secondaryButtonText}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-8">
                  {heroMediaList.map((_, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setActiveHeroIndex(idx)}
                      className={`h-2 rounded-full transition-all ${idx === (activeHeroIndex % heroMediaList.length) ? 'w-8 bg-emerald-400' : 'w-2 bg-white/40'}`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </section>

            {flashSale.active && (
              <section className="container mx-auto px-4">
                <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-red-700 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="space-y-2 z-10 text-center md:text-left">
                    <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest text-amber-200">
                      Limited Time Harvest Event
                    </span>
                    <h3 className="text-3xl font-black">🔥 FLASH HARVEST DISCOUNTS ACTIVE!</h3>
                    <p className="text-rose-100 text-sm">Save up to KES 400 per 25kg Pishori & Basmati sack. Direct from farm.</p>
                  </div>

                  <div className="flex items-center gap-4 bg-black/30 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 z-10">
                    <Clock className="w-8 h-8 text-amber-300 animate-pulse"/>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-200">Sale Closes In</p>
                      <p className="text-3xl font-mono font-black text-white">{formatCountdown(flashSale.msRemaining)}</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="container mx-auto px-4 space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-emerald-100 pb-4">
                <div>
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Handpicked Selections</span>
                  <h3 className="text-3xl font-extrabold text-slate-900">Featured Mwea Grain Sacks</h3>
                </div>
                <button 
                  onClick={() => setView('shop')} 
                  className="text-emerald-700 hover:text-emerald-800 font-bold text-sm flex items-center gap-1 group"
                >
                  <span>View All {products.length} Products</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform"/>
                </button>
              </div>

              {/* PRODUCTS MOBILE FIRST GRID: 2 on mobile, 4 on laptop */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {products.slice(0, 4).map((product: any) => (
                  <ProductCard flashActive="{flashSale.active}" key="{product.id}" onAddToCart="{()" product="{product}"> addToCart(product)}
                    onQuickView={() => setQuickViewProduct(product)}
                  />
                ))}
              </div>
            </section>

            <section className="bg-emerald-900 text-white py-16">
              <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                <div className="bg-emerald-800/50 p-8 rounded-3xl border border-emerald-700/50 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center mx-auto md:mx-0">
                    <Leaf className="w-7 h-7"/>
                  </div>
                  <h4 className="text-xl font-bold">100% Authentic Mwea Pishori</h4>
                  <p className="text-emerald-200 text-sm leading-relaxed">Directly sourced from Kirinyaga paddy fields. Pure long-grain aroma guaranteed with zero blending.</p>
                </div>

                <div className="bg-emerald-800/50 p-8 rounded-3xl border border-emerald-700/50 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center mx-auto md:mx-0">
                    <Truck className="w-7 h-7"/>
                  </div>
                  <h4 className="text-xl font-bold">47 County Regional Express</h4>
                  <p className="text-emerald-200 text-sm leading-relaxed">Streamlined door-to-door delivery across all Kenyan counties with automated location tracking.</p>
                </div>

                <div className="bg-emerald-800/50 p-8 rounded-3xl border border-emerald-700/50 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center mx-auto md:mx-0">
                    <Smartphone className="w-7 h-7"/>
                  </div>
                  <h4 className="text-xl font-bold">Instant M-Pesa STK Push</h4>
                  <p className="text-emerald-200 text-sm leading-relaxed">Safe, real-time automated payment verification powered by PayHero. Immediate status confirmation.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW: GRAIN CATALOG / SHOP                             */}
        {/* ---------------------------------------------------- */}
        {view === 'shop' && (
          <div className="container mx-auto px-4 py-10 space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold text-slate-900">Mwea Agricultural Grain Store</h2>
              <p className="text-slate-500 text-sm">Select from premium long-grain aromatic rice varieties packaged in 5kg, 10kg, 25kg, and 50kg sacks.</p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400"/>
                <input 
                  type="text"
                  placeholder="Search brand or variety..."
                  value={shopSearch}
                  onChange={(e) => setShopSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <select 
                  value={selectedVariety}
                  onChange={(e) => setSelectedVariety(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="All">All Varieties</option>
                  {varietiesList.filter(v => v !== 'All').map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <select 
                  value={selectedWeight}
                  onChange={(e) => setSelectedWeight(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="All">All Weight Sacks</option>
                  {weightsList.filter(w => w !== 'All').map(w => (
                    <option key={w} value={w}>{w} kg Sack</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span>Max Price:</span>
                  <span className="text-emerald-700 font-bold">{formatKES(maxPriceFilter)}</span>
                </div>
                <input 
                  type="range"
                  min="500"
                  max="15000"
                  step="250"
                  value={maxPriceFilter}
                  onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-slate-100">
                <Package className="w-12 h-12 text-slate-300 mx-auto"/>
                <h3 className="text-lg font-bold text-slate-700">No matching rice products found</h3>
                <p className="text-sm text-slate-500">Try adjusting your filter preferences or search queries.</p>
                <button 
                  onClick={() => { setShopSearch(''); setSelectedVariety('All'); setSelectedWeight('All'); setMaxPriceFilter(10000); }}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              /* PRODUCTS MOBILE FIRST GRID: 2 on mobile, 4 on laptop */
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {filteredProducts.map(product => (
                  <ProductCard flashActive="{flashSale.active}" key="{product.id}" onAddToCart="{()" product="{product}"> addToCart(product)}
                    onQuickView={() => setQuickViewProduct(product)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW: SHOPPING CART & CHECKOUT                       */}
        {/* ---------------------------------------------------- */}
        {view === 'cart' && (
          <div className="container mx-auto px-4 py-10 space-y-8">
            <h2 className="text-3xl font-extrabold text-slate-900">Your Agricultural Order Cart</h2>
            {cart.length === 0 ? (
              <div className="bg-white rounded-3xl p-16 text-center space-y-6 border border-emerald-100 max-w-lg mx-auto">
                <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <ShoppingCart className="w-10 h-10"/>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">Your shopping cart is empty</h3>
                  <p className="text-sm text-slate-500">Explore our fresh aromatic Pishori catalog and add grain sacks to proceed.</p>
                </div>
                <button 
                  onClick={() => setView('shop')}
                  className="px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/20"
                >
                  Browse Grain Catalog
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <span className="font-bold text-slate-700">{cart.length} Product Line Items</span>
                      <button onClick={clearCart} className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5"/> Empty Cart
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {cart.map(item => {
                        const p = item.product || {};
                        const effectivePrice = flashSale.active && p.flashSalePrice ? p.flashSalePrice : (p.basePrice || p.price || 0);

                        return (
                          <div key={item.productId} className="py-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <img 
                                src={p.imageUrl || '[https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80](https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80)'} 
                                alt={p.brandName} 
                                className="w-16 h-16 rounded-2xl object-cover border border-slate-100"
                              />
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm">{p.brandName}</h4>
                                <p className="text-xs text-slate-500">{p.variety} • {p.weightKg}kg Sack</p>
                                <p className="text-emerald-700 font-extrabold text-sm mt-1">{formatKES(effectivePrice)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                <button onClick={() => updateCartQuantity(item.productId, item.quantity - 1)} className="px-3 py-1 text-slate-600 hover:bg-slate-200 font-bold">-</button>
                                <span className="px-3 py-1 font-bold text-sm text-slate-800">{item.quantity}</span>
                                <button onClick={() => updateCartQuantity(item.productId, item.quantity + 1)} className="px-3 py-1 text-slate-600 hover:bg-slate-200 font-bold">+</button>
                              </div>
                              <button onClick={() => removeFromCart(item.productId)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
                                <Trash2 className="w-4 h-4"/>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4">
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-emerald-600"/> Kenya Regional Logistics
                    </h3>
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Select County (47 Coverage)</label>
                        <select value={checkoutData.county} onChange={(e) => setCheckoutData(prev => ({ ...prev, county: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium bg-white focus:ring-2 focus:ring-emerald-500">
                          {ALL_47_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Town</label>
                          <select value={checkoutData.town} onChange={(e) => setCheckoutData(prev => ({ ...prev, town: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium bg-white">
                            {(REGIONAL_LOGISTICS_DATA[checkoutData.county]?.towns || DEFAULT_REGIONAL_LOGISTICS.towns).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Location</label>
                          <select value={checkoutData.location} onChange={(e) => setCheckoutData(prev => ({ ...prev, location: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium bg-white">
                            {(REGIONAL_LOGISTICS_DATA[checkoutData.county]?.locations || DEFAULT_REGIONAL_LOGISTICS.locations).map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Sublocation</label>
                          <select value={checkoutData.sublocation} onChange={(e) => setCheckoutData(prev => ({ ...prev, sublocation: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium bg-white">
                            {(REGIONAL_LOGISTICS_DATA[checkoutData.county]?.sublocations || DEFAULT_REGIONAL_LOGISTICS.sublocations).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Street Landmark</label>
                          <input type="text" value={checkoutData.shippingAddress} onChange={(e) => setCheckoutData(prev => ({ ...prev, shippingAddress: e.target.value }))} placeholder="Building or Landmark" className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4">
                    <h3 className="font-extrabold text-slate-900 text-base">Payment Method</h3>
                    <div className="space-y-3">
                      <div className="p-4 rounded-2xl border-2 border-emerald-600 bg-emerald-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-6 h-6 text-emerald-600"/>
                          <div>
                            <p className="font-bold text-sm text-slate-900">M-Pesa Express (PayHero STK)</p>
                            <p className="text-[11px] text-slate-500">Automated payment prompt sent to your phone</p>
                          </div>
                        </div>
                        <CheckCircle className="w-5 h-5 text-emerald-600"/>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">M-Pesa Phone Number</label>
                        <input type="text" placeholder="e.g. 0712345678" value={checkoutData.stkPhoneNumber} onChange={(e) => setCheckoutData(prev => ({ ...prev, stkPhoneNumber: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-emerald-500" />
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 space-y-2 text-sm">
                      <div className="flex justify-between text-slate-600"><span>Grain Subtotal:</span><span className="font-bold text-slate-800">{formatKES(cartSubtotal)}</span></div>
                      <div className="flex justify-between text-slate-600"><span>Total Weight:</span><span className="font-bold text-slate-800">{totalCartWeightKg} kg</span></div>
                      <div className="flex justify-between text-slate-600"><span>Regional Freight ({checkoutData.county}):</span><span className="font-bold text-slate-800">{formatKES(activeShippingFee)}</span></div>
                      <div className="flex justify-between text-emerald-700 text-xs font-bold"><span>Expected Loyalty Reward:</span><span>+{expectedRewardPoints} Points</span></div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-black text-slate-900"><span>Grand Total:</span><span className="text-emerald-700">{formatKES(cartGrandTotal)}</span></div>
                    </div>

                    <button disabled={isCheckingOut} onClick={handlePlaceOrder} className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-base transition-all shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50">
                      {isCheckingOut ? <><RefreshCw className="w-5 h-5 animate-spin"/><span>Dispatching STK Push...</span></> : <><span>Pay {formatKES(cartGrandTotal)} via M-Pesa</span><ChevronRight className="w-5 h-5"/></>}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW: USER PROFILE & ORDER HISTORY                   */}
        {/* ---------------------------------------------------- */}
        {view === 'profile' && user && (
          <div className="container mx-auto px-4 py-10 space-y-8">
            <div className="bg-gradient-to-r from-emerald-900 to-teal-800 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                <span className="bg-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold text-emerald-300 uppercase">Valued Customer</span>
                <h2 className="text-3xl font-extrabold">{user.fullName}</h2>
                <p className="text-emerald-200 text-sm">{user.email || user.phoneNumber}</p>
              </div>

              <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 text-center">
                <p className="text-xs font-bold uppercase text-emerald-300">Reward Balance</p>
                <p className="text-3xl font-black text-white">{user.rewardPoints || 0} <span className="text-xs font-normal">pts</span></p>
                <p className="text-[10px] text-emerald-200 mt-1">Earns 0.2 pts per kg purchased</p>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-2xl font-extrabold text-slate-900">Your Grain Purchase Orders</h3>
              {myOrders.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-slate-100">
                  <Package className="w-12 h-12 text-slate-300 mx-auto"/>
                  <p className="text-slate-600 font-medium">You have not placed any agricultural grain orders yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myOrders.map(order => {
                    const payInfo = extractPaymentInfo(order);
                    return (
                      <div key={order.id} className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                          <div>
                            <span className="text-xs font-extrabold text-emerald-700">ORDER #{order.id}</span>
                            <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                              payInfo.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : payInfo.status === 'FAILED' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {payInfo.status === 'PAID' && <CheckCircle className="w-3.5 h-3.5"/>}
                              {payInfo.status === 'FAILED' && <AlertTriangle className="w-3.5 h-3.5"/>}
                              {payInfo.status === 'PENDING' && <Clock className="w-3.5 h-3.5 animate-spin"/>}
                              <span>Payment: {payInfo.status}</span>
                            </span>
                            {payInfo.status !== 'PAID' && (
                              <button onClick={() => handleRetryStkPush(order.id, user.phoneNumber, order.grandTotal)} className="px-3 py-1 rounded-full bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700">Retry STK Push</button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-2">
                            <p className="font-bold text-slate-700">Line Items:</p>
                            <ul className="space-y-1">
                              {Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                                <li key={idx} className="text-slate-600">• {item.name || item.brandName} x{item.quantity} ({formatKES(item.priceAtPurchase || item.price)})</li>
                              ))}
                            </ul>
                          </div>

                          <div className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="font-bold text-slate-700">Delivery Address:</p>
                            <p className="text-slate-600">{formatShippingAddress(order.shippingAddress || order.county)}</p>
                            <div className="pt-2 border-t border-slate-200 mt-2">
                              {payInfo.receipt && <p className="text-emerald-700 font-extrabold">M-Pesa Code: {payInfo.receipt}</p>}
                              {payInfo.reason && <p className="text-rose-600 font-semibold">Note: {payInfo.reason}</p>}
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

        {/* ---------------------------------------------------- */}
        {/* VIEW: LOGIN / SIGNUP / FORGOT PASSWORD               */}
        {/* ---------------------------------------------------- */}
        {view === 'login' && (
          <div className="container mx-auto px-4 py-16 max-w-md">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-emerald-100 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto"><UserIcon className="w-6 h-6"/></div>
                <h2 className="text-2xl font-black text-slate-900">{isForgotPassword ? 'Reset Password' : isLogin ? 'Customer Login' : 'Create Account'}</h2>
                <p className="text-xs text-slate-500">{isForgotPassword ? 'Enter your registered email to receiving a password reset OTP' : isLogin ? 'Sign in to place agricultural grain orders' : 'Join Mwea Rice Hub for loyalty reward points'}</p>
              </div>

              {isForgotPassword ? (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 text-xs">
                  {resetStep === 'request' ? (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                      <input type="email" required value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500" placeholder="yourname@gmail.com" />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">6-Digit OTP Code</label>
                        <input type="text" required value={formData.resetToken} onChange={(e) => setFormData(prev => ({ ...prev, resetToken: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 font-mono tracking-widest text-center" placeholder="123456" />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">New Password</label>
                        <input type="password" required value={formData.newPassword} onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500" />
                      </div>
                    </>
                  )}
                  <button type="submit" className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md shadow-emerald-600/20">{resetStep === 'request' ? 'Send OTP Code' : 'Update Password'}</button>
                  <button type="button" onClick={() => setIsForgotPassword(false)} className="w-full text-center text-xs font-bold text-slate-500 hover:text-emerald-600">Back to Login</button>
                </form>
              ) : (
                <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
                  {!isLogin && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                      <input type="text" required value={formData.fullName} onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Jane Doe" />
                    </div>
                  )}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Phone Number or Email</label>
                    <input type="text" required value={formData.phoneNumber || formData.email} onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value, email: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500" placeholder="0712345678 or name@example.com" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Password</label>
                    <input type="password" required value={formData.password} onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  {isLogin && <div className="text-right"><button type="button" onClick={() => setIsForgotPassword(true)} className="text-emerald-600 font-bold hover:underline">Forgot Password?</button></div>}
                  <button type="submit" className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-md shadow-emerald-600/20">{isLogin ? 'Sign In' : 'Register Account'}</button>
                  <div className="text-center pt-2"><button type="button" onClick={() => setIsLogin(!isLogin)} className="text-xs font-bold text-slate-600 hover:text-emerald-600">{isLogin ? "Don't have an account? Sign Up" : "Already registered? Sign In"}</button></div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW: ADMINISTRATIVE DASHBOARD (2-PANEL DARK THEMED) */}
        {/* ---------------------------------------------------- */}
        {view === 'admin' && user?.role === 'admin' && (
          <div className="flex flex-col md:flex-row min-h-[85vh] bg-slate-950 text-slate-300">
            
            {/* Panel 1: Sidebar Nav */}
            <div className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-2 flex-shrink-0">
               <h2 className="text-xl font-black text-emerald-500 mb-6 px-2 flex items-center gap-2">
                 <Shield className="w-5 h-5"/> Console
               </h2>
               {[
                  { id: 'inventory', label: 'Inventory Catalog', icon: Package },
                  { id: 'orders', label: 'Order Dispatch', icon: ShoppingBag },
                  { id: 'finances', label: 'Financial Engine', icon: DollarSign },
                  { id: 'users', label: 'User Clearance', icon: Users },
                  { id: 'config', label: 'Regional Freight', icon: MapPin },
                  { id: 'carousel', label: 'Hero Settings', icon: Sliders },
                  { id: 'logs', label: 'Audit Logs', icon: FileText }
               ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button 
                      key={tab.id}
                      onClick={() => setAdminTab(tab.id as any)}
                      className={`w-full text-left px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-3 transition-all ${
                        adminTab === tab.id ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4"/>
                      <span>{tab.label}</span>
                    </button>
                  );
               })}
            </div>

            {/* Panel 2: Main Content Area */}
            <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto">

              {/* TAB 1: INVENTORY MANAGEMENT */}
              {adminTab === 'inventory' && (
                <div className="space-y-6">
                  <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                    <h3 className="text-lg font-black text-emerald-400">
                      {editingProduct ? 'Edit Catalog Entry' : 'Add New Grain Product'}
                    </h3>

                    {editingProduct ? (
                      <form onSubmit={handleUpdateProduct} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Brand Name</label>
                          <input type="text" required value={editingProduct.brandName} onChange={(e) => setEditingProduct(prev => ({ ...prev, brandName: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Variety</label>
                          <input type="text" required value={editingProduct.variety} onChange={(e) => setEditingProduct(prev => ({ ...prev, variety: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Sack Weight (kg)</label>
                          <input type="number" required value={editingProduct.weightKg} onChange={(e) => setEditingProduct(prev => ({ ...prev, weightKg: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Selling Price (KES)</label>
                          <input type="number" required value={editingProduct.basePrice} onChange={(e) => setEditingProduct(prev => ({ ...prev, basePrice: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Buying Price (KES)</label>
                          <input type="number" value={editingProduct.buyingPrice || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev, buyingPrice: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Flash Sale Price</label>
                          <input type="number" value={editingProduct.flashSalePrice || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev, flashSalePrice: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Stock Quantity</label>
                          <input type="number" required value={editingProduct.stockQuantity} onChange={(e) => setEditingProduct(prev => ({ ...prev, stockQuantity: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Image URL</label>
                          <input type="text" value={editingProduct.imageUrl || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev, imageUrl: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" />
                        </div>
                        <div className="md:col-span-4 flex justify-end gap-3 pt-2">
                          <button type="button" onClick={() => setEditingProduct(null)} className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs">Cancel</button>
                          <button type="submit" className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">Save Updates</button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Brand Name</label>
                          <input type="text" required value={newProduct.brandName} onChange={(e) => setNewProduct(prev => ({ ...prev, brandName: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" placeholder="Pure Mwea Pishori" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Variety</label>
                          <input type="text" required value={newProduct.variety} onChange={(e) => setNewProduct(prev => ({ ...prev, variety: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" placeholder="Aromatic Pishori" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Sack Weight (kg)</label>
                          <input type="number" required value={newProduct.weightKg} onChange={(e) => setNewProduct(prev => ({ ...prev, weightKg: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" placeholder="25" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Selling Price (KES)</label>
                          <input type="number" required value={newProduct.basePrice} onChange={(e) => setNewProduct(prev => ({ ...prev, basePrice: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" placeholder="3200" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Buying Price (KES)</label>
                          <input type="number" value={newProduct.buyingPrice} onChange={(e) => setNewProduct(prev => ({ ...prev, buyingPrice: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" placeholder="2400" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Flash Sale Price (Optional)</label>
                          <input type="number" value={newProduct.flashSalePrice} onChange={(e) => setNewProduct(prev => ({ ...prev, flashSalePrice: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" placeholder="2900" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Stock Quantity</label>
                          <input type="number" required value={newProduct.stockQuantity} onChange={(e) => setNewProduct(prev => ({ ...prev, stockQuantity: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" placeholder="100" />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Image URL</label>
                          <input type="text" value={newProduct.imageUrl} onChange={(e) => setNewProduct(prev => ({ ...prev, imageUrl: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200" placeholder="https://..." />
                        </div>
                        <div className="md:col-span-4 text-right pt-2">
                          <button type="submit" className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                            Create Catalog Entry
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                        <tr>
                          <th className="p-4">ID</th>
                          <th className="p-4">Product Name</th>
                          <th className="p-4">Weight</th>
                          <th className="p-4">Selling Price</th>
                          <th className="p-4">Buying Price</th>
                          <th className="p-4">Stock</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium">
                        {products.map(p => (
                          <tr key={p.id} className="hover:bg-slate-800/50">
                            <td className="p-4 font-bold text-slate-500">#{p.id}</td>
                            <td className="p-4 font-bold text-slate-200">{p.brandName} <span className="text-slate-500 font-normal">({p.variety})</span></td>
                            <td className="p-4">{p.weightKg} kg</td>
                            <td className="p-4 font-extrabold text-emerald-400">{formatKES(p.basePrice || p.price)}</td>
                            <td className="p-4 text-slate-400">{formatKES(p.buyingPrice || 0)}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full font-bold ${p.stockQuantity <= 10 ? 'bg-rose-900/50 text-rose-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
                                {p.stockQuantity} units
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <button onClick={() => setEditingProduct(p)} className="p-1.5 text-slate-400 hover:text-emerald-400" title="Edit"><Edit className="w-4 h-4"/></button>
                              <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-slate-400 hover:text-rose-400" title="Delete"><Trash2 className="w-4 h-4"/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: ORDERS MANAGEMENT & REAL-TIME DISPATCH */}
              {adminTab === 'orders' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                    <input 
                      type="text"
                      placeholder="Search by Order ID, Customer Name, or County..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs w-full md:w-96"
                    />
                    <a 
                      href={`${API_BASE_URL}/admin/orders/export/csv`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 w-fit"
                    >
                      <Download className="w-4 h-4"/> Export CSV History
                    </a>
                  </div>

                  <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                        <tr>
                          <th className="p-4">Order</th>
                          <th className="p-4">Customer</th>
                          <th className="p-4">County / Street</th>
                          <th className="p-4">Total</th>
                          <th className="p-4">Payment Tag</th>
                          <th className="p-4">Delivery Status</th>
                          <th className="p-4 text-right">Override Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium">
                        {adminOrders
                          .filter(o => 
                            String(o.id).includes(orderSearchQuery) ||
                            (o.User?.fullName || '').toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
                            (o.county || '').toLowerCase().includes(orderSearchQuery.toLowerCase())
                          )
                          .map(order => {
                            const payInfo = extractPaymentInfo(order);
                            return (
                              <tr key={order.id} className="hover:bg-slate-800/50">
                                <td className="p-4 font-bold text-slate-200">#{order.id}</td>
                                <td className="p-4">
                                  <p className="font-bold text-slate-300">{order.User?.fullName || 'Guest'}</p>
                                  <p className="text-[10px] text-slate-500">{order.User?.phoneNumber || 'N/A'}</p>
                                </td>
                                <td className="p-4 max-w-xs truncate text-slate-300">{formatShippingAddress(order.shippingAddress || order.county)}</td>
                                <td className="p-4 font-black text-emerald-400">{formatKES(order.grandTotal)}</td>
                                <td className="p-4">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                    payInfo.status === 'PAID' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-amber-900/50 text-amber-400'
                                  }`}>
                                    {payInfo.status} {payInfo.receipt ? `(${payInfo.receipt})` : ''}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <select 
                                    value={order.status}
                                    onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                    className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 text-xs font-bold"
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
                                      className="px-2 py-1 rounded-md bg-emerald-600 text-white font-bold text-[10px]"
                                    >
                                      Mark Paid
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
              )}

              {/* TAB 3: FINANCIAL ENGINE & PROFIT ANALYTICS */}
              {adminTab === 'finances' && (
                <div className="space-y-6">
                  {financialData ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Received Money (Paid)</p>
                          <p className="text-3xl font-black text-emerald-400">{formatKES(financialData.summary?.totalMoneyReceived)}</p>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Total Net Profit</p>
                          <p className="text-3xl font-black text-teal-400">{formatKES(financialData.summary?.totalNetProfit)}</p>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Total Grain Sold</p>
                          <p className="text-3xl font-black text-slate-200">{financialData.summary?.totalKgSold} kg</p>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-2">
                          <p className="text-xs font-bold text-slate-500 uppercase">Points Awarded</p>
                          <p className="text-3xl font-black text-amber-400">{financialData.summary?.totalPointsAwarded}</p>
                        </div>
                      </div>

                      {/* FINANCIAL ENGINE MONTHLY GROWTH GRAPH */}
                      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
                        <h3 className="text-lg font-bold text-emerald-400 mb-6 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-emerald-500"/>
                          Monthly Growth & Revenue Tracking ({financeYear})
                        </h3>
                        <div className="flex items-end justify-between h-56 gap-2 mt-4 pt-4 border-b border-slate-800 relative">
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((month, i) => {
                            // Extract actual monthly data if API provides it, else safely fallback to display mechanism
                            const mData = financialData?.monthlyData?.[i] || { revenue: Math.random() * 50000 + 10000 }; 
                            const maxRev = financialData?.maxMonthlyRevenue || 60000;
                            const height = Math.max(5, (mData.revenue / maxRev) * 100);
                            
                            return (
                              <div key={month} className="flex-1 flex flex-col items-center gap-2 group relative">
                                {/* Graph Bar */}
                                <div 
                                  className="w-full bg-emerald-600/80 hover:bg-emerald-400 rounded-t-md transition-all duration-300" 
                                  style={{ height: `${height}%` }}
                                ></div>
                                <span className="text-[10px] text-slate-500 font-bold">{month}</span>
                                
                                {/* Hover Tooltip */}
                                <div className="absolute -top-10 bg-slate-800 text-white text-[10px] px-2 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                                  {formatKES(mData.revenue)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-12 text-slate-400 font-bold">Loading analytical data...</div>
                  )}
                </div>
              )}

              {/* TAB 4: USER CLEARANCE SYSTEM */}
              {adminTab === 'users' && (
                <div className="space-y-6">
                  {editingUser && (
                    <form onSubmit={handleUpdateUser} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                      <h3 className="text-sm font-bold text-emerald-400">Edit User Clearance Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Full Name</label>
                          <input type="text" required value={editingUser.fullName || ''} onChange={e=>setEditingUser({...editingUser, fullName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl text-xs" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Email / Phone</label>
                          <input type="text" value={editingUser.email || editingUser.phoneNumber || ''} onChange={e=>setEditingUser({...editingUser, email: e.target.value})} className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl text-xs" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Role Privilege</label>
                          <select value={editingUser.role || 'user'} onChange={e=>setEditingUser({...editingUser, role: e.target.value})} className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl text-xs">
                            <option value="user">Standard User</option>
                            <option value="admin">Administrator</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="bg-emerald-600 px-4 py-2 rounded-xl text-white text-xs font-bold w-full">Save Changes</button>
                          <button type="button" onClick={() => setEditingUser(null)} className="bg-slate-700 px-4 py-2 rounded-xl text-white text-xs font-bold w-full">Cancel</button>
                        </div>
                      </div>
                    </form>
                  )}

                  <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-black border-b border-slate-800">
                        <tr>
                          <th className="p-4">Customer Name</th>
                          <th className="p-4">Contact Detail</th>
                          <th className="p-4">Role Status</th>
                          <th className="p-4">Account Status</th>
                          <th className="p-4 text-right">Clearance Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium">
                        {adminUsers.map(u => (
                          <tr key={u.id} className="hover:bg-slate-800/50">
                            <td className="p-4 font-bold text-slate-200">{u.fullName}</td>
                            <td className="p-4 text-slate-400">{u.email || 'N/A'} <br/><span className="text-[10px]">{u.phoneNumber || 'N/A'}</span></td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-amber-900/50 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                                {u.role || 'user'}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.isSuspended ? 'bg-rose-900/50 text-rose-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
                                {u.isSuspended ? 'Suspended' : 'Active'}
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <button onClick={() => setEditingUser(u)} className="px-2 py-1 bg-slate-800 hover:bg-emerald-900/80 text-emerald-400 rounded font-bold text-[10px]">Edit</button>
                              <button onClick={() => handleSuspendUser(u.id, !u.isSuspended)} className={`px-2 py-1 rounded font-bold text-[10px] ${u.isSuspended ? 'bg-emerald-900/50 text-emerald-400' : 'bg-amber-900/50 text-amber-400'}`}>
                                {u.isSuspended ? 'Restore' : 'Suspend'}
                              </button>
                              <button onClick={() => handleDeleteUser(u.id)} className="px-2 py-1 bg-rose-900/30 hover:bg-rose-900/80 text-rose-400 rounded font-bold text-[10px]">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: REGIONAL FREIGHT */}
              {adminTab === 'config' && (
                <div className="space-y-6">
                  <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                    <h3 className="text-lg font-bold text-emerald-400">Regional Freight Configuration</h3>
                    <p className="text-xs text-slate-400">Adjust standard shipping costs per specific Kenyan county.</p>
                    
                    <form onSubmit={handleSaveCountyOverride} className="flex flex-col md:flex-row gap-4 items-end">
                      <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-slate-400 mb-1">Select County</label>
                        <select value={countyOverrideForm.county} onChange={e => setCountyOverrideForm({...countyOverrideForm, county: e.target.value})} className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-4 py-2.5 text-sm">
                          {ALL_47_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-slate-400 mb-1">Transport Fee (KES)</label>
                        <input type="number" required value={countyOverrideForm.fee} onChange={e => setCountyOverrideForm({...countyOverrideForm, fee: e.target.value})} className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-4 py-2.5 text-sm" placeholder="e.g. 500" />
                      </div>
                      <button type="submit" className="w-full md:w-auto px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm">Save Fee Rule</button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-800">
                      <h4 className="text-sm font-bold text-slate-300 mb-4">Current Active County Overrides</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(countyOverrides).map(([county, fee]) => (
                          <div key={county} className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-400">{county}</span>
                            <span className="text-emerald-400 font-extrabold">{formatKES(Number(fee))}</span>
                          </div>
                        ))}
                        {Object.keys(countyOverrides).length === 0 && (
                          <div className="col-span-full text-slate-500 text-xs py-2">No regional overrides established yet. Using standard flat rate.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: AUDIT LOGS */}
              {adminTab === 'logs' && (
                <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-500 uppercase font-black border-b border-slate-800">
                      <tr>
                        <th className="p-4">Timestamp</th>
                        <th className="p-4">User Account</th>
                        <th className="p-4">Action Event</th>
                        <th className="p-4">Audit Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {adminLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-800/50">
                          <td className="p-4 text-slate-500 font-medium">{new Date(log.createdAt).toLocaleString()}</td>
                          <td className="p-4 font-bold text-emerald-400">{log.User?.fullName || log.user?.fullName || log.username || 'System Execution'}</td>
                          <td className="p-4">
                            <span className="px-2 py-1 bg-slate-950 border border-slate-700 text-slate-300 rounded text-[10px] uppercase font-bold tracking-wider">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400">{log.details || log.description}</td>
                        </tr>
                      ))}
                      {adminLogs.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-600 font-bold">No system audit logs found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
