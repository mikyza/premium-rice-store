"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  User as UserIcon,
  ShieldAlert,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  Truck,
  DollarSign,
  Package,
  TrendingUp,
  Settings,
  LogOut,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  Save,
  ChevronRight,
  Filter,
  Eye,
  Menu,
  X,
  CreditCard,
  MapPin,
  Lock,
  Award,
  AlertTriangle
} from "lucide-react";

// ==========================================
// CONFIG & TYPES
// ==========================================
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface UserProfile {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: "user" | "admin";
  isActive: boolean;
  rewardPoints: number;
}

interface Product {
  id: number;
  brandName: string;
  variety: string;
  weightKg: number;
  basePrice: number;
  buyingPrice?: number;
  flashSalePrice?: number | null;
  stockQuantity: number;
  imageUrl?: string;
  isAvailable: boolean;
  price?: number;
}

interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  product: Product;
}

interface OrderItem {
  productId: number;
  name: string;
  variety: string;
  brandName: string;
  weightKg: number;
  quantity: number;
  priceAtPurchase: number;
  buyingPrice: number;
  imageUrl?: string;
}

interface Order {
  id: number;
  userId: number;
  items: OrderItem[];
  transportFee: number;
  subTotal: number;
  grandTotal: number;
  totalWeightKg: number;
  pointsEarned: number;
  paymentDetails: {
    method: string;
    isPaid: boolean;
    paidTag: "PAID" | "PENDING" | "FAILED";
    mpesaNumber?: string;
    amount?: number;
    paidAt?: string;
    mpesaReceipt?: string;
    failureReason?: string;
  };
  county: string;
  town: string;
  location: string;
  sublocation: string;
  shippingAddress: {
    county: string;
    town: string;
    location: string;
    sublocation: string;
    streetAddress: string;
    details: string;
  };
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "payment_failed";
  createdAt: string;
  User?: {
    id: number;
    fullName: string;
    phoneNumber: string;
    email: string;
  };
  userName?: string;
  userPhone?: string;
  userEmail?: string;
  transactionCategory?: "pending_shipping" | "completed" | "unpaid";
}

interface HeroConfig {
  type: "video" | "image";
  url: string;
  title: string;
  subtitle: string;
  badgeText: string;
  buttonText: string;
  buttonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  overlayOpacity: number;
  alignment: "left" | "center" | "right";
  autoPlay: boolean;
  videoDuration: number;
  imageDuration: number;
}

interface FinancialSummary {
  selectedYear: number;
  availableYears: number[];
  summary: {
    totalMoneyReceived: number;
    totalBuyingCost: number;
    totalNetProfit: number;
    totalKgSold: number;
    totalPointsAwarded: number;
  };
  riceCategories: {
    category: string;
    brandName: string;
    quantitySold: number;
    totalRevenue: number;
    totalBuyingCost: number;
    totalProfit: number;
    buyingPricePerUnit: number;
    sellingPricePerUnit: number;
  }[];
}

