"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

export type WorkflowSource =
  | "ai_generated"
  | "user_uploaded"
  | "";

export type ScheduleSlot = {
  /*
  |--------------------------------------------------------------------------
  | AI workflow: "reel" | "post"
  | User Upload workflow: "content"
  |--------------------------------------------------------------------------
  */
  type: "reel" | "post" | "content";
  number: number;

  /*
  |--------------------------------------------------------------------------
  | Always stored as HH:mm (24-hour).
  | Interpreted in the workflow's `timezone` field.
  |--------------------------------------------------------------------------
  */
  time: string;
};

export type Workflow = {
  /* BASIC */
  name: string;
  source: WorkflowSource;

  /* CONTENT REQUIREMENTS */
  contentDescription: string;
  formats: string[];
  styles: string[];
  enablePost: boolean;
  enableReel: boolean;

  /* USER UPLOAD CONTENT */
  contentPerDay: number;

  /* GENERATED SCRIPTS */
  reelScript: string;
  postScript: string;

  /* BRANDING */
  showLogo: boolean;
  logoFile: File | null;
  showPageName: boolean;
  brandName: string;
  textOverlay: boolean;

  /* VIDEO OPTIONS */
  videoMode: string;
  voiceOver: boolean;
  voiceType: string;
  voiceStyle: string;
  characterEnabled: boolean;
  characterType: string;
  characterGender: string;
  characterAge: string;
  targetCountries: string[];
  backgroundMusic: boolean;

  /* LANGUAGE */
  language: string;
  videoLanguage: string;

  /* USER UPLOAD */
  uploadFiles: File[];
  uploadDescription: string;

  /* ASSISTANCE */
  generateCaption: boolean;
  generateHashtags: boolean;
  generateDescription: boolean;
  addSubtitles: boolean;
  autoEdit: boolean;

  /* SCHEDULE */
  reelsPerDay: number;
  postsPerDay: number;
  scheduleSlots: ScheduleSlot[];
  scheduleTimes: string[];
  scheduleDays: string[];
  applySameTimeAllDays: boolean;
  scheduleDuration: string;
  customStartDate: string;
  customEndDate: string;

  /* TIMEZONE (IANA) */
  timezone: string;

  /*
  |--------------------------------------------------------------------------
  | PLATFORMS + SELECTED ACCOUNTS
  | platforms        = which platforms are enabled
  | selectedAccounts = concrete account rows the user picked
  |                    (written to workflow_accounts on activate)
  |--------------------------------------------------------------------------
  */
  platforms: string[];
  selectedAccounts: {
    platform: string;           // "instagram" | "facebook" | ...
    accountId: string;          // accounts.id (UUID)
    accountName: string;        // display name / username
    platformAccountId: string;  // platform’s own ID (ig-user-id etc.)
  }[];

  /* APPROVAL */
  requireApproval: boolean;
  approvalTime: string;
};

/*
|--------------------------------------------------------------------------
| DEFAULT WORKFLOW
|--------------------------------------------------------------------------
*/

const defaultWorkflow: Workflow = {
  name: "",
  source: "",

  contentDescription: "",
  formats: [],
  styles: [],
  enablePost: false,
  enableReel: false,

  contentPerDay: 1,

  reelScript: "",
  postScript: "",

  showLogo: false,
  logoFile: null,
  showPageName: false,
  brandName: "",
  textOverlay: false,

  videoMode: "",
  voiceOver: false,
  voiceType: "",
  voiceStyle: "",
  characterEnabled: false,
  characterType: "",
  characterGender: "",
  characterAge: "",
  targetCountries: [],
  backgroundMusic: true,

  language: "English",
  videoLanguage: "English",

  uploadFiles: [],
  uploadDescription: "",

  generateCaption: true,
  generateHashtags: true,
  generateDescription: true,
  addSubtitles: false,
  autoEdit: false,

  reelsPerDay: 1,
  postsPerDay: 1,
  scheduleSlots: [],
  scheduleTimes: [],
  scheduleDays: [],
  applySameTimeAllDays: false,
  scheduleDuration: "1_month",
  customStartDate: "",
  customEndDate: "",

  timezone: "",

  platforms: [],
  selectedAccounts: [],

  requireApproval: false,
  approvalTime: "",
};

/*
|--------------------------------------------------------------------------
| CONTEXT TYPE
|--------------------------------------------------------------------------
*/

type WorkflowContextType = {
  workflow: Workflow;
  updateWorkflow: (updates: Partial<Workflow>) => void;
  resetWorkflow: () => void;
};

const WorkflowContext = createContext<WorkflowContextType | undefined>(
  undefined
);

/*
|--------------------------------------------------------------------------
| PROVIDER
|--------------------------------------------------------------------------
*/

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [workflow, setWorkflow] = useState<Workflow>(defaultWorkflow);

  function updateWorkflow(updates: Partial<Workflow>) {
    setWorkflow((current) => ({
      ...current,
      ...updates,
    }));
  }

  function resetWorkflow() {
    setWorkflow({
      ...defaultWorkflow,

      // fresh arrays / objects
      formats: [],
      styles: [],
      targetCountries: [],
      uploadFiles: [],
      scheduleSlots: [],
      scheduleTimes: [],
      scheduleDays: [],
      platforms: [],
      selectedAccounts: [],
      logoFile: null,

      // reset counters
      reelsPerDay: 1,
      postsPerDay: 1,
      contentPerDay: 1,

      // force re-detection of timezone
      timezone: "",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | AUTO-DETECT BROWSER TIMEZONE
  | Runs client-side only.
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    if (workflow.timezone) return;

    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) {
        updateWorkflow({ timezone: detected });
      }
    } catch (err) {
      console.error("Unable to auto-detect timezone:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.timezone]);

  const value = useMemo(
    () => ({
      workflow,
      updateWorkflow,
      resetWorkflow,
    }),
    [workflow]
  );

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

/*
|--------------------------------------------------------------------------
| HOOK
|--------------------------------------------------------------------------
*/

export function useWorkflow() {
  const context = useContext(WorkflowContext);

  if (!context) {
    throw new Error("useWorkflow must be used inside WorkflowProvider");
  }

  return context;
}