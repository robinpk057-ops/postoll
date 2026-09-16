"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";


type Workflow = {
  id: string;
  name: string;
  mode: string;
  description: string | null;
  active: boolean;
  created_at: string;
};


export default function WorkflowsPage() {

  const supabase = createClient();


  const [workflows, setWorkflows] =
    useState<Workflow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");



  async function loadWorkflows() {

    try {

      setLoading(true);
      setError("");


      const {
        data:{
          user
        },
      } = await supabase.auth.getUser();



      if(!user){

        setError(
          "Please login first."
        );

        return;

      }



      const {
        data,
        error,
      } =
      await supabase
        .from("workflows")
        .select(
          `
          id,
          name,
          mode,
          description,
          active,
          created_at
          `
        )
        .eq(
          "user_id",
          user.id
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        );



      if(error){

        throw error;

      }



      setWorkflows(
        data || []
      );


    }
    catch(err){

      console.error(
        "Load workflow error:",
        err
      );


      setError(
        err instanceof Error
        ? err.message
        : "Unable to load workflows."
      );


    }
    finally{

      setLoading(false);

    }

  }



  useEffect(()=>{

    loadWorkflows();

  },[]);




  return (

    <AppShell>


      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">


        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">


          <div>

            <h1 className="text-4xl font-bold">
              Workflows
            </h1>


            <p
              className="mt-3 text-sm"
              style={{
                color:"var(--muted)"
              }}
            >
              Create automated content systems
              for your brands.
            </p>

          </div>



          <Link
            href="/workflows/create"
            className="rounded-xl px-5 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{
              background:"var(--foreground)",
              color:"var(--background)"
            }}
          >
            + Create Workflow
          </Link>


        </div>





        {error && (

          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">

            {error}

          </div>

        )}






        {loading && (

          <div className="grid gap-5 md:grid-cols-3">

            {[1,2,3].map(item=>(

              <div
                key={item}
                className="h-48 animate-pulse rounded-2xl border"
                style={{
                  background:"var(--card)",
                  borderColor:"var(--border)"
                }}
              />

            ))}

          </div>

        )}






        {!loading &&
        workflows.length===0 && (


          <div
            className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed text-center"
            style={{
              background:"var(--card)",
              borderColor:"var(--border)"
            }}
          >

            <div>


              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-2xl">
                ✦
              </div>



              <h2 className="mt-5 text-xl font-semibold">
                No workflows yet
              </h2>


              <p
                className="mt-2 max-w-md text-sm"
                style={{
                  color:"var(--muted)"
                }}
              >
                Create your first automated AI content workflow.
              </p>



              <Link
                href="/workflows/create"
                className="mt-6 inline-flex rounded-xl px-5 py-3 text-sm font-semibold"
                style={{
                  background:"var(--foreground)",
                  color:"var(--background)"
                }}
              >
                Create Workflow
              </Link>


            </div>


          </div>


        )}






        {!loading &&
        workflows.length>0 && (


          <div className="grid gap-6 md:grid-cols-3">


          {
            workflows.map(workflow=>(


              <div
                key={workflow.id}
                className="rounded-2xl border p-6 transition hover:-translate-y-1"
                style={{
                  background:"var(--card)",
                  borderColor:"var(--border)"
                }}
              >


                <div className="flex items-start justify-between">


                  <h2 className="text-xl font-semibold">
                    {workflow.name}
                  </h2>


                  <span
                    className="rounded-full px-3 py-1 text-xs"
                    style={{
                      background:
                      workflow.active
                      ? "rgba(34,197,94,.15)"
                      : "rgba(156,163,175,.15)",

                      color:
                      workflow.active
                      ? "#22c55e"
                      : "#9ca3af"
                    }}
                  >

                    {
                      workflow.active
                      ? "Active"
                      : "Paused"
                    }

                  </span>


                </div>



                <p
                  className="mt-4 text-sm"
                  style={{
                    color:"var(--muted)"
                  }}
                >

                  {
                    workflow.description ||
                    "AI generated content workflow"
                  }

                </p>



                <div className="mt-6 text-sm">

                  Mode:

                  <span className="ml-2 font-medium">

                    {workflow.mode}

                  </span>

                </div>



              </div>


            ))
          }


          </div>


        )}



      </div>


    </AppShell>

  );

}