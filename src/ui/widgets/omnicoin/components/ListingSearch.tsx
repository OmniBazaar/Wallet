import React, { useState } from 'react';
import styled from 'styled-components';
import { SearchFilters } from '../../../../../types/listing';
// import { OmniCoinLoading } from './OmniCoinLoading';
// import { OmniCoinToast } from './OmniCoinToast';

const SearchContainer = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.background};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const SearchForm = styled.form`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.primary};
`;

const Input = styled.input`
  padding: 0.5rem;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const Select = styled.select`
  padding: 0.5rem;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  font-size: 0.875rem;
  background: white;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background: ${props => props.theme.colors.disabled};
    cursor: not-allowed;
  }
`;

const FilterTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const FilterTag = styled.span`
  padding: 0.25rem 0.5rem;
  background: ${props => props.theme.colors.backgroundAlt};
  border-radius: 4px;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.text.secondary};
  cursor: pointer;
  padding: 0;
  font-size: 1rem;

  &:hover {
    color: ${props => props.theme.colors.text.primary};
  }
`;

interface ListingSearchProps {
    onSearch: (filters: SearchFilters) => void;
    isLoading: boolean;
}

export const ListingSearch: React.FC<ListingSearchProps> = ({ onSearch, isLoading }) => {
    const [filters, setFilters] = useState<SearchFilters>({
        type: 'product',
        sortBy: 'date',
        sortOrder: 'desc',
    });

    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
        const { name, value } = e.target;

        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFilters(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent as keyof SearchFilters],
                    [child]: value ? Number(value) : undefined,
                },
            }));
        } else {
            setFilters(prev => ({
                ...prev,
                [name]: value,
            }));
        }
    };

    const handleSubmit = (e: React.FormEvent): void => {
        e.preventDefault();
        onSearch(filters);
        updateActiveFilters();
    };

    const updateActiveFilters = (): void => {
        const newActiveFilters: Record<string, string> = {};
        Object.entries(filters).forEach(([key, value]) => {
            if (value && typeof value !== 'object') {
                newActiveFilters[key] = value.toString();
            } else if (value && typeof value === 'object') {
                Object.entries(value).forEach(([subKey, subValue]) => {
                    if (subValue) {
                        newActiveFilters[`${key}.${subKey}`] = subValue.toString();
                    }
                });
            }
        });
        setActiveFilters(newActiveFilters);
    };

    const removeFilter = (key: string): void => {
        if (key.includes('.')) {
            const [parent, child] = key.split('.');
            setFilters(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent as keyof SearchFilters],
                    [child]: undefined,
                },
            }));
        } else {
            setFilters(prev => {
                const newFilters = { ...prev };
                delete newFilters[key as keyof SearchFilters];
                return newFilters;
            });
        }

        setActiveFilters(prev => {
            const newFilters = { ...prev };
            delete newFilters[key];
            return newFilters;
        });
    };

    return (
        <SearchContainer>
            <SearchForm onSubmit={handleSubmit}>
                <InputGroup>
                    <Label>Type</Label>
                    <Select
                        name="type"
                        value={filters.type || ''}
                        onChange={handleInputChange}
                    >
                        <option value="product">Product</option>
                        <option value="service">Service</option>
                    </Select>
                </InputGroup>

                <InputGroup>
                    <Label>Category</Label>
                    <Input
                        type="text"
                        name="category"
                        value={filters.category || ''}
                        onChange={handleInputChange}
                        placeholder="Enter category"
                    />
                </InputGroup>

                <InputGroup>
                    <Label>Price Range</Label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Input
                            type="number"
                            name="priceRange.min"
                            value={filters.priceRange?.min || ''}
                            onChange={handleInputChange}
                            placeholder="Min"
                        />
                        <Input
                            type="number"
                            name="priceRange.max"
                            value={filters.priceRange?.max || ''}
                            onChange={handleInputChange}
                            placeholder="Max"
                        />
                    </div>
                </InputGroup>

                <InputGroup>
                    <Label>Location</Label>
                    <Input
                        type="text"
                        name="location.city"
                        value={filters.location?.city || ''}
                        onChange={handleInputChange}
                        placeholder="City"
                    />
                </InputGroup>

                <InputGroup>
                    <Label>Sort By</Label>
                    <Select
                        name="sortBy"
                        value={filters.sortBy || ''}
                        onChange={handleInputChange}
                    >
                        <option value="price">Price</option>
                        <option value="rating">Rating</option>
                        <option value="date">Date</option>
                        <option value="popularity">Popularity</option>
                    </Select>
                </InputGroup>

                <InputGroup>
                    <Label>Order</Label>
                    <Select
                        name="sortOrder"
                        value={filters.sortOrder || ''}
                        onChange={handleInputChange}
                    >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </Select>
                </InputGroup>

                <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Searching...' : 'Search'}
                </Button>
            </SearchForm>

            {Object.keys(activeFilters).length > 0 && (
                <FilterTags>
                    {Object.entries(activeFilters).map(([key, value]) => (
                        <FilterTag key={key}>
                            {key}: {value}
                            <RemoveButton onClick={() => removeFilter(key)}>×</RemoveButton>
                        </FilterTag>
                    ))}
                </FilterTags>
            )}
        </SearchContainer>
    );
}; 