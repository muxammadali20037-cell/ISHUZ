import { LegalPage, legalMetadata } from "@/features/legal/legal-page";

export const generateMetadata = () => legalMetadata("cookies");

/** /cookies — cookie fayllari va brauzer xotirasi siyosati (ochiq; footer va cookie eslatmasidan havola) */
export default function CookiesPage() {
  return <LegalPage doc="cookies" />;
}
