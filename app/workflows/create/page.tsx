"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkflow } from "./context";

export default function CreateWorkflowEntryPage() {
  const router = useRouter();
  const { resetWorkflow, updateWorkflow } = useWorkflow();

  useEffect(() => {
    resetWorkflow();
    updateWorkflow({ source: "user_uploaded" });
    router.replace("/workflows/create/upload");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
