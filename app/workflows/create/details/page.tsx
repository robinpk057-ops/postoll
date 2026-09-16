"use client";

import { useRouter } from "next/navigation";
import AppShell from "../../../AppShell";
import { useWorkflow } from "../context";



const formats = [
  "Post",
  "Reel",
];



const styles = [
  "Luxury",
  "Educational",
  "Information",
  "Funny",
  "Motivational",
  "Professional",
  "Storytelling",
  "Product Showcase",
];



const voiceTones = [
  "Friendly",
  "Professional",
  "Energetic",
  "Calm",
  "Confident",
  "Warm",
  "Authoritative",
  "Inspirational",
  "Conversational",
];



const characterGenders = [
  "Male",
  "Female",
];



const characterAges = [
  "18–25",
  "26–35",
  "36–45",
  "46–55",
  "56+",
];



const countries = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Brazil",
  "Mexico",
  "Japan",
  "South Korea",
  "Singapore",
  "United Arab Emirates",
  "Saudi Arabia",
  "South Africa",
];



export default function DetailsPage() {

  const router = useRouter();



  const {
    workflow,
    updateWorkflow,
  } = useWorkflow();





  /*
  |--------------------------------------------------------------------------
  | CONTENT TYPE
  |--------------------------------------------------------------------------
  */

  function toggleFormat(
    value: string
  ) {

    const current =
      workflow.formats || [];



    const updated =
      current.includes(value)
        ? current.filter(
            item => item !== value
          )
        : [
            ...current,
            value,
          ];



    updateWorkflow({

      formats: updated,

      enablePost:
        updated.includes("Post"),

      enableReel:
        updated.includes("Reel"),

    });

  }





  /*
  |--------------------------------------------------------------------------
  | VISUAL STYLE
  |--------------------------------------------------------------------------
  */

  function toggleStyle(
    value: string
  ) {

    const current =
      workflow.styles || [];



    updateWorkflow({

      styles:
        current.includes(value)
          ? current.filter(
              item => item !== value
            )
          : [
              ...current,
              value,
            ],

    });

  }





  /*
  |--------------------------------------------------------------------------
  | TARGET COUNTRIES
  |--------------------------------------------------------------------------
  */

  function toggleCountry(
    country: string
  ) {

    const current =
      workflow.targetCountries || [];



    updateWorkflow({

      targetCountries:
        current.includes(country)
          ? current.filter(
              item => item !== country
            )
          : [
              ...current,
              country,
            ],

    });

  }





  /*
  |--------------------------------------------------------------------------
  | LOGO TOGGLE
  |--------------------------------------------------------------------------
  */

  function handleLogoToggle(
    enabled: boolean
  ) {

    updateWorkflow({

      showLogo: enabled,

      logoFile:
        enabled
          ? workflow.logoFile
          : null,

    });

  }





  /*
  |--------------------------------------------------------------------------
  | LOGO UPLOAD
  |--------------------------------------------------------------------------
  */

  function handleLogoUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {

    const file =
      event.target.files?.[0];



    if (!file) {
      return;
    }



    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];



    if (
      !allowedTypes.includes(
        file.type
      )
    ) {

      alert(
        "Please upload a PNG, JPG, JPEG, or WebP image."
      );

      event.target.value = "";

      return;

    }



    updateWorkflow({

      showLogo: true,

      logoFile: file,

    });

  }





  /*
  |--------------------------------------------------------------------------
  | BRAND / PAGE NAME TOGGLE
  |--------------------------------------------------------------------------
  */

  function handleBrandNameToggle(
    enabled: boolean
  ) {

    updateWorkflow({

      showPageName:
        enabled,

    });

  }





  /*
  |--------------------------------------------------------------------------
  | CONTINUE
  |--------------------------------------------------------------------------
  |
  | ONLY TWO THINGS ARE REQUIRED:
  |
  | 1. Content description
  | 2. At least one content format
  |
  | Everything else is optional.
  |
  */

  function continueNext() {

    if (
      !workflow.contentDescription.trim()
    ) {

      return;

    }



    if (
      (workflow.formats || []).length === 0
    ) {

      return;

    }



    router.push(
      "/workflows/create/schedule"
    );

  }





  /*
  |--------------------------------------------------------------------------
  | CONTINUE BUTTON STATE
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | Do NOT check logo, brand name, voice,
  | character, style, music, countries, etc.
  |
  */

  const canContinue =
    workflow.contentDescription.trim().length > 0 &&
    (workflow.formats || []).length > 0;





  return (

    <AppShell>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 md:px-10 md:py-12">



        {/* HEADER */}

        <div className="mb-8 md:mb-10">

          <p
            className="text-sm font-medium"
            style={{
              color: "#a78bfa",
            }}
          >
            ✦ AI Content Setup
          </p>



          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Tell Postoll what to create
          </h1>



          <p
            className="mt-3 max-w-2xl text-sm"
            style={{
              color: "var(--muted)",
            }}
          >
            Postoll will create fresh and different
            posts and reels based on your requirements.
          </p>

        </div>





        {/* MAIN CARD */}

        <div
          className="space-y-8 rounded-2xl border p-5 sm:p-6 md:space-y-10 md:p-8"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >



          {/* CONTENT DESCRIPTION */}

          <div>

            <label className="text-sm font-medium">

              What content should Postoll create?

              <span
                className="ml-1"
                style={{
                  color: "#ef4444",
                }}
              >
                *
              </span>

            </label>



            <textarea

              value={
                workflow.contentDescription || ""
              }

              onChange={(e) =>
                updateWorkflow({

                  contentDescription:
                    e.target.value,

                })
              }

              placeholder="Example: Create luxury watch marketing content for Instagram. Focus on premium lifestyle, product benefits, trust, and modern luxury."

              className="mt-3 min-h-[140px] w-full rounded-xl border p-4 outline-none transition focus:ring-2 focus:ring-purple-500/20"

              style={{
                background:
                  "var(--background)",

                borderColor:
                  "var(--border)",
              }}

            />

          </div>





          {/* CONTENT TYPE */}

          <div>

            <h2 className="text-lg font-semibold">

              Content Type

              <span
                className="ml-1"
                style={{
                  color: "#ef4444",
                }}
              >
                *
              </span>

            </h2>



            <p
              className="mt-1 text-sm"
              style={{
                color: "var(--muted)",
              }}
            >
              Select one or both.
            </p>



            <div className="mt-4 grid gap-4 md:grid-cols-2">

              {
                formats.map(
                  item => {

                    const selected =
                      (
                        workflow.formats || []
                      ).includes(item);



                    return (

                      <button

                        key={item}

                        type="button"

                        onClick={() =>
                          toggleFormat(item)
                        }

                        className="rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5"

                        style={{

                          background:
                            selected
                              ? "rgba(139,92,246,.12)"
                              : "var(--background)",

                          borderColor:
                            selected
                              ? "#8b5cf6"
                              : "var(--border)",

                          boxShadow:
                            selected
                              ? "0 0 0 2px rgba(139,92,246,.08)"
                              : "none",

                        }}

                      >

                        <div className="flex items-center justify-between gap-4">

                          <div>

                            <h3 className="text-base font-semibold">
                              {item}
                            </h3>


                            <p
                              className="mt-1 text-sm"
                              style={{
                                color:
                                  "var(--muted)",
                              }}
                            >

                              {
                                item === "Reel"
                                  ? "AI-generated video content with its own reel script."
                                  : "AI-generated visual/text content with its own post script."
                              }

                            </p>

                          </div>



                          <ToggleVisual
                            enabled={selected}
                          />

                        </div>

                      </button>

                    );

                  }
                )
              }

            </div>

          </div>





          {/* VISUAL STYLE */}

          <div>

            <h2 className="text-lg font-semibold">
              Visual Style
            </h2>



            <p
              className="mt-1 text-sm"
              style={{
                color: "var(--muted)",
              }}
            >
              Optional. Select one or more styles.
            </p>



            <div className="mt-4 flex flex-wrap gap-3">

              {
                styles.map(
                  item => {

                    const selected =
                      (
                        workflow.styles || []
                      ).includes(item);



                    return (

                      <button

                        key={item}

                        type="button"

                        onClick={() =>
                          toggleStyle(item)
                        }

                        className="rounded-full border px-4 py-2 text-sm transition"

                        style={{
                          background:
                            selected
                              ? "rgba(139,92,246,.15)"
                              : "var(--background)",

                          borderColor:
                            selected
                              ? "#8b5cf6"
                              : "var(--border)",
                        }}

                      >

                        {item}

                      </button>

                    );

                  }
                )
              }

            </div>

          </div>





          {/* BRAND VISIBILITY */}

          <div>

            <h2 className="text-lg font-semibold">
              Brand Visibility
            </h2>



            <p
              className="mt-1 text-sm"
              style={{
                color: "var(--muted)",
              }}
            >
              Optional. Postoll will only add these
              when you enable them.
            </p>



            <div className="mt-5 space-y-5">



              {/* LOGO */}

              <div
                className="rounded-2xl border p-5"
                style={{
                  borderColor:
                    workflow.showLogo
                      ? "#8b5cf6"
                      : "var(--border)",

                  background:
                    workflow.showLogo
                      ? "rgba(139,92,246,.06)"
                      : "var(--background)",
                }}
              >

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <p className="font-medium">
                      Add Logo
                    </p>

                    <p
                      className="mt-1 text-sm"
                      style={{
                        color:
                          "var(--muted)",
                      }}
                    >
                      Logo will be placed near the
                      top-right of generated content.
                    </p>

                  </div>



                  <ToggleSwitch

                    enabled={
                      workflow.showLogo
                    }

                    onChange={
                      handleLogoToggle
                    }

                  />

                </div>



                {
                  workflow.showLogo && (

                    <div className="mt-5">

                      <label className="text-sm font-medium">

                        Upload Logo

                        <span
                          className="ml-1"
                          style={{
                            color:
                              "#ef4444",
                          }}
                        >
                          *
                        </span>

                      </label>



                      <input

                        type="file"

                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"

                        onChange={
                          handleLogoUpload
                        }

                        className="mt-3 block w-full cursor-pointer rounded-xl border p-3 text-sm"

                        style={{
                          background:
                            "var(--background)",

                          borderColor:
                            workflow.logoFile
                              ? "#8b5cf6"
                              : "var(--border)",
                        }}

                      />



                      {
                        workflow.logoFile && (

                          <div
                            className="mt-3 rounded-xl border p-3 text-sm"
                            style={{
                              borderColor:
                                "#8b5cf6",

                              background:
                                "rgba(139,92,246,.08)",
                            }}
                          >

                            ✓ Logo selected:

                            <span className="ml-1 font-medium break-all">
                              {workflow.logoFile.name}
                            </span>

                          </div>

                        )
                      }

                    </div>

                  )
                }

              </div>





              {/* BRAND / PAGE NAME */}

              <div
                className="rounded-2xl border p-5"
                style={{
                  borderColor:
                    workflow.showPageName
                      ? "#8b5cf6"
                      : "var(--border)",

                  background:
                    workflow.showPageName
                      ? "rgba(139,92,246,.06)"
                      : "var(--background)",
                }}
              >

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <p className="font-medium">
                      Add Brand/Page Name
                    </p>

                    <p
                      className="mt-1 text-sm"
                      style={{
                        color:
                          "var(--muted)",
                      }}
                    >
                      The brand/page name will appear
                      near the bottom center of generated content.
                    </p>

                  </div>



                  <ToggleSwitch

                    enabled={
                      workflow.showPageName
                    }

                    onChange={
                      handleBrandNameToggle
                    }

                  />

                </div>



                {
                  workflow.showPageName && (

                    <div className="mt-5">

                      <label className="text-sm font-medium">

                        Brand/Page Name

                        <span
                          className="ml-1"
                          style={{
                            color:
                              "#ef4444",
                          }}
                        >
                          *
                        </span>

                      </label>



                      <input

                        type="text"

                        value={
                          workflow.brandName || ""
                        }

                        onChange={(e) =>
                          updateWorkflow({

                            brandName:
                              e.target.value,

                          })
                        }

                        placeholder="Example: Postoll"

                        className="mt-3 w-full rounded-xl border p-3 outline-none"

                        style={{
                          background:
                            "var(--background)",

                          borderColor:
                            workflow.brandName?.trim()
                              ? "#8b5cf6"
                              : "var(--border)",
                        }}

                      />

                    </div>

                  )
                }

              </div>

            </div>

          </div>





          {/* VIDEO OPTIONS */}

          <div>

            <h2 className="text-lg font-semibold">
              Video Options
            </h2>



            <div className="mt-5 space-y-5">



              {/* VOICE OVER */}

              <div
                className="rounded-2xl border p-5"
                style={{
                  borderColor:
                    workflow.voiceOver
                      ? "#8b5cf6"
                      : "var(--border)",

                  background:
                    workflow.voiceOver
                      ? "rgba(139,92,246,.06)"
                      : "var(--background)",
                }}
              >

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <p className="font-medium">
                      Voice Over
                    </p>

                    <p
                      className="mt-1 text-sm"
                      style={{
                        color:
                          "var(--muted)",
                      }}
                    >
                      Add an AI voice to generated reels.
                    </p>

                  </div>



                  <ToggleSwitch

                    enabled={
                      workflow.voiceOver
                    }

                    onChange={(enabled) =>
                      updateWorkflow({

                        voiceOver:
                          enabled,

                      })
                    }

                  />

                </div>



                {
                  workflow.voiceOver && (

                    <div className="mt-5">

                      <label className="text-sm font-medium">
                        Voice Tone
                      </label>



                      <select

                        value={
                          workflow.voiceStyle || ""
                        }

                        onChange={(e) =>
                          updateWorkflow({

                            voiceStyle:
                              e.target.value,

                          })
                        }

                        className="mt-3 w-full rounded-xl border p-3"

                        style={{
                          background:
                            "var(--background)",

                          borderColor:
                            "var(--border)",
                        }}

                      >

                        <option value="">
                          Select a voice tone
                        </option>

                        {
                          voiceTones.map(
                            tone => (

                              <option
                                key={tone}
                                value={tone}
                              >
                                {tone}
                              </option>

                            )
                          )
                        }

                      </select>

                    </div>

                  )
                }

              </div>





              {/* AI CHARACTER */}

              <div
                className="rounded-2xl border p-5"
                style={{
                  borderColor:
                    workflow.characterEnabled
                      ? "#8b5cf6"
                      : "var(--border)",

                  background:
                    workflow.characterEnabled
                      ? "rgba(139,92,246,.06)"
                      : "var(--background)",
                }}
              >

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <p className="font-medium">
                      AI Character
                    </p>

                    <p
                      className="mt-1 text-sm"
                      style={{
                        color:
                          "var(--muted)",
                      }}
                    >
                      Use AI characters that match your
                      selected target audiences.
                    </p>

                  </div>



                  <ToggleSwitch

                    enabled={
                      workflow.characterEnabled
                    }

                    onChange={(enabled) =>
                      updateWorkflow({

                        characterEnabled:
                          enabled,

                      })
                    }

                  />

                </div>



                {
                  workflow.characterEnabled && (

                    <div className="mt-5 space-y-5">



                      {/* GENDER */}

                      <div>

                        <label className="text-sm font-medium">
                          Character Gender
                        </label>



                        <div className="mt-3 flex flex-wrap gap-3">

                          {
                            characterGenders.map(
                              gender => (

                                <button

                                  key={gender}

                                  type="button"

                                  onClick={() =>
                                    updateWorkflow({

                                      characterGender:
                                        gender,

                                    })
                                  }

                                  className="rounded-xl border px-5 py-3"

                                  style={{
                                    background:
                                      workflow.characterGender === gender
                                        ? "rgba(139,92,246,.15)"
                                        : "var(--background)",

                                    borderColor:
                                      workflow.characterGender === gender
                                        ? "#8b5cf6"
                                        : "var(--border)",
                                  }}

                                >

                                  {gender}

                                </button>

                              )
                            )
                          }

                        </div>

                      </div>





                      {/* AGE */}

                      <div>

                        <label className="text-sm font-medium">
                          Character Age
                        </label>



                        <select

                          value={
                            workflow.characterAge || ""
                          }

                          onChange={(e) =>
                            updateWorkflow({

                              characterAge:
                                e.target.value,

                            })
                          }

                          className="mt-3 w-full rounded-xl border p-3"

                          style={{
                            background:
                              "var(--background)",

                            borderColor:
                              "var(--border)",
                          }}

                        >

                          <option value="">
                            Select age
                          </option>

                          {
                            characterAges.map(
                              age => (

                                <option
                                  key={age}
                                  value={age}
                                >
                                  {age}
                                </option>

                              )
                            )
                          }

                        </select>

                      </div>





                      {/* TARGET COUNTRIES */}

                      <div>

                        <label className="text-sm font-medium">
                          Target Audience Countries
                        </label>



                        <p
                          className="mt-1 text-sm"
                          style={{
                            color:
                              "var(--muted)",
                          }}
                        >
                          Select multiple countries. Postoll
                          can vary the character appearance
                          across different days.
                        </p>



                        <div className="mt-3 flex flex-wrap gap-2">

                          {
                            countries.map(
                              country => {

                                const selected =
                                  (
                                    workflow.targetCountries ||
                                    []
                                  ).includes(country);



                                return (

                                  <button

                                    key={country}

                                    type="button"

                                    onClick={() =>
                                      toggleCountry(
                                        country
                                      )
                                    }

                                    className="rounded-full border px-3 py-2 text-sm"

                                    style={{
                                      background:
                                        selected
                                          ? "rgba(139,92,246,.15)"
                                          : "var(--background)",

                                      borderColor:
                                        selected
                                          ? "#8b5cf6"
                                          : "var(--border)",
                                    }}

                                  >

                                    {country}

                                  </button>

                                );

                              }
                            )
                          }

                        </div>

                      </div>

                    </div>

                  )
                }

              </div>





              {/* BACKGROUND MUSIC */}

              <div
                className="rounded-2xl border p-5"
                style={{
                  borderColor:
                    workflow.backgroundMusic
                      ? "#8b5cf6"
                      : "var(--border)",

                  background:
                    workflow.backgroundMusic
                      ? "rgba(139,92,246,.06)"
                      : "var(--background)",
                }}
              >

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <p className="font-medium">
                      Background Music
                    </p>

                    <p
                      className="mt-1 text-sm"
                      style={{
                        color:
                          "var(--muted)",
                      }}
                    >
                      Add suitable background music
                      to generated reels.
                    </p>

                  </div>



                  <ToggleSwitch

                    enabled={
                      workflow.backgroundMusic
                    }

                    onChange={(enabled) =>
                      updateWorkflow({

                        backgroundMusic:
                          enabled,

                      })
                    }

                  />

                </div>

              </div>

            </div>

          </div>





          {/* LANGUAGE */}

          <div>

            <label className="text-sm font-medium">
              Content Language
            </label>



            <select

              value={
                workflow.videoLanguage || "English"
              }

              onChange={(e) =>
                updateWorkflow({

                  videoLanguage:
                    e.target.value,

                })
              }

              className="mt-3 w-full rounded-xl border p-3"

              style={{
                background:
                  "var(--background)",

                borderColor:
                  "var(--border)",
              }}

            >

              <option>
                English
              </option>

              <option>
                Hindi
              </option>

              <option>
                Tamil
              </option>

              <option>
                Telugu
              </option>

              <option>
                Malayalam
              </option>

              <option>
                Kannada
              </option>

              <option>
                Arabic
              </option>

              <option>
                Spanish
              </option>

              <option>
                French
              </option>

              <option>
                German
              </option>

              <option>
                Dutch
              </option>

            </select>

          </div>





          {/* BUTTONS */}

          <div
            className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"

            style={{
              borderColor:
                "var(--border)",
            }}
          >

            <button

              type="button"

              onClick={() =>
                router.back()
              }

              className="w-full rounded-xl border px-6 py-3 sm:w-auto"

            >
              ← Back
            </button>



            <button

              type="button"

              disabled={!canContinue}

              onClick={
                continueNext
              }

              className="w-full rounded-xl px-6 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"

              style={{
                background:
                  "var(--foreground)",

                color:
                  "var(--background)",
              }}

            >
              Continue →
            </button>

          </div>

        </div>

      </div>

    </AppShell>

  );

}





