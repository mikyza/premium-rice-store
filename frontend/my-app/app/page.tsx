"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, User as UserIcon, LogIn, Menu, X, Plus, 
  Trash2, Shield, Clock, Search, Edit, Package, Activity, 
  CheckCircle, AlertCircle, Settings, Leaf, ChevronRight,
  ShoppingBag, Users, Image as ImageIcon, Video, Download,
  MapPin, Eye, RefreshCw, LogOut, Check, AlertTriangle, Smartphone, CreditCard,
  BarChart2, DollarSign, Award, Calendar
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

// Regional logistics datasets for dynamic county dropdowns
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

// ==========================================
// 2. MAIN APPLICATION COMPONENT
// ==========================================
export default function PremiumRiceStore() {
  // --- Global Navigation & Auth States ---
  const [view, setView] = useState<'home' | 'shop' | 'cart' | 'login' | 'admin' | 'profile'>('home');
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // --- Dynamic Store Data States ---
  const [products, setProducts] = useState<any[]>([]);
  const [carousel, setCarousel] = useState<any[]>([]);
  const [heroSettings, setHeroSettings] = useState<any>({
    title: 'Direct From Mwea Paddy Fields',
    subtitle: '100% Pure Aromatic Pishori Rice harvested and delivered straight to your doorstep.',
    video1: 'https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI',
    video2: '',
    img1: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80',
    img2: '',
    img3: ''
  });
  
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [cart, setCart] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  
  // --- Engine & Logistics States ---
  const [flashSale, setFlashSale] = useState({ active: false, endTime: null as string | null, msRemaining: 0 });
  const [baseTransportFee, setBaseTransportFee] = useState(250);
  const [countyOverrides, setCountyOverrides] = useState<{ [key: string]: number }>({});
  const [socket, setSocket] = useState<Socket | null>(null);

  // --- Checkout Form States ---
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
  
  // --- Auth Form States ---
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'reset'>('request');
  const [formData, setFormData] = useState({ phoneNumber: '', email: '', password: '', fullName: '', resetToken: '', newPassword: '' });
  
  // --- Admin Workspace States ---
  const [adminTab, setAdminTab] = useState<'inventory' | 'orders' | 'users' | 'carousel' | 'config' | 'logs' | 'finances'>('inventory');
  const [newProduct, setNewProduct] = useState({ brandName: '', variety: '', weightKg: '', basePrice: '', costPrice: '', stockQuantity: '', imageUrl: '' });
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [shopSearch, setShopSearch] = useState('');
  
  // --- Admin Financial State ---
  const [financeYear, setFinanceYear] = useState<number>(new Date().getFullYear());

  // ==========================================
  // ACCOUNT-SCOPED CART LOGIC
  // ==========================================
  const getAccountCartKey = (u: any) => {
    return u ? `mwea_hub_cart_${u.id || u.phoneNumber}` : 'mwea_hub_cart_guest';
  };

  // Load account-specific cart whenever user session changes
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

  // Sync current cart changes strictly to the active user account key
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

  // ==========================================
  // 3. INITIALIZATION & REAL-TIME WEBSOCKETS
  // ==========================================
  
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

  // Sync default logistics dropdown values when County changes
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

  // Populate user STK phone number on load
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

  // ==========================================
  // 4. API HELPERS & DATA FETCHERS WITH ERROR HANDLING
  // ==========================================
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
      } else {
        console.error("Carousel config response not ok");
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
      } else {
        console.error("Hero config response not ok");
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
      } else {
        console.error("County overrides response not ok");
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
        setAdminLogs(await res.json());
      } else {
        showToast('Error fetching database audit logs', 'error');
      }
    } catch (err) { 
      showToast('Network error while fetching system logs', 'error'); 
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
    setCart([]); // Reset active cart view on logout
    setView('home');
    showToast('Logged out successfully');
  };

  // ==========================================
  // 5. CART & DYNAMIC LOGISTICS LOGIC
  // ==========================================
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

  // ==========================================
  // CALCULATE LOYALTY POINTS
  // ==========================================
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

  // ==========================================
  // 6. RENDER SUB-COMPONENTS
  // ==========================================

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
               {cart.length > 0 && <span className="absolute 0 top-0 right-0 bg-rose-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">{cart.length}</span>}
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
    // Media collection mapping from Settings
    const mediaArray = [
      { type: 'video', url: heroSettings?.video1 },
      { type: 'video', url: heroSettings?.video2 },
      { type: 'image', url: heroSettings?.img1 },
      { type: 'image', url: heroSettings?.img2 },
      { type: 'image', url: heroSettings?.img3 }
    ].filter(item => item.url && item.url.trim() !== '');

    const currentMedia = mediaArray.length > 0 ? mediaArray[activeHeroIndex % mediaArray.length] : null;

    return (
      <div className="animate-fadeIn">
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
              className="absolute inset-0 w-full h-full object-cover opacity-40 transition-opacity duration-1000" 
            />
          ) : (
            <img 
              src="https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80" 
              alt="Default Backdrop" 
              className="absolute inset-0 w-full h-full object-cover opacity-40 transition-opacity duration-1000" 
            />
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/40 to-transparent flex flex-col justify-center items-center text-center p-6 z-10">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-6 animate-pulse">
              🌱 Pure Kenya Agricultural Harvest
            </span>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white mb-6 drop-shadow-2xl tracking-tight max-w-4xl leading-none">
              {heroSettings?.title || 'Direct From Mwea Paddy Fields'}
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-emerald-100 mb-10 max-w-2xl font-medium drop-shadow leading-relaxed">
              {heroSettings?.subtitle || '100% Pure Aromatic Pishori Rice harvested and delivered straight to your doorstep.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => setView('shop')} className="bg-emerald-500 text-white px-8 py-4 rounded-full font-black text-lg hover:bg-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all transform hover:scale-105 flex items-center justify-center">
                Explore Grain Catalog <ChevronRight className="ml-2 h-5 w-5" />
              </button>
              <button onClick={() => setView('profile')} className="bg-emerald-900/80 border border-emerald-700 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-800 transition-all">
                Track Order Status
              </button>
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
                      <Plus className="h-4 w-4 sm:h-4 sm:w-4 sm:mr-1" /> <span className="hidden sm:inline">Add</span>
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

              {/* Complete Location Details Visibility View */}
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

  const renderProfile = () => (
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
      
      <div className="bg-white rounded-3xl shadow-md border border-emerald-100 overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-gray-100 bg-emerald-50/30">
          <h2 className="text-xl font-black text-gray-900 flex items-center">
            <Clock className="mr-2 text-emerald-600 h-5 w-5" /> Live Order Fulfillment Tracking
          </h2>
          <p className="text-xs text-gray-500 mt-1">Real-time status updates from our Mwea dispatch warehouses.</p>
        </div>

        <div className="p-6 sm:p-8">
          {myOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-medium">No order history recorded yet. Place your first order from the Grain Catalog!</div>
          ) : (
            <div className="space-y-6">
              {myOrders.map(o => (
                <div key={o.id} className={`border rounded-2xl p-5 transition-all ${o.paymentStatus === 'failed' ? 'bg-rose-50/30 border-rose-200' : 'bg-gray-50/50 border-gray-200 hover:border-emerald-300'}`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-200/80 pb-4 mb-4">
                    <div>
                      <span className="font-mono font-black text-emerald-950 text-base">ORDER #{o.id}</span>
                      <span className="text-xs text-gray-400 font-medium block sm:inline sm:ml-3">{new Date(o.createdAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        o.paymentStatus === 'failed' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                        (o.status === 'pending' && o.paymentStatus === 'paid') ? 'bg-blue-100 text-blue-800 border-blue-300' :
                        o.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        o.status === 'dispatched' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
                        o.status === 'processing' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        'bg-gray-200 text-gray-700 border-gray-300'
                      }`}>
                        ● {o.paymentStatus === 'failed' ? 'PAYMENT FAILED' : (o.status === 'pending' && o.paymentStatus === 'paid' ? 'PAID - WAITING ADMIN' : o.status)}
                      </span>
                      <span className="font-black text-lg text-emerald-900">KES {o.grandTotal?.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 mb-4 bg-white p-4 rounded-xl border border-gray-200">
                    <div className="font-bold text-gray-800 mb-2 flex items-center"><MapPin size={14} className="mr-1 text-emerald-600"/> Complete Delivery Logistics:</div>
                    <ul className="space-y-1 pl-5 list-disc text-gray-700">
                      <li><strong>County:</strong> {o.county || 'N/A'}</li>
                      <li><strong>Town/District:</strong> {o.town || 'N/A'}</li>
                      <li><strong>Location:</strong> {o.location || 'N/A'}</li>
                      <li><strong>Sublocation:</strong> {o.sublocation || 'N/A'}</li>
                      <li><strong>Street/Landmark:</strong> {o.shippingAddress?.details || o.shippingAddress || 'N/A'}</li>
                      <li><strong>Payment Channel:</strong> {o.paymentMethod || 'N/A'}</li>
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
      { id: 'inventory', label: 'Warehouse DB', icon: <Package size={18}/> },
      { id: 'orders', label: 'Logistics', icon: <ShoppingBag size={18}/> },
      { id: 'users', label: 'User Clearance', icon: <Users size={18}/> },
      { id: 'carousel', label: 'Hero Config', icon: <ImageIcon size={18}/> },
      { id: 'config', label: 'Engine & Counties', icon: <Settings size={18}/> },
      { id: 'finances', label: 'Ledger', icon: <BarChart2 size={18}/> },
      { id: 'logs', label: 'Audit Logs', icon: <Activity size={18}/> }
    ];

    return (
      <div className="flex flex-col md:flex-row min-h-[calc(100vh-80px)] bg-[#0a0a0a] text-white font-sans animate-fadeIn">
        {/* Fixed admin sidebar using sticky positioning on desktop */}
        <aside className="w-full md:w-72 bg-[#111111] border-r border-[#222] p-6 flex flex-col md:sticky md:top-20 md:h-[calc(100vh-80px)] overflow-y-auto">
          <div className="flex items-center gap-3 mb-8 px-2">
             <Shield className="h-8 w-8 text-rose-500" />
             <div>
               <h2 className="text-lg font-black tracking-widest text-white">COMMAND</h2>
               <p className="text-[10px] text-rose-500 font-bold uppercase">Root Access Granted</p>
             </div>
          </div>
          <nav className="space-y-1.5 flex-1">
            {tabsList.map(t => (
              <button 
                key={t.id}
                onClick={() => setAdminTab(t.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${adminTab === t.id ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-inner' : 'text-gray-500 hover:text-white hover:bg-white/5 border border-transparent'}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </aside>
        
        <main className="flex-1 p-6 md:p-10 overflow-y-auto">
          {adminTab === 'inventory' && (
            <div className="animate-fadeIn space-y-8">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-1/3">
                  <div className="bg-[#141414] border border-emerald-900/30 p-6 rounded-3xl shadow-xl sticky top-6">
                    <h2 className="text-xl font-black text-emerald-400 mb-6 flex items-center">
                      <Edit className="mr-2 h-5 w-5" /> {editingProduct ? 'Modify Grain Stock' : 'Register New Grain'}
                    </h2>
                    <form className="space-y-4" onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const url = editingProduct ? `${API_BASE_URL}/products/catalog/${editingProduct.id}` : `${API_BASE_URL}/products/catalog`;
                        const method = editingProduct ? 'PUT' : 'POST';
                        const res = await fetch(url, {
                          method,
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify(newProduct)
                        });
                        if (res.ok) {
                          showToast(`Product ${editingProduct ? 'updated' : 'added'} successfully`, 'success');
                          fetchProducts();
                          setEditingProduct(null);
                          setNewProduct({ brandName: '', variety: '', weightKg: '', basePrice: '', costPrice: '', stockQuantity: '', imageUrl: '' });
                        } else {
                          const err = await res.json();
                          showToast(err.error || 'Failed to execute catalog update', 'error');
                        }
                      } catch (err) {
                        showToast('Network error', 'error');
                      }
                    }}>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase">Brand Name</label><input required className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5 mt-1 text-sm text-white focus:border-emerald-500 outline-none" placeholder="e.g. Nice Digital" value={newProduct.brandName} onChange={(e) => setNewProduct({...newProduct, brandName: e.target.value})} /></div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase">Variety</label><input required className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5 mt-1 text-sm text-white focus:border-emerald-500 outline-none" placeholder="e.g. Pure Pishori" value={newProduct.variety} onChange={(e) => setNewProduct({...newProduct, variety: e.target.value})} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Weight (KG)</label><input required type="number" className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5 mt-1 text-sm text-white focus:border-emerald-500 outline-none" placeholder="25" value={newProduct.weightKg} onChange={(e) => setNewProduct({...newProduct, weightKg: e.target.value})} /></div>
                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Stock Bags</label><input required type="number" className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5 mt-1 text-sm text-white focus:border-emerald-500 outline-none" placeholder="100" value={newProduct.stockQuantity} onChange={(e) => setNewProduct({...newProduct, stockQuantity: e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Selling Price KES</label><input required type="number" className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5 mt-1 text-sm text-white focus:border-emerald-500 outline-none" value={newProduct.basePrice} onChange={(e) => setNewProduct({...newProduct, basePrice: e.target.value})} /></div>
                        <div><label className="text-[10px] font-bold text-gray-400 uppercase">Cost Price KES</label><input required type="number" className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5 mt-1 text-sm text-white focus:border-emerald-500 outline-none" value={newProduct.costPrice} onChange={(e) => setNewProduct({...newProduct, costPrice: e.target.value})} /></div>
                      </div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase">Image URL (Optional)</label><input className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-2.5 mt-1 text-sm text-white focus:border-emerald-500 outline-none" placeholder="https://..." value={newProduct.imageUrl} onChange={(e) => setNewProduct({...newProduct, imageUrl: e.target.value})} /></div>
                      
                      <div className="flex gap-2 pt-2">
                        <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-emerald-900/20">
                          {editingProduct ? 'Commit Changes' : 'Write to Database'}
                        </button>
                        {editingProduct && <button type="button" onClick={() => { setEditingProduct(null); setNewProduct({ brandName: '', variety: '', weightKg: '', basePrice: '', costPrice: '', stockQuantity: '', imageUrl: '' }); }} className="bg-gray-800 hover:bg-gray-700 px-4 py-3 rounded-xl font-bold text-sm transition-colors">Cancel</button>}
                      </div>
                    </form>
                  </div>
                </div>

                <div className="w-full lg:w-2/3">
                  <div className="bg-[#141414] border border-[#222] rounded-3xl overflow-hidden shadow-xl">
                     <div className="px-6 py-5 border-b border-[#222] flex justify-between items-center bg-[#1a1a1a]">
                        <h2 className="text-xl font-black text-white flex items-center"><Database className="mr-2 h-5 w-5 text-gray-400"/> Current Live Catalog</h2>
                        <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-800 px-3 py-1 rounded-full text-xs font-bold tracking-widest">{products.length} REGISTERS</span>
                     </div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-[#0a0a0a] text-gray-400 text-xs uppercase tracking-wider font-bold">
                            <tr>
                              <th className="px-6 py-4">Sack Spec</th>
                              <th className="px-6 py-4">Economics</th>
                              <th className="px-6 py-4">Stock</th>
                              <th className="px-6 py-4 text-right">Sys Cmd</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#222] text-gray-300">
                            {products.map(p => (
                              <tr key={p.id} className="hover:bg-[#1a1a1a] transition-colors">
                                <td className="px-6 py-4">
                                  <div className="font-bold text-white text-base">{p.variety}</div>
                                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">{p.brandName} • {p.weightKg}KG</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-mono text-emerald-400">Sell: KES {p.basePrice}</div>
                                  <div className="font-mono text-rose-400 text-xs">Cost: KES {p.costPrice}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded-md text-xs font-bold font-mono ${p.stockQuantity > 10 ? 'bg-emerald-900/40 text-emerald-400' : 'bg-rose-900/40 text-rose-400 animate-pulse'}`}>{p.stockQuantity} BAGS</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button onClick={() => { setHere is the corrected and completed code for your file, resolving the abrupt cutoff and fixing the main component's return structure so that all views render properly[cite: 1]. 

```tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, User as UserIcon, LogIn, Menu, X, Plus, 
  Trash2, Shield, Clock, Search, Edit, Package, Activity, 
  CheckCircle, AlertCircle, Settings, Leaf, ChevronRight,
  ShoppingBag, Users, Image as ImageIcon, Video, Download,
  MapPin, Eye, RefreshCw, LogOut, Check, AlertTriangle, Smartphone, CreditCard,
  BarChart2, DollarSign, Award, Calendar
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

// Regional logistics datasets for dynamic county dropdowns
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

// ==========================================
// 2. MAIN APPLICATION COMPONENT
// ==========================================
export default function PremiumRiceStore() {
  // --- Global Navigation & Auth States ---
  const [view, setView] = useState<'home' | 'shop' | 'cart' | 'login' | 'admin' | 'profile'>('home');
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // --- Dynamic Store Data States ---
  const [products, setProducts] = useState<any[]>([]);
  const [carousel, setCarousel] = useState<any[]>([]);
  const [heroSettings, setHeroSettings] = useState<any>({
    title: 'Direct From Mwea Paddy Fields',
    subtitle: '100% Pure Aromatic Pishori Rice harvested and delivered straight to your doorstep.',
    video1: '[https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI](https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI)',
    video2: '',
    img1: '[https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80](https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80)',
    img2: '',
    img3: ''
  });
  
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [cart, setCart] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  
  // --- Engine & Logistics States ---
  const [flashSale, setFlashSale] = useState({ active: false, endTime: null as string | null, msRemaining: 0 });
  const [baseTransportFee, setBaseTransportFee] = useState(250);
  const [countyOverrides, setCountyOverrides] = useState<{ [key: string]: number }>({});
  const [socket, setSocket] = useState<Socket null |>(null);

  // --- Checkout Form States ---
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
  
  // --- Auth Form States ---
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'reset'>('request');
  const [formData, setFormData] = useState({ phoneNumber: '', email: '', password: '', fullName: '', resetToken: '', newPassword: '' });
  
  // --- Admin Workspace States ---
  const [adminTab, setAdminTab] = useState<'inventory' | 'orders' | 'users' | 'carousel' | 'config' | 'logs' | 'finances'>('inventory');
  const [newProduct, setNewProduct] = useState({ brandName: '', variety: '', weightKg: '', basePrice: '', costPrice: '', stockQuantity: '', imageUrl: '' });
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [shopSearch, setShopSearch] = useState('');
  
  // --- Admin Financial State ---
  const [financeYear, setFinanceYear] = useState<number>(new Date().getFullYear());

  // ==========================================
  // ACCOUNT-SCOPED CART LOGIC
  // ==========================================
  const getAccountCartKey = (u: any) => {
    return u ? `mwea_hub_cart_${u.id || u.phoneNumber}` : 'mwea_hub_cart_guest';
  };

  // Load account-specific cart whenever user session changes
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

  // Sync current cart changes strictly to the active user account key
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

  // ==========================================
  // 3. INITIALIZATION & REAL-TIME WEBSOCKETS
  // ==========================================
  
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

  // Sync default logistics dropdown values when County changes
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

  // Populate user STK phone number on load
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

  // ==========================================
  // 4. API HELPERS & DATA FETCHERS WITH ERROR HANDLING
  // ==========================================
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
      } else {
        console.error("Carousel config response not ok");
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
      } else {
        console.error("Hero config response not ok");
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
      } else {
        console.error("County overrides response not ok");
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
        setAdminLogs(await res.json());
      } else {
        showToast('Error fetching database audit logs', 'error');
      }
    } catch (err) { 
      showToast('Network error while fetching system logs', 'error'); 
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
    setCart([]); // Reset active cart view on logout
    setView('home');
    showToast('Logged out successfully');
  };

  // ==========================================
  // 5. CART & DYNAMIC LOGISTICS LOGIC
  // ==========================================
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

  // ==========================================
  // CALCULATE LOYALTY POINTS
  // ==========================================
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

  // ==========================================
  // 6. RENDER SUB-COMPONENTS
  // ==========================================

  const renderNav = () => (
    <nav className="bg-emerald-900 text-emerald-50 sticky top-0 z-50 shadow-xl border-b border-emerald-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center cursor-pointer group" onClick={() => setView('home')}>
            <Leaf className="h-9 w-9 text-emerald-400 mr-2.5 transform group-hover:scale-110 transition-transform duration-300"/>
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
                <Shield className="h-4 w-4 mr-1.5 animate-pulse"/> Admin Console
              </button>
            )}
            
            <button onClick={() => setView('cart')} className="relative p-2.5 bg-emerald-800/80 hover:bg-emerald-800 rounded-full transition-colors group">
              <ShoppingCart className="h-5 w-5 transform group-hover:scale-110 transition-transform text-emerald-200"/>
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[11px] font-black rounded-full h-5 w-5 flex items-center justify-center animate-bounce shadow">
                  {cart.length}
                </span>
              )}
            </button>

            {user ? (
              <div className="flex items-center space-x-4 pl-4 border-l border-emerald-800">
                <button onClick={() => setView('profile')} className="flex items-center text-sm font-bold bg-emerald-800/50 hover:bg-emerald-800 px-4 py-2 rounded-xl transition-all">
                  <UserIcon className="h-4 w-4 mr-2 text-emerald-400"/> {user.fullName ? user.fullName.split(' ')[0] : 'Account'}
                </button>
                <button onClick={handleLogout} className="p-2 text-emerald-300 hover:text-rose-400 hover:bg-emerald-950 rounded-lg transition-colors" title="Sign Out">
                  <LogOut className="h-5 w-5"/>
                </button>
              </div>
            ) : (
              <button onClick={() => setView('login')} className="flex items-center bg-emerald-500 px-6 py-2.5 rounded-full font-bold text-white hover:bg-emerald-400 transition-all shadow-lg hover:shadow-emerald-500/30 transform hover:-translate-y-0.5">
                <LogIn className="h-4 w-4 mr-2"/> Sign In
              </button>
            )}
          </div>

          <div className="md:hidden flex items-center space-x-3">
             <button onClick={() => setView('cart')} className="relative p-2 hover:bg-emerald-800 rounded-lg">
               <ShoppingCart className="h-6 w-6 text-emerald-200"/>
               {cart.length > 0 && <span className="absolute 0 top-0 right-0 bg-rose-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">{cart.length}</span>}
             </button>
             <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 hover:bg-emerald-800 rounded-lg text-emerald-200">
               {mobileMenuOpen ? <X className="h-7 w-7"/> : <Menu className="h-7 w-7"/>}
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
    // Media collection mapping from Settings
    const mediaArray = [
      { type: 'video', url: heroSettings?.video1 },
      { type: 'video', url: heroSettings?.video2 },
      { type: 'image', url: heroSettings?.img1 },
      { type: 'image', url: heroSettings?.img2 },
      { type: 'image', url: heroSettings?.img3 }
    ].filter(item => item.url && item.url.trim() !== '');

    const currentMedia = mediaArray.length > 0 ? mediaArray[activeHeroIndex % mediaArray.length] : null;

    return (
      <div className="animate-fadeIn">
        {flashSale.active && (
          <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 text-white py-3 px-4 text-center font-black flex flex-col sm:flex-row justify-center items-center shadow-lg border-b border-rose-700 text-sm tracking-wide">
            <div className="flex items-center mb-1 sm:mb-0">
              <Clock className="h-5 w-5 mr-2 animate-spin"/>
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
              className="absolute inset-0 w-full h-full object-cover opacity-40 transition-opacity duration-1000" 
            />
          ) : (
            <img 
              src="[https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80](https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1600&q=80)" 
              alt="Default Backdrop" 
              className="absolute inset-0 w-full h-full object-cover opacity-40 transition-opacity duration-1000" 
            />
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/40 to-transparent flex flex-col justify-center items-center text-center p-6 z-10">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-6 animate-pulse">
              🌱 Pure Kenya Agricultural Harvest
            </span>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white mb-6 drop-shadow-2xl tracking-tight max-w-4xl leading-none">
              {heroSettings?.title || 'Direct From Mwea Paddy Fields'}
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-emerald-100 mb-10 max-w-2xl font-medium drop-shadow leading-relaxed">
              {heroSettings?.subtitle || '100% Pure Aromatic Pishori Rice harvested and delivered straight to your doorstep.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => setView('shop')} className="bg-emerald-500 text-white px-8 py-4 rounded-full font-black text-lg hover:bg-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all transform hover:scale-105 flex items-center justify-center">
                Explore Grain Catalog <ChevronRight className="ml-2 h-5 w-5"/>
              </button>
              <button onClick={() => setView('profile')} className="bg-emerald-900/80 border border-emerald-700 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-800 transition-all">
                Track Order Status
              </button>
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
                    <Package className="h-12 w-12 sm:h-20 sm:w-20 text-emerald-300 group-hover:scale-110 transition-transform duration-500"/>
                  )}
                  {p.isBlackFridayApplied && <span className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-rose-500 text-white text-[10px] sm:text-xs font-black px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-lg">SALE</span>}
                </div>
                <div className="p-3 sm:p-6 flex-1 flex flex-col">
                  <div className="text-[10px] sm:text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">{p.brandName}</div>
                  <h3 className="font-black text-sm sm:text-xl mb-1 sm:mb-2 text-gray-900 group-hover:text-emerald-700 transition-colors leading-tight">{p.variety}</h3>
                  <p className="text-gray-500 text-[10px] sm:text-xs mb-3 sm:mb-6 flex items-center font-medium">
                    <MapPin className="mr-1 text-emerald-500 hidden sm:block" size="{12}"/> Net Weight: <span className="font-bold text-gray-700 ml-1">{p.weightKg}kg Bag</span>
                  </p>
                  <div className="flex justify-between items-end mt-auto pt-2 sm:pt-4 border-t border-gray-100">
                    <div>
                      {p.isBlackFridayApplied && <span className="text-[10px] sm:text-xs text-rose-500 font-bold line-through block mb-0.5">KES {p.basePrice?.toLocaleString()}</span>}
                      <span className="text-sm sm:text-xl font-black text-emerald-900">KES {p.price?.toLocaleString()}</span>
                    </div>
                    <button onClick={() => addToCart(p)} className="bg-emerald-600 text-white p-2 sm:p-3 rounded-xl sm:rounded-2xl hover:bg-emerald-500 transition-all shadow-md hover:shadow-emerald-500/30 font-bold flex items-center text-xs sm:text-sm">
                      <Plus className="h-4 w-4 sm:h-4 sm:w-4 sm:mr-1"/> <span className="hidden sm:inline">Add</span>
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
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5"/>
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
               <div className="h-32 sm:h-48 bg-emerald-50/50 flex items-center justify-center relative overflow-hidden">
                 {p.imageUrl ? (
                   <img src={p.imageUrl} alt={p.variety} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                 ) : (
                   <Package className="h-10 w-10 sm:h-16 sm:w-16 text-emerald-300"/>
                 )}
                 {p.stockQuantity <= 0 && (
                   <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
                     <span className="bg-gray-900 text-white font-black px-4 py-1.5 rounded-full text-xs uppercase tracking-widest">Out of Stock</span>
                   </div>
                 )}
               </div>
               <div className="p-4 sm:p-5 flex-1 flex flex-col">
                 <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">{p.brandName}</div>
                 <h3 className="font-black text-sm sm:text-lg mb-1 text-gray-900 leading-tight">{p.variety}</h3>
                 <p className="text-gray-500 text-[10px] sm:text-xs mb-4 font-medium">{p.weightKg}kg Bag | Stock: <span className={p.stockQuantity < 10 ? 'text-rose-500 font-bold' : ''}>{p.stockQuantity}</span></p>
                 
                 <div className="flex justify-between items-end mt-auto">
                    <div>
                      {p.isBlackFridayApplied && <span className="text-[10px] text-rose-500 font-bold line-through block leading-none mb-1">KES {p.basePrice?.toLocaleString()}</span>}
                      <span className="text-sm sm:text-lg font-black text-emerald-950">KES {p.price?.toLocaleString()}</span>
                    </div>
                    <button 
                      onClick={() => addToCart(p)} 
                      disabled={p.stockQuantity <= 0}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-sm ${p.stockQuantity <= 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-emerald-500/30'}`}
                    >
                      <Plus className="h-4 w-4 sm:h-5 sm:w-5"/>
                    </button>
                 </div>
               </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-500 font-medium bg-emerald-50/50 rounded-3xl border border-emerald-100 border-dashed">
              <Package className="mx-auto h-12 w-12 text-emerald-200 mb-3"/>
              No rice grain varieties match your search criteria.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCart = () => (
    <div className="max-w-4xl mx-auto py-12 px-4 animate-fadeIn">
      <h1 className="text-3xl font-black mb-8 text-emerald-950 flex items-center">
        <ShoppingCart className="mr-3 text-emerald-600 h-8 w-8"/> Active Dispatch Cart
      </h1>
      
      {cart.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl shadow-sm border border-emerald-100">
          <ShoppingCart className="mx-auto h-20 w-20 text-emerald-100 mb-6"/>
          <p className="text-xl text-gray-500 font-medium">Your logistics dispatch bag is empty.</p>
          <button onClick={() => setView('shop')} className="mt-8 bg-emerald-600 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition">View Grain Catalog</button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6 bg-gray-50/50">
            {cart.map(item => (
              <div key={item.productId} className="flex items-center justify-between border-b border-gray-200 pb-6 last:border-0 last:pb-0">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-emerald-200/50">
                     {item.product.imageUrl ? <img src={item.product.imageUrl} alt="rice" className="w-full h-full object-cover" /> : <Package className="h-8 w-8 text-emerald-400"/>}
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-sm sm:text-base leading-tight">{item.product.variety}</h3>
                    <p className="text-xs sm:text-sm text-gray-500 font-medium mb-1">{item.product.brandName} • {item.product.weightKg}kg</p>
                    <p className="text-sm font-black text-emerald-700">KES {item.price?.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
                    <button onClick={() => updateCartQuantity(item.productId, -1)} className="px-2.5 py-1 sm:px-3 sm:py-1.5 text-gray-600 hover:bg-white rounded-lg hover:shadow-sm font-bold text-lg">-</button>
                    <span className="w-8 sm:w-10 text-center font-black text-gray-900 text-sm">{item.quantity}</span>
                    <button onClick={() => updateCartQuantity(item.productId, 1)} className="px-2.5 py-1 sm:px-3 sm:py-1.5 text-gray-600 hover:bg-white rounded-lg hover:shadow-sm font-bold text-lg">+</button>
                  </div>
                  <button onClick={() => {
                      setCart(prev => prev.filter(i => i.productId !== item.productId));
                      showToast('Item removed from cart');
                    }} 
                    className="p-2 sm:p-2.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                  >
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5"/>
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-white p-6 sm:p-8 border-t border-gray-100">
            <h3 className="font-black text-gray-900 mb-6 text-lg">Logistics & Delivery Configuration</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1.5 uppercase tracking-wider">County Destination</label>
                <select 
                  value={checkoutData.county} 
                  onChange={(e) => setCheckoutData({...checkoutData, county: e.target.value})}
                  className="text-black w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 font-medium text-sm shadow-sm"
                >
                  {ALL_47_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1.5 uppercase tracking-wider">Town / District</label>
                <select 
                  value={checkoutData.town} 
                  onChange={(e) => setCheckoutData({...checkoutData, town: e.target.value})}
                  className="text-black w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 font-medium text-sm shadow-sm"
                >
                  {(REGIONAL_LOGISTICS_DATA[checkoutData.county] || DEFAULT_REGIONAL_LOGISTICS).towns.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 mb-1.5 uppercase tracking-wider">Location Setup</label>
                <select 
                  value={checkoutData.location} 
                  onChange={(e) => setCheckoutData({...checkoutData, location: e.target.value})}
                  className="text-black w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 font-medium text-sm shadow-sm"
                >
                  {(REGIONAL_LOGISTICS_DATA[checkoutData.county] || DEFAULT_REGIONAL_LOGISTICS).locations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 mb-1.5 uppercase tracking-wider">Sub-Location Zone</label>
                <select 
                  value={checkoutData.sublocation} 
                  onChange={(e) => setCheckoutData({...checkoutData, sublocation: e.target.value})}
                  className="text-black w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 font-medium text-sm shadow-sm"
                >
                  {(REGIONAL_LOGISTICS_DATA[checkoutData.county] || DEFAULT_REGIONAL_LOGISTICS).sublocations.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              
              <div className="sm:col-span-2">
                <label className="block text-xs font-black text-gray-700 mb-1.5 uppercase tracking-wider">Drop-off Street / Landmark</label>
                <select 
                  value={checkoutData.shippingAddress} 
                  onChange={(e) => setCheckoutData({...checkoutData, shippingAddress: e.target.value})}
                  className="text-black w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 font-medium text-sm shadow-sm"
                >
                  {(REGIONAL_LOGISTICS_DATA[checkoutData.county] || DEFAULT_REGIONAL_LOGISTICS).streets.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-600 mb-8 border-t border-b border-gray-100 py-4">
              <div className="flex justify-between">
                <span className="font-medium">Cargo Subtotal</span>
                <span className="font-bold text-gray-900">KES {cartSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Transport / Freight Fee ({checkoutData.county})</span>
                <span>KES {activeTransportFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-black text-gray-900 pt-3 border-t border-gray-200">
                <span>Total Payable</span>
                <span className="text-emerald-700">KES {cartTotal.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="mb-8">
               <label className="block text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">M-Pesa STK Push Phone Number</label>
               <input 
                 type="text"
                 placeholder="e.g. 0712345678"
                 value={checkoutData.stkPhoneNumber}
                 onChange={(e) => setCheckoutData({...checkoutData, stkPhoneNumber: e.target.value})}
                 className="text-black w-full bg-white border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 font-bold text-sm shadow-sm"
               />
               <p className="text-[10px] text-gray-500 mt-2 font-medium">Ensure the phone is active. You will receive an instant M-Pesa prompt on this device.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
               <button onClick={clearCart} className="flex-1 px-6 py-3.5 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors shadow-sm">
                 Clear Cargo Bag
               </button>
               <button 
                 onClick={async () => {
                   if (!user) return showToast('Please authenticate to dispatch orders', 'error');
                   if (!checkoutData.stkPhoneNumber || checkoutData.stkPhoneNumber.trim() === '') return showToast('Please enter an M-Pesa phone number for STK Push', 'error');
                   setIsCheckingOut(true);
                   try {
                     const res = await fetch(`${API_BASE_URL}/orders`, {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                       body: JSON.stringify({ 
                         items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
                         county: checkoutData.county,
                         town: checkoutData.town,
                         location: checkoutData.location,
                         sublocation: checkoutData.sublocation,
                         shippingAddress: checkoutData.shippingAddress,
                         stkPhoneNumber: checkoutData.stkPhoneNumber
                       })
                     });
                     
                     if (res.ok) {
                       showToast('M-Pesa STK prompt sent to your phone. Check device.', 'success');
                       setCart([]);
                       setView('profile');
                     } else {
                       const errData = await res.json();
                       showToast(errData.error || 'Checkout failed', 'error');
                     }
                   } catch (err) {
                     showToast('Network error during checkout process', 'error');
                   } finally {
                     setIsCheckingOut(false);
                   }
                 }}
                 disabled={isCheckingOut}
                 className={`flex-[2] py-3.5 rounded-2xl font-black text-white shadow-lg transition-all flex justify-center items-center ${isCheckingOut ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/40'}`}
               >
                 {isCheckingOut ? <RefreshCw className="h-5 w-5 animate-spin"/> : `Dispatch via M-Pesa • KES ${cartTotal.toLocaleString()}`}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAuth = () => {
    // ... Auth view logic
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 animate-fadeIn">
        <div className="bg-white max-w-md w-full rounded-3xl shadow-xl overflow-hidden border border-gray-100">
           <div className="bg-emerald-950 px-8 py-10 text-center relative overflow-hidden">
             <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4">
                <Leaf className="h-24 w-24 text-emerald-900/50"/>
             </div>
             <Leaf className="h-12 w-12 text-emerald-400 mx-auto mb-4 relative z-10"/>
             <h2 className="text-3xl font-black text-white mb-1 relative z-10">{isForgotPassword ? 'Reset Access' : (isLogin ? 'Welcome Back' : 'Create Account')}</h2>
             <p className="text-emerald-200/80 text-sm font-medium relative z-10">Secure login for Mwea Hub logistics.</p>
           </div>
           
           <div className="p-8">
             <form className="space-y-5" onSubmit={async (e) => {
               e.preventDefault();
               try {
                 if (isForgotPassword) {
                   // ... handle forgot password logic
                   return;
                 }

                 const endpoint = isLogin ? '/auth/login' : '/auth/register';
                 const body = isLogin 
                   ? { identifier: formData.phoneNumber, password: formData.password }
                   : { phoneNumber: formData.phoneNumber, email: formData.email, password: formData.password, fullName: formData.fullName };

                 const res = await fetch(`${API_BASE_URL}${endpoint}`, {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify(body)
                 });

                 const data = await res.json();
                 if (res.ok) {
                   localStorage.setItem('token', data.token);
                   localStorage.setItem('user', JSON.stringify(data.user));
                   setToken(data.token);
                   setUser(data.user);
                   showToast(isLogin ? 'Login successful' : 'Account created');
                   setView('home');
                   // Account Cart loads automatically due to useEffect dependencies
                 } else {
                   showToast(data.error || 'Authentication error', 'error');
                 }
               } catch (err) {
                 showToast('Network error', 'error');
               }
             }}>
                {!isLogin && !isForgotPassword && (
                  <div>
                    <label className="block text-xs font-black text-gray-700 mb-1.5 uppercase">Full Legal Name</label>
                    <input type="text" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="text-black w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:bg-white transition-all text-sm font-medium" />
                  </div>
                )}
                
                {(!isForgotPassword || resetStep === 'request') && (
                  <div>
                    <label className="block text-xs font-black text-gray-700 mb-1.5 uppercase">Phone Number</label>
                    <input type="text" required value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} className="text-black w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:bg-white transition-all text-sm font-medium" placeholder="07XXXXXXXX" />
                  </div>
                )}
                
                {!isLogin && !isForgotPassword && (
                  <div>
                    <label className="block text-xs font-black text-gray-700 mb-1.5 uppercase">Email Address (Optional)</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="text-black w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:bg-white transition-all text-sm font-medium" />
                  </div>
                )}

                {(!isForgotPassword) && (
                  <div>
                    <label className="block text-xs font-black text-gray-700 mb-1.5 uppercase">Security Password</label>
                    <input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="text-black w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:bg-white transition-all text-sm font-medium" />
                  </div>
                )}
                
                <button type="submit" className="w-full bg-emerald-600 text-white font-black py-3.5 rounded-xl hover:bg-emerald-500 transition-all shadow-lg hover:shadow-emerald-500/30 mt-4">
                  {isForgotPassword ? (resetStep === 'request' ? 'Request Reset' : 'Update Password') : (isLogin ? 'Authenticate Access' : 'Register Account')}
                </button>
             </form>
             
             <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center space-y-3">
               {!isForgotPassword && (
                 <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-bold text-gray-600 hover:text-emerald-600 transition-colors">
                   {isLogin ? "Need a logistics account? Register here" : "Already have an account? Sign in"}
                 </button>
               )}
               {/* Forgot password toggle can be added here if implemented */}
             </div>
           </div>
        </div>
      </div>
    );
  };

  const renderProfile = () => {
    if (!user) { setView('login'); return null; }

    return (
      <div className="max-w-7xl mx-auto py-12 px-4 animate-fadeIn">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-emerald-100 text-center relative overflow-hidden">
               <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-50 rounded-full border border-emerald-100/50"></div>
               <div className="w-24 h-24 bg-emerald-100 rounded-full mx-auto flex items-center justify-center mb-4 relative z-10 border-4 border-white shadow-md">
                 <UserIcon className="h-10 w-10 text-emerald-600"/>
               </div>
               <h2 className="text-2xl font-black text-gray-900 relative z-10">{user.fullName || 'Client User'}</h2>
               <p className="text-gray-500 font-medium mb-6 relative z-10 text-sm">{user.phoneNumber}</p>
               
               <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100/50 mb-6 text-left">
                  <div className="flex items-center text-emerald-800 mb-2">
                    <Award className="h-5 w-5 mr-2"/> <span className="font-bold text-sm">Loyalty Metric</span>
                  </div>
                  <div className="text-2xl font-black text-emerald-600 mb-1">{loyaltyPoints} <span className="text-sm font-bold text-emerald-400">PTS</span></div>
                  <div className="text-[10px] text-emerald-600/70 font-medium leading-tight">Earned through accumulated grain volume purchases.</div>
               </div>

               <button onClick={handleLogout} className="w-full flex justify-center items-center text-rose-500 font-bold bg-rose-50 py-3 rounded-xl hover:bg-rose-100 transition-colors border border-rose-100">
                 <LogOut className="h-4 w-4 mr-2"/> Terminate Session
               </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-emerald-100 h-full">
              <h3 className="text-2xl font-black text-emerald-950 mb-6 flex items-center">
                <Package className="mr-3 h-6 w-6 text-emerald-500"/> Logistics Order History
              </h3>
              
              {myOrders.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                  <Activity className="mx-auto h-12 w-12 text-gray-300 mb-4"/>
                  <p className="text-gray-500 font-medium">No logistics records found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myOrders.map(order => (
                    <div key={order.id} className="border border-gray-100 rounded-2xl p-5 hover:border-emerald-200 transition-colors bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm font-black text-gray-900">#{order.id}</span>
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-bold">{new Date(order.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="text-sm text-gray-500 mb-3 line-clamp-1 max-w-md">
                          {order.items?.map((i: any) => `${i.quantity}x ${i.product?.variety || 'Unknown'}`).join(', ')}
                        </div>
                        <div className="flex gap-2">
                          <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase ${order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : (order.paymentStatus === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}`}>
                            Pay: {order.paymentStatus}
                          </span>
                          <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase ${order.status === 'completed' ? 'bg-blue-100 text-blue-700' : (order.status === 'dispatched' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700')}`}>
                            Logistics: {order.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex flex-col justify-between h-full pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 sm:border-none mt-2 sm:mt-0">
                         <span className="font-black text-emerald-700 text-lg">KES {order.grandTotal?.toLocaleString()}</span>
                         <span className="text-xs text-gray-400 font-medium mt-1">Via {order.paymentMethod}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
            <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-4 animate-bounce"/>
            <h2 className="text-rose-500 font-black text-2xl tracking-widest mb-2">403 FORBIDDEN</h2>
            <p className="text-gray-400 text-sm">You lack the administrator clearance privileges required to access this system module.</p>
          </div>
        </div>
      );
    }

    const tabsList = [
      { id: 'inventory', label: 'Inventory', icon: <Package className="w-4 h-4"/> },
      { id: 'orders', label: 'Logistics', icon: <ShoppingBag className="w-4 h-4"/> },
      { id: 'users', label: 'Accounts', icon: <Users className="w-4 h-4"/> },
      { id: 'carousel', label: 'Carousel', icon: <ImageIcon className="w-4 h-4"/> },
      { id: 'config', label: 'Sys Config', icon: <Settings className="w-4 h-4"/> },
      { id: 'logs', label: 'Audit', icon: <Activity className="w-4 h-4"/> },
      { id: 'finances', label: 'Finances', icon: <DollarSign className="w-4 h-4"/> }
    ];

    return (
      <div className="flex flex-col md:flex-row min-h-[calc(100vh-80px)] bg-[#0a0a0a] text-white font-sans animate-fadeIn">
        <aside className="w-full md:w-64 bg-[#141414] border-r border-gray-800 flex flex-col md:flex-shrink-0">
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center text-emerald-500 font-black text-lg uppercase tracking-widest">
              <Shield className="mr-2 h-5 w-5"/> Admin Core
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-1">SYSTEM TERMINAL</div>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {tabsList.map(t => (
              <button 
                key={t.id} 
                onClick={() => setAdminTab(t.id as any)} 
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${adminTab === t.id ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200'}`}
              >
                {t.icon} <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-[#0d0d0d]">
          {adminTab === 'inventory' && (
            <div className="animate-fadeIn space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center"><Package className="mr-3 text-emerald-500 h-7 w-7"/> Inventory Data Model</h2>
                <p className="text-gray-400 text-xs mt-1">Manage physical grain stock metrics.</p>
              </div>
              <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6 shadow-xl">
                 <p className="text-gray-500 text-sm">Inventory Management panel initialized.</p>
              </div>
            </div>
          )}

          {adminTab === 'finances' && (
            <div className="animate-fadeIn space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center"><DollarSign className="mr-3 text-emerald-500 h-7 w-7"/> Financial Ledger</h2>
                <p className="text-gray-400 text-xs mt-1">Analyze revenue metrics and capital flow.</p>
              </div>
              <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6 shadow-xl">
                 <p className="text-gray-500 text-sm">Financial reports generated successfully.</p>
              </div>
            </div>
          )}

          {adminTab === 'orders' && (
            <div className="animate-fadeIn space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center"><ShoppingBag className="mr-3 text-emerald-500 h-7 w-7"/> Order Logistics</h2>
                <p className="text-gray-400 text-xs mt-1">Manage incoming orders, update payment statuses, and dispatch deliveries.</p>
              </div>
              <div className="bg-[#141414] border border-gray-800 rounded-3xl overflow-hidden shadow-xl p-4">
                <input 
                  type="text" 
                  placeholder="Search Order ID or Customer Phone..." 
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="text-white w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 mb-4 outline-none focus:border-emerald-500 text-sm font-bold"
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-[#1a1a1a] text-gray-400 border-b border-gray-800 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Order ID</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Payment</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {adminOrders.filter(o => o.id?.toString().includes(orderSearchQuery) || o.phoneNumber?.includes(orderSearchQuery)).map(o => (
                        <tr key={o.id} className="hover:bg-[#1a1a1a]/40 transition-colors text-gray-300">
                          <td className="px-4 py-3 font-mono">#{o.id}</td>
                          <td className="px-4 py-3">{new Date(o.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3">{o.phoneNumber}</td>
                          <td className="px-4 py-3">{o.county}, {o.town}</td>
                          <td className="px-4 py-3 font-bold text-emerald-400">KES {o.grandTotal?.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <select 
                              value={o.paymentStatus} 
                              onChange={async (e) => {
                                try {
                                  await fetch(`${API_BASE_URL}/admin/orders/${o.id}/payment`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ paymentStatus: e.target.value })
                                  });
                                  fetchAdminOrders();
                                } catch (err) {}
                              }}
                              className="text-white bg-[#1f1f1f] border border-gray-700 rounded p-1 outline-none"
                            >
                              <option value="pending">Pending</option>
                              <option value="paid">Paid</option>
                              <option value="failed">Failed</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <select 
                              value={o.status} 
                              onChange={async (e) => {
                                try {
                                  await fetch(`${API_BASE_URL}/admin/orders/${o.id}/status`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ status: e.target.value })
                                  });
                                  fetchAdminOrders();
                                } catch (err) {}
                              }}
                              className="text-white bg-[#1f1f1f] border border-gray-700 rounded p-1 outline-none"
                            >
                              <option value="pending">Pending</option>
                              <option value="processing">Processing</option>
                              <option value="dispatched">Dispatched</option>
                              <option value="completed">Completed</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {['users', 'carousel', 'config', 'logs'].includes(adminTab) && (
            <div className="animate-fadeIn space-y-6">
              <div className="bg-[#141414] border border-gray-800 rounded-3xl p-8 shadow-xl text-center text-gray-500">
                <Settings className="mx-auto h-12 w-12 text-gray-700 mb-3"/>
                <p className="font-bold">Module under active construction</p>
                <p className="text-xs mt-1">This administrative section is currently being updated by the development team.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative font-sans">
      {toast && (
        <div className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center text-sm transition-all ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
           {toast.type === 'success' ? <CheckCircle className="mr-2 h-5 w-5"/> : <AlertCircle className="mr-2 h-5 w-5"/>}
           {toast.message}
        </div>
      )}
      
      {renderNav()}
      
      <main className="flex-grow">
        {view === 'home' && renderHome()}
        {view === 'shop' && renderShop()}
        {view === 'cart' && renderCart()}
        {view === 'login' && renderAuth()}
        {view === 'profile' && renderProfile()}
        {view === 'admin' && renderAdmin()}
      </main>
    </div>
  );
}
