import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { api, setAuthToken } from '../services/api';
import { useAuth } from '@clerk/clerk-expo';

export interface Business {
  id: string;
  name: string;
  gst_number: string | null;
  gst_enabled: boolean;
  state: string;
  subscription_plan?: string | null;
  subscription_status?: string | null;
  dual_address_enabled?: boolean;
  my_role?: 'OWNER' | 'STAFF' | 'CA' | string;
  my_preset?: string | null;
  my_permissions?: string[];
  invoice_scope?: string;
  access_paused?: boolean;
}

export interface StaffInvite {
  business_id: string;
  business_name: string;
  preset?: string;
  status?: string;
  invited_by_name?: string | null;
}

interface BusinessContextType {
  hasBusiness: boolean;
  setHasBusiness: (value: boolean) => void;
  business: Business | null;
  businesses: Business[];
  pendingInvite: StaffInvite | null;
  isLoading: boolean;
  isSwitching: boolean;
  refreshBusinesses: () => Promise<void>;
  switchBusiness: (businessId: string) => Promise<void>;
  canAddBusiness: boolean;
  maxBusinesses: number;
}

const PLAN_LIMITS: Record<string, number> = { saral: 2, vistaar: 6, basic: 1, pro: 1, premium: 2, enterprise: 6 };

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const [hasBusiness, setHasBusiness] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [pendingInvite, setPendingInvite] = useState<StaffInvite | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const refreshBusinesses = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      let meData: Business | null = null;
      let allData: Business[] = [];
      try {
        const [meRes, allRes] = await Promise.all([
          api.get('/businesses/me'),
          api.get('/businesses/all'),
        ]);
        meData = meRes.data;
        allData = Array.isArray(allRes.data) ? allRes.data : [];
      } catch (err: any) {
        if (err.response?.status === 404) {
          meData = null;
          allData = [];
        } else {
          console.log('Error fetching business in refreshBusinesses:', err);
        }
      }

      if (!meData) {
        setHasBusiness(false);
        setBusiness(null);
        setBusinesses([]);
        // Query pending staff invites when user has no active business
        try {
          const invitesRes = await api.get('/staff/my-invites');
          const invites = Array.isArray(invitesRes.data) ? invitesRes.data : [];
          if (invites.length > 0) {
            setPendingInvite(invites[0]);
          } else {
            setPendingInvite(null);
          }
        } catch (inviteErr) {
          console.log('Error fetching staff invites in refreshBusinesses:', inviteErr);
          setPendingInvite(null);
        }
      } else {
        setBusiness(meData);
        setBusinesses(allData);
        setHasBusiness(true);
        setPendingInvite(null);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setHasBusiness(false);
        setBusiness(null);
        setBusinesses([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  const switchBusiness = useCallback(async (businessId: string) => {
    setIsSwitching(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await api.post('/businesses/set-active', { business_id: businessId });
      await refreshBusinesses();
    } finally {
      setIsSwitching(false);
    }
  }, [getToken, refreshBusinesses]);

  // Reset state on sign out
  useEffect(() => {
    if (!isSignedIn) {
      setBusiness(null);
      setBusinesses([]);
      setHasBusiness(false);
      setPendingInvite(null);
    }
  }, [isSignedIn]);

  const status = business?.subscription_status || 'trial';
  const plan = business?.subscription_plan || 'basic';
  const maxBusinesses = status === 'trial' ? 1 : (PLAN_LIMITS[plan] || 1);
  const canAddBusiness = (Array.isArray(businesses) ? businesses.length : 0) < maxBusinesses;

  return (
    <BusinessContext.Provider value={{
      hasBusiness, setHasBusiness, business, businesses,
      pendingInvite,
      isLoading, isSwitching, refreshBusinesses, switchBusiness,
      canAddBusiness, maxBusinesses,
    }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) throw new Error('useBusiness must be used within BusinessProvider');
  return context;
}