/*
|--------------------------------------------------------------------------
| PROFESSIONAL TOGGLE
|--------------------------------------------------------------------------
*/

function ToggleSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (
    enabled: boolean
  ) => void;
}) {

  return (

    <button

      type="button"

      role="switch"

      aria-checked={enabled}

      onClick={() =>
        onChange(!enabled)
      }

      className="relative h-8 w-14 shrink-0 rounded-full border transition-all duration-200"

      style={{
        background:
          enabled
            ? "#8b5cf6"
            : "rgba(127,127,127,.25)",

        borderColor:
          enabled
            ? "#8b5cf6"
            : "var(--border)",

        boxShadow:
          enabled
            ? "0 0 0 3px rgba(139,92,246,.12)"
            : "none",
      }}

    >

      <span

        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-200"

        style={{
          left:
            enabled
              ? "28px"
              : "4px",
        }}

      />

    </button>

  );

}





/*
|--------------------------------------------------------------------------
| CONTENT TYPE TOGGLE VISUAL
|--------------------------------------------------------------------------
*/

function ToggleVisual({
  enabled,
}: {
  enabled: boolean;
}) {

  return (

    <div

      className="relative h-7 w-12 shrink-0 rounded-full border"

      style={{
        background:
          enabled
            ? "#8b5cf6"
            : "rgba(127,127,127,.25)",

        borderColor:
          enabled
            ? "#8b5cf6"
            : "var(--border)",
      }}

    >

      <span

        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow"

        style={{
          left:
            enabled
              ? "24px"
              : "4px",
        }}

      />

    </div>

  );

}