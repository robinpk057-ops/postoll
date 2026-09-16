"use client";

import { useRouter } from "next/navigation";
import AppShell from "../../AppShell";
import { useWorkflow } from "./context";


export default function CreateWorkflowPage() {

  return (

    <CreateWorkflowContent />

  );

}





function CreateWorkflowContent() {


  const router = useRouter();


  const {
    workflow,
    updateWorkflow,
  } = useWorkflow();





  function continueNext(){


    if(!workflow.source)
      return;



    if(!workflow.name.trim())
      return;



    if(
      workflow.source === "ai_generated"
    ){

      router.push(
        "/workflows/create/details"
      );


    }


    else if(
      workflow.source === "user_uploaded"
    ){

      router.push(
        "/workflows/create/upload"
      );

    }


  }







  return (

    <AppShell>


      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">



        {/* HEADER */}

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
            Create Workflow
          </h1>



          <p
            className="mt-3 max-w-2xl text-sm leading-6"
            style={{
              color:"var(--muted)"
            }}
          >
            Tell Postoll how you want your content
            to be created and published automatically.
          </p>


        </div>









        {/* STEP INDICATOR */}


        <div className="mb-10 flex items-center gap-3">


          <div
            className="rounded-full px-4 py-2 text-sm font-medium"
            style={{
              background:"#8b5cf6",
              color:"#fff"
            }}
          >
            1
          </div>



          <span className="text-sm">
            Content Source
          </span>




          <div
            className="h-px flex-1"
            style={{
              background:"var(--border)"
            }}
          />




          <div
            className="rounded-full border px-4 py-2 text-sm"
            style={{
              borderColor:"var(--border)",
              color:"var(--muted)"
            }}
          >
            2
          </div>




          <span
            className="hidden text-sm md:block"
            style={{
              color:"var(--muted)"
            }}
          >
            Details
          </span>



        </div>









        <div
          className="rounded-2xl border p-8"
          style={{
            background:"var(--card)",
            borderColor:"var(--border)"
          }}
        >






          {/* WORKFLOW NAME */}


          <div className="mb-8">


            <label className="text-sm font-medium">

              Workflow Name

            </label>



            <input


              value={
                workflow.name
              }


              onChange={(e)=>
                updateWorkflow({

                  name:e.target.value

                })
              }



              placeholder="Example: Luxury Watch Instagram"



              className="mt-3 w-full rounded-xl border p-4 outline-none"



              style={{

                background:
                "var(--background)",


                borderColor:
                "var(--border)"

              }}


            />


          </div>









          <h2 className="text-2xl font-semibold">

            How should Postoll handle your content?

          </h2>




          <p
            className="mt-2 text-sm"
            style={{
              color:"var(--muted)"
            }}
          >
            Choose whether Postoll creates content
            or you provide your own content.
          </p>









          <div className="mt-8 grid gap-6 md:grid-cols-2">









            {/* AI GENERATED */}


            <button


              type="button"



              onClick={()=>

                updateWorkflow({

                  source:"ai_generated"

                })

              }



              className="rounded-2xl border p-6 text-left transition hover:-translate-y-1"



              style={{


                background:

                workflow.source === "ai_generated"

                ?

                "rgba(139,92,246,.12)"

                :

                "var(--background)",




                borderColor:

                workflow.source === "ai_generated"

                ?

                "#8b5cf6"

                :

                "var(--border)"

              }}


            >



              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-2xl">

                ✨

              </div>




              <h3 className="mt-5 text-xl font-semibold">

                Postoll Creates Content

              </h3>




              <p
                className="mt-3 text-sm leading-6"
                style={{
                  color:"var(--muted)"
                }}
              >

                Postoll creates posts, reels,
                captions and hashtags automatically.

              </p>




              <div className="mt-5 flex flex-wrap gap-2">


                {[
                  "AI Images",
                  "AI Reels",
                  "Captions",
                  "Hashtags"

                ].map(item=>(


                  <span

                    key={item}

                    className="rounded-full border px-3 py-1 text-xs"

                    style={{
                      borderColor:"var(--border)"
                    }}

                  >

                    {item}

                  </span>


                ))}


              </div>


            </button>












            {/* UPLOAD */}


            <button


              type="button"



              onClick={()=>

                updateWorkflow({

                  source:"user_uploaded"

                })

              }




              className="rounded-2xl border p-6 text-left transition hover:-translate-y-1"




              style={{


                background:

                workflow.source === "user_uploaded"

                ?

                "rgba(139,92,246,.12)"

                :

                "var(--background)",




                borderColor:

                workflow.source === "user_uploaded"

                ?

                "#8b5cf6"

                :

                "var(--border)"

              }}



            >



              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-2xl">

                📤

              </div>




              <h3 className="mt-5 text-xl font-semibold">

                I Upload Content

              </h3>




              <p
                className="mt-3 text-sm leading-6"
                style={{
                  color:"var(--muted)"
                }}
              >

                Upload videos or images.
                Postoll creates captions,
                hashtags and publishes.

              </p>





              <div className="mt-5 flex flex-wrap gap-2">


                {[
                  "Upload Video",
                  "Upload Image",
                  "AI Caption",
                  "Auto Publish"

                ].map(item=>(


                  <span

                    key={item}

                    className="rounded-full border px-3 py-1 text-xs"

                    style={{
                      borderColor:"var(--border)"
                    }}

                  >

                    {item}

                  </span>


                ))}


              </div>


            </button>








          </div>









          {/* FOOTER */}


          <div
            className="mt-10 flex justify-end border-t pt-6"
            style={{
              borderColor:"var(--border)"
            }}
          >




            <button


              disabled={
                !workflow.source ||
                !workflow.name.trim()
              }



              onClick={continueNext}



              className="rounded-xl px-6 py-3 text-sm font-semibold disabled:opacity-40"



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