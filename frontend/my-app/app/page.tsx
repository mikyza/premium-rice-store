"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  ShoppingCart, User as UserIcon, LogIn, Menu, X, Plus, 
  Trash2, Shield, Clock, Search, Edit, Package, Activity, 
  CheckCircle, AlertCircle, Settings, Leaf, ChevronRight,
  ShoppingBag, Users, Image as ImageIcon, Video, Download,
  MapPin, Eye, RefreshCw, LogOut, Check, AlertTriangle, Smartphone, CreditCard,
  BarChart2, DollarSign, Award, Calendar, Lock, Unlock, TrendingUp, Filter, FileText, Percent, Layers, Globe, Sliders, Bell
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// ==========================================
// 1. SYSTEM CONFIGURATION & CONSTANTS
// ==========================================
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL 
  ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api` 
  : 'https://premium-rice-store-7.onrender.com/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL 
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') 
  : 'https://premium-rice-store-7.onrender.com';

// ==========================================
// 2. TYPES & INTERFACES
// ==========================================
interface RiceProduct {
  id: number;
  brandName: string;
  variety: string;
  weightKg: number;
  basePrice: number;
  price?: number;
  buyingPrice?: number;
  flashSalePrice?: number | null;
  stockQuantity: number;
  imageUrl?: string | null;
  isAvailable: boolean;
  isBlackFridayApplied?: boolean;
}

interface CartItem {
  id?: number;
  productId: number;
  quantity: number;
  product: RiceProduct;
}

interface PaymentDetails {
  method?: string;
  isPaid?: boolean;
  paidTag?: string;
  mpesaNumber?: string;
  amount?: number;
  paidAt?: string | null;
  mpesaReceipt?: string | null;
  failureReason?: string | null;
}

interface OrderItem {
  productId: number;
  name: string;
  variety?: string;
  brandName?: string;
  weightKg?: number;
  quantity: number;
  priceAtPurchase: number;
  buyingPrice?: number;
  imageUrl?: string | null;
}

interface Order {
  id: number;
  userId: number;
  items: OrderItem[];
  transportFee: number;
  subTotal: number;
  grandTotal: number;
  totalWeightKg?: number;
  pointsEarned?: number;
  paymentDetails?: PaymentDetails;
  isPaid?: boolean; // Legacy flat fallback
  paymentStatus?: string; // Legacy flat fallback
  mpesaReceipt?: string; // Legacy flat fallback
  county?: string;
  town?: string;
  location?: string;
  sublocation?: string;
  shippingAddress?: any;
  status: string; // 'pending', 'paid', 'delivered', 'payment_failed', 'cancelled'
  createdAt: string;
  User?: {
    id: number;
    fullName: string;
    phoneNumber: string;
    email: string;
  };
}

interface UserProfile {
  id: number;
  fullName: string;
  phoneNumber?: string;
  email?: string;
  role: 'user' | 'admin';
  rewardPoints?: number;
  isActive?: boolean;
}

interface HeroSettings {
  type: 'video' | 'image';
  url: string;
  title: string;
  subtitle: string;
  badgeText: string;
  buttonText: string;
  buttonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  overlayOpacity: number;
  alignment: 'left' | 'center' | 'right';
  autoPlay: boolean;
  videoDuration: number;
  imageDuration: number;
}

// ==========================================
// 3. PAYMENT STRUCTURE HELPER UTILITIES
// ==========================================
const isOrderPaid = (order: Order | null | undefined): boolean => {
  if (!order) return false;
  if (order.paymentDetails && typeof order.paymentDetails.isPaid === 'boolean') {
    return order.paymentDetails.isPaid;
  }
  if (order.paymentDetails?.paidTag === 'PAID') return true;
  if (order.isPaid === true) return true;
  if (order.status === 'paid' || order.status === 'completed' || order.status === 'delivered') return true;
  return false;
};

const getOrderPaidTag = (order: Order | null | undefined): string => {
  if (!order) return 'PENDING';
  if (order.paymentDetails?.paidTag) return order.paymentDetails.paidTag;
  if (isOrderPaid(order)) return 'PAID';
  if (order.status === 'payment_failed') return 'FAILED';
  if (order.paymentStatus) return order.paymentStatus.toUpperCase();
  return 'PENDING';
};

const getMpesaReceipt = (order: Order | null | undefined): string => {
  if (!order) return 'N/A';
  return order.paymentDetails?.mpesaReceipt || order.mpesaReceipt || 'N/A';
};

const getFailureReason = (order: Order | null | undefined): string | null => {
  if (!order) return null;
  return order.paymentDetails?.failureReason || null;
};

// ==========================================
// 4. MAIN COMPONENT
// ==========================================
export default function MweaRiceStoreFront() {
  // --- Auth & Profile State ---
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  
  // Auth Form Fields
  const [authFullName, setAuthFullName] = useState('');
  const [authIdentifier, setAuthIdentifier] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNewPassword, setAuthNewPassword] = useState('');
  const [authOtp, setAuthOtp] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Profile Edit State
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileCurrentPass, setProfileCurrentPass] = useState('');
  const [profileNewPass, setProfileNewPass] = useState('');
  const [profileMsg, setProfileMsg] = useState('');

  // --- Views & Layout State ---
  const [activeTab, setActiveTab] = useState<'catalog' | 'orders' | 'profile' | 'admin'>('catalog');
  const [adminTab, setAdminTab] = useState<'catalog' | 'orders' | 'finances' | 'settings' | 'users' | 'logs'>('orders');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- Data State ---
  const [products, setProducts] = useState<RiceProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetailsModalOpen, setOrderDetailsModalOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  // --- Search & Filters ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVariety, setSelectedVariety] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(10000);

  // --- Checkout State ---
  const [checkoutCounty, setCheckoutCounty] = useState('Kirinyaga');
  const [checkoutTown, setCheckoutTown] = useState('');
  const [checkoutLocation, setCheckoutLocation] = useState('');
  const [checkoutSublocation, setCheckoutSublocation] = useState('');
  const [checkoutStreet, setCheckoutStreet] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa_stk' | 'paybill' | 'till'>('mpesa_stk');
  const [countyShippingRates, setCountyShippingRates] = useState<Record<string, number>>({});
  const [logisticsHierarchy, setLogisticsHierarchy] = useState<any>({});
  const [mpesaConfig, setMpesaConfig] = useState({ paybillNumber: '522522', paybillAccount: 'MWEARICE', tillNumber: '889900', stkEnabled: true });

  // --- STK & Polling State ---
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [stkStatusMessage, setStkStatusMessage] = useState('');
  const [activePollingOrderId, setActivePollingOrderId] = useState<number | null>(null);
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- System Config & Flash Sale ---
  const [heroSettings, setHeroSettings] = useState<HeroSettings | null>(null);
  const [flashSale, setFlashSale] = useState<{ active: boolean; endTime: string | null; msRemaining?: number }>({ active: false, endTime: null });
  const [rewardPoints, setRewardPoints] = useState<number>(0);

  // --- Admin State ---
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [adminCategoryFilter, setAdminCategoryFilter] = useState<'all' | 'pending_shipping' | 'completed'>('all');
  const [adminSearch, setAdminSearch] = useState('');
  const [financialData, setFinancialData] = useState<any>(null);
  
  // Product Edit Modal
  const [editingProduct, setEditingProduct] = useState<RiceProduct | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [prodBrand, setProdBrand] = useState('');
  const [prodVariety, setProdVariety] = useState('');
  const [prodWeight, setProdWeight] = useState(5);
  const [prodPrice, setProdPrice] = useState(1200);
  const [prodBuyingPrice, setProdBuyingPrice] = useState(900);
  const [prodFlashPrice, setProdFlashPrice] = useState<number | ''>('');
  const [prodStock, setProdStock] = useState(50);
  const [prodImage, setProdImage] = useState('');

  // Socket reference
  const socketRef = useRef<Socket | null>(null);

  // ==========================================
  // 5. API UTILITY WRAPPERS
  // ==========================================
  const fetchWithAuth = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Request failed with status ${res.status}`);
    }
    return res.json();
  }, [token]);

  // ==========================================
  // 6. PAYMENT STATUS POLLING ENGINE
  // ==========================================
  const checkPaymentStatus = useCallback(async (orderId: number, silent = false) => {
    try {
      if (!silent) setIsPollingPayment(true);
      const data = await fetchWithAuth(`/payments/payhero/status/${orderId}`);
      
      // Update order state locally
      setOrders(prev => prev.map(o => o.id === orderId ? {
        ...o,
        status: data.status,
        paymentDetails: data.paymentDetails || o.paymentDetails
      } : o));

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? {
          ...prev,
          status: data.status,
          paymentDetails: data.paymentDetails || prev.paymentDetails
        } : null);
      }

      if (user?.role === 'admin') {
        setAdminOrders(prev => prev.map(o => o.id === orderId ? {
          ...o,
          status: data.status,
          paymentDetails: data.paymentDetails || o.paymentDetails
        } : o));
      }

      const isPaid = data.paymentDetails?.isPaid || data.paymentStatus === 'PAID';
      if (isPaid || data.status === 'payment_failed' || data.paymentStatus === 'FAILED') {
        stopPaymentPolling();
        if (isPaid) {
          setStkStatusMessage('🎉 Payment confirmed! Your order is now being processed.');
          fetchUserCart();
          fetchUserPoints();
        } else {
          setStkStatusMessage(`❌ Payment failed: ${data.paymentDetails?.failureReason || 'Transaction cancelled or failed.'}`);
        }
      }

      return data;
    } catch (err: any) {
      console.warn(`Payment status poll check error for order #${orderId}:`, err.message);
    } finally {
      if (!silent) setIsPollingPayment(false);
    }
  }, [fetchWithAuth, selectedOrder, user]);

  const startPaymentPolling = useCallback((orderId: number) => {
    stopPaymentPolling();
    setActivePollingOrderId(orderId);
    setIsPollingPayment(true);

    // Initial check
    checkPaymentStatus(orderId, true);

    // Poll every 3 seconds for up to 2 minutes
    let attempts = 0;
    pollingIntervalRef.current = setInterval(async () => {
      attempts += 1;
      if (attempts > 40) { // 2 minutes timeout
        stopPaymentPolling();
        setStkStatusMessage('⌛ Payment verification timed out. If you completed payment, check order status later.');
        return;
      }
      await checkPaymentStatus(orderId, true);
    }, 3000);
  }, [checkPaymentStatus]);

  const stopPaymentPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPollingPayment(false);
    setActivePollingOrderId(null);
  }, []);

  // ==========================================
  // 7. REAL-TIME SOCKET INITIALIZATION
  // ==========================================
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⚡ Connected to socket server:', socket.id);
      if (token && user?.role === 'admin') {
        socket.emit('joinAdminChannel', token);
      }
    });

    socket.on('orderStatusUpdated', (updatedOrder: Order) => {
      console.log('🔔 Socket Event: orderStatusUpdated', updatedOrder);
      
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
      
      if (selectedOrder && selectedOrder.id === updatedOrder.id) {
        setSelectedOrder(prev => prev ? { ...prev, ...updatedOrder } : null);
      }

      if (user?.role === 'admin') {
        setAdminOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
      }

      // If active polling order was updated to paid, stop polling
      if (isOrderPaid(updatedOrder) && activePollingOrderId === updatedOrder.id) {
        stopPaymentPolling();
        setStkStatusMessage('🎉 Real-time payment verification received!');
      }
    });

    socket.on('paymentReceived', (data: any) => {
      console.log('🔔 Socket Event: paymentReceived', data);
      if (data.orderId) {
        setOrders(prev => prev.map(o => o.id === data.orderId ? {
          ...o,
          status: data.status || o.status,
          paymentDetails: data.paymentDetails || {
            ...o.paymentDetails,
            isPaid: data.isPaid,
            paidTag: data.isPaid ? 'PAID' : 'FAILED',
            mpesaReceipt: data.mpesaReceipt
          }
        } : o));

        if (activePollingOrderId === data.orderId && data.isPaid) {
          stopPaymentPolling();
          setStkStatusMessage('🎉 Payment confirmed via Webhook callback!');
        }
      }
    });

    socket.on('blackFridayTick', (data: any) => {
      setFlashSale(data);
    });

    socket.on('blackFridayStarted', (data: any) => {
      setFlashSale(data);
    });

    socket.on('blackFridayEnded', () => {
      setFlashSale({ active: false, endTime: null });
    });

    return () => {
      stopPaymentPolling();
      socket.disconnect();
    };
  }, [token, user, activePollingOrderId, stopPaymentPolling, selectedOrder]);

  // ==========================================
  // 8. DATA FETCHING EFFECTS
  // ==========================================
  // Restore JWT token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('mwea_auth_token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Fetch Public Initial Data
  useEffect(() => {
    fetchCatalog();
    fetchHeroSettings();
    fetchCountyRates();
    fetchLogistics();
    fetchMpesaConfig();
  }, []);

  // Fetch Authenticated User Data
  useEffect(() => {
    if (token) {
      fetchUserProfile();
      fetchUserOrders();
      fetchUserCart();
      fetchUserPoints();
    } else {
      setUser(null);
      setOrders([]);
      setCart([]);
      setRewardPoints(0);
    }
  }, [token]);

  // Admin Data Fetching
  useEffect(() => {
    if (token && user?.role === 'admin' && activeTab === 'admin') {
      fetchAdminOrders();
      fetchAdminUsers();
      fetchAdminLogs();
      fetchFinancials();
    }
  }, [token, user, activeTab, adminTab, adminCategoryFilter]);

  const fetchCatalog = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/products/catalog`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Failed to fetch product catalog:', err);
    }
  };

  const fetchHeroSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/hero`);
      if (res.ok) {
        const data = await res.json();
        setHeroSettings(data);
      }
    } catch (err) {
      console.error('Failed to fetch hero settings:', err);
    }
  };

  const fetchCountyRates = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/counties`);
      if (res.ok) {
        const data = await res.json();
        setCountyShippingRates(data);
      }
    } catch (err) {
      console.error('Failed to fetch county rates:', err);
    }
  };

  const fetchLogistics = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/locations`);
      if (res.ok) {
        const data = await res.json();
        setLogisticsHierarchy(data);
      }
    } catch (err) {
      console.error('Failed to fetch logistics hierarchy:', err);
    }
  };

  const fetchMpesaConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config/payment-methods`);
      if (res.ok) {
        const data = await res.json();
        setMpesaConfig(data);
      }
    } catch (err) {
      console.error('Failed to fetch M-Pesa config:', err);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const data = await fetchWithAuth('/user/profile');
      setUser(data);
      setProfileName(data.fullName || '');
      setProfileEmail(data.email || '');
      setProfilePhone(data.phoneNumber || '');
      if (data.phoneNumber) setCheckoutPhone(data.phoneNumber);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      handleLogout();
    }
  };

  const fetchUserOrders = async () => {
    try {
      const data = await fetchWithAuth('/orders/my-orders');
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch user orders:', err);
    }
  };

  const fetchUserCart = async () => {
    try {
      const data = await fetchWithAuth('/cart');
      if (data && data.items) {
        setCart(data.items);
      }
    } catch (err) {
      console.error('Failed to fetch user cart:', err);
    }
  };

  const fetchUserPoints = async () => {
    try {
      const data = await fetchWithAuth('/user/points');
      setRewardPoints(data.rewardPoints || 0);
    } catch (err) {
      console.error('Failed to fetch reward points:', err);
    }
  };

  const fetchAdminOrders = async () => {
    try {
      let endpoint = `/admin/orders`;
      if (adminCategoryFilter !== 'all') {
        endpoint += `?category=${adminCategoryFilter}`;
      }
      const data = await fetchWithAuth(endpoint);
      setAdminOrders(data);
    } catch (err) {
      console.error('Failed to fetch admin orders:', err);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const data = await fetchWithAuth('/admin/users');
      setAdminUsers(data);
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
    }
  };

  const fetchAdminLogs = async () => {
    try {
      const data = await fetchWithAuth('/admin/logs');
      setAdminLogs(data);
    } catch (err) {
      console.error('Failed to fetch admin logs:', err);
    }
  };

  const fetchFinancials = async () => {
    try {
      const data = await fetchWithAuth('/admin/analytics/finances');
      setFinancialData(data);
    } catch (err) {
      console.error('Failed to fetch financial analytics:', err);
    }
  };

  // ==========================================
  // 9. AUTHENTICATION & HANDLERS
  // ==========================================
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        const res = await fetch(`${API_BASE_URL}/user/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: authIdentifier, password: authPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        
        localStorage.setItem('mwea_auth_token', data.token);
        setToken(data.token);
        setUser(data.user);
        setAuthModalOpen(false);
        setAuthPassword('');
      } else if (authMode === 'signup') {
        const res = await fetch(`${API_BASE_URL}/user/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: authFullName,
            phoneNumber: authIdentifier.includes('@') ? '' : authIdentifier,
            email: authIdentifier.includes('@') ? authIdentifier : '',
            password: authPassword
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Signup failed');

        localStorage.setItem('mwea_auth_token', data.token);
        setToken(data.token);
        setUser(data.user);
        setAuthModalOpen(false);
        setAuthPassword('');
      } else if (authMode === 'forgot') {
        const res = await fetch(`${API_BASE_URL}/user/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authIdentifier })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to dispatch OTP');
        
        setAuthSuccessMsg(data.message || 'OTP dispatched to your email address');
        setAuthMode('reset');
      } else if (authMode === 'reset') {
        const res = await fetch(`${API_BASE_URL}/user/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authIdentifier,
            otp: authOtp,
            newPassword: authNewPassword
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Password reset failed');

        setAuthSuccessMsg('Password reset successful! You can now log in.');
        setAuthMode('login');
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('mwea_auth_token');
    setToken(null);
    setUser(null);
    setCart([]);
    setOrders([]);
    setActiveTab('catalog');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    try {
      const data = await fetchWithAuth('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: profileName,
          email: profileEmail,
          phoneNumber: profilePhone,
          currentPassword: profileCurrentPass || undefined,
          newPassword: profileNewPass || undefined
        })
      });
      setUser(data.user);
      setProfileMsg('✅ Profile updated successfully!');
      setProfileCurrentPass('');
      setProfileNewPass('');
    } catch (err: any) {
      setProfileMsg(`❌ ${err.message}`);
    }
  };

  // ==========================================
  // 10. CART & CHECKOUT ACTIONS
  // ==========================================
  const addToCart = async (product: RiceProduct, qty = 1) => {
    if (!token) {
      setAuthModalOpen(true);
      return;
    }
    try {
      await fetchWithAuth('/cart/add', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, quantity: qty })
      });
      fetchUserCart();
      setCartDrawerOpen(true);
    } catch (err: any) {
      alert(`Could not add to cart: ${err.message}`);
    }
  };

  const updateCartQuantity = async (cartItemId: number, quantity: number) => {
    try {
      await fetchWithAuth(`/cart/item/${cartItemId}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity })
      });
      fetchUserCart();
    } catch (err: any) {
      console.error('Update cart item error:', err);
    }
  };

  const removeCartItem = async (cartItemId: number) => {
    try {
      await fetchWithAuth(`/cart/item/${cartItemId}`, {
        method: 'DELETE'
      });
      fetchUserCart();
    } catch (err: any) {
      console.error('Delete cart item error:', err);
    }
  };

  const calculatedShippingFee = useMemo(() => {
    if (countyShippingRates && countyShippingRates[checkoutCounty] !== undefined) {
      return countyShippingRates[checkoutCounty];
    }
    return 250;
  }, [countyShippingRates, checkoutCounty]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const p = item.product;
      const effectivePrice = flashSale.active && p.flashSalePrice ? p.flashSalePrice : (p.basePrice || p.price || 0);
      return sum + (effectivePrice * item.quantity);
    }, 0);
  }, [cart, flashSale]);

  const cartTotalWeightKg = useMemo(() => {
    return cart.reduce((sum, item) => sum + ((item.product.weightKg || 0) * item.quantity), 0);
  }, [cart]);

  const cartGrandTotal = cartSubtotal + calculatedShippingFee;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPhone) {
      alert('Please provide an M-Pesa phone number for payment.');
      return;
    }
    setIsSubmittingOrder(true);
    setStkStatusMessage('Initiating order and sending M-Pesa STK push prompt...');

    try {
      const payload = {
        cartItems: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
        paymentMethod,
        mpesaPhoneNumber: checkoutPhone,
        county: checkoutCounty,
        town: checkoutTown,
        location: checkoutLocation,
        sublocation: checkoutSublocation,
        streetAddress: checkoutStreet,
        shippingFee: calculatedShippingFee,
        grandTotal: cartGrandTotal
      };

      const createdOrder: Order = await fetchWithAuth('/orders/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setOrders(prev => [createdOrder, ...prev]);
      setCheckoutModalOpen(false);
      setSelectedOrder(createdOrder);
      setOrderDetailsModalOpen(true);

      if (paymentMethod === 'mpesa_stk') {
        startPaymentPolling(createdOrder.id);
      } else {
        setStkStatusMessage('Order created! Please complete payment using the Paybill/Till info.');
      }

      fetchUserCart();
    } catch (err: any) {
      alert(`Order placement failed: ${err.message}`);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // ==========================================
  // 11. CATALOG FILTER COMPUTATION
  // ==========================================
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.brandName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.variety.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesVariety = selectedVariety ? p.variety === selectedVariety : true;
      const currentPrice = flashSale.active && p.flashSalePrice ? p.flashSalePrice : (p.basePrice || p.price || 0);
      const matchesPrice = currentPrice <= maxPriceFilter;
      return matchesSearch && matchesVariety && matchesPrice;
    });
  }, [products, searchQuery, selectedVariety, maxPriceFilter, flashSale]);

  const availableVarieties = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => p.variety && set.add(p.variety));
    return Array.from(set);
  }, [products]);

  // ==========================================
  // 12. ADMIN ACTIONS
  // ==========================================
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        brandName: prodBrand,
        variety: prodVariety,
        weightKg: Number(prodWeight),
        basePrice: Number(prodPrice),
        buyingPrice: Number(prodBuyingPrice),
        flashSalePrice: prodFlashPrice === '' ? null : Number(prodFlashPrice),
        stockQuantity: Number(prodStock),
        imageUrl: prodImage || null,
        isAvailable: true
      };

      if (editingProduct) {
        await fetchWithAuth(`/admin/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await fetchWithAuth('/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setProductModalOpen(false);
      fetchCatalog();
    } catch (err: any) {
      alert(`Product save failed: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this catalog item?')) return;
    try {
      await fetchWithAuth(`/admin/products/${id}`, { method: 'DELETE' });
      fetchCatalog();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      await fetchWithAuth(`/admin/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      fetchAdminOrders();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleManualPaymentOverride = async (orderId: number, isPaid: boolean) => {
    try {
      await fetchWithAuth(`/admin/orders/${orderId}/payment-status`, {
        method: 'PUT',
        body: JSON.stringify({
          isPaid,
          paidTag: isPaid ? 'PAID' : 'PENDING'
        })
      });
      fetchAdminOrders();
    } catch (err: any) {
      alert(`Payment override failed: ${err.message}`);
    }
  };

  // ==========================================
  // 13. RENDER SUB-VIEWS
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* --- TOP BANNER (FLASH SALE TICKER) --- */}
      {flashSale.active && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white px-4 py-2.5 text-center text-sm font-semibold flex items-center justify-center gap-3 shadow-md animate-pulse">
          <Activity className="w-5 h-5" />
          <span>🔥 FLASH HARVEST SALE IS LIVE! Huge Discounts on All Aromatic Rice Sacks!</span>
          <span className="bg-white/20 px-3 py-0.5 rounded-full text-xs font-mono">
            {flashSale.msRemaining ? `${Math.floor(flashSale.msRemaining / 60000)}m ${Math.floor((flashSale.msRemaining % 60000) / 1000)}s remaining` : 'Limited Time'}
          </span>
        </div>
      )}

      {/* --- HEADER NAVBAR --- */}
      <header className="sticky top-0 z-40 bg-emerald-900 text-white shadow-lg border-b border-emerald-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('catalog')}>
            <div className="w-12 h-12 bg-amber-400 rounded-2xl flex items-center justify-center text-emerald-950 font-black text-2xl shadow-inner">
              🌾
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white leading-tight">MWEA RICE HUB</h1>
              <p className="text-xs text-emerald-200 font-medium">100% Pure Pishori & Basmati Direct From Paddy Fields</p>
            </div>
          </div>

          {/* Desktop Nav Actions */}
          <div className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => setActiveTab('catalog')} 
              className={`text-sm font-semibold transition-colors ${activeTab === 'catalog' ? 'text-amber-400' : 'text-emerald-100 hover:text-white'}`}
            >
              Storefront Catalog
            </button>

            {token && (
              <button 
                onClick={() => setActiveTab('orders')} 
                className={`text-sm font-semibold transition-colors flex items-center gap-1.5 ${activeTab === 'orders' ? 'text-amber-400' : 'text-emerald-100 hover:text-white'}`}
              >
                <Package className="w-4 h-4" /> My Orders ({orders.length})
              </button>
            )}

            {token && user?.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('admin')} 
                className={`text-sm font-semibold transition-colors px-3 py-1.5 rounded-lg bg-amber-500 text-emerald-950 flex items-center gap-1.5 ${activeTab === 'admin' ? 'bg-amber-400 font-bold' : 'hover:bg-amber-400'}`}
              >
                <Shield className="w-4 h-4" /> Admin Console
              </button>
            )}

            {/* Cart Trigger */}
            <button 
              onClick={() => setCartDrawerOpen(true)}
              className="relative p-2.5 bg-emerald-800 hover:bg-emerald-700 rounded-xl transition-all flex items-center gap-2 border border-emerald-700"
            >
              <ShoppingCart className="w-5 h-5 text-amber-300" />
              <span className="text-xs font-bold bg-amber-400 text-emerald-950 px-2 py-0.5 rounded-full">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </button>

            {/* User Profile / Auth */}
            {token && user ? (
              <div className="flex items-center gap-3 bg-emerald-950/60 pl-3 pr-2 py-1.5 rounded-xl border border-emerald-800">
                <div className="text-right">
                  <div className="text-xs font-bold text-white">{user.fullName}</div>
                  <div className="text-[10px] text-amber-300 font-medium">{rewardPoints} Reward Points</div>
                </div>
                <button 
                  onClick={() => setEditProfileOpen(true)}
                  className="p-1.5 hover:bg-emerald-800 rounded-lg text-emerald-200"
                  title="Manage Profile"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-1.5 hover:bg-red-800/80 rounded-lg text-red-300"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}
                className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" /> Login / Sign Up
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-3">
            <button 
              onClick={() => setCartDrawerOpen(true)}
              className="relative p-2 bg-emerald-800 rounded-lg text-amber-300"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-amber-400 text-emerald-950 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </button>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-white">
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-emerald-950 border-b border-emerald-800 px-4 py-4 space-y-3">
            <button 
              onClick={() => { setActiveTab('catalog'); setIsMobileMenuOpen(false); }}
              className="w-full text-left font-semibold py-2 text-emerald-100 border-b border-emerald-900"
            >
              Catalog
            </button>
            {token && (
              <button 
                onClick={() => { setActiveTab('orders'); setIsMobileMenuOpen(false); }}
                className="w-full text-left font-semibold py-2 text-emerald-100 border-b border-emerald-900"
              >
                My Orders ({orders.length})
              </button>
            )}
            {token && user?.role === 'admin' && (
              <button 
                onClick={() => { setActiveTab('admin'); setIsMobileMenuOpen(false); }}
                className="w-full text-left font-semibold py-2 text-amber-400 border-b border-emerald-900"
              >
                Admin Console
              </button>
            )}
            {token ? (
              <div className="pt-2 flex items-center justify-between">
                <span className="text-sm text-white font-medium">{user?.fullName}</span>
                <button onClick={handleLogout} className="text-xs bg-red-800 text-white px-3 py-1 rounded">Logout</button>
              </div>
            ) : (
              <button 
                onClick={() => { setAuthMode('login'); setAuthModalOpen(true); setIsMobileMenuOpen(false); }}
                className="w-full bg-amber-400 text-emerald-950 font-bold py-2 rounded.xl text-center"
              >
                Login / Register
              </button>
            )}
          </div>
        )}
      </header>

      {/* --- HERO SECTION --- */}
      {activeTab === 'catalog' && (
        <section className="relative bg-emerald-950 text-white overflow-hidden py-16 px-4 sm:px-6 lg:px-8 border-b border-emerald-800">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-900/90 to-transparent z-10" />
          {heroSettings?.type === 'image' && heroSettings.url && (
            <img src={heroSettings.url} alt="Mwea Paddy" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          )}
          <div className="relative z-20 max-w-5xl mx-auto text-center space-y-6">
            <span className="inline-block bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest">
              {heroSettings?.badgeText || '🌾 Direct From Mwea Paddy Fields'}
            </span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
              {heroSettings?.title || '100% Authentic Aromatic Mwea Rice'}
            </h2>
            <p className="text-emerald-100 text-lg sm:text-xl max-w-2xl mx-auto font-normal">
              {heroSettings?.subtitle || 'Order farm-fresh Pishori and Basmati in 5kg, 10kg, 25kg, and 50kg sacks with direct doorstep M-Pesa delivery across Kenya.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <a href="#catalog-grid" className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-extrabold px-8 py-3.5 rounded-2xl shadow-xl transition-all">
                {heroSettings?.buttonText || 'Shop Fresh Harvest'}
              </a>
            </div>
          </div>
        </section>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* ========================================== */}
        {/* VIEW 1: CATALOG STOREFRONT                 */}
        {/* ========================================== */}
        {activeTab === 'catalog' && (
          <div id="catalog-grid" className="space-y-8">
            {/* Filter & Search Bar */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search by rice brand or variety (e.g., Pishori, Basmati)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <select 
                  value={selectedVariety} 
                  onChange={e => setSelectedVariety(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="">All Varieties</option>
                  {availableVarieties.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>

                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl">
                  <span className="text-xs font-bold text-slate-500">Max KES:</span>
                  <input 
                    type="range" 
                    min={500} 
                    max={10000} 
                    step={250} 
                    value={maxPriceFilter}
                    onChange={e => setMaxPriceFilter(Number(e.target.value))}
                    className="w-24 accent-emerald-600"
                  />
                  <span className="text-xs font-bold text-emerald-900">KES {maxPriceFilter}</span>
                </div>
              </div>
            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map(product => {
                const effectivePrice = flashSale.active && product.flashSalePrice ? product.flashSalePrice : (product.basePrice || product.price || 0);
                const isDiscounted = flashSale.active && product.flashSalePrice && product.flashSalePrice < product.basePrice;

                return (
                  <div key={product.id} className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group">
                    <div className="relative h-56 bg-slate-100 overflow-hidden">
                      {product.imageUrl ? (
                        <img 
                          src={product.imageUrl} 
                          alt={product.brandName} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl bg-emerald-50 text-emerald-700">🌾</div>
                      )}
                      
                      <div className="absolute top-3 left-3 bg-emerald-950/80 backdrop-blur-md text-amber-300 text-xs font-bold px-3 py-1 rounded-full">
                        {product.weightKg} KG Sack
                      </div>

                      {isDiscounted && (
                        <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-black px-2.5 py-1 rounded-full animate-bounce">
                          SALE
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">{product.variety}</div>
                        <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-emerald-800 transition-colors">{product.brandName}</h3>
                        <p className="text-xs text-slate-500 mt-1">Stock Available: {product.stockQuantity} sacks</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          {isDiscounted && (
                            <div className="text-xs text-slate-400 line-through">KES {product.basePrice}</div>
                          )}
                          <div className="text-xl font-black text-emerald-900">
                            KES {effectivePrice.toLocaleString()}
                          </div>
                        </div>

                        <button 
                          onClick={() => addToCart(product, 1)}
                          className="bg-emerald-800 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" /> Add
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* VIEW 2: MY ORDERS LIST & DETAILS          */}
        {/* ========================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">My Order History</h2>
                <p className="text-xs text-slate-500">Track M-Pesa payments, real-time dispatch, and receipt numbers.</p>
              </div>
              <button onClick={fetchUserOrders} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-700 text-xs font-bold flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 space-y-4">
                <Package className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-lg font-bold text-slate-700">No Orders Found</h3>
                <p className="text-sm text-slate-500">You haven't placed any orders yet. Browse our catalog to buy farm-fresh rice.</p>
                <button onClick={() => setActiveTab('catalog')} className="bg-emerald-800 text-white font-bold px-6 py-2.5 rounded-xl text-sm">
                  Go To Storefront
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(order => {
                  const isPaid = isOrderPaid(order);
                  const paidTag = getOrderPaidTag(order);
                  const receipt = getMpesaReceipt(order);
                  const failureReason = getFailureReason(order);

                  return (
                    <div key={order.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-xs font-bold text-slate-400">ORDER NUMBER</span>
                          <h4 className="text-base font-extrabold text-slate-900">#ORD-{order.id}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black px-3 py-1 rounded-full uppercase ${
                            isPaid ? 'bg-emerald-100 text-emerald-800' : 
                            paidTag === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            PAYMENT: {paidTag}
                          </span>
                          <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full uppercase">
                            STATUS: {order.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
                        <div>
                          <span className="font-bold text-slate-400 block">TOTAL AMOUNT</span>
                          <span className="text-base font-extrabold text-emerald-900">KES {order.grandTotal?.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-400 block">M-PESA RECEIPT</span>
                          <span className="font-mono font-bold text-slate-800">{receipt}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-400 block">DATE PLACED</span>
                          <span>{new Date(order.createdAt).toLocaleString()}</span>
                        </div>
                      </div>

                      {failureReason && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                          <span>Failure Reason: {failureReason}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-3 pt-2">
                        {!isPaid && (
                          <button 
                            onClick={() => startPaymentPolling(order.id)}
                            disabled={isPollingPayment && activePollingOrderId === order.id}
                            className="bg-amber-500 hover:bg-amber-400 text-emerald-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isPollingPayment && activePollingOrderId === order.id ? 'animate-spin' : ''}`} />
                            Check Payment Status
                          </button>
                        )}
                        <button 
                          onClick={() => { setSelectedOrder(order); setOrderDetailsModalOpen(true); }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* VIEW 3: ADMINISTRATIVE CONSOLE             */}
        {/* ========================================== */}
        {activeTab === 'admin' && user?.role === 'admin' && (
          <div className="space-y-6">
            {/* Admin Header Tabs */}
            <div className="bg-emerald-950 text-white p-4 rounded-3xl flex flex-wrap items-center gap-3 shadow-md">
              <button 
                onClick={() => setAdminTab('orders')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${adminTab === 'orders' ? 'bg-amber-400 text-emerald-950' : 'bg-emerald-900 text-emerald-200'}`}
              >
                <Package className="w-4 h-4" /> Order & Shipping Management
              </button>
              <button 
                onClick={() => setAdminTab('catalog')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${adminTab === 'catalog' ? 'bg-amber-400 text-emerald-950' : 'bg-emerald-900 text-emerald-200'}`}
              >
                <ShoppingBag className="w-4 h-4" /> Products Catalog
              </button>
              <button 
                onClick={() => setAdminTab('finances')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${adminTab === 'finances' ? 'bg-amber-400 text-emerald-950' : 'bg-emerald-900 text-emerald-200'}`}
              >
                <BarChart2 className="w-4 h-4" /> Financial Profit Analytics
              </button>
            </div>

            {/* Admin Tab: Orders Management */}
            {adminTab === 'orders' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Live Orders Dashboard</h3>
                    <p className="text-xs text-slate-500">Filter between pending shipping and completed deliveries.</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <select 
                      value={adminCategoryFilter}
                      onChange={e => setAdminCategoryFilter(e.target.value as any)}
                      className="bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold"
                    >
                      <option value="all">All Transactions</option>
                      <option value="pending_shipping">Paid & Awaiting Dispatch</option>
                      <option value="completed">Delivered Sacks</option>
                    </select>

                    <a 
                      href={`${API_BASE_URL}/admin/orders/export/csv?token=${token}`}
                      target="_blank" 
                      rel="noreferrer"
                      className="bg-emerald-800 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" /> Export CSV
                    </a>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase">
                      <tr>
                        <th className="p-3">Order ID</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Payment Tag</th>
                        <th className="p-3">Receipt</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminOrders.map(ord => {
                        const isPaid = isOrderPaid(ord);
                        const paidTag = getOrderPaidTag(ord);
                        const receipt = getMpesaReceipt(ord);

                        return (
                          <tr key={ord.id} className="hover:bg-slate-50">
                            <td className="p-3 font-mono font-bold">#ORD-{ord.id}</td>
                            <td className="p-3 font-semibold text-slate-900">
                              {ord.User?.fullName || 'Customer'}<br />
                              <span className="text-[10px] text-slate-400">{ord.User?.phoneNumber}</span>
                            </td>
                            <td className="p-3 font-extrabold text-emerald-900">KES {ord.grandTotal?.toLocaleString()}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {paidTag}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-[11px] font-bold">{receipt}</td>
                            <td className="p-3 font-bold uppercase">{ord.status}</td>
                            <td className="p-3 flex items-center gap-2">
                              <select 
                                value={ord.status}
                                onChange={e => handleUpdateOrderStatus(ord.id, e.target.value)}
                                className="bg-slate-100 border border-slate-300 rounded px-2 py-1 text-[11px]"
                              >
                                <option value="pending">pending</option>
                                <option value="dispatched">dispatched</option>
                                <option value="delivered">delivered</option>
                                <option value="cancelled">cancelled</option>
                              </select>
                              <button 
                                onClick={() => handleManualPaymentOverride(ord.id, !isPaid)}
                                className="p-1 bg-slate-200 hover:bg-slate-300 rounded text-[10px] font-bold"
                                title="Toggle Payment Status"
                              >
                                {isPaid ? 'Unmark Paid' : 'Mark Paid'}
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

            {/* Admin Tab: Catalog Product CRUD */}
            {adminTab === 'catalog' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Product Inventory Catalog</h3>
                    <p className="text-xs text-slate-500">Manage base prices, buying prices, flash sale rates, and images.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingProduct(null);
                      setProdBrand('');
                      setProdVariety('Aromatic Pishori');
                      setProdWeight(5);
                      setProdPrice(1200);
                      setProdBuyingPrice(900);
                      setProdFlashPrice('');
                      setProdStock(50);
                      setProdImage('');
                      setProductModalOpen(true);
                    }}
                    className="bg-amber-400 text-emerald-950 px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Rice Product
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map(p => (
                    <div key={p.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-emerald-700">{p.variety}</span>
                        <h4 className="font-extrabold text-sm text-slate-900">{p.brandName} ({p.weightKg}kg)</h4>
                        <div className="text-xs font-bold text-slate-600 mt-1">
                          Selling: KES {p.basePrice} | Buying: KES {p.buyingPrice || 'N/A'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setEditingProduct(p);
                            setProdBrand(p.brandName);
                            setProdVariety(p.variety);
                            setProdWeight(p.weightKg);
                            setProdPrice(p.basePrice);
                            setProdBuyingPrice(p.buyingPrice || p.basePrice * 0.75);
                            setProdFlashPrice(p.flashSalePrice || '');
                            setProdStock(p.stockQuantity);
                            setProdImage(p.imageUrl || '');
                            setProductModalOpen(true);
                          }}
                          className="p-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-2 bg-red-100 hover:bg-red-200 rounded-lg text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Tab: Financial Profit Analytics */}
            {adminTab === 'finances' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6">
                <h3 className="text-xl font-black text-slate-900">Real Received Revenue & Net Profit Analytics</h3>
                
                {financialData?.summary && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <span className="text-xs font-bold text-emerald-700 uppercase">Received Revenue</span>
                      <div className="text-2xl font-black text-emerald-950 mt-1">KES {financialData.summary.totalMoneyReceived?.toLocaleString()}</div>
                    </div>
                    <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
                      <span className="text-xs font-bold text-amber-700 uppercase">Buying Expenses</span>
                      <div className="text-2xl font-black text-amber-950 mt-1">KES {financialData.summary.totalBuyingCost?.toLocaleString()}</div>
                    </div>
                    <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                      <span className="text-xs font-bold text-blue-700 uppercase">Net Profit Margin</span>
                      <div className="text-2xl font-black text-blue-950 mt-1">KES {financialData.summary.totalNetProfit?.toLocaleString()}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================== */}
      {/* MODAL 1: AUTHENTICATION (LOGIN / SIGNUP)    */}
      {/* ========================================== */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 space-y-6 shadow-2xl relative border border-slate-200">
            <button onClick={() => setAuthModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <h3 className="text-2xl font-black text-slate-900">
                {authMode === 'login' ? 'Welcome Back' : authMode === 'signup' ? 'Create Customer Account' : 'Password Recovery'}
              </h3>
              <p className="text-xs text-slate-500">Access your Mwea Rice Hub orders & reward points.</p>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                {authError}
              </div>
            )}

            {authSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
                {authSuccessMsg}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={authFullName}
                    onChange={e => setAuthFullName(e.target.value)}
                    placeholder="e.g. Jane Wambui"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Phone Number or Email</label>
                <input 
                  type="text" 
                  required 
                  value={authIdentifier}
                  onChange={e => setAuthIdentifier(e.target.value)}
                  placeholder="0712345678 or user@gmail.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                />
              </div>

              {(authMode === 'login' || authMode === 'signup') && (
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Password</label>
                  <input 
                    type="password" 
                    required 
                    value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                  />
                </div>
              )}

              {authMode === 'reset' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">6-Digit OTP Code</label>
                    <input 
                      type="text" 
                      required 
                      value={authOtp}
                      onChange={e => setAuthOtp(e.target.value)}
                      placeholder="123456"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">New Password</label>
                    <input 
                      type="password" 
                      required 
                      value={authNewPassword}
                      onChange={e => setAuthNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                </>
              )}

              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-md text-sm"
              >
                {authLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : authMode === 'forgot' ? 'Send OTP' : 'Reset Password'}
              </button>
            </form>

            <div className="text-center pt-2 text-xs text-slate-500">
              {authMode === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button onClick={() => { setAuthMode('signup'); setAuthError(''); }} className="text-emerald-700 font-bold underline">
                    Sign Up
                  </button>{' '}
                  |{' '}
                  <button onClick={() => { setAuthMode('forgot'); setAuthError(''); }} className="text-slate-600 font-medium underline">
                    Forgot Password?
                  </button>
                </p>
              ) : (
                <p>
                  Already registered?{' '}
                  <button onClick={() => { setAuthMode('login'); setAuthError(''); }} className="text-emerald-700 font-bold underline">
                    Log In
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: USER CART DRAWER / MODAL          */}
      {/* ========================================== */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-md h-full p-6 flex flex-col justify-between shadow-2xl space-y-6">
            <div className="space-y-4 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-800" /> Your Shopping Cart
                </h3>
                <button onClick={() => setCartDrawerOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="text-slate-500 text-sm font-medium">Your cart is currently empty.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => {
                    const p = item.product;
                    const effectivePrice = flashSale.active && p.flashSalePrice ? p.flashSalePrice : (p.basePrice || p.price || 0);

                    return (
                      <div key={item.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-200 rounded-xl overflow-hidden flex-shrink-0">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.brandName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg">🌾</div>
                          )}
                        </div>

                        <div className="flex-1">
                          <h4 className="font-bold text-xs text-slate-900">{p.brandName} ({p.weightKg}kg)</h4>
                          <span className="text-xs text-emerald-900 font-black">KES {effectivePrice.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => updateCartQuantity(item.id!, item.quantity - 1)}
                            className="w-6 h-6 bg-slate-200 hover:bg-slate-300 rounded-md font-bold text-xs"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold">{item.quantity}</span>
                          <button 
                            onClick={() => updateCartQuantity(item.id!, item.quantity + 1)}
                            className="w-6 h-6 bg-slate-200 hover:bg-slate-300 rounded-md font-bold text-xs"
                          >
                            +
                          </button>
                          <button 
                            onClick={() => removeCartItem(item.id!)}
                            className="text-red-500 p-1 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-slate-200 pt-4 space-y-4">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal ({cartTotalWeightKg} kg):</span>
                    <span className="font-bold text-slate-900">KES {cartSubtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-xs">
                    <span>Est. Reward Points Earned:</span>
                    <span className="font-bold text-amber-600">+{ (cartTotalWeightKg * 0.2).toFixed(1) } pts</span>
                  </div>
                </div>

                <button 
                  onClick={() => { setCartDrawerOpen(false); setCheckoutModalOpen(true); }}
                  className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl transition-all shadow-md text-sm"
                >
                  Proceed To M-Pesa Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 3: CHECKOUT & STK TRIGGER           */}
      {/* ========================================== */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 space-y-6 shadow-2xl relative border border-slate-200 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setCheckoutModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-xl font-black text-slate-900">M-Pesa Shipping Checkout</h3>
              <p className="text-xs text-slate-500">Provide county delivery details and M-Pesa handset number.</p>
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Delivery County</label>
                <select 
                  value={checkoutCounty} 
                  onChange={e => setCheckoutCounty(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                >
                  {Object.keys(countyShippingRates).length > 0 ? (
                    Object.keys(countyShippingRates).map(c => <option key={c} value={c}>{c}</option>)
                  ) : (
                    <option value="Kirinyaga">Kirinyaga</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Town</label>
                  <input 
                    type="text" 
                    required 
                    value={checkoutTown}
                    onChange={e => setCheckoutTown(e.target.value)}
                    placeholder="e.g. Kerugoya / Mwea"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Street / Landmark</label>
                  <input 
                    type="text" 
                    required 
                    value={checkoutStreet}
                    onChange={e => setCheckoutStreet(e.target.value)}
                    placeholder="e.g. Hospital Road"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">M-Pesa Phone Number (For STK Prompt)</label>
                <input 
                  type="text" 
                  required 
                  value={checkoutPhone}
                  onChange={e => setCheckoutPhone(e.target.value)}
                  placeholder="0712345678"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Rice Subtotal:</span>
                  <span className="font-bold">KES {cartSubtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transport Charge ({checkoutCounty}):</span>
                  <span className="font-bold">KES {calculatedShippingFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-emerald-950 border-t border-slate-200 pt-2">
                  <span>Grand Total:</span>
                  <span>KES {cartGrandTotal.toLocaleString()}</span>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmittingOrder}
                className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl transition-all shadow-md text-sm flex items-center justify-center gap-2"
              >
                {isSubmittingOrder ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4 text-amber-300" />}
                {isSubmittingOrder ? 'Triggering STK Push...' : `Pay KES ${cartGrandTotal.toLocaleString()} via M-Pesa`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 4: ORDER DETAILS & PAYMENT POLLING    */}
      {/* ========================================== */}
      {orderDetailsModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-3xl p-6 space-y-6 shadow-2xl relative border border-slate-200 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setOrderDetailsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-200 pb-4">
              <span className="text-xs font-bold text-slate-400 uppercase">INSPECTING ORDER</span>
              <h3 className="text-2xl font-black text-slate-900">#ORD-{selectedOrder.id}</h3>
            </div>

            {/* Live Payment Status Banner */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              isOrderPaid(selectedOrder) ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div>
                <span className="text-xs font-bold uppercase block">M-PESA PAYMENT STATE</span>
                <span className="text-base font-black">
                  TAG: {getOrderPaidTag(selectedOrder)} | RECEIPT: {getMpesaReceipt(selectedOrder)}
                </span>
              </div>
              {!isOrderPaid(selectedOrder) && (
                <button 
                  onClick={() => startPaymentPolling(selectedOrder.id)}
                  disabled={isPollingPayment}
                  className="bg-amber-500 hover:bg-amber-400 text-emerald-950 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPollingPayment ? 'animate-spin' : ''}`} /> Verify
                </button>
              )}
            </div>

            {stkStatusMessage && (
              <div className="p-3 bg-slate-100 rounded-xl text-xs font-medium text-slate-700">
                {stkStatusMessage}
              </div>
            )}

            {/* Items List */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase text-slate-500">Ordered Rice Sacks</h4>
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{item.name}</span>
                    <span className="text-slate-500 block">Quantity: {item.quantity} sack(s)</span>
                  </div>
                  <span className="font-extrabold text-slate-900">KES {(item.priceAtPurchase * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-4 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Shipping Fee:</span>
                <span className="font-bold">KES {selectedOrder.transportFee?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1">
                <span>Grand Total:</span>
                <span>KES {selectedOrder.grandTotal?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 5: ADMIN PRODUCT EDIT MODAL          */}
      {/* ========================================== */}
      {productModalOpen && user?.role === 'admin' && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 space-y-4 shadow-2xl relative border border-slate-200">
            <button onClick={() => setProductModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-slate-900">
              {editingProduct ? 'Edit Catalog Product' : 'Add New Rice Product'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Brand Name</label>
                <input type="text" required value={prodBrand} onChange={e => setProdBrand(e.target.value)} className="w-full p-2 border rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">Variety</label>
                  <input type="text" required value={prodVariety} onChange={e => setProdVariety(e.target.value)} className="w-full p-2 border rounded-xl" />
                </div>
                <div>
                  <label className="font-bold block mb-1">Weight (KG)</label>
                  <input type="number" required value={prodWeight} onChange={e => setProdWeight(Number(e.target.value))} className="w-full p-2 border rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">Selling Price (KES)</label>
                  <input type="number" required value={prodPrice} onChange={e => setProdPrice(Number(e.target.value))} className="w-full p-2 border rounded-xl" />
                </div>
                <div>
                  <label className="font-bold block mb-1">Buying Price (KES)</label>
                  <input type="number" required value={prodBuyingPrice} onChange={e => setProdBuyingPrice(Number(e.target.value))} className="w-full p-2 border rounded-xl" />
                </div>
              </div>
              <div>
                <label className="font-bold block mb-1">Image URL</label>
                <input type="text" value={prodImage} onChange={e => setProdImage(e.target.value)} placeholder="https://..." className="w-full p-2 border rounded-xl" />
              </div>
              <button type="submit" className="w-full bg-emerald-800 text-white font-bold py-2.5 rounded-xl text-sm">
                Save Product
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 6: USER PROFILE EDIT MODAL           */}
      {/* ========================================== */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 space-y-4 shadow-2xl relative border border-slate-200">
            <button onClick={() => setEditProfileOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-slate-900">Manage Your Account</h3>

            {profileMsg && <div className="p-2 bg-slate-100 rounded text-xs">{profileMsg}</div>}

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Full Name</label>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full p-2 border rounded-xl" />
              </div>
              <div>
                <label className="font-bold block mb-1">Email</label>
                <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full p-2 border rounded-xl" />
              </div>
              <div>
                <label className="font-bold block mb-1">Phone Number</label>
                <input type="text" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} className="w-full p-2 border rounded-xl" />
              </div>
              <button type="submit" className="w-full bg-emerald-800 text-white font-bold py-2.5 rounded-xl text-sm">
                Update Details
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
