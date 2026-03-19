/**
 * LUNCHPORTALEN — Icon system (single source).
 * Primary family: lucide-react. Do not mix other icon libraries in app code.
 * Consumed only by lib/iconRegistry.tsx. UI uses Icon from @/components/ui/Icon (semantic names).
 */

import type { LucideProps } from "lucide-react";
import {
  AlertTriangle,
  BarChart2,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  Crop,
  FileText,
  Folder,
  Globe,
  Home,
  Image,
  Info,
  Languages,
  LayoutGrid,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Menu,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  Truck,
  User,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";

const defaultSize = 24;

function withDefaults(Icon: React.ComponentType<LucideProps>, name: string) {
  const Wrapped = (props: LucideProps) => (
    <Icon size={defaultSize} strokeWidth={2} {...props} />
  );
  Wrapped.displayName = name;
  return Wrapped;
}

// Canonical set; only iconRegistry and Icon component use these
export const IconContent = withDefaults(FileText, "IconContent");
export const IconMedia = withDefaults(Image, "IconMedia");
export const IconTemplate = withDefaults(LayoutGrid, "IconTemplate");
export const IconUsers = withDefaults(Users, "IconUsers");
export const IconMember = withDefaults(User, "IconMember");
export const IconForm = withDefaults(FileText, "IconForm");
export const IconTranslation = withDefaults(Languages, "IconTranslation");
export const IconSettings = withDefaults(Settings, "IconSettings");
export const IconReleases = withDefaults(Clock, "IconReleases");
export const IconRecycle = withDefaults(Trash2, "IconRecycle");
export const IconHome = withDefaults(Home, "IconHome");
export const IconFolder = withDefaults(Folder, "IconFolder");
export const IconChevronRight = withDefaults(ChevronRight, "IconChevronRight");
export const IconChevronUp = withDefaults(ChevronUp, "IconChevronUp");
export const IconChevronDown = withDefaults(ChevronDown, "IconChevronDown");
export const IconCheck = withDefaults(Check, "IconCheck");
export const IconWarning = withDefaults(AlertTriangle, "IconWarning");
export const IconLoader = withDefaults(Loader2, "IconLoader");
export const IconSparkles = withDefaults(Sparkles, "IconSparkles");
export const IconX = withDefaults(X, "IconX");
export const IconPlus = withDefaults(Plus, "IconPlus");
export const IconImage = withDefaults(Image, "IconImage");

// Public / driver / shared
export const IconClock = withDefaults(Clock, "IconClock");
export const IconShield = withDefaults(Shield, "IconShield");
export const IconMenu = withDefaults(Menu, "IconMenu");
export const IconLock = withDefaults(Lock, "IconLock");
export const IconGlobe = withDefaults(Globe, "IconGlobe");
export const IconLogOut = withDefaults(LogOut, "IconLogOut");
export const IconRefreshCw = withDefaults(RefreshCw, "IconRefreshCw");
export const IconCrop = withDefaults(Crop, "IconCrop");

// Semantic registry icons (used via iconRegistry)
export const IconEdit = withDefaults(Pencil, "IconEdit");
export const IconSearch = withDefaults(Search, "IconSearch");
export const IconCompany = withDefaults(Building2, "IconCompany");
export const IconLocation = withDefaults(MapPin, "IconLocation");
export const IconKitchen = withDefaults(UtensilsCrossed, "IconKitchen");
export const IconDriver = withDefaults(Truck, "IconDriver");
export const IconOrder = withDefaults(ClipboardList, "IconOrder");
export const IconInvoice = withDefaults(Receipt, "IconInvoice");
export const IconSeo = withDefaults(BarChart2, "IconSeo");
export const IconInfo = withDefaults(Info, "IconInfo");
