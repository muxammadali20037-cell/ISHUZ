"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/misc";
import type { CompanyInviteRow, CompanyMemberRole, CompanyRow, MemberRow, VerificationRequestRow } from "../../types";
import type { ReferenceLists } from "../ref-types";
import { CompanyInfoTab } from "./company-info-tab";
import { MembersTab } from "./members-tab";
import { VerificationTab } from "./verification-tab";

type TabKey = "info" | "members" | "verification";
const TABS: TabKey[] = ["info", "members", "verification"];

function tabFromHash(): TabKey | null {
  const h = window.location.hash.replace("#", "");
  return (TABS as string[]).includes(h) ? (h as TabKey) : null;
}

/** /company/settings (kompaniya bor): Ma'lumotlar / A'zolar / Tasdiqlash. #verification hash → tab */
export function CompanySettings({
  userId,
  company,
  myRole,
  members,
  invites,
  requests,
  refs,
}: {
  userId: string;
  company: CompanyRow;
  myRole: CompanyMemberRole | null;
  members: MemberRow[];
  invites: CompanyInviteRow[];
  requests: VerificationRequestRow[];
  refs: ReferenceLists;
}) {
  const { t } = useT();
  const [tab, setTab] = useState<TabKey>("info");
  const isAdmin = myRole === "owner" || myRole === "admin";

  useEffect(() => {
    const apply = () => {
      const next = tabFromHash();
      if (next) setTab(next);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  return (
    <div className="container-narrow py-6">
      <PageHeader title={t("employer.settings.title")} subtitle={company.name} backHref="/employer" />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as TabKey);
          window.history.replaceState(null, "", `#${v}`);
        }}
      >
        <TabsList>
          <TabsTrigger value="info">{t("employer.settings.tab_info")}</TabsTrigger>
          <TabsTrigger value="members">{t("employer.settings.tab_members")}</TabsTrigger>
          <TabsTrigger value="verification">{t("employer.settings.tab_verification")}</TabsTrigger>
        </TabsList>
        <TabsContent value="info">
          <CompanyInfoTab company={company} myRole={myRole} refs={refs} />
        </TabsContent>
        <TabsContent value="members">
          <MembersTab companyId={company.id} userId={userId} myRole={myRole} members={members} invites={invites} />
        </TabsContent>
        <TabsContent value="verification">
          <VerificationTab userId={userId} companyId={company.id} status={company.verification_status} requests={requests} canSubmit={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
