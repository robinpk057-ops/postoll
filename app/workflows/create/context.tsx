"use client";

import {
  createContext,
  useContext,
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
  | Always stored internally as HH:mm.
  |
  | Examples:
  | 09:00
  | 14:30
  | 18:45
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
    });
  }

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