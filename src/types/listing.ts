/**
 * Represents a geographic location for listings and sellers
 */
export interface Location {
    /** Country name or code */
    country: string;
    /** State or province */
    state?: string;
    /** City name */
    city?: string;
    /** Postal or ZIP code */
    postalCode?: string;
    /** GPS coordinates */
    coordinates?: {
        latitude: number;
        longitude: number;
    };
}

/**
 * Contact information for sellers in the marketplace
 */
export interface ContactInfo {
    /** Email address */
    email: string;
    /** Phone number */
    phone?: string;
    /** Website URL */
    website?: string;
    /** Social media profiles */
    socialMedia?: {
        twitter?: string;
        facebook?: string;
        instagram?: string;
        linkedin?: string;
    };
}

/**
 * Represents a seller in the OmniBazaar marketplace
 */
export interface Seller {
    /** Seller's blockchain address */
    address: string;
    /** Seller's display name */
    name: string;
    /** Optional seller description */
    description?: string;
    /** Geographic location */
    location: Location;
    /** Contact information */
    contactInfo: ContactInfo;
    /** Average rating (0-5) */
    rating?: number;
    /** Total number of completed sales */
    totalSales?: number;
    /** Date when seller joined marketplace */
    joinedDate: string;
    /** Whether seller is verified */
    verified: boolean;
}

/**
 * Details for physical products in marketplace listings
 */
export interface ProductDetails {
    /** Product name */
    name: string;
    /** Detailed product description */
    description: string;
    /** Primary category */
    category: string;
    /** Secondary category */
    subcategory?: string;
    /** Tags for search and discovery */
    tags: string[];
    /** Product pricing information */
    price: {
        amount: string;
        currency: string;
    };
    /** Array of product images */
    images: string[];
    /** Technical specifications */
    specifications?: Record<string, string>;
    /** Physical condition of the product */
    condition?: 'new' | 'used' | 'refurbished';
    /** Available quantity */
    quantity?: number;
    /** Whether product is available for purchase */
    availability: boolean;
}

/**
 * Details for services offered in marketplace listings
 */
export interface ServiceDetails {
    /** Service name */
    name: string;
    /** Detailed service description */
    description: string;
    /** Primary category */
    category: string;
    /** Secondary category */
    subcategory?: string;
    /** Tags for search and discovery */
    tags: string[];
    /** Service pricing information */
    price: {
        amount: string;
        currency: string;
        type: 'fixed' | 'hourly' | 'daily' | 'negotiable';
    };
    /** Service availability details */
    availability: {
        schedule?: {
            days: string[];
            hours: string[];
        };
        location: 'remote' | 'onsite' | 'both';
    };
    /** Required qualifications or certifications */
    qualifications?: string[];
    /** Experience level or description */
    experience?: string;
}

/**
 * Represents a node in the distributed listing network
 */
export interface ListingNode {
    /** Node address or identifier */
    address: string;
    /** Human-readable node name */
    name: string;
    /** Optional node description */
    description?: string;
    /** Geographic location of the node */
    location: Location;
    /** Current operational status */
    status: 'active' | 'inactive' | 'maintenance';
    /** Timestamp of last synchronization */
    lastSync: string;
}

/**
 * Complete metadata for a marketplace listing
 */
export interface ListingMetadata {
    /** Unique listing identifier */
    id: string;
    /** Type of listing */
    type: 'product' | 'service';
    /** Seller information */
    seller: Seller;
    /** Product or service details */
    details: ProductDetails | ServiceDetails;
    /** Node hosting this listing */
    listingNode: ListingNode;
    /** Creation timestamp */
    createdAt: string;
    /** Last update timestamp */
    updatedAt: string;
    /** Current listing status */
    status: 'active' | 'sold' | 'expired' | 'cancelled';
    /** Number of views */
    views: number;
    /** Number of favorites */
    favorites: number;
    /** Number of completed sales */
    sales?: number;
    /** Review statistics */
    reviews?: {
        rating: number;
        count: number;
    };
}

/**
 * Filter options for searching marketplace listings
 */
export interface SearchFilters {
    /** Filter by listing type */
    type?: 'product' | 'service';
    /** Filter by category */
    category?: string;
    /** Filter by subcategory */
    subcategory?: string;
    /** Price range filter */
    priceRange?: {
        min?: string;
        max?: string;
        currency?: string;
    };
    /** Location-based filter */
    location?: {
        country?: string;
        state?: string;
        city?: string;
        radius?: number; // in kilometers
    };
    /** Seller criteria filter */
    seller?: {
        verified?: boolean;
        minRating?: number;
    };
    /** Product condition filter */
    condition?: 'new' | 'used' | 'refurbished';
    /** Availability filter */
    availability?: boolean;
    /** Tags filter */
    tags?: string[];
    /** Sort field */
    sortBy?: 'price' | 'rating' | 'date' | 'popularity';
    /** Sort direction */
    sortOrder?: 'asc' | 'desc';
    /** Page number for pagination */
    page?: number;
    /** Results per page limit */
    limit?: number;
}
