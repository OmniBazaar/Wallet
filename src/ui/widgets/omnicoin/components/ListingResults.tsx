/* @jsxImportSource react */
import React from 'react';
import styled from 'styled-components';
import { OmniCoinLoading } from './OmniCoinLoading';
import { OmniCoinToast } from './OmniCoinToast';

const ResultsContainer = styled.div`
  padding: 1rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
`;

const ListingCard = styled.div`
  background: ${props => props.theme.colors.background};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-2px);
  }
`;

const ListingImage = styled.img`
  width: 100%;
  height: 200px;
  object-fit: cover;
`;

const ListingContent = styled.div`
  padding: 1rem;
`;

const ListingTitle = styled.h3`
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  color: ${props => props.theme.colors.text.primary};
`;

const ListingPrice = styled.div`
  font-size: 1.2rem;
  font-weight: bold;
  color: ${props => props.theme.colors.primary};
  margin-bottom: 0.5rem;
`;

const ListingDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
`;

const ListingLocation = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
`;

const SellerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid ${props => props.theme.colors.border};
`;

const SellerAvatar = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
`;

const SellerName = styled.span`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.primary};
`;

const Rating = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: ${props => props.theme.colors.primary};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: ${props => props.theme.colors.textSecondary};
`;

// Minimal listing types to decouple from external type import
interface ListingSeller { avatar?: string; name?: string; rating?: number }
interface ListingLocation { city?: string; country?: string }
interface ListingMetadata {
  image: string;
  title: string;
  price: string;
  currency: string;
  description?: string;
  type?: 'product' | 'service' | string;
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

export const ListingResults: React.FC<ListingResultsProps> = ({
  listings,
  isLoading,
  error,
}) => {
  if (isLoading) {
    return <OmniCoinLoading />;
  }

  if (error) {
    return <OmniCoinToast type="error" message={error} />;
  }

  if (listings.length === 0) {
    return (
      <EmptyState>
        <h3>No listings found</h3>
        <p>Try adjusting your search filters</p>
      </EmptyState>
    );
  }

  return (
    <ResultsContainer>
      <Grid>
        {listings.map((listing) => (
          <ListingCard key={listing.id}>
            <ListingImage
              src={listing.metadata.image}
              alt={listing.metadata.title}
            />
            <ListingContent>
              <ListingTitle>{listing.metadata.title}</ListingTitle>
              <ListingPrice>
                {listing.metadata.price} {listing.metadata.currency}
              </ListingPrice>
              <ListingDetails>
                <div>{listing.metadata.description}</div>
                {listing.metadata.type === 'product' && (
                  <div>Condition: {listing.metadata.productDetails?.condition}</div>
                )}
                {listing.metadata.type === 'service' && (
                  <div>Service Type: {listing.metadata.serviceDetails?.serviceType}</div>
                )}
              </ListingDetails>
              <ListingLocation>
                📍 {listing.metadata.location?.city}, {listing.metadata.location?.country}
              </ListingLocation>
              <SellerInfo>
                <SellerAvatar
                  src={listing.metadata.seller?.avatar}
                  alt={listing.metadata.seller?.name}
                />
                <SellerName>{listing.metadata.seller?.name}</SellerName>
                <Rating>
                  ⭐ {listing.metadata.seller?.rating}
                </Rating>
              </SellerInfo>
            </ListingContent>
          </ListingCard>
        ))}
      </Grid>
    </ResultsContainer>
  );
}; 
