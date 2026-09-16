"use client";

import { useRouter } from "next/navigation";
import AppShell from "../../../AppShell";
import { useWorkflow } from "../context";



const modes = [
  {
    id:"visual",
    title:"Visual Video",
    icon:"🎬",
    desc:"Create cinematic visuals with music and effects."
  },
  {
    id:"voice",
    title:"Voice Over Video",
    icon:"🎙",
    desc:"Generate script, AI voice, scenes and captions."
  },
  {
    id:"character",
    title:"AI Character Presenter",
    icon:"🧑",
    desc:"Create a presenter explaining your content."
  }
];



const languages = [
  "English",
  "Hindi",
  "Tamil",
  "Malayalam",
  "Arabic",
  "Spanish"
];



const voices = [
  "male",
  "female"
];


const styles = [
  "professional",
  "storytelling",
  "energetic",
  "emotional"
];


const characters = [
  "Business Person",
  "Influencer",
  "Teacher",
  "Expert",
  "Product Presenter"
];




export default function VideoSettingsPage(){


  const router = useRouter();


  const {
    workflow,
    updateWorkflow
  } = useWorkflow();




  return (

    <AppShell>


      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">



        <div className="mb-10">

          <p
            className="text-sm font-medium"
            style={{
              color:"#a78bfa"
            }}
          >
            ✦ Workflow Builder
          </p>


          <h1 className="mt-2 text-4xl font-bold">
            AI Video Settings
          </h1>


          <p
            className="mt-3 text-sm"
            style={{
              color:"var(--muted)"
            }}
          >
            Decide how Postoll should create videos.
          </p>

        </div>







        <div
          className="space-y-8 rounded-2xl border p-8"
          style={{
            background:"var(--card)",
            borderColor:"var(--border)"
          }}
        >





          <div>

            <h2 className="text-xl font-semibold">
              Video Creation Mode
            </h2>


            <div className="mt-5 grid gap-5 md:grid-cols-3">


              {
                modes.map(mode=>(


                  <button

                    key={mode.id}

                    onClick={()=>
                      updateWorkflow({

                        videoMode:
                          mode.id as any,


                        voiceOver:
                          mode.id==="voice" ||
                          mode.id==="character",


                        characterEnabled:
                          mode.id==="character"

                      })
                    }


                    className="rounded-2xl border p-5 text-left"


                    style={{

                      background:

                      workflow.videoMode===mode.id

                      ?"rgba(139,92,246,.12)"

                      :"var(--background)",


                      borderColor:

                      workflow.videoMode===mode.id

                      ?"#8b5cf6"

                      :"var(--border)"

                    }}

                  >

                    <div className="text-3xl">
                      {mode.icon}
                    </div>


                    <h3 className="mt-4 font-semibold">
                      {mode.title}
                    </h3>


                    <p
                      className="mt-2 text-sm"
                      style={{
                        color:"var(--muted)"
                      }}
                    >
                      {mode.desc}
                    </p>


                  </button>


                ))
              }


            </div>

          </div>









          {
            workflow.videoMode !== "visual" && (


              <div className="space-y-5">


                <h2 className="text-xl font-semibold">
                  Voice Settings
                </h2>



                <select

                  value={workflow.videoLanguage}

                  onChange={(e)=>
                    updateWorkflow({

                      videoLanguage:
                        e.target.value

                    })
                  }


                  className="w-full rounded-xl border p-3"

                >

                  {
                    languages.map(item=>(

                      <option key={item}>
                        {item}
                      </option>

                    ))
                  }

                </select>




                <div className="flex gap-3">


                  {
                    voices.map(item=>(

                      <button

                        key={item}

                        onClick={()=>
                          updateWorkflow({

                            voiceType:
                              item as any

                          })
                        }


                        className="rounded-xl border px-5 py-3"

                        style={{

                          background:

                          workflow.voiceType===item

                          ?"rgba(139,92,246,.12)"

                          :"transparent"

                        }}

                      >

                        {item}

                      </button>

                    ))
                  }


                </div>





                <div>

                  <p className="text-sm mb-3">
                    Voice Style
                  </p>


                  <div className="flex flex-wrap gap-3">


                  {
                    styles.map(item=>(

                      <button

                        key={item}

                        onClick={()=>
                          updateWorkflow({

                            voiceStyle:
                              item as any

                          })
                        }


                        className="rounded-full border px-4 py-2 text-sm"

                      >

                        {item}

                      </button>

                    ))
                  }


                  </div>


                </div>


              </div>


            )
          }










          {
            workflow.videoMode==="character" && (


              <div>


                <h2 className="text-xl font-semibold">
                  Character Type
                </h2>



                <div className="mt-4 flex flex-wrap gap-3">


                {
                  characters.map(item=>(

                    <button

                      key={item}

                      onClick={()=>
                        updateWorkflow({

                          characterType:item

                        })
                      }


                      className="rounded-xl border px-4 py-3"

                    >

                      {item}

                    </button>

                  ))
                }


                </div>


              </div>


            )
          }









          <div
            className="flex items-center justify-between rounded-xl border p-4"
            style={{
              borderColor:"var(--border)"
            }}
          >

            <div>

              <h3 className="font-medium">
                Background Music
              </h3>


              <p
                className="text-sm"
                style={{
                  color:"var(--muted)"
                }}
              >
                Add background music to videos.
              </p>

            </div>



            <button

              onClick={()=>
                updateWorkflow({

                  backgroundMusic:
                    !workflow.backgroundMusic

                })
              }


              className="rounded-full px-4 py-2 text-sm"


              style={{

                background:

                workflow.backgroundMusic

                ?"#8b5cf6"

                :"var(--border)",

                color:"#fff"

              }}

            >

              {
                workflow.backgroundMusic
                ?"ON"
                :"OFF"
              }

            </button>


          </div>









          <div className="flex justify-between border-t pt-6">


            <button

              onClick={()=>
                router.back()
              }

              className="rounded-xl border px-6 py-3"

            >
              ← Back
            </button>




            <button

              disabled={!workflow.videoMode}


              onClick={()=>
                router.push(
                  "/workflows/create/schedule"
                )
              }


              className="rounded-xl px-6 py-3 font-semibold disabled:opacity-40"


              style={{

                background:
                "var(--foreground)",

                color:
                "var(--background)"

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