import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Please log in first.",
        },
        {
          status: 401,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | IMPORTANT
    |--------------------------------------------------------------------------
    | Never select access_token here.
    |
    | The browser does not need the token.
    */

    const {
      data: accounts,
      error,
    } =
      await supabase
        .from("accounts")
        .select(
          "id, platform, account_name, account_id, connected"
        )
        .eq(
          "user_id",
          user.id
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (error) {
      console.error(
        "Accounts fetch error:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      accounts:
        accounts || [],
    });
  } catch (error) {
    console.error(
      "Accounts GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load accounts.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| DISCONNECT ACCOUNT
|--------------------------------------------------------------------------
*/

export async function DELETE(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Please log in first.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const accountId =
      body?.id;

    if (!accountId) {
      return NextResponse.json(
        {
          error:
            "Account ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      error,
    } =
      await supabase
        .from("accounts")
        .delete()
        .eq(
          "id",
          accountId
        )
        .eq(
          "user_id",
          user.id
        );

    if (error) {
      console.error(
        "Account disconnect error:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Accounts DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to disconnect account.",
      },
      {
        status: 500,
      }
    );
  }
}