export default function StorefrontApp() {
  // Authentication & Global User State
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<"catalog" | "orders" | "profile" | "admin">("catalog");
  const [adminSubTab, setAdminSubTab] = useState<"finances" | "pending_tx" | "all_orders" | "products" | "hero_config" | "users">("finances");

  // Storefront Data
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [heroConfig, setHeroConfig] = useState<HeroConfig>({
    type: "video",
    url: "https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI",
    title: "Direct From Mwea Paddy Fields",
    subtitle: "100% Pure Aromatic Pishori Rice harvested and delivered straight to your doorstep.",
    badgeText: "🌾 100% Authentic Mwea Harvest",
    buttonText: "Shop Fresh Harvest Now",
    buttonLink: "#catalog",
    secondaryButtonText: "View Flash Deals",
    secondaryButtonLink: "#flash-sales",
    overlayOpacity: 0.4,
    alignment: "center",
    autoPlay: true,
    videoDuration: 5,
    imageDuration: 4
  });

  // UI / Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">("login");
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Form Inputs: Auth
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");

  // Form Inputs: Profile Edit
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileEmail, setEditProfileEmail] = useState("");
  const [editProfilePhone, setEditProfilePhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Form Inputs: Shipping / Checkout
  const [checkoutCounty, setCheckoutCounty] = useState("Kirinyaga");
  const [checkoutTown, setCheckoutTown] = useState("Mwea");
  const [checkoutLocation, setCheckoutLocation] = useState("Wamumu");
  const [checkoutSublocation, setCheckoutSublocation] = useState("Rice Mill Zone");
  const [checkoutStreet, setCheckoutStreet] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [countiesMap, setCountiesMap] = useState<Record<string, number>>({});
  const [locationsMap, setLocationsMap] = useState<any>({});

  // Search & Catalog Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVariety, setSelectedVariety] = useState("");

  // Admin Specific State
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminPendingTx, setAdminPendingTx] = useState<Order[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [financialData, setFinancialData] = useState<FinancialSummary | null>(null);
  const [buyingPricesEditMap, setBuyingPricesEditMap] = useState<Record<number, number>>({});
  
  // Admin Hero Form State (10 fields)
  const [heroForm, setHeroForm] = useState<HeroConfig>({ ...heroConfig });

  // Admin New Product Form State
  const [newProd, setNewProd] = useState({
    brandName: "",
    variety: "Aromatic Pishori",
    weightKg: 5,
    basePrice: 1000,
    buyingPrice: 750,
    flashSalePrice: 900,
    stockQuantity: 50,
    imageUrl: ""
  });

  const notify = (message: string, type: "success" | "error" | "info" = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // ==========================================
  // INITIALIZATION & DATA FETCHING
  // ==========================================
  useEffect(() => {
    const savedToken = localStorage.getItem("mwea_auth_token");
    if (savedToken) {
      setToken(savedToken);
      fetchUserProfile(savedToken);
      fetchUserCart(savedToken);
    }
    fetchProducts();
    fetchHeroConfig();
    fetchLocationConfigs();
  }, []);

  useEffect(() => {
    if (token && user?.role === "admin" && activeTab === "admin") {
      if (adminSubTab === "finances") fetchFinancials();
      if (adminSubTab === "pending_tx") fetchAdminPendingTx();
      if (adminSubTab === "all_orders") fetchAdminOrders();
      if (adminSubTab === "users") fetchAdminUsers();
    }
  }, [token, user, activeTab, adminSubTab]);

  const fetchUserProfile = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setEditProfileName(data.fullName || "");
        setEditProfileEmail(data.email || "");
        setEditProfilePhone(data.phoneNumber || "");
      } else {
        localStorage.removeItem("mwea_auth_token");
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/catalog`);
      if (res.ok) setProducts(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHeroConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/hero`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.title) {
          setHeroConfig(data);
          setHeroForm(data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLocationConfigs = async () => {
    try {
      const countyRes = await fetch(`${API_BASE_URL}/api/config/counties`);
      if (countyRes.ok) setCountiesMap(await countyRes.json());

      const locRes = await fetch(`${API_BASE_URL}/api/config/locations`);
      if (locRes.ok) setLocationsMap(await locRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUserCart = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/cart`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCart(data.items || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUserOrders = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/my-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setUserOrders(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // AUTHENTICATION HANDLERS
  // ==========================================
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let endpoint = "/api/user/login";
      let payload: any = {};

      if (authMode === "login") {
        endpoint = "/api/user/login";
        payload = { identifier: loginIdentifier, password: authPassword };
      } else if (authMode === "signup") {
        endpoint = "/api/user/signup";
        payload = { fullName: authName, phoneNumber: authPhone, email: authEmail, password: authPassword };
      } else if (authMode === "forgot") {
        endpoint = "/api/user/forgot-password";
        payload = { email: authEmail };
      }

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");

      if (authMode === "forgot") {
        notify("OTP password reset code sent to your email!", "success");
        return;
      }

      localStorage.setItem("mwea_auth_token", data.token);
      setToken(data.token);
      setUser(data.user);
      setIsAuthModalOpen(false);
      notify(`Welcome back, ${data.user.fullName}!`, "success");
      fetchUserCart(data.token);
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("mwea_auth_token");
    setToken(null);
    setUser(null);
    setCart([]);
    setActiveTab("catalog");
    notify("Logged out successfully", "info");
  };

  // ==========================================
  // USER PROFILE EDIT & SUSPENSION HANDLERS
  // ==========================================
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: editProfileName,
          email: editProfileEmail,
          phoneNumber: editProfilePhone,
          currentPassword,
          newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      setUser(data.user);
      setCurrentPassword("");
      setNewPassword("");
      notify("Profile details updated successfully!", "success");
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  const handleSuspendAccount = async () => {
    if (!token) return;
    if (!confirm("Are you sure you want to suspend your account? You will be logged out immediately.")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/user/suspend`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        notify("Account suspended. Logging out...", "info");
        handleLogout();
      } else {
        const data = await res.json();
        notify(data.error || "Failed to suspend account", "error");
      }
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  // ==========================================
  // CART & CHECKOUT HANDLERS
  // ==========================================
  const addToCart = async (product: Product) => {
    if (!token) {
      setIsAuthModalOpen(true);
      notify("Please sign in to add items to your cart", "info");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/cart/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ productId: product.id, quantity: 1 })
      });

      if (res.ok) {
        notify(`Added ${product.brandName} to cart`, "success");
        fetchUserCart(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateCartQty = async (cartItemId: number, quantity: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/cart/item/${cartItemId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ quantity })
      });

      if (res.ok) fetchUserCart(token);
    } catch (err) {
      console.error(err);
    }
  };

  const removeCartItem = async (cartItemId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/cart/item/${cartItemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchUserCart(token);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlaceOrder = async () => {
    if (!token || cart.length === 0) return;

    const activeShippingFee = countiesMap[checkoutCounty] || 250;
    const itemsSubtotal = cart.reduce((acc, item) => acc + (item.product.price || item.product.basePrice) * item.quantity, 0);
    const grandTotal = itemsSubtotal + activeShippingFee;

    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          cartItems: cart,
          paymentMethod: "mpesa_stk",
          mpesaPhoneNumber: checkoutPhone || user?.phoneNumber,
          county: checkoutCounty,
          town: checkoutTown,
          location: checkoutLocation,
          sublocation: checkoutSublocation,
          streetAddress: checkoutStreet,
          shippingFee: activeShippingFee,
          grandTotal: grandTotal
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create order");

      notify(data.stkStatusMessage || "Order placed! M-Pesa STK push dispatched.", "success");
      setIsCheckoutOpen(false);
      setIsCartDrawerOpen(false);
      fetchUserCart(token);
      setActiveTab("orders");
      fetchUserOrders();
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  const pollOrderStatus = async (orderId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/payhero/status/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        notify(`Payment Status: ${data.paymentDetails?.paidTag || data.status}`, "info");
        fetchUserOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // ADMIN DASHBOARD HANDLERS
  // ==========================================
  const fetchFinancials = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/analytics/finances`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFinancialData(data);
        const map: Record<number, number> = {};
        products.forEach(p => {
          if (p.buyingPrice !== undefined) map[p.id] = p.buyingPrice;
        });
        setBuyingPricesEditMap(map);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminPendingTx = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/orders/pending-transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setAdminPendingTx(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setAdminOrders(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setAdminUsers(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateBuyingPrice = async (productId: number, price: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/products/${productId}/buying-price`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ buyingPrice: price })
      });

      if (res.ok) {
        notify("Buying price updated successfully!", "success");
        fetchFinancials();
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBatchUpdateBuyingPrices = async () => {
    const updates = Object.entries(buyingPricesEditMap).map(([id, buyingPrice]) => ({
      id: Number(id),
      buyingPrice
    }));

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/products/buying-prices/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ updates })
      });

      if (res.ok) {
        notify("Batch buying prices updated!", "success");
        fetchFinancials();
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        notify(`Order #${orderId} status set to ${status}`, "success");
        fetchAdminPendingTx();
        fetchAdminOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveHeroConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/config/hero`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(heroForm)
      });

      if (res.ok) {
        const data = await res.json();
        setHeroConfig(data.hero);
        notify("Hero Backdrop settings saved!", "success");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newProd)
      });

      if (res.ok) {
        notify("Product created successfully!", "success");
        fetchProducts();
        setNewProd({
          brandName: "",
          variety: "Aromatic Pishori",
          weightKg: 5,
          basePrice: 1000,
          buyingPrice: 750,
          flashSalePrice: 900,
          stockQuantity: 50,
          imageUrl: ""
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calculations
  const cartSubtotal = cart.reduce((acc, item) => acc + (item.product.price || item.product.basePrice) * item.quantity, 0);
  const cartTotalWeight = cart.reduce((acc, item) => acc + (item.product.weightKg || 0) * item.quantity, 0);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.brandName.toLowerCase().includes(searchQuery.toLowerCase()) || p.variety.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVariety = selectedVariety ? p.variety === selectedVariety : true;
    return matchesSearch && matchesVariety;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-white font-medium transition-all ${
            notification.type === "success" ? "bg-emerald-600" : notification.type === "error" ? "bg-rose-600" : "bg-blue-600"
          }`}
        >
          {notification.type === "success" && <CheckCircle size={20} />}
          {notification.type === "error" && <XCircle size={20} />}
          {notification.type === "info" && <ShieldAlert size={20} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab("catalog")}>
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
                🌾
              </div>
              <div>
                <span className="text-xl font-black bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-transparent">
                  MWEA RICE HUB
                </span>
                <span className="block text-[10px] text-slate-500 tracking-wider font-semibold uppercase">
                  Direct Paddy Harvest
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-6">
              <button
                onClick={() => setActiveTab("catalog")}
                className={`text-sm font-semibold transition ${activeTab === "catalog" ? "text-emerald-600" : "text-slate-600 hover:text-emerald-600"}`}
              >
                Catalog & Grain Store
              </button>
              {token && (
                <>
                  <button
                    onClick={() => {
                      setActiveTab("orders");
                      fetchUserOrders();
                    }}
                    className={`text-sm font-semibold transition ${activeTab === "orders" ? "text-emerald-600" : "text-slate-600 hover:text-emerald-600"}`}
                  >
                    My Orders
                  </button>
                  <button
                    onClick={() => setActiveTab("profile")}
                    className={`text-sm font-semibold transition ${activeTab === "profile" ? "text-emerald-600" : "text-slate-600 hover:text-emerald-600"}`}
                  >
                    Account Profile
                  </button>
                </>
              )}
              {user?.role === "admin" && (
                <button
                  onClick={() => setActiveTab("admin")}
                  className={`text-sm font-bold px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-50 text-amber-800 transition ${
                    activeTab === "admin" ? "bg-amber-500 text-white" : "hover:bg-amber-100"
                  }`}
                >
                  Admin Portal
                </button>
              )}
            </div>

            {/* User Actions & Cart */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCartDrawerOpen(true)}
                className="relative p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition"
              >
                <ShoppingBag size={22} />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 text-white rounded-full text-xs font-bold flex items-center justify-center">
                    {cart.reduce((a, b) => a + b.quantity, 0)}
                  </span>
                )}
              </button>

              {token ? (
                <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-3">
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-800">{user?.fullName}</p>
                    <p className="text-[11px] text-amber-600 font-semibold">{user?.rewardPoints || 0} pts</p>
                  </div>
                  <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-600 transition" title="Logout">
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition"
                >
                  Sign In
                </button>
              )}

              <button className="md:hidden p-2 text-slate-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ========================================================================= */}
        {/* CATALOG / STOREFRONT TAB */}
        {/* ========================================================================= */}
        {activeTab === "catalog" && (
          <div className="space-y-8">
            {/* Dynamic Hero Configuration Backdrop Section */}
            <div className="relative rounded-3xl overflow-hidden bg-slate-900 text-white shadow-2xl min-h-[420px] flex items-center">
              {heroConfig.type === "video" ? (
                <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                  <iframe
                    src={heroConfig.url}
                    className="w-full h-full scale-125 opacity-60"
                    allow="autoplay; encrypted-media"
                    title="Hero Video"
                  />
                </div>
              ) : (
                <div
                  className="absolute inset-0 w-full h-full bg-cover bg-center opacity-60"
                  style={{ backgroundImage: `url(${heroConfig.url})` }}
                />
              )}
              <div
                className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-transparent"
                style={{ opacity: heroConfig.overlayOpacity }}
              />

              <div
                className={`relative z-10 max-w-2xl px-8 py-12 ${
                  heroConfig.alignment === "center" ? "mx-auto text-center" : heroConfig.alignment === "right" ? "ml-auto text-right" : ""
                }`}
              >
                <span className="inline-block px-3 py-1 bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold rounded-full mb-4">
                  {heroConfig.badgeText}
                </span>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-4">
                  {heroConfig.title}
                </h1>
                <p className="text-slate-200 text-lg mb-8 leading-relaxed">
                  {heroConfig.subtitle}
                </p>
                <div className="flex flex-wrap gap-4 justify-start">
                  <a
                    href={heroConfig.buttonLink}
                    className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition transform hover:-translate-y-0.5"
                  >
                    {heroConfig.buttonText}
                  </a>
                  <a
                    href={heroConfig.secondaryButtonLink}
                    className="px-6 py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold rounded-xl border border-white/20 transition"
                  >
                    {heroConfig.secondaryButtonText}
                  </a>
                </div>
              </div>
            </div>

            {/* Catalog Search & Variety Filter */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search Pishori, Basmati, Brown..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter size={18} className="text-slate-400" />
                <select
                  value={selectedVariety}
                  onChange={e => setSelectedVariety(e.target.value)}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All Variety Grains</option>
                  <option value="Aromatic Pishori">Aromatic Pishori</option>
                  <option value="Long Grain Basmati">Long Grain Basmati</option>
                  <option value="Kaisari Long Grain">Kaisari Long Grain</option>
                  <option value="Brown Nutritious Rice">Brown Nutritious Rice</option>
                </select>
              </div>
            </div>

            {/* Products Grid */}
            <div id="catalog" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map(product => {
                const effectivePrice = product.price || product.basePrice;
                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition"
                  >
                    <div className="relative h-48 bg-slate-100 overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.brandName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">🌾</div>
                      )}
                      <span className="absolute top-3 left-3 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                        {product.weightKg} KG Sack
                      </span>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                          {product.variety}
                        </span>
                        <h3 className="text-base font-bold text-slate-800 line-clamp-1 mt-1">
                          {product.brandName}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Stock Available: {product.stockQuantity} bags</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div>
                          <p className="text-xs text-slate-400 font-medium">Price per bag</p>
                          <p className="text-lg font-black text-slate-900">
                            KES {effectivePrice.toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => addToCart(product)}
                          className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition"
                          title="Add to Cart"
                        >
                          <ShoppingBag size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* USER ORDERS & LIVE PAYMENT STATUS TAB */}
        {/* ========================================================================= */}
        {activeTab === "orders" && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">My Orders & Track Payments</h2>
                <p className="text-sm text-slate-500">Monitor live payment status, M-Pesa receipts, and delivery stages</p>
              </div>
              <button
                onClick={fetchUserOrders}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
              >
                <RefreshCw size={16} /> Refresh
              </button>
            </div>

            {userOrders.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-3">
                <Package size={48} className="mx-auto text-slate-300" />
                <p className="text-slate-600 font-semibold">No order history found yet.</p>
                <button onClick={() => setActiveTab("catalog")} className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm">
                  Start Shopping Fresh Rice
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {userOrders.map(order => {
                  const payTag = order.paymentDetails?.paidTag || (order.paymentDetails?.isPaid ? "PAID" : "PENDING");
                  return (
                    <div key={order.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-slate-800">Order #{order.id}</span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                payTag === "PAID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : payTag === "FAILED"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              Payment: {payTag}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 uppercase">
                              Status: {order.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Placed on {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <button
                          onClick={() => pollOrderStatus(order.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                        >
                          Check Live Payment Status
                        </button>
                      </div>

                      {/* Items List */}
                      <div className="space-y-2">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm py-1">
                            <span className="font-semibold text-slate-700">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="font-bold text-slate-900">
                              KES {(item.priceAtPurchase * item.quantity).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Payment & Logistics Meta */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl">
                        <div>
                          <p className="font-bold text-slate-800 mb-1">Payment Breakdown</p>
                          <p>M-Pesa Receipt: <span className="font-semibold text-slate-900">{order.paymentDetails?.mpesaReceipt || "Pending..."}</span></p>
                          <p>Grand Total: <span className="font-bold text-emerald-700">KES {order.grandTotal.toLocaleString()}</span></p>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 mb-1">Shipping Destination</p>
                          <p>{order.county} County, {order.town} Town</p>
                          <p>{order.location} / {order.sublocation} ({order.shippingAddress?.streetAddress})</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* USER PROFILE & ACCOUNT MANAGEMENT TAB */}
        {/* ========================================================================= */}
        {activeTab === "profile" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">User Profile Details</h2>
                <p className="text-sm text-slate-500">Edit account info or adjust security credentials</p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editProfileName}
                    onChange={e => setEditProfileName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={editProfileEmail}
                      onChange={e => setEditProfileEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={editProfilePhone}
                      onChange={e => setEditProfilePhone(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-800 mb-2">Change Password (Optional)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="password"
                      placeholder="Current password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow"
                >
                  Save Profile Changes
                </button>
              </form>
            </div>

            {/* Suspend Account Action Box */}
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-rose-900">Self Account Suspension</h3>
                <p className="text-xs text-rose-700 mt-1">
                  Temporarily suspend your user account and disable login access.
                </p>
              </div>
              <button
                onClick={handleSuspendAccount}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition"
              >
                Suspend Account
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADMIN DASHBOARD PORTAL */}
        {/* ========================================================================= */}
        {activeTab === "admin" && user?.role === "admin" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Admin Control & Analytics Center</h2>
                <p className="text-sm text-slate-500">Manage finances, pending shipping orders, products, and hero configuration</p>
              </div>

              {/* Admin Sub-Tab Navigation */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAdminSubTab("finances")}
                  className={`px-3 py-2 text-xs font-bold rounded-xl transition ${
                    adminSubTab === "finances" ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  📊 Financial Dashboard
                </button>
                <button
                  onClick={() => setAdminSubTab("pending_tx")}
                  className={`px-3 py-2 text-xs font-bold rounded-xl transition ${
                    adminSubTab === "pending_tx" ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  🚚 Pending Shipping
                </button>
                <button
                  onClick={() => setAdminSubTab("all_orders")}
                  className={`px-3 py-2 text-xs font-bold rounded-xl transition ${
                    adminSubTab === "all_orders" ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  📦 All Orders
                </button>
                <button
                  onClick={() => setAdminSubTab("products")}
                  className={`px-3 py-2 text-xs font-bold rounded-xl transition ${
                    adminSubTab === "products" ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  🌾 Products Catalog
                </button>
                <button
                  onClick={() => setAdminSubTab("hero_config")}
                  className={`px-3 py-2 text-xs font-bold rounded-xl transition ${
                    adminSubTab === "hero_config" ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  🎨 Hero Backdrop (10)
                </button>
              </div>
            </div>

            {/* --- ADMIN SUB-TAB 1: FINANCIAL DASHBOARD --- */}
            {adminSubTab === "finances" && financialData && (
              <div className="space-y-6">
                {/* Summary Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">Received Money Only</p>
                    <p className="text-2xl font-black text-emerald-600">
                      KES {financialData.summary.totalMoneyReceived.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-500">From verified paid transactions</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">Total Buying Costs</p>
                    <p className="text-2xl font-black text-slate-800">
                      KES {financialData.summary.totalBuyingCost.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-500">Based on rice purchase prices</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">Net Profit Earned</p>
                    <p className="text-2xl font-black text-amber-600">
                      KES {financialData.summary.totalNetProfit.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-500">Revenue minus buying cost</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">Total Grain Volume</p>
                    <p className="text-2xl font-black text-slate-900">
                      {financialData.summary.totalKgSold} KG
                    </p>
                    <p className="text-[11px] text-slate-500">Harvest sold and delivered</p>
                  </div>
                </div>

                {/* Categories & Profit Breakdown Table + Buying Price Adjustments */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Rice Category Profitability & Monthly Buying Price Config</h3>
                      <p className="text-xs text-slate-500">Update unit buying prices to recalculate exact profit margins</p>
                    </div>
                    <button
                      onClick={handleBatchUpdateBuyingPrices}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition"
                    >
                      Batch Save Buying Prices
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[11px]">
                        <tr>
                          <th className="p-3">Variety Category</th>
                          <th className="p-3">Bags Sold</th>
                          <th className="p-3">Received Revenue</th>
                          <th className="p-3">Buying Cost</th>
                          <th className="p-3">Category Net Profit</th>
                          <th className="p-3">Unit Buying Price (KES)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {financialData.riceCategories.map((cat, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{cat.category}</td>
                            <td className="p-3">{cat.quantitySold} bags</td>
                            <td className="p-3 font-semibold text-emerald-600">KES {cat.totalRevenue.toLocaleString()}</td>
                            <td className="p-3 text-slate-600">KES {cat.totalBuyingCost.toLocaleString()}</td>
                            <td className="p-3 font-bold text-amber-600">KES {cat.totalProfit.toLocaleString()}</td>
                            <td className="p-3">
                              <input
                                type="number"
                                defaultValue={cat.buyingPricePerUnit}
                                onChange={e => {
                                  const prod = products.find(p => p.variety === cat.category);
                                  if (prod) {
                                    setBuyingPricesEditMap({ ...buyingPricesEditMap, [prod.id]: Number(e.target.value) });
                                  }
                                }}
                                className="w-24 px-2 py-1 rounded border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* --- ADMIN SUB-TAB 2: PENDING SHIPPING TRANSACTIONS --- */}
            {adminSubTab === "pending_tx" && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Pending Shipping Transactions</h3>
                  <p className="text-xs text-slate-500">Paid transactions awaiting dispatch and delivery</p>
                </div>

                {adminPendingTx.length === 0 ? (
                  <p className="text-sm text-slate-500 italic py-6 text-center">No pending shipping orders right now.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100 font-bold text-slate-800 uppercase">
                        <tr>
                          <th className="p-3">Order ID</th>
                          <th className="p-3">Customer Name</th>
                          <th className="p-3">Contact</th>
                          <th className="p-3">Destination Details</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Status Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {adminPendingTx.map(order => (
                          <tr key={order.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold">#{order.id}</td>
                            <td className="p-3 font-bold text-slate-900">{order.userName || order.User?.fullName}</td>
                            <td className="p-3">{order.userPhone || order.User?.phoneNumber}</td>
                            <td className="p-3">
                              <span className="font-semibold">{order.county}</span>, {order.town}, {order.location} ({order.shippingAddress?.streetAddress})
                            </td>
                            <td className="p-3 font-bold text-emerald-600">KES {order.grandTotal.toLocaleString()}</td>
                            <td className="p-3">
                              <button
                                onClick={() => handleUpdateOrderStatus(order.id, "delivered")}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow transition"
                              >
                                Mark as Delivered
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* --- ADMIN SUB-TAB 3: ALL ORDERS --- */}
            {adminSubTab === "all_orders" && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">All System Transactions & Orders</h3>
                    <p className="text-xs text-slate-500">Comprehensive customer logistics & payment records</p>
                  </div>
                  <a
                    href={`${API_BASE_URL}/api/admin/orders/export/csv?token=${token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow hover:bg-slate-800 transition"
                  >
                    Export Orders CSV
                  </a>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-100 font-bold text-slate-800 uppercase">
                      <tr>
                        <th className="p-3">ID</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">County / Address</th>
                        <th className="p-3">M-Pesa Receipt</th>
                        <th className="p-3">Paid Tag</th>
                        <th className="p-3">Delivery Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminOrders.map(o => (
                        <tr key={o.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold">#{o.id}</td>
                          <td className="p-3">
                            <p className="font-bold text-slate-900">{o.userName || o.User?.fullName}</p>
                            <p className="text-[10px] text-slate-400">{o.userPhone}</p>
                          </td>
                          <td className="p-3">{o.county}, {o.town}</td>
                          <td className="p-3 font-mono text-slate-600">{o.paymentDetails?.mpesaReceipt || "N/A"}</td>
                          <td className="p-3 font-bold text-emerald-600">{o.paymentDetails?.paidTag || "PENDING"}</td>
                          <td className="p-3 uppercase font-semibold">{o.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- ADMIN SUB-TAB 4: PRODUCTS CATALOG & ADD --- */}
            {adminSubTab === "products" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-900">Add New Grain Product</h3>
                  <form onSubmit={handleCreateProduct} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold mb-1">Brand Name</label>
                      <input
                        type="text"
                        required
                        value={newProd.brandName}
                        onChange={e => setNewProd({ ...newProd, brandName: e.target.value })}
                        className="w-full p-2 rounded-lg border text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold mb-1">Weight (KG)</label>
                        <input
                          type="number"
                          required
                          value={newProd.weightKg}
                          onChange={e => setNewProd({ ...newProd, weightKg: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg border text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">Selling Price (KES)</label>
                        <input
                          type="number"
                          required
                          value={newProd.basePrice}
                          onChange={e => setNewProd({ ...newProd, basePrice: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg border text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold mb-1">Buying Price (KES)</label>
                        <input
                          type="number"
                          required
                          value={newProd.buyingPrice}
                          onChange={e => setNewProd({ ...newProd, buyingPrice: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg border text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">Stock Quantity</label>
                        <input
                          type="number"
                          required
                          value={newProd.stockQuantity}
                          onChange={e => setNewProd({ ...newProd, stockQuantity: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg border text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Image URL</label>
                      <input
                        type="text"
                        value={newProd.imageUrl}
                        onChange={e => setNewProd({ ...newProd, imageUrl: e.target.value })}
                        className="w-full p-2 rounded-lg border text-xs"
                      />
                    </div>
                    <button type="submit" className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs">
                      Create Product
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-900">Current Catalog Inventory</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 font-bold">
                        <tr>
                          <th className="p-2">Product</th>
                          <th className="p-2">Weight</th>
                          <th className="p-2">Selling</th>
                          <th className="p-2">Buying</th>
                          <th className="p-2">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.map(p => (
                          <tr key={p.id}>
                            <td className="p-2 font-bold">{p.brandName}</td>
                            <td className="p-2">{p.weightKg} kg</td>
                            <td className="p-2 font-semibold text-emerald-600">KES {p.basePrice}</td>
                            <td className="p-2 text-slate-500">KES {p.buyingPrice || "N/A"}</td>
                            <td className="p-2">{p.stockQuantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* --- ADMIN SUB-TAB 5: EXPANDED 10-FIELD HERO BACKDROP CONFIGURATION --- */}
            {adminSubTab === "hero_config" && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 max-w-3xl">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Configure Storefront Hero Backdrop (10 Settings)</h3>
                  <p className="text-xs text-slate-500">Customize main storefront visual parameters and call to actions</p>
                </div>

                <form onSubmit={handleSaveHeroConfig} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold mb-1">1. Media Type</label>
                      <select
                        value={heroForm.type}
                        onChange={e => setHeroForm({ ...heroForm, type: e.target.value as any })}
                        className="w-full p-2.5 rounded-xl border"
                      >
                        <option value="video">YouTube Video</option>
                        <option value="image">Static Image</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold mb-1">2. Media URL</label>
                      <input
                        type="text"
                        value={heroForm.url}
                        onChange={e => setHeroForm({ ...heroForm, url: e.target.value })}
                        className="w-full p-2.5 rounded-xl border"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold mb-1">3. Hero Main Title</label>
                    <input
                      type="text"
                      value={heroForm.title}
                      onChange={e => setHeroForm({ ...heroForm, title: e.target.value })}
                      className="w-full p-2.5 rounded-xl border"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">4. Subtitle Description</label>
                    <textarea
                      rows={2}
                      value={heroForm.subtitle}
                      onChange={e => setHeroForm({ ...heroForm, subtitle: e.target.value })}
                      className="w-full p-2.5 rounded-xl border"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold mb-1">5. Badge Text</label>
                      <input
                        type="text"
                        value={heroForm.badgeText}
                        onChange={e => setHeroForm({ ...heroForm, badgeText: e.target.value })}
                        className="w-full p-2.5 rounded-xl border"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">6. Alignment</label>
                      <select
                        value={heroForm.alignment}
                        onChange={e => setHeroForm({ ...heroForm, alignment: e.target.value as any })}
                        className="w-full p-2.5 rounded-xl border"
                      >
                        <option value="left">Left Align</option>
                        <option value="center">Center Align</option>
                        <option value="right">Right Align</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold mb-1">7. Primary Button Label</label>
                      <input
                        type="text"
                        value={heroForm.buttonText}
                        onChange={e => setHeroForm({ ...heroForm, buttonText: e.target.value })}
                        className="w-full p-2.5 rounded-xl border"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">8. Primary Button Target</label>
                      <input
                        type="text"
                        value={heroForm.buttonLink}
                        onChange={e => setHeroForm({ ...heroForm, buttonLink: e.target.value })}
                        className="w-full p-2.5 rounded-xl border"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold mb-1">9. Secondary Button Label</label>
                      <input
                        type="text"
                        value={heroForm.secondaryButtonText}
                        onChange={e => setHeroForm({ ...heroForm, secondaryButtonText: e.target.value })}
                        className="w-full p-2.5 rounded-xl border"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">10. Overlay Opacity (0.1 to 0.9)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={heroForm.overlayOpacity}
                        onChange={e => setHeroForm({ ...heroForm, overlayOpacity: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-xl border"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow hover:bg-emerald-700 transition"
                  >
                    Save All 10 Hero Backdrop Configurations
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* CHECKOUT & CART DRAWER */}
      {/* ========================================================================= */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-white h-full p-6 flex flex-col justify-between shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-lg font-bold">Your Grain Basket</h3>
              <button onClick={() => setIsCartDrawerOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {cart.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Your cart is empty.</p>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center border-b pb-2 text-xs">
                    <div>
                      <p className="font-bold">{item.product.brandName}</p>
                      <p className="text-slate-500">
                        KES {item.product.price || item.product.basePrice} x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateCartQty(item.id, item.quantity - 1)} className="px-2 py-1 bg-slate-100 rounded">
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateCartQty(item.id, item.quantity + 1)} className="px-2 py-1 bg-slate-100 rounded">
                        +
                      </button>
                      <button onClick={() => removeCartItem(item.id)} className="text-rose-600 ml-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between font-bold text-sm">
                  <span>Subtotal:</span>
                  <span>KES {cartSubtotal.toLocaleString()}</span>
                </div>
                <button
                  onClick={() => {
                    setIsCartDrawerOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                  className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-sm"
                >
                  Proceed to Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold">Logistics & M-Pesa Checkout</h3>
              <button onClick={() => setIsCheckoutOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">County Destination</label>
                <select
                  value={checkoutCounty}
                  onChange={e => setCheckoutCounty(e.target.value)}
                  className="w-full p-2.5 rounded-xl border"
                >
                  {Object.keys(countiesMap).map(c => (
                    <option key={c} value={c}>
                      {c} County (+KES {countiesMap[c]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Town</label>
                  <input
                    type="text"
                    value={checkoutTown}
                    onChange={e => setCheckoutTown(e.target.value)}
                    className="w-full p-2 rounded-xl border"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Location/Ward</label>
                  <input
                    type="text"
                    value={checkoutLocation}
                    onChange={e => setCheckoutLocation(e.target.value)}
                    className="w-full p-2 rounded-xl border"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Street / House Address</label>
                <input
                  type="text"
                  placeholder="e.g. Near Wamumu Primary, House 42"
                  value={checkoutStreet}
                  onChange={e => setCheckoutStreet(e.target.value)}
                  className="w-full p-2 rounded-xl border"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">M-Pesa Express Phone Number</label>
                <input
                  type="text"
                  placeholder="254712345678"
                  defaultValue={user?.phoneNumber}
                  onChange={e => setCheckoutPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl border font-bold"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span>Items Subtotal:</span>
                  <span className="font-bold">KES {cartSubtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transport Charge:</span>
                  <span className="font-bold">KES {countiesMap[checkoutCounty] || 250}</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-2 border-t text-emerald-700">
                  <span>Grand Total:</span>
                  <span>KES {(cartSubtotal + (countiesMap[checkoutCounty] || 250)).toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-sm shadow hover:bg-emerald-700 transition"
              >
                Trigger M-Pesa STK Push Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold">
                {authMode === "login" ? "Sign In" : authMode === "signup" ? "Create Account" : "Forgot Password"}
              </h3>
              <button onClick={() => setIsAuthModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
              {authMode === "signup" && (
                <div>
                  <label className="block font-bold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={e => setAuthName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border"
                  />
                </div>
              )}

              {authMode === "login" ? (
                <div>
                  <label className="block font-bold mb-1">Phone or Email</label>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={e => setLoginIdentifier(e.target.value)}
                    className="w-full p-2.5 rounded-xl border"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    className="w-full p-2.5 rounded-xl border"
                  />
                </div>
              )}

              {authMode === "signup" && (
                <div>
                  <label className="block font-bold mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={authPhone}
                    onChange={e => setAuthPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border"
                  />
                </div>
              )}

              {authMode !== "forgot" && (
                <div>
                  <label className="block font-bold mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)}
                    className="w-full p-2.5 rounded-xl border"
                  />
                </div>
              )}

              <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow">
                {authMode === "login" ? "Sign In" : authMode === "signup" ? "Sign Up" : "Send OTP"}
              </button>
            </form>

            <div className="text-center text-xs text-slate-500 pt-2 border-t">
              {authMode === "login" ? (
                <p>
                  Don't have an account?{" "}
                  <button onClick={() => setAuthMode("signup")} className="text-emerald-600 font-bold">
                    Sign Up
                  </button>
                </p>
              ) : (
                <p>
                  Already registered?{" "}
                  <button onClick={() => setAuthMode("login")} className="text-emerald-600 font-bold">
                    Sign In
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
