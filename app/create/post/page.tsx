"use client";

import { FormEvent, useState } from "react";

type PostPlan = {
  caption: string;
  hashtags: string[];
  imagePrompt: string;
};

export default function CreatePostPage() {
  const [topic, setTopic] = useState("");
  const [brandName, setBrandName] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Professional");
  const [language, setLanguage] = useState("English");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<PostPlan | null>(null);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setPlan(null);

    if (!topic.trim()) {
      setError("Please tell Postoll what you want to create.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "post",
          topic: topic.trim(),
          brandName: brandName.trim(),
          audience: audience.trim(),
          tone,
          language,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to generate the post.");
      }

      const generatedPlan = result?.plan ?? result;

      setPlan({
        caption: generatedPlan?.caption || "",
        hashtags: Array.isArray(generatedPlan?.hashtags)
          ? generatedPlan.hashtags
          : [],
        imagePrompt: generatedPlan?.imagePrompt || "",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while generating the post."
      );
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setTopic("");
    setBrandName("");
    setAudience("");
    setTone("Professional");
    setLanguage("English");
    setPlan(null);
    setError("");
  }

  return (
    <div
      style={{
        minHeight: "100%",
        padding: "40px 24px 80px",
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              color: "var(--muted-foreground)",
              marginBottom: "8px",
            }}
          >
            Create / Post
          </div>

          <h1
            style={{
              fontSize: "36px",
              lineHeight: 1.2,
              fontWeight: 700,
              margin: 0,
              marginBottom: "10px",
            }}
          >
            Create a post
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: "16px",
              color: "var(--muted-foreground)",
            }}
          >
            Tell Postoll what you want to create and let AI build the post
            plan.
          </p>
        </div>

        <form onSubmit={handleGenerate}>
          {/* Main card */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "18px",
              background: "var(--card)",
              overflow: "hidden",
            }}
          >
            {/* What to create */}
            <section
              style={{
                padding: "28px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  marginBottom: "8px",
                  fontSize: "20px",
                  fontWeight: 600,
                }}
              >
                What do you want to create?
              </h2>

              <p
                style={{
                  margin: 0,
                  marginBottom: "18px",
                  fontSize: "14px",
                  color: "var(--muted-foreground)",
                }}
              >
                Describe the post in your own words. Postoll will turn it into
                a social media-ready concept.
              </p>

              <textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Example: Create an Instagram post about saving water. Make it engaging and suitable for young people."
                rows={6}
                style={{
                  width: "100%",
                  resize: "vertical",
                  boxSizing: "border-box",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--background)",
                  color: "var(--foreground)",
                  outline: "none",
                  fontSize: "15px",
                  lineHeight: 1.6,
                }}
              />
            </section>

            {/* Brand information */}
            <section
              style={{
                padding: "28px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  marginBottom: "8px",
                  fontSize: "20px",
                  fontWeight: 600,
                }}
              >
                Brand information
              </h2>

              <p
                style={{
                  margin: 0,
                  marginBottom: "20px",
                  fontSize: "14px",
                  color: "var(--muted-foreground)",
                }}
              >
                Optional information that helps Postoll create a better post.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                  gap: "18px",
                }}
              >
                <div>
                  <label
                    htmlFor="brandName"
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "8px",
                    }}
                  >
                    Brand name
                  </label>

                  <input
                    id="brandName"
                    type="text"
                    value={brandName}
                    onChange={(event) => setBrandName(event.target.value)}
                    placeholder="Example: Postoll"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      outline: "none",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="audience"
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "8px",
                    }}
                  >
                    Target audience
                  </label>

                  <input
                    id="audience"
                    type="text"
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                    placeholder="Example: Young adults"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      outline: "none",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Style */}
            <section
              style={{
                padding: "28px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  marginBottom: "20px",
                  fontSize: "20px",
                  fontWeight: 600,
                }}
              >
                Style
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "18px",
                }}
              >
                <div>
                  <label
                    htmlFor="tone"
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "8px",
                    }}
                  >
                    Tone
                  </label>

                  <select
                    id="tone"
                    value={tone}
                    onChange={(event) => setTone(event.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      outline: "none",
                      fontSize: "14px",
                    }}
                  >
                    <option value="Professional">Professional</option>
                    <option value="Friendly">Friendly</option>
                    <option value="Casual">Casual</option>
                    <option value="Inspirational">Inspirational</option>
                    <option value="Funny">Funny</option>
                    <option value="Bold">Bold</option>
                    <option value="Luxury">Luxury</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="language"
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "8px",
                    }}
                  >
                    Language
                  </label>

                  <select
                    id="language"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      outline: "none",
                      fontSize: "14px",
                    }}
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Malayalam">Malayalam</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Kannada">Kannada</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Error */}
            {error && (
              <div
                style={{
                  margin: "24px 28px 0",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "1px solid #5c2020",
                  background: "#250d0d",
                  color: "#ff8f8f",
                  fontSize: "14px",
                }}
              >
                {error}
              </div>
            )}

            {/* Actions */}
            <div
              style={{
                padding: "24px 28px",
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={clearForm}
                disabled={loading}
                style={{
                  padding: "12px 20px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--foreground)",
                  fontWeight: 500,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                Clear
              </button>

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "12px 24px",
                  borderRadius: "10px",
                  border: "none",
                  background: "var(--foreground)",
                  color: "var(--background)",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "Generating..." : "✨ Generate post"}
              </button>
            </div>
          </div>
        </form>

        {/* Generated result */}
        {plan && (
          <div
            style={{
              marginTop: "28px",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              background: "var(--card)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "24px 28px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--muted-foreground)",
                  marginBottom: "6px",
                }}
              >
                AI-generated plan
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: "24px",
                  fontWeight: 600,
                }}
              >
                Your post is ready
              </h2>
            </div>

            {/* Caption */}
            <div
              style={{
                padding: "24px 28px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  marginBottom: "10px",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
              >
                Caption
              </h3>

              <div
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.7,
                  fontSize: "15px",
                  color: "var(--foreground)",
                }}
              >
                {plan.caption || "No caption was generated."}
              </div>
            </div>

            {/* Hashtags */}
            <div
              style={{
                padding: "24px 28px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  marginBottom: "12px",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
              >
                Hashtags
              </h3>

              {plan.hashtags.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  {plan.hashtags.map((hashtag, index) => {
                    const formattedHashtag = hashtag.startsWith("#")
                      ? hashtag
                      : `#${hashtag}`;

                    return (
                      <span
                        key={`${formattedHashtag}-${index}`}
                        style={{
                          padding: "7px 11px",
                          borderRadius: "999px",
                          border: "1px solid var(--border)",
                          background: "var(--background)",
                          fontSize: "13px",
                        }}
                      >
                        {formattedHashtag}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p
                  style={{
                    margin: 0,
                    color: "var(--muted-foreground)",
                    fontSize: "14px",
                  }}
                >
                  No hashtags were generated.
                </p>
              )}
            </div>

            {/* Image prompt */}
            <div
              style={{
                padding: "24px 28px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  marginBottom: "10px",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
              >
                Image generation prompt
              </h3>

              <div
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "var(--background)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  color: "var(--muted-foreground)",
                }}
              >
                {plan.imagePrompt || "No image prompt was generated."}
              </div>
            </div>

            {/* Next step */}
            <div
              style={{
                margin: "0 28px 28px",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "var(--background)",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              <strong>Next step:</strong> Review this plan before we generate
              the actual image. Later, we can connect this step to the image
              generation system.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}