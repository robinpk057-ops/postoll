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
  | AI workflow
  |--------------------------------------------------------------------------
  |
  | reel
  | post
  |
  | User Upload workflow
  |--------------------------------------------------------------------------
  |
  | content
  |
  */

  type: "reel" | "post" | "content";

  number: number;

  /*
  |--------------------------------------------------------------------------
  | TIME
  |--------------------------------------------------------------------------
  |
  | Always stored internally as HH:mm, 24-hour format.
  |
  | Examples:
  | 09:00
  | 14:30
  | 18:45
  |
  | Interpreted in the workflow's `timezone` field below.
  |
  */

  time: string;
};

export type Workflow = {
  /*
  |--------------------------------------------------------------------------
  | BASIC WORKFLOW
  |--------------------------------------------------------------------------
  */

  name: string;

  source: WorkflowSource;

  /*
  |--------------------------------------------------------------------------
  | CONTENT REQUIREMENTS
  |--------------------------------------------------------------------------
  */

  contentDescription: string;

  formats: string[];

  styles: string[];

  enablePost: boolean;

  enableReel: boolean;

  /*
  |--------------------------------------------------------------------------
  | USER UPLOAD CONTENT
  |--------------------------------------------------------------------------
  |
  | Used for:
  |
  | User Upload
  |      ↓
  | We Post
  |
  | The user chooses how many uploaded contents
  | should be published per day.
  |
  */

  contentPerDay: number;

  /*
  |--------------------------------------------------------------------------
  | GENERATED SCRIPTS
  |--------------------------------------------------------------------------
  */

  reelScript: string;

  postScript: string;

  /*
  |--------------------------------------------------------------------------
  | BRANDING
  |--------------------------------------------------------------------------
  */

  showLogo: boolean;

  logoFile: File | null;

  showPageName: boolean;

  brandName: string;

  textOverlay: boolean;

  /*
  |--------------------------------------------------------------------------
  | VIDEO OPTIONS
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | LANGUAGE
  |--------------------------------------------------------------------------
  */

  language: string;

  videoLanguage: string;

  /*
  |--------------------------------------------------------------------------
  | USER UPLOAD
  |--------------------------------------------------------------------------
  */

  uploadFiles: File[];

  uploadDescription: string;

  /*
  |--------------------------------------------------------------------------
  | ASSISTANCE
  |--------------------------------------------------------------------------
  */

  generateCaption: boolean;

  generateHashtags: boolean;

  generateDescription: boolean;

  addSubtitles: boolean;

  autoEdit: boolean;

  /*
  |--------------------------------------------------------------------------
  | SCHEDULE
  |--------------------------------------------------------------------------
  |
  | AI workflow:
  |
  |   reelsPerDay
  |   postsPerDay
  |
  | User Upload workflow:
  |
  |   contentPerDay
  |
  | scheduleSlots is shared by both workflow types.
  |
  */

  reelsPerDay: number;

  postsPerDay: number;

  scheduleSlots: ScheduleSlot[];

  scheduleTimes: string[];

  scheduleDays: string[];

  applySameTimeAllDays: boolean;

  scheduleDuration: string;

  customStartDate: string;

  customEndDate: string;

  /*
  |--------------------------------------------------------------------------
  | TIMEZONE
  |--------------------------------------------------------------------------
  |
  | IANA timezone name, e.g. "America/New_York", "Europe/London",
  | "Asia/Kolkata".
  |
  | All scheduleSlots' HH:mm times are interpreted in this
  | timezone. Auto-detected from the browser when a new workflow
  | starts (see WorkflowProvider below), but the user can
  | override it on the schedule step.
  |
  */

  timezone: string;

  /*
  |--------------------------------------------------------------------------
  | PLATFORMS
  |--------------------------------------------------------------------------
  */

  platforms: string[];

  /*
  |--------------------------------------------------------------------------
  | APPROVAL
  |--------------------------------------------------------------------------
  */

  requireApproval: boolean;

  approvalTime: string;
};

/*
|--------------------------------------------------------------------------
| DEFAULT WORKFLOW
|--------------------------------------------------------------------------
*/

