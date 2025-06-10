export interface Location {
    country: string;
    state?: string;
    city?: string;
    postalCode?: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
}

export interface ContactInfo {
    email: string;
    phone?: string;
    website?: string;
    socialMedia?: {
        twitter?: string;
        facebook?: string;
        instagram?: string;
        linkedin?: string;
    };
}

export interface Seller {
    address: string;
    name: string;
    description?: string;
    location: Location;
    contactInfo: ContactInfo;
    rating?: number;
    totalSales?: number;
    joinedDate: string;
    verified: boolean;
}

export interface ProductDetails {
    name: string;
    description: string;
    category: string;
    subcategory?: string;
    tags: string[];
    price: {
        amount: string;
        currency: string;
    };
    images: string[];
    specifications?: Record<string, string>;
    condition?: 'new' | 'used' | 'refurbished';
    quantity?: number;
    availability: boolean;
}

export interface ServiceDetails {
    name: string;
    description: string;
    category: string;
    subcategory?: string;
    tags: string[];
    price: {
        amount: string;
        currency: string;
        type: 'fixed' | 'hourly' | 'daily' | 'negotiable';
    };
    availability: {
        schedule?: {
            days: string[];
            hours: string[];
        };
        location: 'remote' | 'onsite' | 'both';
    };
    qualifications?: string[];
    experience?: string;
}

export interface ListingNode {
    address: string;
    name: string;
    description?: string;
    location: Location;
    status: 'active' | 'inactive' | 'maintenance';
    lastSync: string;
}

export interface ListingMetadata {
    id: string;
    type: 'product' | 'service';
    seller: Seller;
    details: ProductDetails | ServiceDetails;
    listingNode: ListingNode;
    createdAt: string;
    updatedAt: string;
    status: 'active' | 'sold' | 'expired' | 'cancelled';
    views: number;
    favorites: number;
    sales?: number;
    reviews?: {
        rating: number;
        count: number;
    };
}

export interface SearchFilters {
    type?: 'product' | 'service';
    category?: string;
    subcategory?: string;
    priceRange?: {
        min?: string;
        max?: string;
        currency?: string;
    };
    location?: {
        country?: string;
        state?: string;
        city?: string;
        radius?: number; // in kilometers
    };
    seller?: {
        verified?: boolean;
        minRating?: number;
    };
    condition?: 'new' | 'used' | 'refurbished';
    availability?: boolean;
    tags?: string[];
    sortBy?: 'price' | 'rating' | 'date' | 'popularity';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
} 