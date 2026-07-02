import { useState, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MapPin, Store, DollarSign, Clock, Tag, TrendingUp } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useAppColors } from '@/hooks/use-app-colors';

export type FilterTabKey = 'all' | 'boutiques' | 'plats' | 'produits';

export type FilterType = 'proches' | 'ouvertes' | 'prix' | 'rapide' | 'promo' | 'proche' | 'populaire' | 'pasCher';

const ALL_FILTER_TABS: { key: FilterTabKey; label: string; icon?: any }[] = [
  { key: 'all', label: 'Tout', icon: null },
  { key: 'boutiques', label: 'Boutiques' },
  { key: 'plats', label: 'Plats' },
  { key: 'produits', label: 'Produits' },
];

const FILTER_CONFIG: Record<FilterTabKey, FilterType[]> = {
  all: ['proche', 'pasCher', 'populaire'],
  boutiques: ['proche', 'ouvertes'],
  plats: ['prix', 'proche', 'rapide'],
  produits: ['prix', 'promo', 'proche'],
};

function getFilterIcon(type: FilterType): any {
  switch (type) {
    case 'proche':
      return MapPin;
    case 'ouvertes':
      return Store;
    case 'prix':
      return DollarSign;
    case 'rapide':
      return Clock;
    case 'promo':
      return Tag;
    case 'populaire':
      return TrendingUp;
    case 'pasCher':
      return DollarSign;
    default:
      return null;
  }
}

function getFilterLabel(type: FilterType): string {
  switch (type) {
    case 'proche':
      return 'Proche';
    case 'ouvertes':
      return 'Ouvertes';
    case 'prix':
      return 'Prix';
    case 'rapide':
      return 'Rapide';
    case 'promo':
      return 'Promo';
    case 'populaire':
      return 'Populaire';
    case 'pasCher':
      return 'Pas cher';
    default:
      return type;
  }
}

export interface DynamicFilterBarProps {
  activeTab: FilterTabKey;
  activeFilters: FilterType[];
  onFilterChange: (filters: FilterType[]) => void;
}

export function DynamicFilterBar({ activeTab, activeFilters, onFilterChange }: DynamicFilterBarProps) {
  const colors = useAppColors();
  const availableFilters = FILTER_CONFIG[activeTab];

  const toggleFilter = (filter: FilterType) => {
    const isActive = activeFilters.includes(filter);
    let newFilters: FilterType[];
    if (isActive) {
      newFilters = activeFilters.filter((f) => f !== filter);
    } else {
      newFilters = [...activeFilters, filter];
    }
    onFilterChange(newFilters);
  };

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.title, { color: colors.textSecondary }]}>
        {ALL_FILTER_TABS.find((t) => t.key === activeTab)?.label} Filters
      </ThemedText>
      <View style={styles.filterRow}>
        {availableFilters.map((filter) => {
          const isActive = activeFilters.includes(filter);
          const IconComponent = getFilterIcon(filter);
          return (
            <Pressable
              key={filter}
              style={[
                styles.filterButton,
                {
                  backgroundColor: isActive ? colors.primarySoft : colors.surface,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
              onPress={() => toggleFilter(filter)}
            >
              {IconComponent ? (
                <IconComponent
                  size={16}
                  color={isActive ? colors.primary : colors.textSecondary}
                  strokeWidth={2}
                />
              ) : null}
              <ThemedText
                style={[styles.filterText, { color: isActive ? colors.primary : colors.textSecondary }]}
              >
                {getFilterLabel(filter)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
});