const defaultWorkflow: Workflow = {
  /*
  |--------------------------------------------------------------------------
  | BASIC
  |--------------------------------------------------------------------------
  */

  name: "",

  source: "",

  /*
  |--------------------------------------------------------------------------
  | CONTENT
  |--------------------------------------------------------------------------
  */

  contentDescription: "",

  formats: [],

  styles: [],

  enablePost: false,

  enableReel: false,

  /*
  |--------------------------------------------------------------------------
  | USER UPLOAD CONTENT
  |--------------------------------------------------------------------------
  */

  contentPerDay: 1,

  /*
  |--------------------------------------------------------------------------
  | GENERATED SCRIPTS
  |--------------------------------------------------------------------------
  */

  reelScript: "",

  postScript: "",

  /*
  |--------------------------------------------------------------------------
  | BRANDING
  |--------------------------------------------------------------------------
  */

  showLogo: false,

  logoFile: null,

  showPageName: false,

  brandName: "",

  textOverlay: false,

  /*
  |--------------------------------------------------------------------------
  | VIDEO
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | LANGUAGE
  |--------------------------------------------------------------------------
  */

  language: "English",

  videoLanguage: "English",

  /*
  |--------------------------------------------------------------------------
  | UPLOAD
  |--------------------------------------------------------------------------
  */

  uploadFiles: [],

  uploadDescription: "",

  /*
  |--------------------------------------------------------------------------
  | ASSISTANCE
  |--------------------------------------------------------------------------
  */

  generateCaption: true,

  generateHashtags: true,

  generateDescription: true,

  addSubtitles: false,

  autoEdit: false,

  /*
  |--------------------------------------------------------------------------
  | SCHEDULE
  |--------------------------------------------------------------------------
  */

  reelsPerDay: 1,

  postsPerDay: 1,

  //contentPerDay: 1,

  scheduleSlots: [],

  scheduleTimes: [],

  scheduleDays: [],

  applySameTimeAllDays: false,

  scheduleDuration: "1_month",

  customStartDate: "",

  customEndDate: "",

  /*
  |--------------------------------------------------------------------------
  | TIMEZONE
  |--------------------------------------------------------------------------
  |
  | Left empty here — WorkflowProvider fills this in client-side
  | via useEffect, so it reflects the actual visitor's browser,
  | not whatever environment first evaluates this module (which,
  | during server-side rendering, would be the server's own
  | timezone, not the user's).
  |
  */

  timezone: "",

  /*
  |--------------------------------------------------------------------------
  | PLATFORMS
  |--------------------------------------------------------------------------
  */

  platforms: [],

  /*
  |--------------------------------------------------------------------------
  | APPROVAL
  |--------------------------------------------------------------------------
  */

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

  updateWorkflow: (
    updates: Partial<Workflow>
  ) => void;

  resetWorkflow: () => void;
};

/*
|--------------------------------------------------------------------------
| CONTEXT
|--------------------------------------------------------------------------
*/

const WorkflowContext =
  createContext<WorkflowContextType | undefined>(
    undefined
  );

/*
|--------------------------------------------------------------------------
| PROVIDER
|--------------------------------------------------------------------------
*/

export function WorkflowProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [workflow, setWorkflow] =
    useState<Workflow>(defaultWorkflow);

  /*
  |--------------------------------------------------------------------------
  | UPDATE WORKFLOW
  |--------------------------------------------------------------------------
  */

  function updateWorkflow(
    updates: Partial<Workflow>
  ) {
    setWorkflow((current) => ({
      ...current,
      ...updates,
    }));
  }

  /*
  |--------------------------------------------------------------------------
  | RESET WORKFLOW
  |--------------------------------------------------------------------------
  */

  function resetWorkflow() {
    setWorkflow({
      ...defaultWorkflow,

      /*
      |--------------------------------------------------------------------------
      | Fresh arrays
      |--------------------------------------------------------------------------
      */

      formats: [],

      styles: [],

      targetCountries: [],

      uploadFiles: [],

      scheduleSlots: [],

      scheduleTimes: [],

      scheduleDays: [],

      platforms: [],

      logoFile: null,

      /*
      |--------------------------------------------------------------------------
      | Reset counters
      |--------------------------------------------------------------------------
      */

      reelsPerDay: 1,

      postsPerDay: 1,

      contentPerDay: 1,

      /*
      |--------------------------------------------------------------------------
      | Timezone is reset to "" so the effect below re-detects it
      | fresh for the new workflow (handles the rare case of a
      | user switching devices/locations between workflows).
      |--------------------------------------------------------------------------
      */

      timezone: "",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | AUTO-DETECT BROWSER TIMEZONE
  |--------------------------------------------------------------------------
  |
  | Runs client-side only (useEffect never runs during server-side
  | rendering), so this correctly reads the visiting user's own
  | timezone rather than the server's.
  |
  | Re-runs whenever workflow.timezone becomes empty — covers both
  | the initial mount and any future resetWorkflow() call.
  |
  */

  useEffect(() => {
    if (workflow.timezone) {
      return;
    }

    try {
      const detected =
        Intl.DateTimeFormat().resolvedOptions().timeZone;

      if (detected) {
        updateWorkflow({ timezone: detected });
      }
    } catch (err) {
      console.error(
        "Unable to auto-detect timezone:",
        err
      );
    }

    // Only re-run when timezone becomes empty, not on every
    // workflow change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.timezone]);

  /*
  |--------------------------------------------------------------------------
  | MEMO
  |--------------------------------------------------------------------------
  */

  const value = useMemo(
    () => ({
      workflow,
      updateWorkflow,
      resetWorkflow,
    }),
    [workflow]
  );

  /*
  |--------------------------------------------------------------------------
  | PROVIDER
  |--------------------------------------------------------------------------
  */

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
  const context =
    useContext(WorkflowContext);

  if (!context) {
    throw new Error(
      "useWorkflow must be used inside WorkflowProvider"
    );
  }

  return context;
}