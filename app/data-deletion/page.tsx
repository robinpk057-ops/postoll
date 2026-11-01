import Link from "next/link";

export default function DataDeletionPage() {
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
          <Link href="/privacy" style={{ color: "#a3a3a3", textDecoration: "none", fontSize: 14 }}>
            Privacy Policy
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 80px" }}>
        <p style={{ color: "#a3a3a3", fontSize: 13, marginBottom: 12, letterSpacing: "0.04em" }}>
          LEGAL
        </p>
        <h1 style={{ fontSize: 36, fontWeight: 650, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
          User Data Deletion
        </h1>
        <p style={{ color: "#a3a3a3", marginBottom: 40 }}>
          Last updated: November 1, 2026
        </p>

        <p style={{ lineHeight: 1.7, color: "#d4d4d4", marginBottom: 28 }}>
          This page explains how to remove social connections and request deletion of your Postoll
          account data. These instructions also satisfy Meta’s user data deletion requirements for
          apps that connect Facebook or Instagram accounts.
        </p>

        <Section title="1. Disconnect a social account">
          <p>To stop Postoll from accessing a connected platform:</p>
          <ol style={{ paddingLeft: 20, marginTop: 12 }}>
            <li style={{ marginBottom: 8 }}>Sign in to Postoll</li>
            <li style={{ marginBottom: 8 }}>Open <strong>Accounts</strong></li>
            <li style={{ marginBottom: 8 }}>
              Find Facebook, Instagram, or another connected account
            </li>
            <li style={{ marginBottom: 8 }}>Click <strong>Disconnect</strong></li>
          </ol>
          <p style={{ marginTop: 12 }}>
            This removes the stored access token for that account from our systems. Postoll will no
            longer be able to publish to that account until you connect it again.
          </p>
        </Section>

        <Section title="2. Remove Postoll from Facebook or Instagram">
          <p>
            You can also revoke access from Meta’s side (Facebook Settings → Apps and websites, or
            the equivalent Instagram/Facebook linked-apps controls). After revocation, any remaining
            tokens we hold will fail and should be cleared when you disconnect in Postoll or request
            full deletion.
          </p>
        </Section>

        <Section title="3. Request full account and data deletion">
          <p>To delete your Postoll account and associated personal data:</p>
          <ol style={{ paddingLeft: 20, marginTop: 12 }}>
            <li style={{ marginBottom: 8 }}>
              Email{" "}
              <a href="mailto:robinpk057@gmail.com" style={{ color: "#fff" }}>
                robinpk057@gmail.com
              </a>
            </li>
            <li style={{ marginBottom: 8 }}>
              Use the subject line: <strong>Data deletion request</strong>
            </li>
            <li style={{ marginBottom: 8 }}>
              Send the request from the same email address registered on your Postoll account
            </li>
          </ol>
          <p style={{ marginTop: 12 }}>
            We will delete or anonymize account data, social connection tokens, and related content
            metadata associated with your account within a reasonable period, except where we are
            required to retain certain records by law (for example, limited security or billing
            logs).
          </p>
        </Section>

        <Section title="4. What is deleted">
          <ul>
            <li>Account profile information tied to your login</li>
            <li>Stored social access tokens and connected account records</li>
            <li>Workflows, schedules, and content metadata linked to your account</li>
            <li>Uploaded media associated with your account, where still stored by us</li>
          </ul>
        </Section>

        <Section title="5. Contact">
          <p>
            Questions about deletion or privacy:
            <br />
            <a href="mailto:robinpk057@gmail.com" style={{ color: "#fff" }}>
              robinpk057@gmail.com
            </a>
          </p>
          <p style={{ marginTop: 12 }}>
            See also our{" "}
            <Link href="/privacy" style={{ color: "#fff" }}>
              Privacy Policy
            </Link>
            .
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