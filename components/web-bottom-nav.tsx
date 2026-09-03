import { useNavigation } from '@react-navigation/native';
import { useRouter } from '@/hooks/use-safe-router';
import { useCart } from '@/contexts/cart-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { useEffect, useRef, useCallback, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/**
 * Bottom navigation bar for MOBILE WEB ONLY.
 *
 * Renders a raw DOM element fixed at the bottom of the viewport, completely
 * outside React Navigation's internal layout tree. This bypasses all the
 * flex-chain / position:absolute / overflow:hidden issues that prevent the
 * normal GolivraTabBar from rendering on mobile web browsers.
 *
 * On native and desktop web this component is a no-op.
 */
const TABS = [
  { name: 'index', label: 'Accueil', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' },
  { name: 'explore', label: 'Commandes', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14h6"/><path d="M9 18h6"/><path d="M9 10h6"/></svg>' },
  { name: 'cart', label: 'Panier', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>' },
  { name: 'favorites', label: 'Favoris', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' },
  { name: 'profile', label: 'Compte', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
];

const CONTAINER_ID = '__golivra_web_nav__';

export function WebBottomNav() {
  const router = useRouter();
  const navigation = useNavigation();
  const { itemCount } = useCart();
  const colors = useAppColors();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const getCurrentTab = useCallback((): string => {
    const state = (navigation as any).getState?.();
    if (!state) return 'index';
    return state.routes[state.index]?.name ?? 'index';
  }, [navigation]);

  // Only show on mobile web (not desktop >= 768px)
  const { width } = useWindowDimensions();
  const isMobileWeb = Platform.OS === 'web' && width < 768;

  // Create the DOM element on mount, destroy on unmount
  useEffect(() => {
    if (!isMobileWeb) return;

    const el = document.createElement('div');
    el.id = CONTAINER_ID;
    document.body.appendChild(el);
    containerRef.current = el;

    return () => {
      el.remove();
      containerRef.current = null;
    };
  }, []);

  // Render into the portal
  useEffect(() => {
    if (!isMobileWeb || !containerRef.current) return;

    const render = () => {
      const el = containerRef.current;
      if (!el) return;

      const currentTab = getCurrentTab();
      const surface = colors.surface;
      const border = colors.border;
      const primary = colors.primary;
      const inactive = colors.tabInactive;
      const textColor = colors.text;

      el.innerHTML = `
        <style>
          #${CONTAINER_ID} {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 9999 !important;
            pointer-events: auto !important;
          }
          #${CONTAINER_ID} .web-nav-bar {
            display: flex;
            align-items: flex-start;
            justify-content: space-around;
            background: ${surface};
            border-top: 0.5px solid ${border};
            padding: 8px 4px 12px;
            margin: 0;
          }
          #${CONTAINER_ID} .web-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
            padding: 2px 0;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
            text-decoration: none;
            border: none;
            background: none;
          }
          #${CONTAINER_ID} .web-nav-item svg {
            color: ${inactive};
            width: 22px;
            height: 22px;
          }
          #${CONTAINER_ID} .web-nav-item.active svg {
            color: ${primary};
          }
          #${CONTAINER_ID} .web-nav-dot {
            width: 5px;
            height: 5px;
            border-radius: 3px;
            margin-top: 4px;
            background: transparent;
          }
          #${CONTAINER_ID} .web-nav-item.active .web-nav-dot {
            background: ${primary};
          }
          #${CONTAINER_ID} .web-nav-label {
            font-size: 10px;
            font-weight: 500;
            letter-spacing: -0.2px;
            margin-top: 2px;
            color: ${inactive};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          #${CONTAINER_ID} .web-nav-item.active .web-nav-label {
            color: ${primary};
          }
          #${CONTAINER_ID} .web-nav-badge {
            position: absolute;
            top: -4px;
            right: -8px;
            min-width: 16px;
            height: 16px;
            border-radius: 8px;
            background: ${colors.error};
            color: #FFF;
            font-size: 9px;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
        </style>
        <div class="web-nav-bar">
          ${TABS.map((tab) => {
            const active = currentTab === tab.name;
            const badge = tab.name === 'cart' && itemCount > 0
              ? `<span class="web-nav-badge">${itemCount > 99 ? '99+' : itemCount}</span>`
              : '';
            return `
              <button class="web-nav-item${active ? ' active' : ''}" data-tab="${tab.name}">
                <span style="position:relative;display:inline-flex">
                  ${tab.icon}
                  ${badge}
                </span>
                <span class="web-nav-dot"></span>
                <span class="web-nav-label">${tab.label}</span>
              </button>
            `;
          }).join('')}
        </div>
      `;

      // Attach click handlers
      el.querySelectorAll('.web-nav-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tabName = btn.getAttribute('data-tab');
          if (tabName) {
            const path = tabName === 'index' ? '/(tabs)' : `/(tabs)/${tabName}`;
            router.push(path as never);
          }
        });
      });
    };

    render();

    // Re-render when navigation state or cart changes
    const unsubscribe = navigation.addListener('state', render);
    return () => { unsubscribe(); };
  }, [navigation, getCurrentTab, router, colors, itemCount]);

  return null;
}
