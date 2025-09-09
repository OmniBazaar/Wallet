/* @jsxImportSource react */
import React from 'react';
import { OmniCoinLoading } from './OmniCoinLoading';
import { OmniCoinToast } from './OmniCoinToast';

// Inline styles to avoid styled-components typing issues
const resultsContainerStyle: React.CSSProperties = {
  padding: '1rem'
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: '1.5rem',
  marginTop: '1rem'
};

const listingCardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden',
  transition: 'transform 0.2s ease'
};

const listingImageStyle: React.CSSProperties = {
  width: '100%',
  height: '200px',
  objectFit: 'cover'
};

const listingContentStyle: React.CSSProperties = {
  padding: '1rem'
};

const listingTitleStyle: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '1.1rem',
  color: '#1f2937'
};

const listingPriceStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 'bold',
  color: '#3b82f6',
  marginBottom: '0.5rem'
};

const listingDetailsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  fontSize: '0.875rem',
  color: '#6b7280'
};

const listingLocationStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.875rem',
  color: '#6b7280'
};

const sellerInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginTop: '1rem',
  paddingTop: '1rem',
  borderTop: '1px solid #e5e7eb'
};

const sellerAvatarStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  objectFit: 'cover'
};

const sellerNameStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#1f2937'
};

const ratingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  color: '#3b82f6'
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '2rem',
  color: '#9ca3af'
};

// Minimal listing types to decouple from external type import
interface ListingSeller { avatar?: string; name?: string; rating?: number }
interface ListingLocation { city?: string; country?: string }
interface ListingMetadata {
  image: string;
  title: string;
  price: string;
  currency: string;
  description?: string;
  type?: string;
  productDetails?: { condition?: string };
  serviceDetails?: { serviceType?: string };
  seller?: ListingSeller;
  location?: ListingLocation;
}
interface ListingNode { id: string; metadata: ListingMetadata }

interface ListingResultsProps {
  listings: ListingNode[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Displays a grid of marketplace listings with loading and error states
 * @param props - Component props
 * @param props.listings - Array of listing nodes to display
 * @param props.isLoading - Whether listings are currently loading
 * @param props.error - Error message if listing fetch failed
 * @returns React component showing listings grid or appropriate state
 */
export const ListingResults: React.FC<ListingResultsProps> = ({
  listings,
  isLoading,
  error,
}) => {
  if (isLoading) {
    return <OmniCoinLoading />;
  }

  if (typeof error === 'string' && error.length > 0) {
    return <OmniCoinToast type="error" message={error} />;
  }

  if (listings.length === 0) {
    return (
      <div style={emptyStateStyle}>
        <h3>No listings found</h3>
        <p>Try adjusting your search filters</p>
      </div>
    );
  }

  return (
    <div style={resultsContainerStyle}>
      <div style={gridStyle}>
        {listings.map((listing) => (
          <div key={listing.id} style={listingCardStyle}>
            <img
              src={listing.metadata.image}
              alt={listing.metadata.title}
              style={listingImageStyle}
            />
            <div style={listingContentStyle}>
              <h3 style={listingTitleStyle}>{listing.metadata.title}</h3>
              <div style={listingPriceStyle}>
                {listing.metadata.price} {listing.metadata.currency}
              </div>
              <div style={listingDetailsStyle}>
                <div>{listing.metadata.description}</div>
                {listing.metadata.type === 'product' && (
                  <div>Condition: {listing.metadata.productDetails?.condition}</div>
                )}
                {listing.metadata.type === 'service' && (
                  <div>Service Type: {listing.metadata.serviceDetails?.serviceType}</div>
                )}
              </div>
              <div style={listingLocationStyle}>
                📍 {listing.metadata.location?.city}, {listing.metadata.location?.country}
              </div>
              <div style={sellerInfoStyle}>
                <img
                  src={listing.metadata.seller?.avatar}
                  alt={listing.metadata.seller?.name}
                  style={sellerAvatarStyle}
                />
                <span style={sellerNameStyle}>{listing.metadata.seller?.name}</span>
                <div style={ratingStyle}>
                  ⭐ {listing.metadata.seller?.rating}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 
