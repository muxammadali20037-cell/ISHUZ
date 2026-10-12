import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Bell, Briefcase, Search } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  DialogTrigger,
  EmptyState,
  Input,
  RadioGroup,
  RadioItem,
  Select,
  Skeleton,
  Switch,
  Textarea,
} from "@/components/ui";
import { Field } from "@/components/ui/label";

/**
 * Brend UI to'plami — faqat ishlab chiquvchi uchun (docs/BRAND_UI_GUIDE.md). Foydalanuvchi menyusida yo'q, indekslanmaydi.
 * Production'da 404; lokal E2E stendida UI_KIT_PREVIEW=1 bilan ochiladi (skrinshot va a11y tekshiruvi uchun).
 */
export const metadata: Metadata = { title: "UI kit", robots: { index: false, follow: false } };

const COLORS = [
  ["primary", "bg-primary", "Yagona aksent: asosiy tugma, faol holat, havola"],
  ["primary-soft", "bg-primary-soft", "Aksent foni: ikonka plitasi, tanlangan qator"],
  ["foreground", "bg-foreground", "Asosiy matn"],
  ["muted-foreground", "bg-muted-foreground", "Ikkinchi darajali matn (AA ≥ 4.5:1)"],
  ["card", "bg-card", "Karta va forma sirti"],
  ["background", "bg-background", "Sahifa foni"],
  ["border", "bg-border", "Chegara va ajratgich"],
  ["success", "bg-success", "Faqat natija: saqlandi, joylandi, tasdiqlandi"],
  ["warning", "bg-warning", "Faqat ogohlantirish: muddat, chegirma, tekshiruv"],
  ["destructive", "bg-destructive", "Faqat xato va o'chirish"],
] as const;

const TYPE = [
  ["text-3xl font-extrabold", "30 · Sahifa sarlavhasi (h1)"],
  ["text-2xl font-bold", "24 · Bo'lim sarlavhasi"],
  ["text-xl font-semibold", "20 · Karta sarlavhasi"],
  ["text-lg", "18 · Katta matn / savol"],
  ["text-base", "16 · Asosiy matn"],
  ["text-md", "15 · Kiritish maydoni, ixcham matn"],
  ["text-sm", "14 · Izoh, yordamchi matn"],
  ["text-xs", "12 · Yorliq, navigatsiya"],
  ["text-2xs", "11 · Faqat hisoblagich va vaqt"],
] as const;

