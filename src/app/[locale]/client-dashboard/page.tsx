import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import LogoutButton from "@/components/LogoutButton";

export default async function ClientDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user?.email) redirect(`/${locale}/login`);
  const client = await adminDb.collection("clients").doc(user.uid).get();
  if (!client.exists) redirect(`/${locale}/login`);
  const snap = await adminDb
    .collection("bookings")
    .where("studentEmail", "==", user.email.toLowerCase())
    .get();
  const providers = await adminDb.collection("supervisors").get();
  const names = new Map(providers.docs.map((doc) => [doc.id, doc.data().name]));
  const bookings = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as any)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#F6F8FC",
        fontFamily: "IBM Plex Sans Arabic,Arial",
        color: "#001442",
      }}
    >
      <header
        style={{
          height: 68,
          background: "#fff",
          borderBottom: "1px solid #E8EDF5",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 6%",
        }}
      >
        <Link
          href={`/${locale}`}
          style={{
            fontWeight: 900,
            fontSize: 20,
            color: "#0D40FC",
            textDecoration: "none",
          }}
        >
          الواجهة الموحّدة للإشراف
        </Link>
        <LogoutButton locale={locale} />
      </header>
      <div style={{ maxWidth: 1050, margin: "auto", padding: "42px 20px" }}>
        <section
          style={{
            background: "linear-gradient(125deg,#001442,#0D40FC)",
            color: "#fff",
            borderRadius: 22,
            padding: "28px 30px",
            marginBottom: 20,
          }}
        >
          <p style={{ color: "#9FC0FF", fontSize: 12 }}>حساب المستفيد</p>
          <h1 style={{ margin: "5px 0" }}>مرحبًا، {client.data()?.name}</h1>
          <p style={{ color: "#D8E3FF" }}>
            تابع مقابلاتك واستشاراتك من مكان واحد.
          </p>
        </section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
            gap: 10,
          }}
        >
          <h2 style={{ fontSize: 18 }}>مواعيدي</h2>
          <Link
            href={`/${locale}#services`}
            style={{
              background: "#0D40FC",
              color: "#fff",
              padding: "9px 13px",
              borderRadius: 9,
              textDecoration: "none",
              fontSize: 12,
            }}
          >
            حجز موعد جديد
          </Link>
        </div>
        <section style={{ display: "grid", gap: 12 }}>
          {bookings.map((booking) => (
            <article
              key={booking.id}
              style={{
                background: "#fff",
                border: "1px solid #E4EAF3",
                borderRadius: 16,
                padding: 18,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 11,
                    color:
                      booking.bookingType === "consultation"
                        ? "#047857"
                        : "#0D40FC",
                    fontWeight: 700,
                  }}
                >
                  {booking.bookingType === "consultation"
                    ? "استشارة"
                    : "مقابلة أولية"}
                </span>
                <h3 style={{ margin: "5px 0" }}>
                  {names.get(booking.supervisorId) || "مقدم الخدمة"}
                </h3>
                <p style={{ fontSize: 12, color: "#64748B" }}>
                  {booking.date} · {booking.time}
                </p>
              </div>
              <div style={{ textAlign: "left" }}>
                <span
                  style={{
                    padding: "4px 9px",
                    borderRadius: 99,
                    background:
                      booking.status === "confirmed" ? "#ECFDF5" : "#F1F5F9",
                    color:
                      booking.status === "confirmed" ? "#047857" : "#64748B",
                    fontSize: 11,
                  }}
                >
                  {booking.status === "confirmed" ? "مؤكد" : booking.status}
                </span>
                {booking.meetLink && (
                  <a
                    href={booking.meetLink}
                    style={{
                      display: "block",
                      marginTop: 9,
                      color: "#0D40FC",
                      fontSize: 12,
                    }}
                  >
                    رابط الاجتماع
                  </a>
                )}
              </div>
            </article>
          ))}
          {!bookings.length && (
            <div
              style={{
                background: "#fff",
                padding: 35,
                textAlign: "center",
                borderRadius: 16,
                color: "#64748B",
              }}
            >
              لا توجد مواعيد حتى الآن.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
