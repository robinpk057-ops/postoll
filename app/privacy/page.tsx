import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#f5f5f5",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid #222",
          padding: "16px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Link href="/" style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}>
            Postoll
          </Link>
          <Link href="/data-deletion" style={{ color: "#a3a3a3", textDecoration: "none", fontSize: 14 }}>
            Data deletion
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 80px" }}>
        <p style={{ color: "#a3a3a3", fontSize: 13, marginBottom: 12, letterSpacing: "0.04em" }}>
          LEGAL
        </p>
        <h1 style={{ fontSize: 36, fontWeight: 650, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
          Privacy Policy
        </h1>
        <p style={{ color: "#a3a3a3", marginBottom: 40 }}>
          Last updated: November 1, 2026
        </p>

        <p style={{ lineHeight: 1.7, color: "#d4d4d4", marginBottom: 28 }}>
          Postoll (“Postoll”, “we”, “us”, or “our”) provides tools that help users schedule and
          publish content to social media platforms they connect. This Privacy Policy explains what
          information we collect, how we use it, and the choices available to you.
        </p>

        <Section title="1. Information we collect">
          <ul>
            <li>
              <strong>Account information</strong> — such as email address and name when you create
              an account.
            </li>
            <li>
              <strong>Social account connections</strong> — when you connect Facebook, Instagram, or
              other platforms, we receive identifiers and access tokens required to publish on your
              behalf.
            </li>
            <li>
              <strong>Content you provide</strong> — media files, captions, hashtags, schedules, and
              workflow settings you upload or configure.
            </li>
            <li>
              <strong>Technical data</strong> — limited logs and diagnostics needed to operate,
              secure, and improve the service.
            </li>
          </ul>
        </Section>

        <Section title="2. How we use information">
          <ul>
            <li>To provide, maintain, and improve the Postoll service</li>
            <li>To authenticate you and manage your account</li>
            <li>To connect social accounts and publish content according to your schedules</li>
            <li>To communicate service-related notices and respond to support requests</li>
            <li>To protect against abuse, fraud, and security incidents</li>
          </ul>
        </Section>

        <Section title="3. How we share information">
          <p>
            We share information with third parties only as needed to operate the service, including:
          </p>
          <ul>
            <li>
              <strong>Meta (Facebook &amp; Instagram)</strong> — to connect accounts and publish
              content you authorize
            </li>
            <li>
              <strong>Infrastructure providers</strong> — hosting, database, and storage vendors
              that process data on our behalf
            </li>
          </ul>
          <p style={{ marginTop: 12 }}>
            We do not sell your personal information.
          </p>
        </Section>

        <Section title="4. Data retention">
          <p>
            We retain account, connection, and content data for as long as your account remains
            active or as needed to provide the service. You may disconnect social accounts at any
            time. You may request account deletion as described below.
          </p>
        </Section>

        <Section title="5. Security">
          <p>
            We use industry-standard measures to protect access tokens and account data. Publishing
            credentials are stored on our servers and are not exposed to the browser for publishing
            operations. No method of transmission or storage is completely secure.
          </p>
        </Section>

        <Section title="6. Your choices">
          <ul>
            <li>Disconnect social accounts from the Accounts page in Postoll</li>
            <li>Request access, correction, or deletion of your account data by contacting us</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            For detailed deletion instructions, see our{" "}
            <Link href="/data-deletion" style={{ color: "#fff" }}>
              User Data Deletion
            </Link>{" "}
            page.
          </p>
        </Section>

        <Section title="7. International users">
          <p>
            We may process information in countries other than where you live. Where required by
            law, we take appropriate steps to protect personal data transferred internationally.
          </p>
        </Section>

        <Section title="8. Children’s privacy">
          <p>
            Postoll is not directed to children under 13 (or the minimum age required in your
            jurisdiction). We do not knowingly collect personal information from children.
          </p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>
            We may update this Privacy Policy from time to time. The “Last updated” date at the top
            will change when we do. Continued use of the service after an update constitutes
            acceptance of the revised policy where permitted by law.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            Questions about this Privacy Policy or your data:
            <br />
            <a href="mailto:robinpk057@gmail.com" style={{ color: "#fff" }}>
              robinpk057@gmail.com
            </a>
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 12,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      <div style={{ lineHeight: 1.75, color: "#d4d4d4", fontSize: 15 }}>{children}</div>
    </section>
  );
}