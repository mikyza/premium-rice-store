"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, User as UserIcon, LogIn, Menu, X, Plus, 
  Trash2, Shield, Clock, Search, Edit, Package, Activity, 
  CheckCircle, AlertCircle, Settings, Leaf, ChevronRight,
  ShoppingBag, Users, Image as ImageIcon, Download,
  MapPin, Eye, RefreshCw, LogOut, Check, AlertTriangle, Smartphone, CreditCard,
  BarChart2, DollarSign, Award, Calendar, Lock, Unlock, TrendingUp, Filter, FileText, Percent, Layers, Globe, Sliders, Bell
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

const DEFAULT_REGIONAL_LOGISTICS = {
  towns: ["Central District / Town", "North District", "South District", "East District", "West District", "Municipal Center"],
  locations: ["Central Location", "Market Center", "Highway Junction", "Administrative Center", "Commercial Zone"],
  sublocations: ["Town Center Sub-location", "North Ward", "South Ward", "East Ward", "West Ward"],
  streets: ["Main Street / Highway", "Market Road", "Hospital Road", "School Lane", "Opposite Chief's Camp", "Supermarket Landmark"]
};

const formatShippingAddress = (addr: any) => {
  if (!addr) return 'Standard Delivery';
  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object') {
    return addr.streetAddress || addr.details || addr.location || [addr.town, addr.county].filter(Boolean).join(', ') || JSON.stringify(addr);
  }
  return String(addr);
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
    video1: 'https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI',
    video2: '',
    img1: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80',
    img2: '',
    img3: '',
    ctaButtonText: 'Explore Grain Catalog',
    badgeText: '🌱 Pure Kenya Agricultural Harvest',
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
  const [socket, setSocket] = useState<Socket | null>(null);

  const [checkoutData, setCheckoutData] = useState({
    county: 'Nairobi',
    town: 'Westlands',
    location: 'CBD',
    sublocation: 'Mwiki',
    shippingAddress: 'Moi Avenue',
    paymentMethod: 'stk',
    stkPhoneNumber: ''
  });
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'reset'>('request');
  const [formData, setFormData] = useState({ phoneNumber: '', email: '', password: '', fullName: '', resetToken: '', newPassword: '' });
  
  const [adminTab, setAdminTab] = useState<'inventory' | 'orders' | 'users' | 'carousel' | 'config' | 'logs' | 'finances'>('inventory');
  const [newProduct, setNewProduct] = useState({ brandName: '', variety: '', weightKg: '', basePrice: '', costPrice: '', stockQuantity: '', imageUrl: '' });
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [shopSearch, setShopSearch] = useState('');
  const [newSlide, setNewSlide] = useState({ title: '', subtitle: '', url: '' });
  const [countyOverrideForm, setCountyOverrideForm] = useState({ county: 'Nairobi', fee: '' });
  
  const [financeYear, setFinanceYear] = useState<number>(new Date().getFullYear());

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
    const delay = currentMedia?.type === 'video' ? 5000 : 3500;

    const timeoutId = setTimeout(() => {
      setActiveHeroIndex(prev => prev + 1);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [activeHeroIndex, heroSettings]);

  useEffect(() => {
    const currentData = REGIONAL_LOGISTICS_DATA[checkoutData.county] || DEFAULT_REGIONAL_LOGISTICS;
    setCheckoutData(prev => ({
      ...prev,
      town: currentData.towns[0],
      location: currentData.locations[0],
      sublocation: currentData.sublocations[0],
      shippingAddress: currentData.streets[0]
    }));
  }, [checkoutData.county]);

  useEffect(() => {
    if (user && !checkoutData.stkPhoneNumber) {
      setCheckoutData(prev => ({ ...prev, stkPhoneNumber: user.phoneNumber }));
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
      });

      // ==========================================
      // REAL-TIME PAYMENT CALLBACK LISTENERS
      // ==========================================
      newSocket.on('paymentSuccess', (data: any) => {
        showToast(`🎉 Payment of KES ${data.amount?.toLocaleString() || ''} received for Order #${data.orderId || data.id}!`, 'success');
        fetchMyOrders();
        if (user?.role === 'admin') fetchAdminOrders();
      });

      newSocket.on('paymentFailed', (data: any) => {
        showToast(`❌ Payment failed for Order #${data.orderId || data.id}: ${data.message || data.ResultDesc || 'Transaction cancelled'}`, 'error');
        fetchMyOrders();
        if (user?.role === 'admin') fetchAdminOrders();
      });

      newSocket.on('stkCallback', (data: any) => {
        if (data.ResultCode === 0) {
          showToast(`✅ M-Pesa Payment Confirmed! Receipt: ${data.MpesaReceiptNumber || 'Success'}`, 'success');
        } else {
          showToast(`⚠️ STK Push Failed: ${data.ResultDesc || 'Payment was not completed'}`, 'error');
        }
        fetchMyOrders();
        if (user?.role === 'admin') fetchAdminOrders();
      });
    } catch (err) {
      console.error("Real-time socket initialization failed:", err);
    }

    return () => { if (newSocket) newSocket.disconnect(); };
  }, []);

  useEffect(() => {
    if (socket && user?.role === 'admin' && token) {
      socket.emit('joinAdminChannel', token);
      
      socket.on('lowStockAlert', (data: any) => {
        showToast(`Low Stock Warning: ${data.name} has only ${data.remainingStock} bags left!`, 'error');
      });
      socket.on('newOrderAlert', (data: any) => {
        showToast(`New Order Received! Order #${data.id}`, 'success');
        fetchAdminOrders();
      });
    }
  }, [socket, user, token]);

  useEffect(() => {
    if (view === 'profile' && token) fetchMyOrders();
    if (view === 'admin' && token) {
      if (adminTab === 'orders' || adminTab === 'finances') fetchAdminOrders();
      if (adminTab === 'users') fetchAdminUsers();
      if (adminTab === 'logs') fetchAdminLogs();
    }
  }, [view, adminTab, token]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/products/catalog`);
      if (res.ok) {
        setProducts(await res.json());
      } else {
        showToast('Unable to load current grain catalog', 'error');
      }
    } catch (err) {
      console.error("Failed to fetch catalog", err);
      showToast('Network error while loading grain catalog', 'error');
    }
  };

  const fetchCarousel = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/carousel`);
      if (res.ok) {
        setCarousel(await res.json());
      }
    } catch (err) { 
      console.error("Failed to fetch carousel", err); 
    }
  };

  const fetchHero = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/hero`);
      if (res.ok) {
        setHeroSettings(await res.json());
      }
    } catch (err) { 
      console.error("Failed to fetch hero settings", err); 
    }
  };

  const fetchCountiesConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/counties`);
      if (res.ok) {
        setCountyOverrides(await res.json());
      }
    } catch (err) { 
      console.error("Failed to fetch county overrides", err); 
    }
  };

  const fetchMyOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/my-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMyOrders(await res.json());
      } else {
        showToast('Failed to fetch your order history', 'error');
      }
    } catch (err) {
      console.error("Failed to fetch user orders", err);
      showToast('Network error fetching your order history', 'error');
    }
  };

  const fetchAdminOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAdminOrders(await res.json());
      } else {
        showToast('Error fetching administrator orders', 'error');
      }
    } catch (err) { 
      showToast('Network connection error while fetching orders', 'error'); 
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAdminUsers(await res.json());
      } else {
        showToast('Error fetching user accounts registry', 'error');
      }
    } catch (err) { 
      showToast('Network error while fetching registered users', 'error'); 
    }
  };

  const fetchAdminLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminLogs(Array.isArray(data) ? data : (data.logs || []));
      } else {
        showToast('Error fetching payment logs from backend server', 'error');
      }
    } catch (err) { 
      showToast('Network error while fetching backend payment logs', 'error'); 
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (e) {
      console.error("Error clearing local storage:", e);
    }
    setToken(null);
    setUser(null);
    setCart([]);
    setView('home');
    showToast('Logged out successfully');
  };

  const activeTransportFee = React.useMemo(() => {
    if (checkoutData.county && countyOverrides[checkoutData.county] !== undefined) {
      return Number(countyOverrides[checkoutData.county]);
    }
    return baseTransportFee;
  }, [checkoutData.county, countyOverrides, baseTransportFee]);

  const addToCart = (product: any) => {
    if (product.stockQuantity <= 0) return showToast('This product is out of stock', 'error');
    
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          showToast('Cannot add more than available stock', 'error');
          return prev;
        }
        showToast('Cart updated for your account');
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      showToast('Added to bag for your account');
      return [...prev, { productId: product.id, product, quantity: 1, price: product.price }];
    });
  };

  const updateCartQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQ = item.quantity + delta;
        if (newQ > item.product.stockQuantity) {
          showToast('Max stock reached', 'error');
          return item;
        }
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartTotal = cartSubtotal + (cart.length > 0 ? activeTransportFee : 0);

  const totalKgBought = useMemo(() => {
    return myOrders.reduce((acc, order) => {
      if (order.status === 'failed' || order.paymentStatus === 'failed') return acc;
      const orderKg = order.items?.reduce((sum: number, item: any) => {
         return sum + ((item.weightKg || item.product?.weightKg || 25) * item.quantity);
      }, 0) || 0;
      return acc + orderKg;
    }, 0);
  }, [myOrders]);
  const loyaltyPoints = (totalKgBought * 0.2).toFixed(1);

  const renderToast = () => {
    if (!toast) return null;
    return (
      <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-white font-bold text-sm border backdrop-blur-md animate-slideUp ${
        toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50' : 'bg-rose-900/90 border-rose-500/50'
      }`}>
        {toast.type === 'success' ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-rose-400" />}
        <span>{toast.message}</span>
      </div>
    );
  };

  const renderNav = () => (
    <nav className="bg-emerald-900 text-emerald-50 sticky top-0 z-50 shadow-xl border-b border-emerald-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center cursor-pointer group" onClick={() => setView('home')}>
            <Leaf className="h-9 w-9 text-emerald-400 mr-2.5 transform group-hover:scale-110 transition-transform duration-300" />
            <div>
              <span className="font-black text-2xl tracking-tight text-white block leading-none">MWEA HUB</span>
              <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest block mt-1">Direct Rice Logistics</span>
            </div>
          </div>
          
          <div className="hidden md:flex space-x-8 items-center font-medium">
            <button onClick={() => setView('home')} className={`hover:text-emerald-300 transition-colors ${view === 'home' ? 'text-emerald-300 font-bold border-b-2 border-emerald-300 pb-1' : ''}`}>Home</button>
            <button onClick={() => setView('shop')} className={`hover:text-emerald-300 transition-colors ${view === 'shop' ? 'text-emerald-300 font-bold border-b-2 border-emerald-300 pb-1' : ''}`}>Grain Catalog</button>
            
            {user?.role === 'admin' && (
              <button onClick={() => setView('admin')} className="flex items-center text-rose-400 hover:text-rose-300 transition bg-emerald-950/60 border border-rose-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-inner">
                <Shield className="h-4 w-4 mr-1.5 animate-pulse" /> Admin Console
              </button>
            )}
            
            <button onClick={() => setView('cart')} className="relative p-2.5 bg-emerald-800/80 hover:bg-emerald-800 rounded-full transition-colors group">
              <ShoppingCart className="h-5 w-5 transform group-hover:scale-110 transition-transform text-emerald-200" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[11px] font-black rounded-full h-5 w-5 flex items-center justify-center animate-bounce shadow">
                  {cart.length}
                </span>
              )}
            </button>

            {user ? (
              <div className="flex items-center space-x-4 pl-4 border-l border-emerald-800">
                <button onClick={() => setView('profile')} className="flex items-center text-sm font-bold bg-emerald-800/50 hover:bg-emerald-800 px-4 py-2 rounded-xl transition-all">
                  <UserIcon className="h-4 w-4 mr-2 text-emerald-400" /> {user.fullName ? user.fullName.split(' ')[0] : 'Account'}
                </button>
                <button onClick={handleLogout} className="p-2 text-emerald-300 hover:text-rose-400 hover:bg-emerald-950 rounded-lg transition-colors" title="Sign Out">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button onClick={() => setView('login')} className="flex items-center bg-emerald-500 px-6 py-2.5 rounded-full font-bold text-white hover:bg-emerald-400 transition-all shadow-lg hover:shadow-emerald-500/30 transform hover:-translate-y-0.5">
                <LogIn className="h-4 w-4 mr-2" /> Sign In
              </button>
            )}
          </div>

          <div className="md:hidden flex items-center space-x-3">
             <button onClick={() => setView('cart')} className="relative p-2 hover:bg-emerald-800 rounded-lg">
               <ShoppingCart className="h-6 w-6 text-emerald-200" />
               {cart.length > 0 && <span className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">{cart.length}</span>}
             </button>
             <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 hover:bg-emerald-800 rounded-lg text-emerald-200">
               {mobileMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
             </button>
          </div>
        </div>
      </div>
      
      {mobileMenuOpen && (
        <div className="md:hidden bg-emerald-950 px-4 pt-3 pb-5 space-y-2 border-t border-emerald-800 shadow-2xl">
          <button onClick={() => { setView('home'); setMobileMenuOpen(false); }} className="block px-3 py-3 rounded-xl w-full text-left font-bold hover:bg-emerald-900 text-white">Home</button>
          <button onClick={() => { setView('shop'); setMobileMenuOpen(false); }} className="block px-3 py-3 rounded-xl w-full text-left font-bold hover:bg-emerald-900 text-white">Grain Catalog</button>
          <button onClick={() => { setView('cart'); setMobileMenuOpen(false); }} className="block px-3 py-3 rounded-xl w-full text-left font-bold hover:bg-emerald-900 text-white">Your Cart ({cart.length})</button>
          {user?.role === 'admin' && (
            <button onClick={() => { setView('admin'); setMobileMenuOpen(false); }} className="block px-3 py-3 rounded-xl w-full text-left font-bold text-rose-400 bg-rose-950/40">Admin Console</button>
          )}
          {user ? (
             <>
               <button onClick={() => { setView('profile'); setMobileMenuOpen(false); }} className="block px-3 py-3 rounded-xl w-full text-left font-bold text-emerald-300 hover:bg-emerald-900">My Profile & Orders</button>
               <button onClick={handleLogout} className="block px-3 py-3 rounded-xl w-full text-left font-bold text-rose-400 hover:bg-emerald-900">Logout</button>
             </>
          ) : (
             <button onClick={() => { setView('login'); setMobileMenuOpen(false); }} className="block px-3 py-3 rounded-xl w-full text-center font-bold bg-emerald-600 mt-2 text-white shadow-md">Sign In</button>
          )}
        </div>
      )}
    </nav>
  );

  const renderHome = () => {
    const mediaArray = [
      { type: 'video', url: heroSettings?.video1 },
      { type: 'video', url: heroSettings?.video2 },
      { type: 'image', url: heroSettings?.img1 },
      { type: 'image', url: heroSettings?.img2 },
      { type: 'image', url: heroSettings?.img3 }
    ].filter(item => item.url && item.url.trim() !== '');

    const currentMedia = mediaArray.length > 0 ? mediaArray[activeHeroIndex % mediaArray.length] : null;
    const opacityClass = heroSettings?.overlayOpacity === '60' ? 'opacity-60' : heroSettings?.overlayOpacity === '80' ? 'opacity-80' : 'opacity-40';

    return (
      <div className="animate-fadeIn">
        {heroSettings?.announcementTicker && (
          <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-800 text-emerald-100 py-2 px-4 text-center text-xs font-bold tracking-wide border-b border-emerald-900 flex items-center justify-center gap-2 shadow-inner">
            <Bell size={14} className="text-emerald-300 animate-bounce" />
            <span>{heroSettings.announcementTicker}</span>
          </div>
        )}

        {flashSale.active && (
          <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 text-white py-3 px-4 text-center font-black flex flex-col sm:flex-row justify-center items-center shadow-lg border-b border-rose-700 text-sm tracking-wide">
            <div className="flex items-center mb-1 sm:mb-0">
              <Clock className="h-5 w-5 mr-2 animate-spin" />
              🔥 FRESH HARVEST FLASH SALE ACTIVE!
            </div>
            <span className="sm:ml-4 font-mono text-base bg-black/30 px-3.5 py-1 rounded-full border border-white/20">
              {Math.floor(flashSale.msRemaining / (1000 * 60 * 60))}h : {Math.floor((flashSale.msRemaining % (1000 * 60 * 60)) / (1000 * 60))}m : {Math.floor((flashSale.msRemaining % (1000 * 60)) / 1000)}s LEFT
            </span>
          </div>
        )}

        <div className="relative bg-emerald-950 h-[70vh] flex items-center justify-center overflow-hidden transition-all duration-1000">
          {currentMedia?.type === 'video' ? (
            <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden opacity-50 mix-blend-screen transition-opacity duration-1000">
              <iframe
                src={currentMedia.url}
                className="w-full h-full object-cover scale-125"
                allow="autoplay; encrypted-media"
                title="Hero Background Video"
              />
            </div>
          ) : currentMedia?.type === 'image' ? (
            <img 
              src={currentMedia.url} 
              alt="Hero Backdrop" 
              className={`absolute inset-0 w-full h-full object-cover ${opacityClass} transition-opacity duration-1000`} 
            />
          ) : (
            <img 
              src="https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80" 
              alt="Default Backdrop" 
              className={`absolute inset-0 w-full h-full object-cover ${opacityClass} transition-opacity duration-1000`} 
            />
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/40 to-transparent flex flex-col justify-center items-center text-center p-6 z-10">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-6 animate-pulse">
              {heroSettings?.badgeText || '🌱 Pure Kenya Agricultural Harvest'}
            </span>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white mb-6 drop-shadow-2xl tracking-tight max-w-4xl leading-none">
              {heroSettings?.title || 'Direct From Mwea Paddy Fields'}
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-emerald-100 mb-10 max-w-2xl font-medium drop-shadow leading-relaxed">
              {heroSettings?.subtitle || '100% Pure Aromatic Pishori Rice harvested and delivered straight to your doorstep.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => setView('shop')} className="bg-emerald-500 text-white px-8 py-4 rounded-full font-black text-lg hover:bg-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all transform hover:scale-105 flex items-center justify-center">
                {heroSettings?.ctaButtonText || 'Explore Grain Catalog'} <ChevronRight className="ml-2 h-5 w-5" />
              </button>
              <button onClick={() => setView('profile')} className="bg-emerald-900/80 border border-emerald-700 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-800 transition-all">
                {heroSettings?.secondaryButtonText || 'Track Order Status'}
              </button>
            </div>
            
            <div className="mt-8 text-xs text-emerald-300 font-semibold flex items-center gap-4 bg-emerald-950/80 px-6 py-2 rounded-full border border-emerald-800">
              <span>🛡️ {heroSettings?.customerTrustBadgeText || 'Verified Mwea Milling Standards'}</span>
              <span>•</span>
              <span>📞 {heroSettings?.supportHotlineDisplay || '+254 700 000000'}</span>
            </div>
          </div>
        </div>

        {carousel && carousel.length > 0 && (
          <div className="max-w-7xl mx-auto py-16 px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {carousel.map((slide, idx) => (
                <div key={idx} className="relative rounded-3xl overflow-hidden shadow-lg group h-64 bg-emerald-900 border border-emerald-800/60">
                  <img src={slide.url} alt={slide.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-60" />
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/30 to-transparent p-6 flex flex-col justify-end">
                    <h3 className="text-xl font-black text-white mb-1">{slide.title}</h3>
                    <p className="text-xs text-emerald-200 font-medium line-clamp-2">{slide.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto pb-20 px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-emerald-950 mb-3">Featured Grain Selections</h2>
            <p className="text-gray-600 max-w-xl mx-auto text-base">Cultivated in rich soils, aged to perfection, and sorted for unmatched aroma and grain length.</p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {products.slice(0, 4).map(p => (
              <div key={p.id} className="bg-white rounded-2xl sm:rounded-3xl shadow-md overflow-hidden border border-emerald-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col group">
                <div className="h-32 sm:h-56 bg-emerald-50 flex items-center justify-center relative overflow-hidden border-b border-emerald-100">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.variety} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <Package className="h-12 w-12 sm:h-20 sm:w-20 text-emerald-300 group-hover:scale-110 transition-transform duration-500" />
                  )}
                  {p.isBlackFridayApplied && <span className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-rose-500 text-white text-[10px] sm:text-xs font-black px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-lg">SALE</span>}
                </div>
                <div className="p-3 sm:p-6 flex-1 flex flex-col">
                  <div className="text-[10px] sm:text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">{p.brandName}</div>
                  <h3 className="font-black text-sm sm:text-xl mb-1 sm:mb-2 text-gray-900 group-hover:text-emerald-700 transition-colors leading-tight">{p.variety}</h3>
                  <p className="text-gray-500 text-[10px] sm:text-xs mb-3 sm:mb-6 flex items-center font-medium">
                    <MapPin size={12} className="mr-1 text-emerald-500 hidden sm:block" /> Net Weight: <span className="font-bold text-gray-700 ml-1">{p.weightKg}kg Bag</span>
                  </p>
                  <div className="flex justify-between items-end mt-auto pt-2 sm:pt-4 border-t border-gray-100">
                    <div>
                      {p.isBlackFridayApplied && <span className="text-[10px] sm:text-xs text-rose-500 font-bold line-through block mb-0.5">KES {p.basePrice?.toLocaleString()}</span>}
                      <span className="text-sm sm:text-xl font-black text-emerald-900">KES {p.price?.toLocaleString()}</span>
                    </div>
                    <button onClick={() => addToCart(p)} className="bg-emerald-600 text-white p-2 sm:p-3 rounded-xl sm:rounded-2xl hover:bg-emerald-500 transition-all shadow-md hover:shadow-emerald-500/30 font-bold flex items-center text-xs sm:text-sm">
                      <Plus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Add</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderShop = () => {
    const filteredProducts = products.filter(p => {
      if (!shopSearch) return true;
      const q = shopSearch.toLowerCase();
      return p.brandName?.toLowerCase().includes(q) || p.variety?.toLowerCase().includes(q);
    });

    return (
      <div className="max-w-7xl mx-auto py-12 px-4 animate-fadeIn">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 border-b border-gray-200 pb-8">
          <div>
            <h1 className="text-4xl font-black text-emerald-950">Complete Grain Catalog</h1>
            <p className="text-gray-500 mt-1 font-medium">Browse wholesale sacks, aromatic grades, and household bags.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input 
              type="text" 
              placeholder="Search rice brand or variety..." 
              value={shopSearch}
              onChange={(e) => setShopSearch(e.target.value)}
              className="text-black bg-white pl-12 pr-4 py-3 border-2 border-emerald-100 rounded-2xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 w-full font-bold text-sm shadow-sm transition-all" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {filteredProducts.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 border ${p.stockQuantity <= 0 ? 'opacity-70 grayscale' : 'border-emerald-100'} flex flex-col group overflow-hidden`}>
               <div className="h-32 sm:h-48 bg-emerald-50/50 flex flex-col justify-center items-center relative overflow-hidden border-b border-emerald-50">
                 {p.imageUrl ? (
                   <img src={p.imageUrl} alt={p.variety} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                 ) : (
                   <Package className="h-10 w-10 sm:h-16 sm:w-16 text-emerald-300 group-hover:scale-110 transition-transform duration-300" />
                 )}
                 {p.isBlackFridayApplied && <span className="absolute top-2 right-2 bg-rose-500 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow z-10">SALE</span>}
                 {p.stockQuantity <= 0 && <span className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white font-black text-xs sm:text-sm uppercase tracking-widest z-10 text-center">Out of Stock</span>}
               </div>
               
               <div className="p-3 sm:p-5 flex-1 flex flex-col">
                 <div className="text-[9px] sm:text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-1">{p.brandName}</div>
                 <h3 className="font-bold text-sm sm:text-lg text-gray-900 mb-2 leading-tight">{p.variety}</h3>
                 <div className="text-[10px] sm:text-xs text-gray-500 mb-3 sm:mb-6 space-y-1 bg-gray-50 p-2 rounded-lg sm:rounded-xl border border-gray-100">
                   <div className="flex justify-between"><span>Weight:</span><span className="font-bold text-gray-800">{p.weightKg} kg</span></div>
                   <div className="flex justify-between"><span>Inventory:</span><span className={`font-bold ${p.stockQuantity > 10 ? 'text-emerald-600' : 'text-rose-500'}`}>{p.stockQuantity} bags</span></div>
                 </div>
                 
                 <div className="mt-auto flex flex-col sm:flex-row justify-between sm:items-center pt-2 gap-2">
                   <div>
                      {p.isBlackFridayApplied && <span className="text-[10px] sm:text-[11px] text-rose-500 font-bold line-through block">KES {p.basePrice?.toLocaleString()}</span>}
                      <div className="font-black text-base sm:text-xl text-emerald-950">KES {p.price?.toLocaleString()}</div>
                   </div>
                   <button 
                     onClick={() => addToCart(p)}
                     disabled={p.stockQuantity <= 0}
                     className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black transition-all shadow-sm ${p.stockQuantity <= 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-md transform hover:-translate-y-0.5'}`}
                   >
                     Add to Bag
                   </button>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCart = () => {
    const handleCheckout = async () => {
      if (!user) return showToast('Please sign in to place your order', 'error');
      if (!checkoutData.county) return showToast('Please select your delivery county', 'error');
      if (!checkoutData.town || !checkoutData.location) {
        return showToast('Please select Town/District and Location from the logistics dropdowns', 'error');
      }
      
      const targetPhone = checkoutData.paymentMethod === 'stk' ? (checkoutData.stkPhoneNumber || user?.phoneNumber) : user?.phoneNumber;
      
      if (checkoutData.paymentMethod === 'stk' && !targetPhone) {
        return showToast('Please provide a valid M-Pesa phone number for STK Push', 'error');
      }

      setIsCheckingOut(true);
      try {
        const payload = {
          cartItems: cart.map(item => ({ productId: item.productId, quantity: item.quantity })),
          paymentMethod: checkoutData.paymentMethod,
          phoneNumber: targetPhone,
          county: checkoutData.county,
          town: checkoutData.town,
          location: checkoutData.location,
          sublocation: checkoutData.sublocation,
          shippingAddress: checkoutData.shippingAddress,
          shippingFee: activeTransportFee,
          grandTotal: cartTotal
        };

        const res = await fetch(`${API_BASE_URL}/orders/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          
          if (checkoutData.paymentMethod === 'stk') {
            showToast(`📲 STK Push successfully initiated to ${targetPhone}! Please enter your M-Pesa PIN when prompted.`, 'success');
            try {
               await fetch(`${API_BASE_URL}/payments/stkpush`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                 body: JSON.stringify({ orderId: data.id || data.order?.id, amount: cartTotal, phoneNumber: targetPhone })
               });
            } catch (err) {
               console.error("STK trigger request error:", err);
            }
          } else {
            showToast('🌾 Order placed successfully! Direct logistics dispatched.', 'success');
          }

          setCart([]);
          setView('profile');
        } else {
          const err = await res.json();
          showToast(err.error || 'Checkout processing failed', 'error');
        }
      } catch (err) {
        showToast('Network communication error during checkout', 'error');
      }
      setIsCheckingOut(false);
    };

    const currentRegionalData = REGIONAL_LOGISTICS_DATA[checkoutData.county] || DEFAULT_REGIONAL_LOGISTICS;

    return (
      <div className="max-w-7xl mx-auto py-12 px-4 animate-fadeIn">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-3xl sm:text-4xl font-black text-emerald-950 flex items-center">
            <ShoppingBag className="mr-3 h-9 w-9 text-emerald-600" /> Shopping Bag
          </h1>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-rose-500 hover:text-white bg-rose-50 hover:bg-rose-500 border border-rose-100 font-bold flex items-center text-sm px-4 py-2 rounded-xl transition-all shadow-sm">
              <Trash2 className="h-4 w-4 mr-1.5"/> Clear Entire Cart
            </button>
          )}
        </div>
        
        {cart.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl shadow-sm border border-emerald-100 max-w-2xl mx-auto">
            <div className="bg-emerald-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="h-12 w-12 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Your grain sack is currently empty</h2>
            <p className="text-gray-500 mb-8 font-medium">Browse our freshly harvested Pishori and Basmati grades to begin.</p>
            <button onClick={() => setView('shop')} className="bg-emerald-600 text-white px-8 py-3.5 rounded-full font-bold shadow-lg hover:bg-emerald-500 transition-all">Go to Grain Catalog</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7 space-y-4">
              <h2 className="font-bold text-lg text-gray-800 mb-2">Selected Products ({cart.length})</h2>
              {cart.map(item => (
                <div key={item.productId} className="flex flex-col sm:flex-row items-center justify-between bg-white p-5 rounded-3xl shadow-sm border border-gray-100 gap-4">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shrink-0 overflow-hidden">
                      {item.product.imageUrl ? (
                        <img src={item.product.imageUrl} alt={item.product.variety} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="text-emerald-400 h-10 w-10" />
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">{item.product.brandName}</span>
                      <h3 className="font-bold text-lg text-gray-900 leading-snug">{item.product.variety}</h3>
                      <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md mt-1 inline-block">{item.product.weightKg}kg Sack</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6 border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-100">
                    <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
                      <button onClick={() => updateCartQuantity(item.productId, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-gray-700 hover:text-emerald-600 shadow-xs font-black">-</button>
                      <span className="w-10 text-center font-bold text-sm text-gray-900">{item.quantity}</span>
                      <button onClick={() => updateCartQuantity(item.productId, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-gray-700 hover:text-emerald-600 shadow-xs font-black">+</button>
                    </div>
                    <div className="font-black text-lg text-emerald-950 w-28 text-right">KES {(item.price * item.quantity).toLocaleString()}</div>
                    <button onClick={() => updateCartQuantity(item.productId, -item.quantity)} className="text-gray-400 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-xl transition-colors">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-emerald-100 h-fit sticky top-28">
              <h2 className="text-xl font-black text-gray-900 mb-6 border-b border-gray-100 pb-4 flex items-center">
                <MapPin className="mr-2 text-emerald-600 h-5 w-5" /> Delivery & Logistics Details
              </h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Select County (47 Counties Supported)</label>
                  <select 
                    value={checkoutData.county} 
                    onChange={(e) => setCheckoutData({...checkoutData, county: e.target.value})} 
                    className="w-full text-black border-2 border-gray-200 rounded-xl px-4 py-3 bg-white focus:border-emerald-500 outline-none transition-all text-sm font-bold"
                  >
                    {ALL_47_COUNTIES.map(c => <option key={c} value={c}>{c} County</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Town / District *</label>
                    <select 
                      value={checkoutData.town} 
                      onChange={(e) => setCheckoutData({...checkoutData, town: e.target.value})} 
                      className="w-full text-black border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-emerald-500 outline-none"
                    >
                      {currentRegionalData.towns.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Location *</label>
                    <select 
                      value={checkoutData.location} 
                      onChange={(e) => setCheckoutData({...checkoutData, location: e.target.value})} 
                      className="w-full text-black border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-emerald-500 outline-none"
                    >
                      {currentRegionalData.locations.map((loc, idx) => <option key={idx} value={loc}>{loc}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Sub-Location</label>
                    <select 
                      value={checkoutData.sublocation} 
                      onChange={(e) => setCheckoutData({...checkoutData, sublocation: e.target.value})} 
                      className="w-full text-black border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-emerald-500 outline-none"
                    >
                      {currentRegionalData.sublocations.map((sub, idx) => <option key={idx} value={sub}>{sub}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Street Address</label>
                    <select 
                      value={checkoutData.shippingAddress} 
                      onChange={(e) => setCheckoutData({...checkoutData, shippingAddress: e.target.value})} 
                      className="w-full text-black border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-white focus:border-emerald-500 outline-none"
                    >
                      {currentRegionalData.streets.map((str, idx) => <option key={idx} value={str}>{str}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Payment Method</label>
                  <select 
                    value={checkoutData.paymentMethod} 
                    onChange={(e) => setCheckoutData({...checkoutData, paymentMethod: e.target.value})} 
                    className="w-full text-black border-2 border-gray-200 rounded-xl px-4 py-3 bg-white focus:border-emerald-500 outline-none font-bold text-sm"
                  >
                    <option value="stk">🟢 M-Pesa STK Push Express</option>
                    <option value="till">🏪 M-Pesa Paybill / Till Number</option>
                  </select>
                </div>

                {checkoutData.paymentMethod === 'till' && (
                  <div className="bg-emerald-950 text-white p-4 rounded-2xl border border-emerald-800 text-center animate-fadeIn shadow-inner mt-2">
                    <span className="text-[10px] text-emerald-400 uppercase font-black tracking-widest block mb-1">MWEA HUB MERCHANDISE PAYBILL</span>
                    <div className="text-2xl font-mono font-black tracking-wider text-emerald-300">PAYBILL: 889900</div>
                    <span className="text-xs text-gray-300 font-medium block mt-1">Account Number: <strong className="text-white">MWEA-DIRECT</strong></span>
                  </div>
                )}

                {checkoutData.paymentMethod === 'stk' && (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 flex flex-col gap-3 text-emerald-900 text-xs font-bold animate-fadeIn mt-2">
                    <div className="flex items-start gap-3">
                      <Smartphone className="h-6 w-6 text-emerald-600 shrink-0" />
                      <span className="leading-relaxed">An STK Push prompt will instantly pop up on the mobile number below. Please enter your M-Pesa PIN when prompted.</span>
                    </div>
                    <div className="mt-1">
                      <label className="block text-[10px] font-black uppercase text-emerald-800 mb-1">M-Pesa Mobile Number</label>
                      <input 
                        type="tel"
                        value={checkoutData.stkPhoneNumber}
                        onChange={(e) => setCheckoutData({...checkoutData, stkPhoneNumber: e.target.value})}
                        placeholder="e.g. 254712345678"
                        className="w-full bg-white text-black border border-emerald-300 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 mb-6 text-sm">
                <h3 className="font-black text-emerald-900 mb-3 border-b border-emerald-200 pb-2 flex items-center">
                  <MapPin className="h-4 w-4 mr-1.5 text-emerald-600" /> Confirmed Delivery Logistics
                </h3>
                <ul className="space-y-1.5 text-gray-700 font-medium">
                  <li className="flex justify-between"><span className="text-gray-500">County:</span> <strong className="text-right">{checkoutData.county}</strong></li>
                  <li className="flex justify-between"><span className="text-gray-500">Town/District:</span> <strong className="text-right">{checkoutData.town}</strong></li>
                  <li className="flex justify-between"><span className="text-gray-500">Location:</span> <strong className="text-right">{checkoutData.location}</strong></li>
                  <li className="flex justify-between"><span className="text-gray-500">Sub-location:</span> <strong className="text-right">{checkoutData.sublocation}</strong></li>
                  <li className="flex justify-between"><span className="text-gray-500">Street Address:</span> <strong className="text-right">{checkoutData.shippingAddress}</strong></li>
                </ul>
              </div>

              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 space-y-2 mb-6 text-sm font-medium">
                <div className="flex justify-between text-gray-600"><span>Bag Subtotal</span><span className="font-bold text-gray-900">KES {cartSubtotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-gray-600">
                  <span>Transport & Logistics ({checkoutData.county})</span>
                  <span className="font-bold text-emerald-700">KES {activeTransportFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-black text-lg text-emerald-950 border-t border-emerald-200/80 pt-3 mt-1">
                  <span>Total Amount</span><span>KES {cartTotal.toLocaleString()}</span>
                </div>
              </div>

              {!user ? (
                <button onClick={() => setView('login')} className="w-full bg-emerald-950 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-emerald-900 transition-colors">Sign In to Complete Order</button>
              ) : (
                <button 
                  onClick={handleCheckout} 
                  disabled={isCheckingOut}
                  className={`w-full py-4 rounded-2xl font-black text-base flex justify-center items-center shadow-lg transition-all transform hover:-translate-y-0.5 ${
                    checkoutData.paymentMethod === 'stk'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white hover:shadow-emerald-500/40'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/30'
                  }`}
                >
                  {isCheckingOut ? (
                    <><Activity className="animate-spin mr-2 h-5 w-5" /> Processing Order...</>
                  ) : checkoutData.paymentMethod === 'stk' ? (
                    <><Smartphone className="mr-2 h-5 w-5" /> Initiate STK Push & Pay KES {cartTotal.toLocaleString()}</>
                  ) : (
                    <><CheckCircle className="mr-2 h-5 w-5" /> Confirm Order & Pay KES {cartTotal.toLocaleString()}</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAuth = () => {
    const handleResetRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const res = await fetch(`${API_BASE_URL}/user/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: formData.phoneNumber })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('Password reset code sent to your phone!', 'success');
          setResetStep('reset');
        } else {
          showToast(data.error || 'Failed to initiate reset', 'error');
        }
      } catch (err) {
        showToast('Network error', 'error');
      }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const res = await fetch(`${API_BASE_URL}/user/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             phoneNumber: formData.phoneNumber,
             resetToken: formData.resetToken,
             newPassword: formData.newPassword
          })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('Password reset successful! Please sign in.', 'success');
          setIsForgotPassword(false);
          setIsLogin(true);
          setResetStep('request');
        } else {
          showToast(data.error || 'Failed to reset password', 'error');
        }
      } catch (err) {
        showToast('Network error', 'error');
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const endpoint = isLogin ? '/user/login' : '/user/signup';
      try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        
        if (res.ok) {
          try {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
          } catch (storageErr) {
            console.error("Local storage update error:", storageErr);
          }
          setToken(data.token);
          setUser(data.user);
          showToast(`Welcome back, ${data.user.fullName}!`, 'success');
          setView('home');
        } else {
          showToast(data.error || 'Authentication failed', 'error');
        }
      } catch (err) {
        showToast('Network error during authentication', 'error');
      }
    };

    return (
      <div className="min-h-[75vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-emerald-50/40">
        <div className="max-w-md w-full bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-emerald-100 animate-fadeIn">
          <div className="text-center mb-8">
            <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-emerald-950">
               {isForgotPassword ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Create Account')}
            </h2>
            <p className="text-gray-500 mt-1 text-sm font-medium">
               {isForgotPassword 
                 ? (resetStep === 'request' ? 'Enter your phone number to receive a reset code.' : 'Enter the reset code and your new password.')
                 : (isLogin ? 'Sign in to track orders and manage deliveries.' : 'Register to order wholesale Mwea grains.')}
            </p>
          </div>
          
          {isForgotPassword ? (
            <form className="space-y-4" onSubmit={resetStep === 'request' ? handleResetRequest : handlePasswordReset}>
              {resetStep === 'request' ? (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Phone Number</label>
                  <input required type="tel" placeholder="0712345678" onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})} className="text-black bg-white w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 outline-none placeholder-gray-400" />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Phone Number</label>
                    <input required type="tel" value={formData.phoneNumber} disabled className="text-black bg-gray-100 w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Reset Code</label>
                    <input required type="text" placeholder="Enter 6-digit code" onChange={(e) => setFormData({...formData, resetToken: e.target.value})} className="text-black bg-white w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 outline-none placeholder-gray-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">New Password</label>
                    <input required type="password" placeholder="••••••••" onChange={(e) => setFormData({...formData, newPassword: e.target.value})} className="text-black bg-white w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 outline-none placeholder-gray-400" />
                  </div>
                </>
              )}
              <button type="submit" className="w-full py-4 px-4 rounded-xl shadow-lg font-black text-white bg-emerald-600 hover:bg-emerald-500 transition-all transform hover:-translate-y-0.5 mt-6">
                {resetStep === 'request' ? 'Send Reset Code' : 'Update Password'}
              </button>
              <button type="button" onClick={() => { setIsForgotPassword(false); setResetStep('request'); }} className="w-full py-4 px-4 rounded-xl shadow-md font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all mt-3">
                Back to Sign In
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Full Name</label>
                    <input required type="text" placeholder="Full Name" onChange={(e) => setFormData({...formData, fullName: e.target.value})} className="text-black bg-white w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 outline-none placeholder-gray-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Email Address</label>
                    <input required type="email" placeholder="Email Address" onChange={(e) => setFormData({...formData, email: e.target.value})} className="text-black bg-white w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 outline-none placeholder-gray-400" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Phone Number</label>
                <input required type="tel" placeholder="0712345678" onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})} className="text-black bg-white w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 outline-none placeholder-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Password</label>
                <input required type="password" placeholder="••••••••" onChange={(e) => setFormData({...formData, password: e.target.value})} className="text-black bg-white w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 outline-none placeholder-gray-400" />
              </div>
              
              {isLogin && (
                <div className="flex justify-end pt-1">
                  <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs font-bold text-emerald-600 hover:text-emerald-500 transition-colors">
                    Forgot Password?
                  </button>
                </div>
              )}

              <button type="submit" className="w-full py-4 px-4 rounded-xl shadow-lg font-black text-white bg-emerald-600 hover:bg-emerald-500 transition-all transform hover:-translate-y-0.5 mt-6">
                {isLogin ? 'Sign In' : 'Register Account'}
              </button>
            </form>
          )}

          {!isForgotPassword && (
            <div className="mt-8 text-center border-t border-gray-100 pt-6">
              <button onClick={() => setIsLogin(!isLogin)} className="text-emerald-700 hover:text-emerald-500 font-bold text-xs uppercase tracking-wider transition-colors">
                {isLogin ? "Need an account? Register Here" : "Already registered? Sign In"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProfile = () => {
    const pendingTransactions = myOrders.filter(o => o.status !== 'delivered' && o.status !== 'completed' && o.paymentStatus !== 'failed');
    const completedTransactions = myOrders.filter(o => o.status === 'delivered' || o.status === 'completed');

    return (
      <div className="max-w-5xl mx-auto py-12 px-4 animate-fadeIn">
        <div className="bg-white rounded-3xl shadow-md border border-emerald-100 p-6 sm:p-8 mb-10 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 opacity-60"></div>
          <div className="flex items-center gap-5 text-center sm:text-left z-10">
            <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center shrink-0 border-2 border-emerald-200">
               <UserIcon className="h-10 w-10 text-emerald-700" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-emerald-950">{user?.fullName}</h1>
              <p className="text-gray-500 font-medium text-sm flex items-center justify-center sm:justify-start mt-0.5">
                <Shield className="h-4 w-4 mr-1 text-emerald-600" /> Role: <span className="uppercase font-bold text-emerald-700 ml-1">{user?.role}</span> • Phone: {user?.phoneNumber}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center sm:items-end gap-3 z-10">
            <div className="bg-amber-100 border border-amber-300 text-amber-800 px-4 py-2 rounded-xl flex items-center shadow-sm">
              <Award className="h-5 w-5 mr-2" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider">Loyalty Points</div>
                <div className="font-black text-lg leading-none">{loyaltyPoints} PTS</div>
              </div>
            </div>
            <button onClick={fetchMyOrders} className="flex items-center text-emerald-600 hover:text-emerald-800 px-2 py-1 text-xs font-bold transition-all">
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh Orders
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl shadow-md border border-emerald-100 overflow-hidden mb-8">
          <div className="p-6 sm:p-8 border-b border-gray-100 bg-emerald-50/30">
            <h2 className="text-xl font-black text-gray-900 flex items-center">
              <Clock className="mr-2 text-emerald-600 h-5 w-5" /> Pending Shipping Transactions
            </h2>
            <p className="text-xs text-gray-500 mt-1">Successful transactions that have not yet completed shipping procedures up to delivered.</p>
          </div>
          <div className="p-6 sm:p-8">
            {pendingTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 font-medium text-sm">No pending shipping transactions.</div>
            ) : (
              <div className="space-y-4">
                {pendingTransactions.map(o => (
                  <div key={o.id} className="border border-amber-200 bg-amber-50/40 rounded-2xl p-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-amber-200 pb-3 mb-3">
                      <div>
                        <span className="font-mono font-black text-emerald-950 text-base">TXN #{o.transactionId || o.id}</span>
                        <span className="text-xs text-gray-500 font-medium ml-3">Payment Status: <strong className="text-emerald-700 uppercase">{o.paymentStatus || 'Paid'}</strong></span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                          ● {o.status} (In Shipping)
                        </span>
                        <span className="font-black text-lg text-emerald-900">KES {o.grandTotal?.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-700">
                      <strong>Shipping Route:</strong> {o.county}, {o.town}, {o.location} ({formatShippingAddress(o.shippingAddress)})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-md border border-emerald-100 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-100 bg-emerald-50/30">
            <h2 className="text-xl font-black text-gray-900 flex items-center">
              <CheckCircle className="mr-2 text-emerald-600 h-5 w-5" /> Completed & Delivered Transactions
            </h2>
            <p className="text-xs text-gray-500 mt-1">Successfully delivered orders with full transaction IDs and item details.</p>
          </div>
          <div className="p-6 sm:p-8">
            {completedTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 font-medium text-sm">No completed delivery transactions recorded yet.</div>
            ) : (
              <div className="space-y-6">
                {completedTransactions.map(o => (
                  <div key={o.id} className="border border-gray-200 bg-gray-50/50 rounded-2xl p-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-200 pb-4 mb-4">
                      <div>
                        <span className="font-mono font-black text-emerald-950 text-base">TXN ID: #{o.transactionId || o.id}</span>
                        <span className="text-xs text-gray-400 font-medium block sm:inline sm:ml-3">{new Date(o.createdAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ● DELIVERED & COMPLETED
                        </span>
                        <span className="font-black text-lg text-emerald-900">KES {o.grandTotal?.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 mb-4 bg-white p-4 rounded-xl border border-gray-200">
                      <div className="font-bold text-gray-800 mb-2 flex items-center"><MapPin size={14} className="mr-1 text-emerald-600"/> Delivery Details:</div>
                      <ul className="space-y-1 pl-5 list-disc text-gray-700">
                        <li><strong>County:</strong> {o.county || 'N/A'}</li>
                        <li><strong>Town/District:</strong> {o.town || 'N/A'}</li>
                        <li><strong>Location:</strong> {o.location || 'N/A'}</li>
                        <li><strong>Sublocation:</strong> {o.sublocation || 'N/A'}</li>
                        <li><strong>Street/Landmark:</strong> {formatShippingAddress(o.shippingAddress)}</li>
                        <li><strong>Payment Status:</strong> <span className="uppercase text-emerald-600 font-bold">{o.paymentStatus || 'Paid'}</span></li>
                      </ul>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {o.items?.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-100 font-medium">
                          <span>{item.quantity}x {item.name || item.product?.variety}</span>
                          <span className="font-bold">KES {(item.priceAtPurchase * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAdmin = () => {
    if (user?.role !== 'admin') {
      return (
        <div className="min-h-[80vh] flex items-center justify-center bg-[#0a0a0a]">
          <div className="text-center bg-rose-950/20 border border-rose-900/50 p-10 rounded-3xl max-w-md">
            <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-rose-500 font-black text-2xl tracking-widest mb-2">403 FORBIDDEN</h2>
            <p className="text-gray-400 text-sm">You lack the administrator clearance privileges required to access this system module.</p>
          </div>
        </div>
      );
    }

    const tabsList = [
      { id: 'inventory', icon: <Package size={18}/>, label: 'Grain Catalog' },
      { id: 'orders', icon: <ShoppingBag size={18}/>, label: 'Logistics & Orders' },
      { id: 'finances', icon: <BarChart2 size={18}/>, label: 'Financial Dashboard' },
      { id: 'users', icon: <Users size={18}/>, label: 'User Clearance' },
      { id: 'carousel', icon: <ImageIcon size={18}/>, label: 'Hero Config' },
      { id: 'config', icon: <Settings size={18}/>, label: 'Counties & Engine' },
      { id: 'logs', icon: <Activity size={18}/>, label: 'Audit Logs' }
    ];

    return (
      <div className="flex flex-col md:flex-row min-h-[calc(100vh-80px)] bg-[#0a0a0a] text-white font-sans animate-fadeIn">
        <aside className="w-full md:w-64 bg-[#111] border-b md:border-b-0 md:border-r border-gray-800/80 flex flex-col shrink-0 md:sticky md:top-20 md:h-[calc(100vh-80px)] overflow-y-auto">
          <div className="p-5 border-b border-gray-800/60 hidden md:block shrink-0">
            <div className="flex items-center gap-3 bg-[#181818] border border-gray-800 p-3 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                <Shield size={20}/>
              </div>
              <div className="truncate">
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Console Node</p>
                <p className="text-sm font-bold text-gray-200 truncate">{user?.fullName}</p>
              </div>
            </div>
          </div>

          <nav className="p-3 md:p-4 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible shrink-0 flex-1">
            {tabsList.map(tab => {
              const isActive = adminTab === tab.id;
              return (
                <button 
                  key={tab.id}
                  onClick={() => setAdminTab(tab.id as any)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all duration-200 shrink-0 ${
                    isActive 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50' 
                      : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-gray-500'}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>
  
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-[#0d0d0d]">
          {adminTab === 'inventory' && (
            <div className="animate-fadeIn space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center"><Leaf className="mr-3 text-emerald-500"/> Catalog Inventory Engine</h2>
                <p className="text-gray-400 text-xs mt-1">Add, update prices, manage stock quantities, or upload picture URLs.</p>
              </div>

              <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6 relative">
                <h3 className="font-bold text-sm text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Plus size={18}/> Initialize New Grain Record
                </h3>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const res = await fetch(`${API_BASE_URL}/admin/products`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({
                        ...newProduct,
                        weightKg: Number(newProduct.weightKg),
                        basePrice: Number(newProduct.basePrice),
                        price: Number(newProduct.basePrice),
                        costPrice: Number(newProduct.costPrice),
                        stockQuantity: Number(newProduct.stockQuantity)
                      })
                    });
                    if (res.ok) {
                      showToast('New grain product initialized in database!', 'success');
                      setNewProduct({ brandName: '', variety: '', weightKg: '', basePrice: '', costPrice: '', stockQuantity: '', imageUrl: '' });
                      fetchProducts();
                    } else {
                      const errData = await res.json();
                      showToast(errData.error || 'Failed to initialize new product', 'error');
                    }
                  } catch (err) { showToast('Error initializing product in server', 'error'); }
                }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input required type="text" placeholder="Brand (e.g. Mwea Pishori)" value={newProduct.brandName} onChange={e=>setNewProduct({...newProduct, brandName:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs outline-none focus:border-emerald-500 placeholder-gray-500" />
                  <input required type="text" placeholder="Variety (e.g. Grade 1 Aromatic)" value={newProduct.variety} onChange={e=>setNewProduct({...newProduct, variety:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs outline-none focus:border-emerald-500 placeholder-gray-500" />
                  <input required type="number" placeholder="Weight (Kg)" value={newProduct.weightKg} onChange={e=>setNewProduct({...newProduct, weightKg:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs outline-none focus:border-emerald-500 placeholder-gray-500" />
                  <input required type="number" placeholder="Cost/Buying Price (KES)" value={newProduct.costPrice} onChange={e=>setNewProduct({...newProduct, costPrice:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs outline-none focus:border-emerald-500 placeholder-gray-500" />
                  <input required type="number" placeholder="Selling Price (KES)" value={newProduct.basePrice} onChange={e=>setNewProduct({...newProduct, basePrice:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs outline-none focus:border-emerald-500 placeholder-gray-500" />
                  <input required type="number" placeholder="Stock Quantity (Bags)" value={newProduct.stockQuantity} onChange={e=>setNewProduct({...newProduct, stockQuantity:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs outline-none focus:border-emerald-500 placeholder-gray-500" />
                  <input type="text" placeholder="Image URL (http://...)" value={newProduct.imageUrl} onChange={e=>setNewProduct({...newProduct, imageUrl:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs outline-none focus:border-emerald-500 font-mono placeholder-gray-500 md:col-span-2" />
                  <button type="submit" className="bg-emerald-600 text-white px-6 py-3.5 rounded-xl font-bold text-xs hover:bg-emerald-500 transition-all md:col-span-3">Commit Product to Database</button>
                </form>
              </div>

              {editingProduct && (
                <div className="bg-[#1a1a1a] border-2 border-emerald-500/50 rounded-3xl p-6 shadow-2xl animate-fadeIn">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-sm text-emerald-400 uppercase tracking-wider">Modifying Record #{editingProduct.id}</h3>
                    <button onClick={() => setEditingProduct(null)} className="text-gray-400 hover:text-white"><X size={18}/></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Brand Name</label>
                      <input type="text" value={editingProduct.brandName} onChange={e=>setEditingProduct({...editingProduct, brandName:e.target.value})} className="w-full bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Variety</label>
                      <input type="text" value={editingProduct.variety} onChange={e=>setEditingProduct({...editingProduct, variety:e.target.value})} className="w-full bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Buying/Cost Price</label>
                      <input type="number" value={editingProduct.costPrice || ''} onChange={e=>setEditingProduct({...editingProduct, costPrice:Number(e.target.value)})} className="w-full bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs font-mono" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Selling Price</label>
                      <input type="number" value={editingProduct.basePrice} onChange={e=>setEditingProduct({...editingProduct, basePrice:Number(e.target.value), price:Number(e.target.value)})} className="w-full bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs font-mono" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Stock Inventory</label>
                      <input type="number" value={editingProduct.stockQuantity} onChange={e=>setEditingProduct({...editingProduct, stockQuantity:Number(e.target.value)})} className="w-full bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs font-mono" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Image URL</label>
                      <input type="text" placeholder="Image URL" value={editingProduct.imageUrl || ''} onChange={e=>setEditingProduct({...editingProduct, imageUrl:e.target.value})} className="w-full bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs font-mono" />
                    </div>
                  </div>
                  <button onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE_URL}/admin/products/${editingProduct.id}`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify(editingProduct)
                      });
                      if (res.ok) {
                        showToast('Product specifications modified', 'success');
                        setEditingProduct(null);
                        fetchProducts();
                      } else {
                        showToast('Failed to modify product record', 'error');
                      }
                    } catch (err) {
                      showToast('Network error while modifying product', 'error');
                    }
                  }} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-emerald-500 mr-3">Save Changes</button>
                </div>
              )}

              <div className="bg-[#141414] border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-[#1a1a1a] text-gray-400 border-b border-gray-800 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-6 py-4">ID</th>
                        <th className="px-6 py-4">Brand & Variety</th>
                        <th className="px-6 py-4">Buying Price</th>
                        <th className="px-6 py-4">Selling Price</th>
                        <th className="px-6 py-4">Stock Matrix</th>
                        <th className="px-6 py-4 text-center">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {products.map(p => (
                        <tr key={p.id} className="hover:bg-[#1a1a1a]/40 transition-colors">
                          <td className="px-6 py-4 font-mono text-gray-500">#{p.id}</td>
                          <td className="px-6 py-4 font-bold text-gray-200">{p.brandName} - <span className="text-gray-400 font-normal">{p.variety} ({p.weightKg}kg)</span></td>
                          <td className="px-6 py-4 font-bold font-mono text-gray-400">KES {p.costPrice?.toLocaleString() || '---'}</td>
                          <td className="px-6 py-4 font-bold font-mono text-emerald-400">KES {p.price?.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border font-mono ${
                              p.stockQuantity > 10 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}>
                              {p.stockQuantity} BAGS LEFT
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => setEditingProduct(p)} className="text-gray-400 hover:text-emerald-400 p-2 bg-[#1f1f1f] rounded-xl mr-2 transition-colors" title="Edit"><Edit size={14}/></button>
                            <button onClick={async () => {
                              if (confirm(`Permanently delete ${p.brandName} ${p.variety}?`)) {
                                try {
                                  const res = await fetch(`${API_BASE_URL}/admin/products/${p.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                                  if (res.ok) {
                                    showToast('Product wiped from database', 'success');
                                    fetchProducts();
                                  } else {
                                    showToast('Failed to delete product', 'error');
                                  }
                                } catch (err) {
                                  showToast('Network error deleting product', 'error');
                                }
                              }
                            }} className="text-gray-400 hover:text-rose-500 p-2 bg-[#1f1f1f] rounded-xl transition-colors" title="Delete"><Trash2 size={14}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {adminTab === 'orders' && (
            <div className="animate-fadeIn space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center"><ShoppingBag className="mr-3 text-emerald-500"/> Logistics & Order Management</h2>
                <p className="text-gray-400 text-xs mt-1">Review active orders, update delivery statuses, or monitor regional dispatch.</p>
              </div>

              <div className="bg-[#141414] border border-gray-800 rounded-3xl p-4 flex items-center gap-3">
                <Search size={18} className="text-gray-500 ml-2" />
                <input 
                  type="text" 
                  placeholder="Filter orders by ID, Customer Name, or Phone..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="bg-transparent text-white font-bold text-xs w-full outline-none placeholder-gray-600"
                />
              </div>

              <div className="space-y-4">
                {adminOrders
                  .filter(o => {
                    if (!orderSearchQuery) return true;
                    const q = orderSearchQuery.toLowerCase();
                    return String(o.id).includes(q) || o.user?.fullName?.toLowerCase().includes(q) || o.user?.phoneNumber?.includes(q) || o.county?.toLowerCase().includes(q);
                  })
                  .map(o => (
                    <div key={o.id} className="bg-[#141414] border border-gray-800 rounded-3xl p-6 shadow-xl">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-800/80 pb-4 mb-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-emerald-400 text-base">ORDER #{o.id}</span>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              o.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}>
                              {o.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Customer: <strong className="text-white">{o.user?.fullName || 'Guest'}</strong> ({o.user?.phoneNumber || 'No Phone'}) • {new Date(o.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="bg-[#1f1f1f] border border-gray-800 px-3 py-1.5 rounded-xl">
                             <span className="text-[10px] text-gray-400 block uppercase font-bold">Payment Status (Backend)</span>
                             <span className="text-xs font-black text-emerald-400 uppercase">{o.paymentStatus || 'Paid'}</span>
                           </div>

                           <span className="text-xs text-gray-400 font-bold">Shipping Status:</span>
                           <select 
                             value={o.status}
                             onChange={async (e) => {
                               const newStatus = e.target.value;
                               try {
                                 const res = await fetch(`${API_BASE_URL}/admin/orders/${o.id}/status`, {
                                   method: 'PUT',
                                   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                   body: JSON.stringify({ status: newStatus })
                                 });
                                 if (res.ok) {
                                   showToast(`Order #${o.id} shipping status updated to ${newStatus}`, 'success');
                                   fetchAdminOrders();
                                 } else {
                                   showToast('Failed to update order status', 'error');
                                 }
                               } catch (err) {
                                 showToast('Network error updating status', 'error');
                               }
                             }}
                             className="bg-[#1f1f1f] text-emerald-400 font-black text-xs border border-gray-700 rounded-xl px-3 py-2 outline-none cursor-pointer"
                           >
                             <option value="pending">Pending</option>
                             <option value="processing">Processing</option>
                             <option value="dispatched">Dispatched</option>
                             <option value="delivered">Delivered</option>
                             <option value="failed">Failed</option>
                           </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-[#181818] p-4 rounded-2xl border border-gray-800/80">
                          <p className="font-bold text-gray-300 mb-2 flex items-center"><MapPin size={14} className="mr-1 text-emerald-500"/> Delivery Logistics:</p>
                          <ul className="space-y-1 text-gray-400">
                            <li>County: <strong className="text-white">{o.county}</strong></li>
                            <li>Town: <strong className="text-white">{o.town}</strong></li>
                            <li>Location: <strong className="text-white">{o.location}</strong></li>
                            <li>Street: <strong className="text-white">{formatShippingAddress(o.shippingAddress)}</strong></li>
                          </ul>
                        </div>
                        <div className="bg-[#181818] p-4 rounded-2xl border border-gray-800/80 flex flex-col justify-between">
                          <div>
                            <p className="font-bold text-gray-300 mb-2">Order Items ({o.items?.length || 0}):</p>
                            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                              {o.items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-gray-400">
                                  <span>{item.quantity}x {item.name || item.product?.variety}</span>
                                  <span className="font-bold text-white">KES {(item.priceAtPurchase * item.quantity).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-between font-black text-sm text-emerald-400 border-t border-gray-800 pt-2 mt-2">
                            <span>Grand Total</span>
                            <span>KES {o.grandTotal?.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {adminTab === 'finances' && (() => {
            const monthlyRevenue = Array(12).fill(0);
            const monthlyProfit = Array(12).fill(0);
            let totalYearlyRevenue = 0;
            let totalYearlyProfit = 0;

            const categorySales: { [key: string]: { quantity: number, revenue: number, profit: number, sellingPrice: number, costPrice: number } } = {};

            adminOrders.forEach(order => {
               if (order.status !== 'failed' && order.paymentStatus !== 'failed') {
                   const d = new Date(order.createdAt);
                   if (d.getFullYear() === financeYear) {
                       totalYearlyRevenue += (order.grandTotal || 0);
                       
                       order.items?.forEach((item: any) => {
                          const catName = item.name || item.product?.variety || 'Standard Rice';
                          const selling = item.priceAtPurchase || 0;
                          const cost = item.product?.costPrice || item.costPrice || (selling * 0.75);
                          const profit = (selling - cost) * item.quantity;
                          const rev = selling * item.quantity;

                          if (!categorySales[catName]) {
                             categorySales[catName] = { quantity: 0, revenue: 0, profit: 0, sellingPrice: selling, costPrice: cost };
                          }
                          categorySales[catName].quantity += item.quantity;
                          categorySales[catName].revenue += rev;
                          categorySales[catName].profit += profit;
                       });

                       const m = d.getMonth();
                       monthlyRevenue[m] += (order.grandTotal || 0);
                       const orderProfit = order.items?.reduce((sum: number, item: any) => {
                          const selling = item.priceAtPurchase || 0;
                          const cost = item.product?.costPrice || item.costPrice || (selling * 0.75);
                          return sum + ((selling - cost) * item.quantity);
                       }, 0) || 0;
                       monthlyProfit[m] += orderProfit;
                       totalYearlyProfit += orderProfit;
                   }
               }
            });

            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

            return (
              <div className="animate-fadeIn space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-white flex items-center"><BarChart2 className="mr-3 text-emerald-500"/> Financial Analytics & Profits</h2>
                    <p className="text-gray-400 text-xs mt-1">Real-time revenue, net margins, and monthly financial breakdowns.</p>
                  </div>
                  <div className="flex items-center gap-2 bg-[#141414] border border-gray-800 p-2 rounded-2xl">
                    <Calendar className="text-emerald-500 h-4 w-4 ml-2" />
                    <span className="text-xs font-bold text-gray-400">Year:</span>
                    <select 
                      value={financeYear} 
                      onChange={(e) => setFinanceYear(Number(e.target.value))}
                      className="bg-[#1f1f1f] text-emerald-400 font-black text-xs border border-gray-700 rounded-xl px-3 py-1.5 outline-none cursor-pointer"
                    >
                      {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Gross Revenue ({financeYear})</span>
                    <div className="text-2xl font-black font-mono text-emerald-400">KES {totalYearlyRevenue.toLocaleString()}</div>
                  </div>
                  <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Estimated Net Profit</span>
                    <div className="text-2xl font-black font-mono text-emerald-300">KES {totalYearlyProfit.toLocaleString()}</div>
                  </div>
                  <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Average Profit Margin</span>
                    <div className="text-2xl font-black font-mono text-amber-400">
                      {totalYearlyRevenue > 0 ? ((totalYearlyProfit / totalYearlyRevenue) * 100).toFixed(1) : '0'}%
                    </div>
                  </div>
                </div>

                <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6">
                  <h3 className="font-bold text-sm text-gray-200 mb-4 uppercase tracking-wider">Monthly Breakdown ({financeYear})</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {monthNames.map((m, idx) => (
                      <div key={m} className="bg-[#181818] p-3 rounded-2xl border border-gray-800/80">
                        <span className="text-xs font-black text-emerald-400 block">{m}</span>
                        <div className="text-xs font-mono font-bold text-white mt-1">KES {monthlyRevenue[idx].toLocaleString()}</div>
                        <div className="text-[10px] font-mono text-gray-500 mt-0.5">Profit: KES {monthlyProfit[idx].toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#141414] border border-gray-800 rounded-3xl overflow-hidden p-6">
                  <h3 className="font-bold text-sm text-gray-200 mb-4 uppercase tracking-wider">Itemized Variety Profitability</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-[#1a1a1a] text-gray-400 border-b border-gray-800 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-4 py-3">Grain Variety</th>
                          <th className="px-4 py-3">Units Sold</th>
                          <th className="px-4 py-3">Gross Revenue</th>
                          <th className="px-4 py-3">Calculated Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {Object.keys(categorySales).length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No sales recorded for this year.</td></tr>
                        ) : (
                          Object.entries(categorySales).map(([cat, data]) => (
                            <tr key={cat}>
                              <td className="px-4 py-3 font-bold text-gray-200">{cat}</td>
                              <td className="px-4 py-3 font-mono text-gray-400">{data.quantity} bags</td>
                              <td className="px-4 py-3 font-mono text-emerald-400">KES {data.revenue.toLocaleString()}</td>
                              <td className="px-4 py-3 font-mono text-emerald-300 font-bold">KES {data.profit.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {adminTab === 'users' && (
            <div className="animate-fadeIn space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center"><Users className="mr-3 text-emerald-500"/> User Accounts Clearance</h2>
                <p className="text-gray-400 text-xs mt-1">Manage user account permissions and administrator privileges.</p>
              </div>

              <div className="bg-[#141414] border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-[#1a1a1a] text-gray-400 border-b border-gray-800 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-6 py-4">ID</th>
                        <th className="px-6 py-4">Full Name</th>
                        <th className="px-6 py-4">Phone Number</th>
                        <th className="px-6 py-4">Role Clearance</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {adminUsers.map(u => (
                        <tr key={u.id} className="hover:bg-[#1a1a1a]/40 transition-colors">
                          <td className="px-6 py-4 font-mono text-gray-500">#{u.id}</td>
                          <td className="px-6 py-4 font-bold text-gray-200">{u.fullName}</td>
                          <td className="px-6 py-4 font-mono text-gray-400">{u.phoneNumber}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase ${
                              u.role === 'admin' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={async () => {
                              const nextRole = u.role === 'admin' ? 'user' : 'admin';
                              try {
                                const res = await fetch(`${API_BASE_URL}/admin/users/${u.id}/role`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                  body: JSON.stringify({ role: nextRole })
                                });
                                if (res.ok) {
                                  showToast(`User ${u.fullName} clearance updated to ${nextRole}`, 'success');
                                  fetchAdminUsers();
                                } else {
                                  showToast('Failed to update user clearance', 'error');
                                }
                              } catch (err) {
                                showToast('Network error updating clearance', 'error');
                              }
                            }} className="text-gray-400 hover:text-emerald-400 p-2 bg-[#1f1f1f] rounded-xl font-bold text-[10px] uppercase transition-colors">
                              Toggle Role
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

          {adminTab === 'carousel' && (
            <div className="animate-fadeIn space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center"><ImageIcon className="mr-3 text-emerald-500"/> Dynamic Hero & Carousel Engine</h2>
                <p className="text-gray-400 text-xs mt-1">Configure landing page hero videos, images, and announcement text.</p>
              </div>

              <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6">
                <h3 className="font-bold text-sm text-emerald-400 uppercase tracking-wider mb-4">Update Hero Headline & Media</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Hero Title</label>
                    <input type="text" value={heroSettings?.title || ''} onChange={e=>setHeroSettings({...heroSettings, title: e.target.value})} className="w-full bg-white text-black font-bold px-4 py-2.5 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Subtitle</label>
                    <input type="text" value={heroSettings?.subtitle || ''} onChange={e=>setHeroSettings({...heroSettings, subtitle: e.target.value})} className="w-full bg-white text-black font-bold px-4 py-2.5 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Video 1 Embed URL</label>
                    <input type="text" value={heroSettings?.video1 || ''} onChange={e=>setHeroSettings({...heroSettings, video1: e.target.value})} className="w-full bg-white text-black font-mono px-4 py-2.5 rounded-xl outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Image 1 Backdrop URL</label>
                    <input type="text" value={heroSettings?.img1 || ''} onChange={e=>setHeroSettings({...heroSettings, img1: e.target.value})} className="w-full bg-white text-black font-mono px-4 py-2.5 rounded-xl outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Announcement Ticker Text</label>
                    <input type="text" value={heroSettings?.announcementTicker || ''} onChange={e=>setHeroSettings({...heroSettings, announcementTicker: e.target.value})} className="w-full bg-white text-black font-bold px-4 py-2.5 rounded-xl outline-none" />
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE_URL}/config/hero`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify(heroSettings)
                      });
                      if (res.ok) {
                        showToast('Hero settings saved successfully!', 'success');
                      } else {
                        showToast('Failed to save hero settings', 'error');
                      }
                    } catch (err) {
                      showToast('Network error saving hero settings', 'error');
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-3 rounded-xl mt-4 transition-all"
                >
                  Save Hero Settings
                </button>
              </div>
            </div>
          )}

          {adminTab === 'config' && (
            <div className="animate-fadeIn space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center"><Settings className="mr-3 text-emerald-500"/> Regional Delivery & Transport Fees</h2>
                <p className="text-gray-400 text-xs mt-1">Set county-specific delivery fees across all 47 counties in Kenya.</p>
              </div>

              <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6">
                <h3 className="font-bold text-sm text-emerald-400 uppercase tracking-wider mb-4">County Delivery Rate Override</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const updated = { ...countyOverrides, [countyOverrideForm.county]: Number(countyOverrideForm.fee) };
                    const res = await fetch(`${API_BASE_URL}/config/counties`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify(updated)
                    });
                    if (res.ok) {
                      setCountyOverrides(updated);
                      showToast(`Transport fee for ${countyOverrideForm.county} set to KES ${countyOverrideForm.fee}`, 'success');
                      setCountyOverrideForm({ county: 'Nairobi', fee: '' });
                    } else {
                      showToast('Failed to update transport fee', 'error');
                    }
                  } catch (err) {
                    showToast('Network error updating rate', 'error');
                  }
                }} className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">County</label>
                    <select value={countyOverrideForm.county} onChange={e=>setCountyOverrideForm({...countyOverrideForm, county: e.target.value})} className="w-full bg-white text-black font-bold px-4 py-3 rounded-xl text-xs outline-none">
                      {ALL_47_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Custom Fee (KES)</label>
                    <input required type="number" placeholder="250" value={countyOverrideForm.fee} onChange={e=>setCountyOverrideForm({...countyOverrideForm, fee: e.target.value})} className="w-full bg-white text-black font-bold px-4 py-3 rounded-xl text-xs outline-none" />
                  </div>
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-3.5 rounded-xl transition-all w-full sm:w-auto">Save Override</button>
                </form>
              </div>

              <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6">
                <h3 className="font-bold text-sm text-gray-300 uppercase tracking-wider mb-4">Active County Rate Overrides</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(countyOverrides).map(([county, fee]) => (
                    <div key={county} className="bg-[#181818] p-3 rounded-2xl border border-gray-800/80 flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-300">{county}</span>
                      <span className="font-mono font-black text-emerald-400">KES {fee}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {adminTab === 'logs' && (
            <div className="animate-fadeIn space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center"><Activity className="mr-3 text-emerald-500"/> M-Pesa Callbacks & Audit Logs</h2>
                <p className="text-gray-400 text-xs mt-1">Live M-Pesa STK callbacks, response payloads, and order event streams.</p>
              </div>

              <div className="bg-[#141414] border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="p-4 bg-[#1a1a1a] border-b border-gray-800 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Server Logs Registry ({adminLogs.length})</span>
                  <button onClick={fetchAdminLogs} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                    <RefreshCw size={14}/> Refresh
                  </button>
                </div>
                <div className="p-4 font-mono text-xs max-h-[600px] overflow-y-auto space-y-2">
                  {adminLogs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No payment callback logs available in database.</div>
                  ) : (
                    adminLogs.map((log: any, idx: number) => (
                      <div key={idx} className="bg-[#181818] p-3 rounded-xl border border-gray-800 text-gray-300">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                          <span>{log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Event Log'}</span>
                          <span className="text-emerald-400 font-bold">{log.type || 'STK_PUSH_CALLBACK'}</span>
                        </div>
                        <pre className="text-[11px] text-emerald-300 overflow-x-auto whitespace-pre-wrap">{typeof log === 'string' ? log : JSON.stringify(log, null, 2)}</pre>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/20 via-white to-emerald-50/20 text-gray-900 font-sans selection:bg-emerald-500 selection:text-white">
      {renderNav()}
      {renderToast()}
      {view === 'home' && renderHome()}
      {view === 'shop' && renderShop()}
      {view === 'cart' && renderCart()}
      {view === 'login' && renderAuth()}
      {view === 'profile' && renderProfile()}
      {view === 'admin' && renderAdmin()}
    </div>
  );
}
