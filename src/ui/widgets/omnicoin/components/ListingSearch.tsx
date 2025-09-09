/* @jsxImportSource react */
import React, { useState } from 'react';

// Minimal search filter type to avoid external type import
interface SearchFilters {
  type?: string;
  category?: string;
  priceRange?: { min?: number; max?: number };
  location?: { city?: string; country?: string };
  sortBy?: string;
  sortOrder?: string;
}

// Inline styles to avoid styled-components typing issues
const searchContainerStyle: React.CSSProperties = {
  padding: '1rem',
  background: '#ffffff',
  borderRadius: '8px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
};

const searchFormStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '1rem',
  marginBottom: '1rem'
};

const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#1f2937'
};

const inputStyle: React.CSSProperties = {
  padding: '0.5rem',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  fontSize: '0.875rem'
};

const selectStyle: React.CSSProperties = {
  padding: '0.5rem',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  fontSize: '0.875rem',
  background: 'white'
};

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'opacity 0.2s ease'
};

const buttonDisabledStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#9ca3af',
  cursor: 'not-allowed'
};

const filterTagsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  marginTop: '1rem'
};

const filterTagStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  background: '#f3f4f6',
  borderRadius: '4px',
  fontSize: '0.875rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem'
};

const removeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#6b7280',
  cursor: 'pointer',
  padding: '0',
  fontSize: '1rem'
};

interface ListingSearchProps {
    onSearch: (filters: SearchFilters) => void;
    isLoading: boolean;
}

/**
 * Search form component for filtering marketplace listings
 * @param props - Component props
 * @param props.onSearch - Callback function called when search is submitted
 * @param props.isLoading - Whether search is currently in progress
 * @returns React component with search form and active filters
 */
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
            if (typeof parent === 'string' && typeof child === 'string') {
                setFilters(prev => {
                    const parentValue = prev[parent as keyof SearchFilters];
                    const existingParentValue = typeof parentValue === 'object' && parentValue !== null 
                        ? parentValue as Record<string, unknown>
                        : {};
                    return {
                        ...prev,
                        [parent]: {
                            ...existingParentValue,
                            [child]: value.length > 0 ? Number(value) : undefined,
                        },
                    };
                });
            }
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
            if (typeof value === 'string' && value.length > 0) {
                newActiveFilters[key] = value;
            } else if (typeof value === 'object' && value !== null) {
                const valueObj = value as Record<string, unknown>;
                Object.entries(valueObj).forEach(([subKey, subValue]) => {
                    if (typeof subValue === 'string' && subValue.length > 0) {
                        newActiveFilters[`${key}.${subKey}`] = subValue;
                    } else if (typeof subValue === 'number') {
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
            if (typeof parent === 'string' && typeof child === 'string') {
                setFilters(prev => {
                    const parentValue = prev[parent as keyof SearchFilters];
                    const existingParentValue = typeof parentValue === 'object' && parentValue !== null 
                        ? parentValue as Record<string, unknown>
                        : {};
                    return {
                        ...prev,
                        [parent]: {
                            ...existingParentValue,
                            [child]: undefined,
                        },
                    };
                });
            }
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
        <div style={searchContainerStyle}>
            <form style={searchFormStyle} onSubmit={handleSubmit}>
                <div style={inputGroupStyle}>
                    <label style={labelStyle}>Type</label>
                    <select
                        name="type"
                        value={filters.type ?? ''}
                        onChange={handleInputChange}
                        style={selectStyle}
                    >
                        <option value="product">Product</option>
                        <option value="service">Service</option>
                    </select>
                </div>

                <div style={inputGroupStyle}>
                    <label style={labelStyle}>Category</label>
                    <input
                        type="text"
                        name="category"
                        value={filters.category ?? ''}
                        onChange={handleInputChange}
                        placeholder="Enter category"
                        style={inputStyle}
                    />
                </div>

                <div style={inputGroupStyle}>
                    <label style={labelStyle}>Price Range</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="number"
                            name="priceRange.min"
                            value={typeof filters.priceRange?.min === 'number' ? filters.priceRange.min.toString() : ''}
                            onChange={handleInputChange}
                            placeholder="Min"
                            style={inputStyle}
                        />
                        <input
                            type="number"
                            name="priceRange.max"
                            value={typeof filters.priceRange?.max === 'number' ? filters.priceRange.max.toString() : ''}
                            onChange={handleInputChange}
                            placeholder="Max"
                            style={inputStyle}
                        />
                    </div>
                </div>

                <div style={inputGroupStyle}>
                    <label style={labelStyle}>Location</label>
                    <input
                        type="text"
                        name="location.city"
                        value={filters.location?.city ?? ''}
                        onChange={handleInputChange}
                        placeholder="City"
                        style={inputStyle}
                    />
                </div>

                <div style={inputGroupStyle}>
                    <label style={labelStyle}>Sort By</label>
                    <select
                        name="sortBy"
                        value={filters.sortBy ?? ''}
                        onChange={handleInputChange}
                        style={selectStyle}
                    >
                        <option value="price">Price</option>
                        <option value="rating">Rating</option>
                        <option value="date">Date</option>
                        <option value="popularity">Popularity</option>
                    </select>
                </div>

                <div style={inputGroupStyle}>
                    <label style={labelStyle}>Order</label>
                    <select
                        name="sortOrder"
                        value={filters.sortOrder ?? ''}
                        onChange={handleInputChange}
                        style={selectStyle}
                    >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                </div>

                <button type="submit" disabled={isLoading} style={isLoading ? buttonDisabledStyle : buttonStyle}>
                    {isLoading ? 'Searching...' : 'Search'}
                </button>
            </form>

            {Object.keys(activeFilters).length > 0 && (
                <div style={filterTagsStyle}>
                    {Object.entries(activeFilters).map(([key, value]) => (
                        <span key={key} style={filterTagStyle}>
                            {key}: {value}
                            <button onClick={() => removeFilter(key)} style={removeButtonStyle}>×</button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};