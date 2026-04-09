/**
 * Flere annonsekontoer — deterministisk filtrering.
 */

export type AdAccount = {
  id: string;
  name: string;
  spend: number;
  budget: number;
  status: "active" | "paused";
};

export function getActiveAccounts(accounts: AdAccount[]): AdAccount[] {
  return accounts.filter((a) => a.status === "active");
}
