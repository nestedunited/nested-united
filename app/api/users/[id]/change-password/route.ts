import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser || !isSuperAdmin(currentUser)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { new_password } = body;

    if (!new_password || new_password.length < 6) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
        { status: 400 }
      );
    }

    // Create admin client using service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Update password using Supabase Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      { password: new_password }
    );

    if (authError) {
      console.error("Error updating password:", authError);
      return NextResponse.json(
        { error: authError.message || "فشل تغيير كلمة المرور" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (error: any) {
    console.error("Error in change password:", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ أثناء تغيير كلمة المرور" },
      { status: 500 }
    );
  }
}