const RADII = [
  ["rounded-xs", "xs · 5"],
  ["rounded-sm", "sm · 8"],
  ["rounded-md", "md · 12"],
  ["rounded-lg", "lg · 14"],
  ["rounded-xl", "xl · 18"],
  ["rounded-2xl", "2xl · 24"],
  ["rounded-full", "full"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function UiKitPage() {
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.UI_KIT_PREVIEW !== "1") notFound();

  return (
    <main className="mx-auto max-w-4xl space-y-12 px-4 py-8 sm:px-6">
      <header>
        <p className="text-sm font-semibold text-primary">Ish topdim</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Brend UI to&apos;plami</h1>
        <p className="mt-1 text-muted-foreground">Tokenlar, shrift, radius va komponent holatlari. Qoidalar — docs/BRAND_UI_GUIDE.md.</p>
      </header>

      <Section id="colors" title="Ranglar">
        <ul className="grid gap-3 sm:grid-cols-2">
          {COLORS.map(([name, cls, use]) => (
            <li key={name} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span className={`size-11 shrink-0 rounded-xl border border-border ${cls}`} aria-hidden />
              <span>
                <code className="text-sm font-semibold">{name}</code>
                <span className="block text-sm text-muted-foreground">{use}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="type" title="Shrift: Manrope (lotin + kirill)">
        <ul className="space-y-2">
          {TYPE.map(([cls, label]) => (
            <li key={cls} className="flex flex-wrap items-baseline gap-x-4 border-b border-border pb-2">
              <span className={cls}>Ish topdim · Иш топдим</span>
              <span className="text-sm text-muted-foreground">{label}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="shape" title="Radius, soya, oraliq (4/8)">
        <div className="flex flex-wrap gap-4">
          {RADII.map(([cls, label]) => (
            <div key={cls} className="text-center">
              <div className={`size-16 border-2 border-primary bg-primary-soft ${cls}`} aria-hidden />
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-card p-4 shadow-sm">shadow-sm · karta</div>
          <div className="rounded-2xl bg-card p-4 shadow-md">shadow-md · ko&apos;tarilgan</div>
          <div className="rounded-2xl bg-card p-4 shadow-lg">shadow-lg · faqat qalqib chiquvchi</div>
        </div>
        <div className="flex items-end gap-2">
          {[1, 2, 3, 4, 6, 8, 12].map((n) => (
            <div key={n} className="text-center">
              <div className="bg-primary" style={{ width: n * 4, height: n * 4 }} aria-hidden />
              <p className="mt-1 text-2xs text-muted-foreground">{n * 4}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="buttons" title="Tugmalar">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Asosiy amal</Button>
          <Button variant="outline">Ikkinchi darajali</Button>
          <Button variant="soft">Yumshoq</Button>
          <Button variant="ghost">Matnli</Button>
          <Button variant="destructive-soft">O&apos;chirish</Button>
          <Button variant="link">Havola</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Kichik (barmoq maydoni 44)</Button>
          <Button>Odatiy 44</Button>
          <Button size="lg">Katta 52</Button>
          <Button size="icon" aria-label="Qidirish">
            <Search />
          </Button>
          <Button loading>Saqlanmoqda</Button>
          <Button disabled>O&apos;chiq</Button>
        </div>
        <p className="text-sm text-muted-foreground">Bir ekranda faqat bitta asosiy (to&apos;liq rangli) tugma. Qolganlari — outline yoki soft.</p>
      </Section>

      <Section id="inputs" title="Kiritish maydonlari">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ismingiz" htmlFor="kit-name" hint="Majburiy">
            <Input id="kit-name" placeholder="Masalan, Aziz" />
          </Field>
          <Field label="Telefon" htmlFor="kit-phone" error="Raqam to'liq emas: +998 va 9 ta raqam">
            <Input id="kit-phone" invalid defaultValue="+998 90 12" />
          </Field>
          <Field label="Viloyat" htmlFor="kit-region">
            <Select id="kit-region" placeholder="Tanlang" options={[{ value: "t", label: "Toshkent shahri" }, { value: "s", label: "Samarqand" }]} defaultValue="" />
          </Field>
          <Field label="O'chiq maydon" htmlFor="kit-disabled">
            <Input id="kit-disabled" disabled defaultValue="Tahrirlab bo'lmaydi" />
          </Field>
          <Field label="O'zingiz haqingizda" htmlFor="kit-about" className="sm:col-span-2">
            <Textarea id="kit-about" placeholder="Qisqacha yozing" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Checkbox id="kit-cb" label="Telefon raqamim ko'rinsin" defaultChecked />
            <label htmlFor="kit-sw" className="flex min-h-11 cursor-pointer items-center gap-3">
              <Switch id="kit-sw" defaultChecked />
              <span className="text-sm">Bildirishnomalar</span>
            </label>
          </div>
          <RadioGroup defaultValue="a" aria-label="Tajriba" className="grid gap-2">
            <RadioItem value="a" label="Tajribasiz" />
            <RadioItem value="b" label="1–3 yil" />
          </RadioGroup>
        </div>
      </Section>

      <Section id="chips" title="Chip va belgilar">
        <div className="flex flex-wrap gap-2">
          <Chip selected>Tanlangan</Chip>
          <Chip>Oddiy</Chip>
          <Chip size="sm">Kichik</Chip>
          <Chip disabled>O&apos;chiq</Chip>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Oddiy</Badge>
          <Badge variant="primary">Yangi</Badge>
          <Badge variant="success">Joylandi</Badge>
          <Badge variant="warning">Tekshiruvda</Badge>
          <Badge variant="destructive">Rad etildi</Badge>
          <Badge variant="outline">Yarim kun</Badge>
        </div>
      </Section>

      <Section id="cards" title="Karta, bo'sh holat, yuklanish, oyna">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Briefcase className="size-5" />
                </span>
                Buxgalter
              </CardTitle>
              <CardDescription>Toshkent shahri · 5–7 mln so&apos;m</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button size="sm">Qo&apos;ng&apos;iroq</Button>
              <Button size="sm" variant="outline">
                Batafsil
              </Button>
            </CardContent>
          </Card>
          <div role="status" className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-busy="true" aria-label="Yuklanmoqda">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
        <EmptyState icon={Bell} title="Hozircha bildirishnoma yo'q" description="Yangi taklif yoki xabar kelganda shu yerda ko'rinadi." />
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Oynani ochish</Button>
          </DialogTrigger>
          <DialogContent title="E'lonni o'chirasizmi?" description="Bu amalni qaytarib bo'lmaydi.">
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline">Bekor qilish</Button>
              <Button variant="destructive">O&apos;chirish</Button>
            </div>
          </DialogContent>
        </Dialog>
      </Section>
    </main>
  );
}
