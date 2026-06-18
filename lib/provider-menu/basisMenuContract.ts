// lib/provider-menu/basisMenuContract.ts
// Back-compat re-exports — use providerMenuTierContract.ts for tier contract.

export {
  MENU_TIER_CONTRACT_SOURCE as BASIS_MENU_CONTRACT_SOURCE,
  BASIS_WORKSPACE_CATEGORIES as PROVIDER_BASIS_WORKSPACE_CATEGORIES,
  CATEGORY_VARIANT_CONTRACT,
  ENTERPRISE_TIER_MODEL,
  ENTERPRISE_WORKSPACE_CATEGORIES,
  LUXUS_WORKSPACE_CATEGORIES,
  PROVIDER_MENU_CATEGORY_CONTRACTS,
  contractForCategory,
  fixedVariantsForCategory,
  isSanityDrivenCategory,
  tierIncludesCategory,
  workspaceCategoriesForTier,
  type FixedMenuVariant,
  type ProviderMenuCategoryContract,
  type ProviderMenuTier,
} from "@/lib/provider-menu/providerMenuTierContract";
