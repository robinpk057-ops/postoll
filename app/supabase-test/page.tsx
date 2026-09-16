import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default async function SupabaseTestPage() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, created_at")
    .limit(10);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        color: "#fff",
        padding: "40px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          border: "1px solid #333",
          borderRadius: "16px",
          padding: "40px",
          background: "#050505",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            marginBottom: "20px",
          }}
        >
          Postoll × Supabase
        </h1>

        {error ? (
          <div>
            <h2 style={{ color: "#ff5555" }}>❌ Supabase Error</h2>

            <p style={{ marginTop: "12px" }}>
              {error.message}
            </p>
          </div>
        ) : (
          <div>
            <h2 style={{ color: "#4ade80" }}>
              ✅ Supabase Connected
            </h2>

            <p style={{ marginTop: "12px" }}>
              Successfully connected to the{" "}
              <strong>profiles</strong> table.
            </p>

            <p style={{ marginTop: "12px", color: "#aaa" }}>
              Rows returned: {data?.length ?? 0}
            </p>

            {data && data.length > 0 && (
              <pre
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  background: "#111",
                  borderRadius: "10px",
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(data, null, 2)}
              </pre>
            )}

            {data?.length === 0 && (
              <p
                style={{
                  marginTop: "20px",
                  color: "#aaa",
                }}
              >
                The table exists and is accessible, but there
                are currently no profile records.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}