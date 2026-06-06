import { Redirect } from 'expo-router';

/** Marketplace fusionné dans Explorer — redirection vers l'accueil. */
export default function MarketplaceRedirect() {
  return <Redirect href="/(tabs)" />;
}
