export type UserRole = 'admin' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  nameEn: string;
  slug: string;
  description: string;
  image: string;
  itemCount: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  colorName: string;
  colorEn: string;
  colorHex: string;
  storage: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  image?: string;
}

export interface ProductSpecification {
  processor: string;
  display: string;
  battery: string;
  ports: string;
  connectivity?: string;
  sensors?: string;
  weight?: string;
  os?: string;
  camera?: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
  isVerifiedPurchase?: boolean;
}

export interface Product {
  id: string;
  name: string;
  nameEn: string;
  subtitle: string;
  slug: string;
  brand: string;
  category: string;
  basePrice: number;
  compareAtPrice?: number;
  description: string;
  images: string[];
  variants: ProductVariant[];
  specifications: ProductSpecification;
  rating: number;
  reviewCount: number;
  isFeatured?: boolean;
  isFlashDeal?: boolean;
  soldCount?: number;
  stockTotal: number;
  warranty: string;
  tags: string[];
  createdAt: string;
}

export interface FlashCampaign {
  id: string;
  title: string;
  discountPercent: number; // default discount
  productDiscounts?: Record<string, number>; // individual product discounts: productId -> percent
  startDate: string;
  endDate: string;
  isActive: boolean;
  eligibleProductIds: string[];
  bannerText?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  product: Product;
  variant: ProductVariant;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantTitle: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Address {
  id: string;
  userId: string;
  title: string;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  postalAddress: string;
  postalCode: string;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  amount: number;
  status: 'successful' | 'pending' | 'failed';
  gateway: string;
  trackingCode: string;
  cardPan?: string;
  refId?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  status: OrderStatus;
  shippingAddress: Address;
  paymentMethod: string;
  paymentStatus: 'paid' | 'unpaid' | 'refunded';
  transaction?: PaymentTransaction;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  details: string;
  ip: string;
  timestamp: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  recommendedProducts?: {
    id: string;
    name: string;
    price: number;
    image: string;
    reason?: string;
  }[];
}

export interface AIConversation {
  id: string;
  userId: string;
  title: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}
