"use client";

/**
 * Root layout ham ishlamay qolganda (juda kam). Global uslublar va tarjimalar yo'q —
 * shuning uchun matn ikki tilda va inline uslub bilan.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="uz">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f8fb", color: "#0f172a" }}>
        <title>Ish topdim</title>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Nimadir xato ketdi · Что-то пошло не так</h1>
          <p style={{ fontSize: 14, color: "#64748b", maxWidth: 360 }}>{"Sahifani qayta yuklang. Muammo takrorlansa, birozdan keyin urinib ko'ring."}</p>
          <button
            onClick={() => retry()}
            style={{ marginTop: 16, height: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#1d5fe0", color: "#fff", fontSize: 15, fontWeight: 600 }}
          >
            Qayta urinish · Повторить
          </button>
          {error.digest ? <p style={{ marginTop: 16, fontSize: 12, color: "#94a3b8" }}>{error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
