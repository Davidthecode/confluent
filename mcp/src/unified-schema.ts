export type ContactType = "CUSTOMER" | "VENDOR";

export interface UnifiedContactCreation {
  name: string;
  email?: string | null;
  type: ContactType;
}

export interface UnifiedContact {
  id: string;
  name: string;
  email: string | null;
  type: ContactType;
  balance: number;
}

export interface FinancialSummary {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  currency: string;
}