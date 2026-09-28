import { LegalPage, legalMetadata } from "@/features/legal/legal-page";

export const generateMetadata = () => legalMetadata("deletion");

export default function AccountDeletionPage() {
  return <LegalPage doc="deletion" />;
}
