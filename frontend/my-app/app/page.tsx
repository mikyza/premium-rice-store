"use client";

import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, User as UserIcon, LogIn, Menu, X, Plus, 
  Trash2, Shield, Clock, Search, Edit, Package, Activity, 
  CheckCircle, AlertCircle, Settings, Leaf, ChevronRight,
  ShoppingBag, Users, Image as ImageIcon, Video, Download,
  MapPin, Eye, RefreshCw, LogOut, Check, AlertTriangle, Smartphone, CreditCard
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
    paymentMethod: 'stk'
  });
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  // --- Auth Form States ---
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ phoneNumber: '', password: '', fullName: '' });
  
  // --- Admin Workspace States ---
  const [adminTab, setAdminTab] = useState<'inventory' | 'orders' | 'users' | 'carousel' | 'config' | 'logs'>('inventory');
  const [newProduct, setNewProduct] = useState({ brandName: '', variety: '', weightKg: '', basePrice: '', stockQuantity: '', imageUrl: '' });
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [shopSearch, setShopSearch] = useState('');

  // ==========================================
  // 3. INITIALIZATION & REAL-TIME WEBSOCKETS
  // ==========================================
  
  // Updated Hero Timer: 5 seconds for Videos, 3.5 seconds (3-4s) for Pictures
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

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }

    fetchProducts();
    fetchCarousel();
    fetchHero();
    fetchCountiesConfig();

    const newSocket = io(SOCKET_URL);
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

    return () => { newSocket.disconnect(); };
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
      if (adminTab === 'orders') fetchAdminOrders();
      if (adminTab === 'users') fetchAdminUsers();
      if (adminTab === 'logs') fetchAdminLogs();
    }
  }, [view, adminTab, token]);

  // ==========================================
  // 4. API HELPERS & DATA FETCHERS
  // ==========================================
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/products/catalog`);
      if (res.ok) setProducts(await res.json());
    } catch (err) { console.error("Failed to fetch catalog", err); }
  };

  const fetchCarousel = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/carousel`);
      if (res.ok) setCarousel(await res.json());
    } catch (err) { console.error("Failed to fetch carousel", err); }
  };

  const fetchHero = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/hero`);
      if (res.ok) setHeroSettings(await res.json());
    } catch (err) { console.error("Failed to fetch hero settings", err); }
  };

  const fetchCountiesConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/counties`);
      if (res.ok) setCountyOverrides(await res.json());
    } catch (err) { console.error("Failed to fetch county overrides", err); }
  };

  const fetchMyOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/my-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setMyOrders(await res.json());
    } catch (err) { console.error("Failed to fetch user orders", err); }
  };

  const fetchAdminOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setAdminOrders(await res.json());
    } catch (err) { showToast('Error fetching orders', 'error'); }
  };

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setAdminUsers(await res.json());
    } catch (err) { showToast('Error fetching users', 'error'); }
  };

  const fetchAdminLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setAdminLogs(await res.json());
    } catch (err) { showToast('Error fetching system logs', 'error'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
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
        showToast('Cart updated');
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      showToast('Added to bag');
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
                  <UserIcon className="h-4 w-4 mr-2 text-emerald-400" /> {user.fullName.split(' ')[0]}
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
      
      if (checkoutData.paymentMethod === 'stk') {
        showToast(`📲 STK Push initiated to ${user.phoneNumber || 'registered mobile'}! Please enter your M-Pesa PIN when prompted.`, 'success');
      }

      setIsCheckingOut(true);
      try {
        const payload = {
          cartItems: cart.map(item => ({ productId: item.productId, quantity: item.quantity })),
          paymentMethod: checkoutData.paymentMethod,
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
          showToast('🌾 Order placed successfully! Direct logistics dispatched.', 'success');
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
        <h1 className="text-3xl sm:text-4xl font-black text-emerald-950 mb-8 flex items-center">
          <ShoppingBag className="mr-3 h-9 w-9 text-emerald-600" /> Shopping Bag & Checkout
        </h1>
        
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
                  <div className="bg-emerald-950 text-white p-4 rounded-2xl border border-emerald-800 text-center animate-fadeIn shadow-inner">
                    <span className="text-[10px] text-emerald-400 uppercase font-black tracking-widest block mb-1">MWEA HUB MERCHANDISE PAYBILL</span>
                    <div className="text-2xl font-mono font-black tracking-wider text-emerald-300">PAYBILL: 889900</div>
                    <span className="text-xs text-gray-300 font-medium block mt-1">Account Number: <strong className="text-white">MWEA-DIRECT</strong></span>
                  </div>
                )}

                {checkoutData.paymentMethod === 'stk' && (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 flex items-center gap-3 text-emerald-900 text-xs font-bold animate-fadeIn">
                    <Smartphone className="h-6 w-6 text-emerald-600 shrink-0" />
                    <span>Click confirm below & an STK Push prompt will instantly pop up on your registered mobile number ({user?.phoneNumber || 'Registered Phone'}).</span>
                  </div>
                )}
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
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black text-base flex justify-center items-center shadow-lg hover:shadow-emerald-500/30 transition-all transform hover:-translate-y-0.5"
                >
                  {isCheckingOut ? <Activity className="animate-spin mr-2 h-5 w-5" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                  Confirm Order & Pay KES {cartTotal.toLocaleString()}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAuth = () => {
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
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
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
            <h2 className="text-2xl sm:text-3xl font-black text-emerald-950">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="text-gray-500 mt-1 text-sm font-medium">{isLogin ? 'Sign in to track orders and manage deliveries.' : 'Register to order wholesale Mwea grains.'}</p>
          </div>
          
          <form className="space-y-4" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Full Name</label>
                <input required type="text" placeholder="Full Name" onChange={(e) => setFormData({...formData, fullName: e.target.value})} className="text-black bg-white w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 outline-none placeholder-gray-400" />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Phone Number</label>
              <input required type="tel" placeholder="0712345678" onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})} className="text-black bg-white w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 outline-none placeholder-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Password</label>
              <input required type="password" placeholder="••••••••" onChange={(e) => setFormData({...formData, password: e.target.value})} className="text-black bg-white w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 outline-none placeholder-gray-400" />
            </div>
            
            <button type="submit" className="w-full py-4 px-4 rounded-xl shadow-lg font-black text-white bg-emerald-600 hover:bg-emerald-500 transition-all transform hover:-translate-y-0.5 mt-6">
              {isLogin ? 'Sign In' : 'Register Account'}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <button onClick={() => setIsLogin(!isLogin)} className="text-emerald-700 hover:text-emerald-500 font-bold text-xs uppercase tracking-wider transition-colors">
              {isLogin ? "Need an account? Register Here" : "Already registered? Sign In"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderProfile = () => (
    <div className="max-w-5xl mx-auto py-12 px-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-md border border-emerald-100 p-6 sm:p-8 mb-10 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5 text-center sm:text-left">
          <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center shrink-0 border-2 border-emerald-200">
             <UserIcon className="h-10 w-10 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-emerald-950">{user?.fullName}</h1>
            <p className="text-gray-500 font-medium text-sm flex items-center justify-center sm:justify-start mt-0.5">
              <Shield className="h-4 w-4 mr-1 text-emerald-600" /> Account Role: <span className="uppercase font-bold text-emerald-700 ml-1">{user?.role}</span> • Phone: {user?.phoneNumber}
            </p>
          </div>
        </div>
        <button onClick={fetchMyOrders} className="flex items-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh Orders
        </button>
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
                <div key={o.id} className="border border-gray-200 rounded-2xl p-5 hover:border-emerald-300 transition-all bg-gray-50/50">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-200/80 pb-4 mb-4">
                    <div>
                      <span className="font-mono font-black text-emerald-950 text-base">ORDER #{o.id}</span>
                      <span className="text-xs text-gray-400 font-medium block sm:inline sm:ml-3">{new Date(o.createdAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                        o.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        o.status === 'dispatched' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                        o.status === 'processing' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        'bg-gray-200 text-gray-700'
                      }`}>
                        ● {o.status}
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
                        <span>{item.quantity}x {item.name}</span>
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
      { id: 'inventory', icon: <Package size={18}/>, label: 'Grain Catalog' },
      { id: 'orders', icon: <ShoppingBag size={18}/>, label: 'Logistics & Orders' },
      { id: 'users', icon: <Users size={18}/>, label: 'User Clearance' },
      { id: 'carousel', icon: <ImageIcon size={18}/>, label: 'Hero Config' },
      { id: 'config', icon: <Settings size={18}/>, label: 'Counties & Engine' },
      { id: 'logs', icon: <Activity size={18}/>, label: 'Audit Logs' }
    ];

    return (
      <div className="flex flex-col md:flex-row min-h-[calc(100vh-80px)] bg-[#0a0a0a] text-white font-sans animate-fadeIn">
        <aside className="w-full md:w-64 bg-[#111] border-b md:border-b-0 md:border-r border-gray-800/80 flex flex-col shrink-0">
          <div className="p-5 border-b border-gray-800/60 hidden md:block">
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

          <nav className="p-3 md:p-4 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible shrink-0">
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
                        stockQuantity: Number(newProduct.stockQuantity)
                      })
                    });
                    if (res.ok) {
                      showToast('New grain product initialized in database!', 'success');
                      setNewProduct({ brandName: '', variety: '', weightKg: '', basePrice: '', stockQuantity: '', imageUrl: '' });
                      fetchProducts();
                    }
                  } catch (err) { showToast('Error initializing product', 'error'); }
                }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input required type="text" placeholder="Brand (e.g. Mwea Pishori)" value={newProduct.brandName} onChange={e=>setNewProduct({...newProduct, brandName:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs outline-none focus:border-emerald-500 placeholder-gray-500" />
                  <input required type="text" placeholder="Variety (e.g. Grade 1 Aromatic)" value={newProduct.variety} onChange={e=>setNewProduct({...newProduct, variety:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs outline-none focus:border-emerald-500 placeholder-gray-500" />
                  <input required type="number" placeholder="Weight (Kg)" value={newProduct.weightKg} onChange={e=>setNewProduct({...newProduct, weightKg:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs outline-none focus:border-emerald-500 placeholder-gray-500" />
                  <input required type="number" placeholder="Base Price (KES)" value={newProduct.basePrice} onChange={e=>setNewProduct({...newProduct, basePrice:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs outline-none focus:border-emerald-500 placeholder-gray-500" />
                  <input required type="number" placeholder="Stock Quantity (Bags)" value={newProduct.stockQuantity} onChange={e=>setNewProduct({...newProduct, stockQuantity:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs outline-none focus:border-emerald-500 placeholder-gray-500" />
                  <input type="text" placeholder="Image URL (http://...)" value={newProduct.imageUrl} onChange={e=>setNewProduct({...newProduct, imageUrl:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs outline-none focus:border-emerald-500 font-mono placeholder-gray-500" />
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
                    <input type="text" value={editingProduct.brandName} onChange={e=>setEditingProduct({...editingProduct, brandName:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs" />
                    <input type="text" value={editingProduct.variety} onChange={e=>setEditingProduct({...editingProduct, variety:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs" />
                    <input type="number" value={editingProduct.basePrice} onChange={e=>setEditingProduct({...editingProduct, basePrice:Number(e.target.value), price:Number(e.target.value)})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs font-mono" />
                    <input type="number" value={editingProduct.stockQuantity} onChange={e=>setEditingProduct({...editingProduct, stockQuantity:Number(e.target.value)})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs font-mono" />
                    <input type="text" placeholder="Image URL" value={editingProduct.imageUrl || ''} onChange={e=>setEditingProduct({...editingProduct, imageUrl:e.target.value})} className="bg-white border border-gray-300 text-black font-bold px-4 py-3 rounded-xl text-xs font-mono md:col-span-2" />
                  </div>
                  <button onClick={async () => {
                    await fetch(`${API_BASE_URL}/admin/products/${editingProduct.id}`, {
                      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify(editingProduct)
                    });
                    showToast('Product specifications modified', 'success');
                    setEditingProduct(null);
                    fetchProducts();
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
                        <th className="px-6 py-4">Price (KES)</th>
                        <th className="px-6 py-4">Stock Matrix</th>
                        <th className="px-6 py-4 text-center">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {products.map(p => (
                        <tr key={p.id} className="hover:bg-[#1a1a1a]/40 transition-colors">
                          <td className="px-6 py-4 font-mono text-gray-500">#{p.id}</td>
                          <td className="px-6 py-4 font-bold text-gray-200">{p.brandName} - <span className="text-gray-400 font-normal">{p.variety} ({p.weightKg}kg)</span></td>
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
                                await fetch(`${API_BASE_URL}/admin/products/${p.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                                showToast('Product wiped from database', 'success');
                                fetchProducts();
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-6">
                <div>
                  <h2 className="text-2xl font-black text-white">Logistics & Dispatch Control</h2>
                  <p className="text-gray-400 text-xs mt-1">Review live dispatches across all 47 counties and update delivery milestones.</p>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button 
                    onClick={() => {
                      window.open(`${API_BASE_URL}/admin/orders/export/csv?token=${token}`, '_blank');
                    }}
                    className="flex items-center bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </button>
                  <div className="relative flex-1 sm:w-64">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search Order ID, County..." 
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="w-full bg-white text-black font-bold rounded-xl pl-9 pr-4 py-2 text-xs focus:border-emerald-500 outline-none placeholder-gray-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {adminOrders.filter(o => !orderSearchQuery || o.id?.toString().includes(orderSearchQuery) || o.county?.toLowerCase().includes(orderSearchQuery.toLowerCase())).map(order => (
                  <div key={order.id} className="border border-gray-800 rounded-3xl p-6 bg-[#141414] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono font-black text-white text-base">ORDER #{order.id}</span>
                        <span className="bg-gray-800 text-gray-300 text-[10px] font-black px-2.5 py-1 rounded-md uppercase">{order.paymentMethod}</span>
                      </div>
                      <div className="text-xs text-gray-400 font-medium">{order.User?.fullName} • <span className="text-gray-200">{order.User?.phoneNumber}</span></div>
                      
                      <div className="text-xs text-emerald-400 mt-3 bg-emerald-950/40 border border-emerald-500/20 p-4 rounded-xl font-medium">
                        <div className="font-bold text-white mb-2 flex items-center">📍 Detailed Delivery Info:</div>
                        <ul className="space-y-1 list-disc pl-4 text-emerald-300/80">
                          <li><strong className="text-emerald-300">County:</strong> {order.county || 'N/A'}</li>
                          <li><strong className="text-emerald-300">Town/District:</strong> {order.town || 'N/A'}</li>
                          <li><strong className="text-emerald-300">Location:</strong> {order.location || 'N/A'}</li>
                          <li><strong className="text-emerald-300">Sublocation:</strong> {order.sublocation || 'N/A'}</li>
                          <li><strong className="text-emerald-300">Address/Landmark:</strong> {order.shippingAddress?.details || order.shippingAddress || 'N/A'}</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-gray-800">
                      <div className="text-right">
                        <span className="text-[10px] text-gray-500 uppercase block font-bold">Grand Total</span>
                        <span className="font-mono font-black text-lg text-emerald-400">KES {order.grandTotal?.toLocaleString()}</span>
                      </div>
                      
                      <select 
                        value={order.status} 
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          await fetch(`${API_BASE_URL}/admin/orders/${order.id}/status`, {
                            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ status: newStatus })
                          });
                          showToast(`Order #${order.id} updated to ${newStatus}`, 'success');
                          fetchAdminOrders();
                        }}
                        className="bg-white text-black border-2 border-gray-300 rounded-xl px-4 py-2.5 text-xs outline-none font-black cursor-pointer"
                      >
                        <option value="pending">🟡 Pending</option>
                        <option value="processing">🟠 Processing</option>
                        <option value="dispatched">🔵 Dispatched</option>
                        <option value="completed">🟢 Completed</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminTab === 'users' && (
            <div className="animate-fadeIn space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white">Operator Registry & Role Clearance</h2>
                <p className="text-gray-400 text-xs mt-1">Review registered identities, promote staff to administrators, or revoke account access entirely.</p>
              </div>
              
              <div className="bg-[#141414] border border-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl">
                <div className="space-y-4">
                  {adminUsers.map(u => (
                    <div key={u.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#1a1a1a] rounded-2xl border border-gray-800/80">
                      <div>
                        <div className="font-bold text-gray-200">{u.fullName} {u.id === user?.id && "(You)"}</div>
                        <div className="text-xs font-mono text-gray-500 mt-1">{u.phoneNumber || 'N/A'}</div>
                      </div>
                      
                      <div className="flex items-center gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-800">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${u.role === 'admin' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-gray-800 text-gray-300'}`}>
                          {u.role}
                        </span>
                        
                        {u.id !== user?.id && (
                          <div className="flex gap-2 ml-auto sm:ml-0">
                            <button onClick={async () => {
                              const newRole = u.role === 'admin' ? 'user' : 'admin';
                              await fetch(`${API_BASE_URL}/admin/users/${u.id}/modify`, {
                                method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({ role: newRole })
                              });
                              showToast(`Updated ${u.fullName} clearance to ${newRole}`, 'success');
                              fetchAdminUsers();
                            }} className="text-xs bg-[#242424] hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-xl font-bold transition-all">
                              Toggle Role
                            </button>
                            <button onClick={async () => {
                              if (confirm(`Are you sure you want to permanently delete user ${u.fullName}?`)) {
                                await fetch(`${API_BASE_URL}/admin/users/${u.id}`, {
                                  method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
                                });
                                showToast(`User ${u.fullName} deleted securely`, 'success');
                                fetchAdminUsers();
                              }
                            }} className="text-xs bg-rose-950/40 hover:bg-rose-900 text-rose-400 border border-rose-900/50 px-3 py-1.5 rounded-xl font-bold transition-all flex items-center">
                              <Trash2 size={12} className="mr-1"/> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {adminTab === 'carousel' && (
            <div className="animate-fadeIn space-y-6 max-w-4xl">
              <div>
                <h2 className="text-2xl font-black text-white">Hero Storefront & Dynamic Media Cycle</h2>
                <p className="text-gray-400 text-xs mt-1">Configure exactly 2 videos and 3 pictures that will loop on the homepage (Videos cycle for 5 seconds, Pictures cycle for 3-4 seconds).</p>
              </div>

              <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6">
                <h3 className="font-bold text-sm text-emerald-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Video size={18}/> Home Media Array Configuration
                </h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] text-gray-500 uppercase font-bold block mb-1">Headline Text</label>
                      <input type="text" value={heroSettings.title} onChange={e => setHeroSettings({...heroSettings, title: e.target.value})} className="w-full bg-white text-black font-bold border border-gray-300 rounded-xl px-4 py-3 text-xs outline-none focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500 uppercase font-bold block mb-1">Subtitle Text</label>
                      <input type="text" value={heroSettings.subtitle} onChange={e => setHeroSettings({...heroSettings, subtitle: e.target.value})} className="w-full bg-white text-black font-bold border border-gray-300 rounded-xl px-4 py-3 text-xs outline-none focus:border-emerald-500" />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-800">
                    <h4 className="text-xs text-emerald-400 font-bold mb-3 uppercase tracking-wider">Video Assets (Max 2 - Displays for 5s each)</h4>
                    <div className="space-y-3">
                      <input type="text" placeholder="YouTube Embed URL 1" value={heroSettings.video1} onChange={e => setHeroSettings({...heroSettings, video1: e.target.value})} className="w-full bg-white text-black font-mono border border-gray-300 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-emerald-500" />
                      <input type="text" placeholder="YouTube Embed URL 2" value={heroSettings.video2} onChange={e => setHeroSettings({...heroSettings, video2: e.target.value})} className="w-full bg-white text-black font-mono border border-gray-300 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-emerald-500" />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-800">
                    <h4 className="text-xs text-emerald-400 font-bold mb-3 uppercase tracking-wider">Image Assets (Max 3 - Displays for 3-4s each)</h4>
                    <div className="space-y-3">
                      <input type="text" placeholder="Image URL 1" value={heroSettings.img1} onChange={e => setHeroSettings({...heroSettings, img1: e.target.value})} className="w-full bg-white text-black font-mono border border-gray-300 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-emerald-500" />
                      <input type="text" placeholder="Image URL 2" value={heroSettings.img2} onChange={e => setHeroSettings({...heroSettings, img2: e.target.value})} className="w-full bg-white text-black font-mono border border-gray-300 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-emerald-500" />
                      <input type="text" placeholder="Image URL 3" value={heroSettings.img3} onChange={e => setHeroSettings({...heroSettings, img3: e.target.value})} className="w-full bg-white text-black font-mono border border-gray-300 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-emerald-500" />
                    </div>
                  </div>

                  <button onClick={async () => {
                    await fetch(`${API_BASE_URL}/admin/config/hero`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify(heroSettings)
                    });
                    showToast('Hero media array committed and synced!', 'success');
                  }} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-xl font-bold text-sm shadow-lg">
                    Deploy Carousel Configuration
                  </button>
                </div>
              </div>
            </div>
          )}

          {adminTab === 'config' && (
            <div className="animate-fadeIn space-y-6 max-w-5xl">
              <div>
                <h2 className="text-2xl font-black text-white">Logistics & Promotional Engine</h2>
                <p className="text-gray-400 text-xs mt-1">Control Flash Sale timers and assign custom delivery rates across all 47 counties.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6">
                  <h3 className="font-bold text-sm text-rose-400 uppercase tracking-wider mb-4">🔥 Flash Harvest Sale Engine</h3>
                  <p className="text-xs text-gray-400 mb-6">Instantly trigger sitewide discounted pricing via real-time websockets.</p>
                  {flashSale.active ? (
                    <button onClick={async () => {
                      await fetch(`${API_BASE_URL}/admin/config/black-friday`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ active: false }) });
                      showToast('Flash Sale terminated manually', 'success');
                    }} className="w-full bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 py-3.5 rounded-2xl text-xs font-black">
                      Terminate Flash Sale
                    </button>
                  ) : (
                    <button onClick={async () => {
                      await fetch(`${API_BASE_URL}/admin/config/black-friday`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ active: true, durationHours: 24 }) });
                      showToast('24H Flash Sale Launched!', 'success');
                    }} className="w-full bg-rose-600 hover:bg-rose-500 text-white py-3.5 rounded-2xl text-xs font-black shadow-lg shadow-rose-950/50">
                      Deploy 24-Hour Flash Sale Event
                    </button>
                  )}
                </div>

                <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6">
                  <h3 className="font-bold text-sm text-emerald-400 uppercase tracking-wider mb-4">🚚 Default Transport Rate</h3>
                  <p className="text-xs text-gray-400 mb-4">Base shipping fee for counties without custom overrides.</p>
                  <div className="flex gap-3">
                    <input type="number" value={baseTransportFee} onChange={e => setBaseTransportFee(Number(e.target.value))} className="w-full bg-white text-black border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono font-bold" />
                    <button onClick={async () => {
                      await fetch(`${API_BASE_URL}/admin/config/transport`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ amount: baseTransportFee }) });
                      showToast('Default transport fee saved', 'success');
                    }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 rounded-xl font-bold text-xs shrink-0">Commit Rate</button>
                  </div>
                </div>
              </div>

              <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6">
                <h3 className="font-bold text-sm text-white uppercase tracking-wider mb-1">Kenya 47 Counties Regional Overrides Matrix</h3>
                <p className="text-xs text-gray-400 mb-6">Assign specific transport shipping rates for each county in Kenya.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-2">
                  {ALL_47_COUNTIES.map(c => (
                    <div key={c} className="flex justify-between items-center bg-[#1c1c1c] p-3 rounded-2xl border border-gray-800/80">
                      <span className="text-xs text-gray-300 font-bold">{c}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500 font-mono">KES</span>
                        <input 
                          type="number" 
                          value={countyOverrides[c] !== undefined ? countyOverrides[c] : baseTransportFee} 
                          onChange={e => {
                            const val = Number(e.target.value);
                            setCountyOverrides({...countyOverrides, [c]: val});
                          }}
                          onBlur={async (e) => {
                            const val = Number(e.target.value);
                            await fetch(`${API_BASE_URL}/admin/config/counties`, {
                              method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                              body: JSON.stringify({ county: c, fee: val })
                            });
                            showToast(`Updated ${c} delivery rate to KES ${val}`, 'success');
                          }}
                          className="w-16 bg-white text-black border border-gray-400 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {adminTab === 'logs' && (
            <div className="animate-fadeIn space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white">System Logs & Audit Trail</h2>
                <p className="text-gray-400 text-xs mt-1">Real-time database writes, administrative actions, and security events.</p>
              </div>
              
              <div className="bg-[#141414] border border-gray-800 rounded-3xl p-6 font-mono text-xs space-y-2.5 max-h-[600px] overflow-y-auto">
                {adminLogs.length === 0 ? (
                  <div className="text-gray-500 py-6 text-center">No audit logs recorded in system ledger yet.</div>
                ) : adminLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 text-gray-300 bg-[#1a1a1a] p-3.5 rounded-xl border border-gray-800/60">
                    <span className="text-emerald-500 font-bold">[{log.action}]</span>
                    <span className="text-gray-400">{new Date(log.createdAt).toLocaleTimeString()}</span>
                    <span className="text-gray-200 flex-1">Admin {log.Admin?.fullName || `#${log.adminId}`} modified {log.targetType} #{log.targetId}</span>
                    <span className="text-gray-500 text-[10px]">{log.ipAddress}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col selection:bg-emerald-200 selection:text-emerald-900">
      {toast && (
        <div className={`fixed top-24 right-4 sm:right-8 z-50 px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm flex items-center transform transition-all duration-300 animate-fadeIn ${toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.type === 'error' ? <AlertCircle className="mr-3 h-5 w-5 shrink-0" /> : <CheckCircle className="mr-3 h-5 w-5 shrink-0" />}
          {toast.message}
        </div>
      )}

      {renderNav()}

      <main className="flex-1">
        {view === 'home' && renderHome()}
        {view === 'shop' && renderShop()}
        {view === 'cart' && renderCart()}
        {view === 'login' && renderAuth()}
        {view === 'admin' && renderAdmin()}
        {view === 'profile' && renderProfile()}
      </main>

      <footer className="bg-emerald-950 text-emerald-100 py-12 border-t border-emerald-900 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Leaf className="h-6 w-6 text-emerald-400" />
            <span className="font-black text-xl tracking-tight text-white">MWEA HUB</span>
          </div>
          <p className="text-xs text-emerald-300 max-w-md mx-auto leading-relaxed">
            Premium Agricultural Grain E-Commerce Infrastructure. Direct logistics across all 47 Counties in Kenya. Powered by relational database backends and real-time websockets.
          </p>
          <div className="mt-8 pt-6 border-t border-emerald-900/80 text-[11px] text-emerald-500 font-mono">
            © {new Date().getFullYear()} MWEA HUB / RICEDIRECT • ALL RIGHTS RESERVED
          </div>
        </div>
      </footer>
    </div>
  );
}
